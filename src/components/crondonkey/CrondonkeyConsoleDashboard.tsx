import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Stat, StatLabel, StatNumber } from '@/components/ui/stat';
import { createServerClient } from '@/lib/supabase/client';

export default function CrondonkeyConsoleDashboard({ isPaused }: { isPaused: boolean }) {
  const supabase = createServerClient();
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [metrics, setMetrics] = useState({
    sent: 0,
    delivered: 0,
    bounced: 0,
    failed: 0,
    replied: 0
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
      .channel('realtime:email_metrics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_metrics' },
        payload => {
          setMetrics(prev => ({
            ...prev,
            [payload.new.status]: (prev[payload.new.status] || 0) + 1
          }));
          setLogs(logs => [
            ...logs,
            `📬 ${payload.new.status.toUpperCase()} — job ${payload.new.job_id}`
          ]);
        }
      )
      .subscribe();

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
    <Card className="p-4 space-y-4 max-w-5xl mx-auto mt-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">🤖 Crondonkey Command Console</h2>
        <span className="text-sm text-muted">{isPaused ? '⏸️ Paused' : isRunning ? '🟢 Running' : '🔴 Idle'}</span>
      </div>

      <div className="flex gap-4">
        <Button variant="outline" onClick={toggleCrondonkey}>
          {isRunning ? 'Stop Crondonkey' : 'Start Crondonkey'}
        </Button>
        <Button variant="ghost" onClick={togglePause}>
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
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
          <Stat key={label}>
            <StatLabel className="capitalize">{label}</StatLabel>
            <StatNumber>{value}</StatNumber>
          </Stat>
        ))}
      </div>

      <CardContent className="bg-gray-900 text-green-300 font-mono p-2 h-60 overflow-y-auto text-sm rounded-md">
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </CardContent>
    </Card>
  );
}
