//#region Interfaces
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

import { supabaseServerClient } from '@/lib/supabase/server';

import type { Database, Tables } from '@/types/db_types';

type EmailStatus = 'sent' | 'delivered' | 'bounced';
type TimeRange = '24h' | '7d' | '30d';

interface EmailMetric {
  sender_email_used: string | null;
  email_status: string | null;
  count: number;
}

interface MetricTotals {
  sent: number;
  delivered: number;
  bounced: number;
}

interface SenderMetrics extends MetricTotals {
  email: string;
  name: string;
  lastUsed: string;
  status: string;
  warmupPhase: string;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface HttpError extends Error {
  status?: number;
}

export interface CampaignAttempt {
  campaign_id: string;
  sender_id: string;
  sender_email: string;
  status: 'queued' | 'sent' | 'failed';
  contact_email: string;
  error?: string;
}

export const STATUS_KEY = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed'
} as const;

export interface EmailLogEntry extends Tables['email_logs'] {}
//#endregion
//#region Utilities
/**
 * Gets date range for metrics query
 * @param daysBack Number of days to look back
 * @returns Object with start/end dates
 */
const getDateRange = (daysBack: number): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);
  return { start, end };
};

/**
 * Configures Supabase client with service role
 * @returns Authenticated Supabase client
 */
const configureSupabaseClient = <T>(): SupabaseClient<T> => {
  return createClient<T>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

/**
 * Safely serializes data for API responses
 * @param data Data to serialize
 * @returns Serialized JSON string
 */
const serialize = <T>(data: T): string => {
  return JSON.stringify(data);
};
//#endregion
//#region API Handler
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ 
        success: false, 
        error: `Method ${req.method} Not Allowed` 
      });
    }

    const { timeRange = '7d' } = req.query as { timeRange?: TimeRange };
    const dateRange = getDateRange(timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30);
    const supabase = configureSupabaseClient<Database>();

    const client = supabaseServerClient;
      
    const supabaseClient = client as unknown as {
      from: (table: string) => {
        select: (fields: string) => {
          gte: (field: string, value: string) => {
            group: (fields: string) => Promise<{ data: EmailMetric[] | null; error: any; }>;
          };
        };
        update: (data: any) => {
          eq: (field: string, value: string) => Promise<{ data: any[] | null; error: any; }>;
        };
      };
      rpc: (fn: string, params: any) => Promise<{ data: any[] | null; error: any; }>;
    };
     
    const [
      { data: senderData, error: senderError },
      { data: timeSeriesData, error: timeSeriesError }
    ] = await Promise.all([
      supabaseClient
        .from<Database['public']['Tables']['email_log']['Row']>('email_log')
        .select('sender_email_used, email_status, count(*)')
        .gte('created_at', dateRange.start.toISOString())
        .group('sender_email_used,email_status'),
       
      supabaseClient.rpc('get_email_metrics_time_series', {
        start_date: dateRange.start.toISOString(),
        end_date: dateRange.end.toISOString(),
        interval_days: timeRange === '24h' ? 1 : timeRange === '7d' ? 1 : 7
      })
    ]);

    if (senderError) {
      const message = senderError instanceof Error 
        ? senderError.message 
        : 'Unknown error fetching sender metrics';
      console.error('Supabase error:', message);
      return res.status(500).json({ success: false, error: message });
    }

    if (timeSeriesError) {
      const message = timeSeriesError instanceof Error 
        ? timeSeriesError.message 
        : 'Unknown time series error';
      console.warn('Time series data not available:', message);
    }

    const metrics = senderData || [];
    const senderId = req.query.senderId as string;
    if (!senderId) {
      return res.status(400).json({ success: false, error: 'Missing sender ID' });
    }
    const bySender = processSenderMetrics(metrics as unknown as EmailMetric[]) ?? [];
    if (!bySender.length) {
      throw new EmailMetricsError(`Sender metrics not found for sender ID: ${senderId}`);
    }
    const totals = calculateTotals(metrics as unknown as EmailMetric[]);

    const senderMap = new Map<string, SenderMetrics>();
// region update sender metrics
    try {
      await supabaseClient
        .from('senders')
        .update({ 
          metrics: JSON.stringify([...senderMap.values()])
        })
        .eq('id', senderId);
    } catch (updateError) {
      console.error('Sender update error:', updateError);
    }

    return res.status(200).json({
      success: true,
      data: {
        totals,
        timeSeries: timeSeriesData || []
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error 
      ? error.message
      : 'Failed to process email metrics';
    console.error('Email metrics error:', message);
    return res.status(500).json({
      success: false,
      error: message
    });
  }
}
//#endregion
//#region Email Log Updates
export const updateEmailLogStatus = async (
  logId: string,
  status: 'SENT' | 'DELIVERED' | 'BOUNCED',
  timestamp: string
) => {
  const supabase = configureSupabaseClient<Database>();

  const { error } = await supabase
    .from<Database['public']['Tables']['email_log']['Update']>('email_log')
    .update({
      status,
      updated_at: timestamp
    })
    .eq('message_id', logId);

  if (error) {
    throw new EmailMetricsError(
      `Failed to update email log status: ${error.message}`,
      500
    );
  }
};
//#endregion
//#region Email Metrics Service
const supabaseEmailMetrics = configureSupabaseClient<Database>();

export async function logCampaignAttempt(attempt: CampaignAttempt) {
  const { data, error } = await supabaseEmailMetrics
    .from<Database['public']['Tables']['campaign_attempt']['Row'], Database['public']['Tables']['campaign_attempt']['Insert']>('campaign_attempt')
    .insert(attempt)
    .select();

  if (error) {
    console.error('Failed to log campaign attempt:', error);
    return null;
  }

  return data[0];
}
//#endregion
//#region Helper Functions
const isValidEmailStatus = (status: string | null): status is EmailStatus => {
  return status !== null && ['sent', 'delivered', 'bounced'].includes(status);
};

const calculateTotals = (metrics: EmailMetric[]): MetricTotals => {
  const totals: MetricTotals = { 
    sent: 0, 
    delivered: 0, 
    bounced: 0 
  };

  for (const metric of metrics) {
    const emailStatus = metric.email_status ?? 'unknown';
    const status = emailStatus.toLowerCase();
    const count = metric.count || 0;
    
    if (status && isValidEmailStatus(status)) {
      totals[status] = (totals[status] || 0) + count;
    }
    totals.sent += count;
  }

  return totals;
};

const processSenderMetrics = (metrics: EmailMetric[]): SenderMetrics[] => {
  const senderMap = new Map<string, SenderMetrics>();

  for (const metric of metrics) {
    const email = metric.sender_email_used ?? 'unknown';
    const emailStatus = metric.email_status ?? 'unknown';
    const status = emailStatus.toLowerCase();
    const count = metric.count || 0;

    let sender = senderMap.get(email) ?? {
      email: metric.sender_email_used ?? 'unknown',
      name: 'Unknown Sender',
      sent: 0,
      delivered: 0,
      bounced: 0,
      lastUsed: new Date().toISOString(),
      status: 'active',
      warmupPhase: ''
    };
    if (!sender) {
      sender = {
        email: metric.sender_email_used ?? 'unknown',
        name: 'Unknown Sender',
        sent: 0,
        delivered: 0,
        bounced: 0,
        lastUsed: new Date().toISOString(),
        status: 'active',
        warmupPhase: ''
      };
      senderMap.set(email, sender);
    }

    if (sender) {
      if (status && isValidEmailStatus(status)) {
        sender[status] = (sender[status] || 0) + count;
      }
      sender.sent += count;
    }
  }

  return Array.from(senderMap.values())
    .map(sender => {
      if (!sender) return null;
      const { sent, delivered, bounced } = sender;
      const totalSent = sent;
      const deliveredCount = delivered;
      const bouncedCount = bounced;

      const metrics: SenderMetrics = {
        email: sender.email,
        name: sender.name,
        sent: totalSent,
        delivered: deliveredCount,
        bounced: bouncedCount,
        lastUsed: new Date().toISOString(),
        status: 'active',
        warmupPhase: ''
      };

      return metrics;
    })
    .filter(Boolean) as SenderMetrics[];
};
//#endregion
//#region Error Handling
class EmailMetricsError extends Error {
  status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'EmailMetricsError';
    this.status = status;
  }
}