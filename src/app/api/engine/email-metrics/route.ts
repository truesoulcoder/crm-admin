//#region Interfaces
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

import { supabaseServerClient } from '@/lib/supabase/server';

import type { Database } from '@/db_types';

type EmailStatus = 'sent' | 'delivered' | 'bounced';
type TimeRange = '24h' | '7d' | '30d';

type EmailMetric = {
  sender_email_used: string | null;
  email_status: string | null;
  count: number;
}

type MetricTotals = {
  sent: number;
  delivered: number;
  bounced: number;
}

type SenderMetrics = MetricTotals & {
  email: string;
  name: string;
  lastUsed: string;
  status: string;
  warmupPhase: string;
}

type ApiResponse = {
  success: boolean;
  data?: any;
  error?: string;
}

type HttpError = Error & {
  status?: number;
}

export type Campaignjob = {
  campaign_id: string;
  sender_id: string;
  sender_email: string;
  status: 'queued' | 'sent' | 'failed';
  contact_email: string;
  error?: string;
  email_address: string;
  lead_id: string;
}

export const STATUS_KEY = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed'
} as const;

export type EmailLogEntry = Database['public']['Tables']['eli5_email_log']['Row'];

export type EmailLogStatusUpdate = Database['public']['Tables']['eli5_email_log']['Update'] & {
  newStatus: EmailStatus;
  failureReason?: string;
}

export type EmailSendStatus = 'SENT' | 'DELIVERED' | 'BOUNCED';
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
const configureSupabaseClient = (): SupabaseClient<Database> => {
  return createClient<Database>(
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
export async function GET(request: NextRequest) {
  // Initialize variables at function scope
  let metrics: EmailMetric[] = [];
  let timeSeries: any = null;
  let supabaseClient;

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') as TimeRange || '7d';
    const senderId = searchParams.get('senderId');
    
    const daysBack = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
    const dateRange = getDateRange(daysBack);
    
    if (!senderId) {
      return NextResponse.json(
        { success: false, error: 'Missing sender ID' }, 
        { status: 400 }
      );
    }

    // Configure Supabase client with proper type definitions
    type SupabaseQueryBuilder = {
      from: (table: string) => {
        select: (fields: string) => {
          gte: (field: string, value: string) => {
            group: (fields: string) => Promise<{ data: EmailMetric[] | null; error: any }>;
          };
          eq: (field: string, value: string) => {
            single: () => Promise<{ data: any | null; error: any }>;
          };
        };
        update: (data: any) => {
          eq: (field: string, value: string) => Promise<{ data: any[] | null; error: any }>;
        };
      };
      rpc: (fn: string, params: any) => Promise<{ data: any[] | null; error: any }>;
    };

    supabaseClient = supabaseServerClient as unknown as SupabaseQueryBuilder;

    // Fetch data in parallel
    const [metricsResponse, timeSeriesResponse] = await Promise.all([
      supabaseClient
        .from('email_metrics')
        .select('sender_email_used, email_status, count(*)')
        .gte('created_at', dateRange.start.toISOString())
        .group('sender_email_used,email_status'),
        
      supabaseClient.rpc('get_email_metrics_time_series', {
        start_date: dateRange.start.toISOString(),
        end_date: dateRange.end.toISOString(),
        interval_days: daysBack === 1 ? 1 : daysBack === 7 ? 1 : 7
      })
    ]);

    if (metricsResponse.error) {
      throw new Error(`Error fetching metrics: ${metricsResponse.error.message}`);
    }
    if (timeSeriesResponse.error) {
      throw new Error(`Error fetching time series: ${timeSeriesResponse.error.message}`);
    }

    metrics = metricsResponse.data || [];
    timeSeries = timeSeriesResponse.data || [];

    // Process metrics and calculate totals
    const bySender = processSenderMetrics(metrics);
    if (!bySender || !bySender.length) {
      throw new EmailMetricsError(`Sender metrics not found for sender ID: ${senderId}`);
    }
    
    const totals = calculateTotals(metrics);
    const senderMap = new Map<string, SenderMetrics>();

    try {
      await supabaseClient
        .from('senders')
        .update({ 
          metrics: JSON.stringify([...senderMap.values()])
        })
        .eq('id', senderId);
    } catch (updateError) {
      console.error('Sender update error:', updateError);
      // Continue execution even if update fails
    }

    // Return the successful response
    return NextResponse.json({
      success: true,
      data: {
        metrics: bySender,
        totals,
        timeSeries
      }
    });

  } catch (error) {
    console.error('Error in email metrics API:', error);
    const status = error instanceof EmailMetricsError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

// Export other HTTP methods as needed
export const dynamic = 'force-dynamic';
//#endregion
//#region Email Metrics
export const updateEmailLogStatus = async (
  logId: string,
  status: 'SENT' | 'DELIVERED' | 'BOUNCED',
  timestamp: string
) => {
  const supabase = configureSupabaseClient();

  const { error: updateError } = await supabase
  .from('eli5_email_log')
  .update({ 
    email_status: status, 
    updated_at: timestamp 
  })
  .eq('message_id', logId);

  if (updateError) {
    throw new EmailMetricsError(
      `Failed to update email log status: ${updateError.message}`,
      500
    );
  }
};
//#endregion
//#region Job Logging
const supabaseEmailMetrics = configureSupabaseClient();

export async function logCampaignjob(job: Campaignjob) {
  const { data, error } = await supabaseEmailMetrics
    .from('campaign_jobs')
    .insert(job)
    .select();

  if (error) {
    console.error('Failed to log campaign job:', error);
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
//#endregion