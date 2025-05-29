import { useState, useEffect } from 'react';
import CampaignSchedulerUI from './CampaignSchedulerUI';
import CrondonkeyConsoleDashboard from './CrondonkeyConsoleDashboard';
import { createServerClient } from '@/lib/supabase/client';

export default function CrondonkeyTabsDashboard() {
  const [tab, setTab] = useState('schedule');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [queue, setQueue] = useState<any[]>([]);
  const supabase = createServerClient();

  const toggleCrondonkey = async () => {
    setIsRunning(prev => !prev);
    setIsPaused(false);
    await fetch('http://localhost:9000/api/control-crondonkey', {
      method: 'POST',
      body: JSON.stringify({ run: !isRunning }),
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const togglePause = async () => {
    setIsPaused(prev => !prev);
    await fetch('http://localhost:9000/api/pause-crondonkey', {
      method: 'POST',
      body: JSON.stringify({ paused: !isPaused }),
      headers: { 'Content-Type': 'application/json' }
    });
  };

  // Subscribe to campaign_jobs for queue updates
  useEffect(() => {
    const channel = supabase
      .channel('realtime:campaign_jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_jobs' },
        async () => {
          const { data, error } = await supabase
            .from('campaign_jobs')
            .select('*')
            .eq('status', 'pending')
            .order('next_processing_time', { ascending: true });

          if (!error) setQueue(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div className="max-w-5xl mx-auto mt-8 p-4 bg-base-100 rounded-box shadow">
      <div role="tablist" className="tabs tabs-boxed w-full justify-around">
        <button
          role="tab"
          className={`tab ${tab === 'schedule' ? 'tab-active' : ''}`}
          onClick={() => setTab('schedule')}
        >
          📅 Schedule Campaign
        </button>
        <button
          role="tab"
          className={`tab ${tab === 'console' ? 'tab-active' : ''}`}
          onClick={() => setTab('console')}
        >
          🧠 Crondonkey Console
        </button>
      </div>

      <div className="mt-6">
        {tab === 'schedule' && <CampaignSchedulerUI />}

        {tab === 'console' && (
          <div className="space-y-4">
            <div className="flex justify-end gap-4">
              <button className="btn btn-outline" onClick={toggleCrondonkey}>
                {isRunning ? '⏹️ Stop Crondonkey' : '▶️ Start Crondonkey'}
              </button>
              {isRunning && (
                <button className="btn btn-outline" onClick={togglePause}>
                  {isPaused ? '⏯️ Resume' : '⏸️ Pause'}
                </button>
              )}
            </div>
            <CrondonkeyConsoleDashboard isPaused={isPaused} />

            {queue.length > 0 && (
              <div className="overflow-x-auto border rounded-lg mt-6">
                <table className="table table-zebra w-full text-sm">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Lead</th>
                      <th>Email</th>
                      <th>Scheduled Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((job) => (
                      <tr key={job.id}>
                        <td>{job.id}</td>
                        <td>{job.contact_name}</td>
                        <td>{job.email_address}</td>
                        <td>{new Date(job.next_processing_time).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
