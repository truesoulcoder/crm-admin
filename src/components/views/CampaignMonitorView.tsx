import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, AlertCircle, Mail, CheckCircle, MousePointer, AlertTriangle, BarChart2 } from 'lucide-react';

interface CampaignMonitorViewProps {
  campaignId: string;
}

interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  date: string;
}

const CampaignMonitorView: React.FC<CampaignMonitorViewProps> = ({ campaignId }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CampaignStats[]>([]);
  const [campaignName, setCampaignName] = useState<string>('Campaign');
  const supabase = createClient();

  useEffect(() => {
    const fetchCampaignData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch campaign details
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('name')
          .eq('id', campaignId)
          .single();

        if (campaignError) throw campaignError;
        if (campaignData?.name) {
          setCampaignName(campaignData.name);
        }

        // Mock data - replace with actual API calls in production
        const mockStats: CampaignStats[] = [
          { date: 'Mon', sent: 120, delivered: 115, opened: 75, clicked: 35, bounced: 5 },
          { date: 'Tue', sent: 150, delivered: 145, opened: 90, clicked: 45, bounced: 5 },
          { date: 'Wed', sent: 180, delivered: 175, opened: 120, clicked: 65, bounced: 5 },
          { date: 'Thu', sent: 200, delivered: 195, opened: 150, clicked: 85, bounced: 5 },
          { date: 'Fri', sent: 180, delivered: 175, opened: 140, clicked: 75, bounced: 5 },
          { date: 'Sat', sent: 100, delivered: 95, opened: 70, clicked: 35, bounced: 5 },
          { date: 'Sun', sent: 80, delivered: 75, opened: 50, clicked: 25, bounced: 5 },
        ];

        setStats(mockStats);
      } catch (err) {
        console.error('Error fetching campaign data:', err);
        setError('Failed to load campaign data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    if (campaignId) {
      fetchCampaignData();
    }
  }, [campaignId]);

  // Calculate summary metrics
  const summary = stats.reduce(
    (acc, curr) => ({
      sent: acc.sent + curr.sent,
      delivered: acc.delivered + curr.delivered,
      opened: acc.opened + curr.opened,
      clicked: acc.clicked + curr.clicked,
      bounced: acc.bounced + curr.bounced,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
  );

  const deliveryRate = summary.sent > 0 ? (summary.delivered / summary.sent) * 100 : 0;
  const openRate = summary.delivered > 0 ? (summary.opened / summary.delivered) * 100 : 0;
  const clickRate = summary.opened > 0 ? (summary.clicked / summary.opened) * 100 : 0;
  const bounceRate = summary.sent > 0 ? (summary.bounced / summary.sent) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-lg">Loading campaign data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-error">
        <AlertCircle className="h-8 w-8 mb-4" />
        <p className="text-lg">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Campaign: {campaignName}</h2>
        <div className="text-sm text-gray-500">
          Campaign ID: <span className="font-mono">{campaignId}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card bg-base-200 p-4">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-primary" />
            <span className="text-sm text-gray-500">Sent</span>
          </div>
          <div className="text-2xl font-bold mt-1">{summary.sent.toLocaleString()}</div>
        </div>
        
        <div className="card bg-base-200 p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-sm text-gray-500">Delivery Rate</span>
          </div>
          <div className="text-2xl font-bold mt-1">{deliveryRate.toFixed(1)}%</div>
        </div>
        
        <div className="card bg-base-200 p-4">
          <div className="flex items-center space-x-2">
            <BarChart2 className="h-5 w-5 text-info" />
            <span className="text-sm text-gray-500">Open Rate</span>
          </div>
          <div className="text-2xl font-bold mt-1">{openRate.toFixed(1)}%</div>
        </div>
        
        <div className="card bg-base-200 p-4">
          <div className="flex items-center space-x-2">
            <MousePointer className="h-5 w-5 text-warning" />
            <span className="text-sm text-gray-500">Click Rate</span>
          </div>
          <div className="text-2xl font-bold mt-1">{clickRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="card bg-base-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Campaign Activity</h3>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Count</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  <span>Emails Sent</span>
                </td>
                <td>{summary.sent.toLocaleString()}</td>
                <td>100%</td>
              </tr>
              <tr>
                <td className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-success" />
                  <span>Delivered</span>
                </td>
                <td>{summary.delivered.toLocaleString()}</td>
                <td>{deliveryRate.toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="flex items-center">
                  <BarChart2 className="h-4 w-4 mr-2 text-info" />
                  <span>Opened</span>
                </td>
                <td>{summary.opened.toLocaleString()}</td>
                <td>{openRate.toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="flex items-center">
                  <MousePointer className="h-4 w-4 mr-2 text-warning" />
                  <span>Clicked</span>
                </td>
                <td>{summary.clicked.toLocaleString()}</td>
                <td>{clickRate.toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 text-error" />
                  <span>Bounced</span>
                </td>
                <td>{summary.bounced.toLocaleString()}</td>
                <td>{bounceRate.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CampaignMonitorView;
