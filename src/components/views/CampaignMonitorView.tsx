// CampaignMonitorView.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, List, Mail, PauseCircle, PlayCircle, Terminal, X } from 'lucide-react';

interface Job {
  id: string;
  campaign_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  job_id: string;
  recipient: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Log {
  id: string;
  campaign_id: string;
  event_type: string;
  message: string;
  created_at: string;
}

const CampaignMonitorView: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/engine/jobs?campaign_id=${campaignId}`).then(r => r.json()),
      fetch(`/api/engine/tasks?campaign_id=${campaignId}`).then(r => r.json()),
      fetch(`/api/engine/logs?campaign_id=${campaignId}`).then(r => r.json()),
    ])
      .then(([jobsRes, tasksRes, logsRes]) => {
        setJobs(Array.isArray(jobsRes) ? jobsRes : []);
        setTasks(Array.isArray(tasksRes) ? tasksRes : []);
        setLogs(Array.isArray(logsRes) ? logsRes : []);
      })
      .catch(() => setError('Failed to load campaign monitoring data.'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <List size={20} /> Campaign Monitor
      </h2>
      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin" size={32} />
        </div>
      )}
      {error && (
        <div className="alert alert-error mb-4 flex items-center gap-2">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Jobs */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-1">
              <PlayCircle size={16} /> Jobs
            </h3>
            <div className="bg-base-100 rounded-lg shadow p-3 max-h-96 overflow-y-auto">
              {jobs.length === 0 ? (
                <div className="text-base-content/70">No jobs found.</div>
              ) : (
                <ul className="divide-y divide-base-300">
                  {jobs.map(job => (
                    <li key={job.id} className="py-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{job.status}</span>
                          <span className="ml-2 text-xs text-base-content/60">{new Date(job.created_at).toLocaleString()}</span>
                        </div>
                        <span className="badge badge-outline">{job.id.slice(-6)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {/* Tasks */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-1">
              <Mail size={16} /> Tasks
            </h3>
            <div className="bg-base-100 rounded-lg shadow p-3 max-h-96 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="text-base-content/70">No tasks found.</div>
              ) : (
                <ul className="divide-y divide-base-300">
                  {tasks.map(task => (
                    <li key={task.id} className="py-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{task.recipient}</span>
                          <span className="ml-2 text-xs text-base-content/60">{task.status}</span>
                        </div>
                        <span className="badge badge-outline">{task.id.slice(-6)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {/* Logs */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-1">
              <Terminal size={16} /> Logs
            </h3>
            <div className="bg-base-100 rounded-lg shadow p-3 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-base-content/70">No logs found.</div>
              ) : (
                <ul className="divide-y divide-base-300">
                  {logs.map(log => (
                    <li key={log.id} className="py-2">
                      <div className="flex flex-col">
                        <span className="font-medium">{log.event_type}</span>
                        <span className="text-xs text-base-content/60">{log.message}</span>
                        <span className="text-xs text-base-content/40 mt-1">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignMonitorView;
