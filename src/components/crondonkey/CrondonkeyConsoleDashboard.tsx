'use client';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

type EmailMetric = {
  status: 'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked' | 'failed';
  job_id: string;
  created_at?: string;
  updated_at?: string;
};

type Metrics = {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  failed: number;
  [key: string]: number; // For dynamic access
};

export default function CrondonkeyConsoleDashboard({ isPaused }: { isPaused: boolean }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    sent: 0,
    delivered: 0,
    bounced: 0,
    opened: 0,
    clicked: 0,
    failed: 0
  });
  const [totalJobs, setTotalJobs] = useState(0);

  const toggleCrondonkey = async () => {
    const newState = !isRunning;
    setIsRunning(newState);
    setLogs(logs => [...logs, `${newState ? '▶️ Started' : '⏹️ Stopped'} Crondonkey`]);

    await fetch('http://localhost:9000/api/crondonkey', {
      method: 'POST',
      body: JSON.stringify({ run: newState }),
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const togglePause = async () => {
    const newPause = !isPaused;
    await fetch('http://localhost:9000/api/pause-crondonkey', {
      method: 'POST',
      body: JSON.stringify({ pause: newPause }),
      headers: { 'Content-Type': 'application/json' }
    });
  };

useEffect(() => {
  const channel = supabase
    .channel('email_metrics')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'email_metrics',
      },
      (payload) => {
        setMetrics(prev => ({
          ...prev,
          [payload.new.status]: (prev[payload.new.status] || 0) + 1
        }));
      }
    )
    .subscribe((status, err) => {
      if (err) {
        console.error('Error subscribing to email metrics:', err.message);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [supabase]);

  useEffect(() => {
    const fetchTotalJobs = async () => {
      const { count, error } = await supabase
        .from('campaign_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (!error && typeof count === 'number') setTotalJobs(count);
    };

    fetchTotalJobs();
  }, [supabase]);

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto mt-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">🤖 Crondonkey Command Console</h2>
        <span className="text-sm text-muted">{isPaused ? '⏸️ Paused' : isRunning ? '🟢 Running' : '🔴 Idle'}</span>
      </div>

      <div className="flex gap-4">
        <button className="btn btn-outline" onClick={toggleCrondonkey}>
          {isRunning ? 'Stop Crondonkey' : 'Start Crondonkey'}
        </button>
        <button className="btn btn-ghost" onClick={togglePause}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {totalJobs > 0 && (
        <div className="w-full">
          <label className="text-sm font-medium">
            Campaign Progress: {Math.min(100, Math.round(((metrics.sent + metrics.delivered + metrics.bounced + metrics.failed + metrics.replied) / totalJobs) * 100))}%
          </label>
          <progress
            className="progress w-full progress-success"
            value={
              metrics.sent +
              metrics.delivered +
              metrics.bounced +
              metrics.failed +
              metrics.replied
            }
            max={totalJobs}
          />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(metrics).map(([label, value]) => (
          <div key={label} className="stat bg-base-200 rounded-box p-4">
            <div className="stat-title capitalize">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 text-green-300 font-mono p-2 h-60 overflow-y-auto text-sm rounded-md">
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
