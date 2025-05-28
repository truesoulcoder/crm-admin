'use client';

import { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

import { createClient } from '@/lib/supabase/client';

// Types based on your database schema
interface CampaignJob {
  id: string;
  created_at: string;
  next_processing_time: string;
  status: string;
  assigned_sender_id: string;
  email_address: string;
}

interface Sender {
  id: string;
  email: string;
  name: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function CampaignAnalytics() {
  const [jobs, setJobs] = useState<CampaignJob[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch campaign jobs
        const { data: jobsData, error: jobsError } = await supabase
          .from('campaign_jobs')
          .select('*')
          .order('next_processing_time', { ascending: true });
        
        if (jobsError) throw jobsError;

        // Fetch senders
        const { data: sendersData, error: sendersError } = await supabase
          .from('senders')
          .select('*');
        
        if (sendersError) throw sendersError;

        setJobs(jobsData || []);
        setSenders(sendersData || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();

    // Set up real-time subscription
    const channel = supabase
      .channel('campaign_jobs_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'campaign_jobs' 
        }, 
        () => {
          void fetchData(); // Refresh data on changes
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [supabase]);

  if (loading) {
    return <div className="p-4">Loading campaign data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (jobs.length === 0) {
    return <div className="p-4">No campaign data available.</div>;
  }

  // Process data for lead distribution over time
  const leadData = jobs.map(job => ({
    timestamp: new Date(job.next_processing_time).getTime(),
    status: job.status === 'completed' ? 1 : job.status === 'failed' ? -1 : 0, // Convert status to numerical value
    email: job.email_address,
    statusText: job.status
  }));

  // Process data for sender distribution
  const senderData = jobs
    .filter(job => job.assigned_sender_id) // Only include jobs with assigned senders
    .map(job => {
      const sender = senders.find(s => s.id === job.assigned_sender_id);
      return {
        timestamp: new Date(job.next_processing_time).getTime(),
        senderId: job.assigned_sender_id,
        senderName: sender?.name || 'Unknown',
        email: job.email_address,
        // Create a numerical value for the Y-axis based on sender ID
        senderY: (sender?.id?.charCodeAt(0) || 0) % 10 // Ensure we have a number for Y-axis
      };
    });

  // Format date for X-axis
  const formatXAxis = (tickItem: number) => {
    return new Date(tickItem).toLocaleTimeString();
  };

  // Custom tooltip for lead distribution
  interface TooltipPayload {
    payload: {
      timestamp: number;
      email: string;
      statusText: string;
    };
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-base-100 p-3 border border-base-300 rounded-box shadow-lg text-sm">
          <p className="font-semibold">{new Date(payload[0].payload.timestamp).toLocaleString()}</p>
          <p>Email: {payload[0].payload.email}</p>
          <p>Status: {payload[0].payload.statusText}</p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for sender distribution
  interface SenderPayload {
    payload: {
      senderName: string;
      timestamp: number;
      email: string;
    };
  }

  const SenderTooltip = ({ active, payload }: { active?: boolean; payload?: SenderPayload[] }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-base-100 p-3 border border-base-300 rounded-box shadow-lg text-sm">
          <p className="font-semibold">{payload[0].payload.senderName}</p>
          <p>Time: {new Date(payload[0].payload.timestamp).toLocaleString()}</p>
          <p>Email: {payload[0].payload.email}</p>
        </div>
      );
    }
    return null;
  };

  // Get unique statuses for Y-axis
  const statuses = [...new Set(jobs.map(job => job.status))];
  const statusToY = statuses.reduce((acc, status, index) => ({
    ...acc,
    [status]: index + 1
  }), {});

  return (
    <div className="space-y-8 p-4">
      {/* Lead Distribution Over Time */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-xl mb-4">Lead Distribution Over Time</h2>
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{
                  top: 20,
                  right: 20,
                  bottom: 40,
                  left: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc)/0.1)" />
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  name="Time"
                  tickFormatter={formatXAxis}
                  domain={['auto', 'auto']}
                  tick={{ fill: 'hsl(var(--bc)/0.8)' }}
                  tickLine={{ stroke: 'hsl(var(--bc)/0.2)' }}
                />
                <YAxis 
                  type="number"
                  dataKey="status"
                  name="Status"
                  tick={{ fill: 'hsl(var(--bc)/0.8)' }}
                  tickLine={{ stroke: 'hsl(var(--bc)/0.2)' }}
                  tickFormatter={(value) => {
                    const status = statuses[Math.round(value) - 1];
                    return status || '';
                  }}
                />
                <ZAxis type="category" dataKey="email" name="Email" />
                <Tooltip content={<CustomTooltip />} />
                <Scatter name="Leads" data={leadData}>
                  {leadData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[statuses.indexOf(entry.statusText) % COLORS.length]}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sender Distribution Over Time */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-xl mb-4">Sender Distribution Over Time</h2>
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{
                  top: 20,
                  right: 20,
                  bottom: 40,
                  left: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc)/0.1)" />
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  name="Time"
                  tickFormatter={formatXAxis}
                  domain={['auto', 'auto']}
                  tick={{ fill: 'hsl(var(--bc)/0.8)' }}
                  tickLine={{ stroke: 'hsl(var(--bc)/0.2)' }}
                />
                <YAxis
                  type="number"
                  dataKey="senderY"
                  name="Sender"
                  tick={{ fill: 'hsl(var(--bc)/0.8)' }}
                  tickLine={{ stroke: 'hsl(var(--bc)/0.2)' }}
                  tickFormatter={(value) => {
                    const sender = senderData.find(d => d.senderY === value);
                    return sender?.senderName || '';
                  }}
                />
                <ZAxis type="category" dataKey="email" name="Email" />
                <Tooltip content={<SenderTooltip />} />
                <Scatter name="Senders" data={senderData}>
                  {senderData.map((entry, index) => (
                    <Cell
                      key={`sender-cell-${index}`}
                      fill={COLORS[entry.senderId?.charCodeAt(0) % COLORS.length]}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}