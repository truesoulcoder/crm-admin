import { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseClient } from './eli5-engine/_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = getSupabaseClient();
  const { timeRange = '7d' } = req.query;

  try {
    // Calculate date range based on timeRange parameter
    let dateRange = new Date();
    switch (timeRange) {
      case '24h':
        dateRange.setDate(dateRange.getDate() - 1);
        break;
      case '7d':
        dateRange.setDate(dateRange.getDate() - 7);
        break;
      case '30d':
        dateRange.setDate(dateRange.getDate() - 30);
        break;
      case '90d':
        dateRange.setDate(dateRange.getDate() - 90);
        break;
      default:
        dateRange.setDate(dateRange.getDate() - 7); // Default to 7 days
    }

    // Get email metrics by sender
    const { data: senderMetrics, error: senderError } = await supabase
      .from('eli5_email_log')
      .select(`
        sender_email_used,
        sender_name,
        email_status,
        count:count(*)
      `)
      .gte('created_at', dateRange.toISOString())
      .group('sender_email_used, sender_name, email_status');

    if (senderError) throw senderError;

    // Get time-series data for the chart
    const { data: timeSeriesData, error: timeSeriesError } = await supabase
      .rpc('get_email_metrics_time_series', {
        start_date: dateRange.toISOString(),
        end_date: new Date().toISOString(),
        interval_days: timeRange === '24h' ? 1 : timeRange === '7d' ? 1 : 7
      });

    if (timeSeriesError) throw timeSeriesError;

    // Calculate totals
    const totals = {
      sent: 0,
      delivered: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      replied: 0
    };

    const bySender: Record<string, typeof totals> = {};

    // Process sender metrics
    senderMetrics?.forEach(metric => {
      const status = metric.email_status?.toLowerCase();
      const sender = metric.sender_email_used || 'unknown';
      
      // Initialize sender if not exists
      if (!bySender[sender]) {
        bySender[sender] = { sent: 0, delivered: 0, bounced: 0, opened: 0, clicked: 0, replied: 0 };
      }

      const count = metric.count || 0;
      
      // Update sender metrics
      bySender[sender][status] = count;
      bySender[sender].sent += count;
      
      // Update totals
      if (['sent', 'delivered', 'bounced', 'opened', 'clicked', 'replied'].includes(status)) {
        totals[status] += count;
      }
    });

    // Calculate rates
    const rates = {
      delivery: totals.sent > 0 ? (totals.delivered / totals.sent) * 100 : 0,
      bounce: totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0,
      open: totals.delivered > 0 ? (totals.opened / totals.delivered) * 100 : 0,
      click: totals.delivered > 0 ? (totals.clicked / totals.delivered) * 100 : 0,
      reply: totals.delivered > 0 ? (totals.replied / totals.delivered) * 100 : 0
    };

    return res.status(200).json({
      success: true,
      data: {
        totals,
        rates,
        bySender: Object.entries(bySender).map(([email, metrics]) => ({
          email,
          name: senderMetrics?.find(m => m.sender_email_used === email)?.sender_name || email.split('@')[0],
          ...metrics,
          deliveryRate: metrics.sent > 0 ? (metrics.delivered / metrics.sent) * 100 : 0,
          bounceRate: metrics.sent > 0 ? (metrics.bounced / metrics.sent) * 100 : 0,
          openRate: metrics.delivered > 0 ? (metrics.opened / metrics.delivered) * 100 : 0,
          clickRate: metrics.delivered > 0 ? (metrics.clicked / metrics.delivered) * 100 : 0,
          replyRate: metrics.delivered > 0 ? (metrics.replied / metrics.delivered) * 100 : 0
        })),
        timeSeries: timeSeriesData || []
      }
    });
  } catch (error: any) {
    console.error('Error fetching email metrics:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch email metrics'
    });
  }
}
