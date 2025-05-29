import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CampaignSchedulerUI from './CampaignSchedulerUI';
import CrondonkeyConsoleDashboard from './CrondonkeyConsoleDashboard';
import { Card } from '@/components/ui/card';
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
    <Card className="max-w-5xl mx-auto mt-8 p-4">
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="w-full justify-around">
          <TabsTrigger value="schedule">📅 Schedule Campaign</TabsTrigger>
          <TabsTrigger value="console">🧠 Crondonkey Console</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <CampaignSchedulerUI />
        </TabsContent>

        <TabsContent value="console">
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
        </TabsContent>
      </Tabs>
    </Card>
  );
}
