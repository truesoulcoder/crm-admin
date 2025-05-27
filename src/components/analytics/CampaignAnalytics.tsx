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

    fetchData();

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
          fetchData(); // Refresh data on changes
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) {
    return <div className="p-4">Loading campaign data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  // Process data for lead distribution over time
  const leadData = jobs.map(job => ({
    timestamp: new Date(job.next_processing_time).getTime(),
    status: job.status,
    email: job.email_address
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
        email: job.email_address
      };
    });

  // Format date for X-axis
  const formatXAxis = (tickItem: number) => {
    return new Date(tickItem).toLocaleTimeString();
  };

  // Custom tooltip for lead distribution
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow">
          <p className="font-semibold">{new Date(payload[0].payload.timestamp).toLocaleString()}</p>
          <p>Email: {payload[0].payload.email}</p>
          <p>Status: {payload[0].payload.status}</p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for sender distribution
  const SenderTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow">
          <p className="font-semibold">{payload[0].payload.senderName}</p>
          <p>Time: {new Date(payload[0].payload.timestamp).toLocaleString()}</p>
          <p>Email: {payload[0].payload.email}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-12">
      {/* Lead Distribution Over Time */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Lead Distribution Over Time</h2>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="timestamp"
                name="Time"
                tickFormatter={formatXAxis}
                domain={['auto', 'auto']}
              />
              <YAxis 
                type="number" 
                dataKey="status" 
                name="Status" 
                tick={false}
                label={{ value: 'Status', angle: -90, position: 'insideLeft' }}
              />
              <ZAxis type="category" dataKey="email" name="Email" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Scatter
                name="Leads"
                data={leadData}
                fill="#8884d8"
                shape="circle"
              >
                {leadData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sender Distribution Over Time */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Sender Distribution Over Time</h2>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="timestamp"
                name="Time"
                tickFormatter={formatXAxis}
                domain={['auto', 'auto']}
              />
              <YAxis
                type="category"
                dataKey="senderName"
                name="Sender"
                tick={false}
                label={{ value: 'Sender', angle: -90, position: 'insideLeft' }}
              />
              <ZAxis type="category" dataKey="email" name="Email" />
              <Tooltip content={<SenderTooltip />} />
              <Legend />
              <Scatter
                name="Senders"
                data={senderData}
                fill="#82ca9d"
                shape="circle"
              >
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
  );
}