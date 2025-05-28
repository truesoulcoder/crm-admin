'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { createClient } from '@/lib/supabase/client';

interface CampaignJob {
  id: string;
  created_at: string;
  next_processing_time: string;
  status: string;
  assigned_sender_id: string | null;
  email_address: string;
}

interface Sender {
  id: string;
  email: string;
  name: string;
}

interface TimeData {
  time: string;
  count: number;
  [key: string]: string | number; // For dynamic sender counts
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function CampaignAnalytics() {
  const [jobs, setJobs] = useState<CampaignJob[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('day');
  const supabase = createClient();

  // Format date based on selected time range
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    if (timeRange === 'hour') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === 'week') {
      return `Week ${Math.ceil(d.getDate() / 7)} ${d.toLocaleString('default', { month: 'short' })}`;
    } else {
      // day
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Group jobs by time
  const groupJobsByTime = useMemo(() => {
    if (!jobs.length) return [];
    
    const now = new Date();
    let timeMap = new Map<string, TimeData>();
    
    // Initialize time slots
    const timeSlots: Date[] = [];
    const count = timeRange === 'hour' ? 24 : timeRange === 'day' ? 7 : 4; // Show 24h, 7d, or 4w
    
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date();
      if (timeRange === 'hour') {
        date.setHours(date.getHours() - i, 0, 0, 0);
      } else if (timeRange === 'day') {
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
      } else {
        // week
        date.setDate(date.getDate() - (i * 7));
        date.setHours(0, 0, 0, 0);
      }
      timeSlots.push(date);
      
      const timeKey = formatDate(date);
      timeMap.set(timeKey, { time: timeKey, count: 0 });
    }
    
    // Count jobs in each time slot
    jobs.forEach(job => {
      const jobDate = new Date(job.next_processing_time);
      const timeKey = formatDate(jobDate);
      
      if (timeMap.has(timeKey)) {
        const data = timeMap.get(timeKey)!;
        data.count += 1;
        
        // Count by sender if available
        if (job.assigned_sender_id) {
          const sender = senders.find(s => s.id === job.assigned_sender_id);
          const senderKey = sender ? sender.name : 'Unassigned';
          data[senderKey] = (data[senderKey] as number || 0) + 1;
        }
      }
    });
    
    return Array.from(timeMap.values());
  }, [jobs, senders, timeRange]);

  // Get unique senders for the chart
  const uniqueSenders = useMemo(() => {
    const senderSet = new Set<string>();
    jobs.forEach(job => {
      if (job.assigned_sender_id) {
        const sender = senders.find(s => s.id === job.assigned_sender_id);
        if (sender) senderSet.add(sender.name);
      }
    });
    return Array.from(senderSet);
  }, [jobs, senders]);

  // Fetch data
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
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [supabase]);

  if (loading) {
    return <div className="p-4">Loading campaign data...</div>;
  }

  if (error) {
    return <div className="p-4 text-error">Error: {error}</div>;
  }

  if (!jobs.length) {
    return <div className="p-4">No campaign jobs found.</div>;
  }

  return (
    <div className="space-y-8 p-4">
      {/* Time Range Selector */}
      <div className="flex justify-end space-x-2">
        <button 
          className={`btn btn-sm ${timeRange === 'hour' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTimeRange('hour')}
        >
          Last 24 Hours
        </button>
        <button 
          className={`btn btn-sm ${timeRange === 'day' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTimeRange('day')}
        >
          Last 7 Days
        </button>
        <button 
          className={`btn btn-sm ${timeRange === 'week' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTimeRange('week')}
        >
          Last 4 Weeks
        </button>
      </div>

      {/* Job Distribution Over Time */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Job Distribution Over Time</h2>
          <p className="text-sm text-base-content/70">
            {timeRange === 'hour' 
              ? 'Jobs per hour for the last 24 hours' 
              : timeRange === 'day' 
                ? 'Jobs per day for the last 7 days' 
                : 'Jobs per week for the last 4 weeks'}
          </p>
          <div className="h-96 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={groupJobsByTime}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 60,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc)/0.1)" />
                <XAxis 
                  dataKey="time" 
                  angle={-45} 
                  textAnchor="end" 
                  height={60}
                  tick={{ fill: 'hsl(var(--bc)/0.8)', fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--bc)/0.8)' }}
                  tickLine={{ stroke: 'hsl(var(--bc)/0.2)' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--b1))',
                    borderColor: 'hsl(var(--bc)/0.1)',
                    borderRadius: 'var(--rounded-box, 1rem)'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="count" 
                  name="Total Jobs" 
                  fill="hsl(var(--p))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sender Distribution Over Time */}
      {uniqueSenders.length > 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Sender Distribution Over Time</h2>
            <p className="text-sm text-base-content/70">
              Jobs per sender over time
            </p>
            <div className="h-96 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={groupJobsByTime}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 60,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc)/0.1)" />
                  <XAxis 
                    dataKey="time" 
                    angle={-45} 
                    textAnchor="end" 
                    height={60}
                    tick={{ fill: 'hsl(var(--bc)/0.8)', fontSize: 12 }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--bc)/0.8)' }}
                    tickLine={{ stroke: 'hsl(var(--bc)/0.2)' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--b1))',
                      borderColor: 'hsl(var(--bc)/0.1)',
                      borderRadius: 'var(--rounded-box, 1rem)'
                    }}
                  />
                  <Legend />
                  {uniqueSenders.map((sender, index) => (
                    <Line
                      key={sender}
                      type="monotone"
                      dataKey={sender}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}