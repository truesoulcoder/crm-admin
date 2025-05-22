'use client';

import { PlayCircle, StopCircle, Mail, AlertTriangle, Info, CheckCircle, RefreshCw } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Alert } from 'react-daisyui';
import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';

// Assuming eli5_email_log is the primary source of real-time messages for now
type Eli5EmailLogEntry = Database['public']['Tables']['eli5_email_log']['Row'];

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning' | 'engine'; // Added 'engine' type
  data?: any; // Optional raw data from the log
}

type EngineStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'test_sending';

const Eli5EngineControlView: React.FC = () => {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consoleEndRef = useRef<null | HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'], data?: any) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      message,
      type,
      data,
    };
    setConsoleLogs(prevLogs => [newLog, ...prevLogs.slice(0, 199)]); // Keep max 200 logs
  }, []);

  // Scroll to bottom of console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // Placeholder for initial engine status check (if needed)
  useEffect(() => {
    // You might want to fetch the current engine status from an RPC or a dedicated table on load
    addLog('ELI5 Engine Control Panel Initialized.', 'info');
    // Example: async function fetchEngineStatus() { ... setEngineStatus ... } 
    // void fetchEngineStatus();
  }, [addLog]);

  // Real-time subscription to eli5_email_log for console updates
  useEffect(() => {
    const eli5LogChannelName = 'eli5-engine-realtime-log-channel';
    const subscription = supabase
      .channel(eli5LogChannelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'eli5_email_log' }, // Listen to all changes for now
        (payload) => {
          const record = payload.new as Eli5EmailLogEntry;
          let message = `ELI5 Log (${payload.eventType}): `; 
          if (record && record.contact_email) {
            message += `Email to ${record.contact_email} - Status: ${record.email_status}`;
            if (record.email_error_message) message += `, Error: ${record.email_error_message}`;
          } else {
            message += JSON.stringify(payload.new);
          }
          addLog(message, 'engine', payload.new);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          addLog('Connected to ELI5 Engine real-time log stream.', 'success');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const errorMessage = `ELI5 Log Stream Error: ${err?.message || 'Unknown error'}`;
          addLog(errorMessage, 'error');
          setError(errorMessage);
        }
      });

    return () => {
      addLog('Disconnecting from ELI5 Engine log stream...', 'info');
      if (subscription) void supabase.removeChannel(subscription);
    };
  }, [addLog]);

  const handleSendTestEmail = async () => {
    addLog('Attempting to send test email...', 'info');
    setIsLoading(true);
    setEngineStatus('test_sending');
    setError(null);
    try {
      // IMPORTANT: Replace 'rpc_send_test_email' with your actual Supabase RPC function name
      const { data, error: rpcError } = await supabase.rpc('trigger_eli5_test_email'); 
      if (rpcError) throw rpcError;
      addLog(`Test email process triggered successfully: ${JSON.stringify(data)}`, 'success');
    } catch (err: any) {
      const errorMessage = `Error sending test email: ${err.message || 'Unknown RPC error'}`;
      addLog(errorMessage, 'error');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setEngineStatus('idle'); // Or based on actual feedback if available
    }
  };

  const handleStartEngine = async () => {
    addLog('Attempting to start ELI5 Engine...', 'info');
    setIsLoading(true);
    setEngineStatus('starting');
    setError(null);
    try {
      // IMPORTANT: Replace 'rpc_start_eli5_engine' with your actual Supabase RPC function name
      const { data, error: rpcError } = await supabase.rpc('start_eli5_engine'); 
      if (rpcError) throw rpcError;
      addLog(`ELI5 Engine start command issued: ${JSON.stringify(data)}`, 'success');
      setEngineStatus('running'); // Assume success, actual status might come via another channel or table update
    } catch (err: any) {
      const errorMessage = `Error starting ELI5 Engine: ${err.message || 'Unknown RPC error'}`;
      addLog(errorMessage, 'error');
      setError(errorMessage);
      setEngineStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopEngine = async () => {
    addLog('Attempting to stop ELI5 Engine...', 'info');
    setIsLoading(true);
    setEngineStatus('stopping');
    setError(null);
    try {
      // IMPORTANT: Replace 'rpc_stop_eli5_engine' with your actual Supabase RPC function name
      const { data, error: rpcError } = await supabase.rpc('stop_eli5_engine');
      if (rpcError) throw rpcError;
      addLog(`ELI5 Engine stop command issued: ${JSON.stringify(data)}`, 'success');
      setEngineStatus('stopped'); // Assume success
    } catch (err: any) {
      const errorMessage = `Error stopping ELI5 Engine: ${err.message || 'Unknown RPC error'}`;
      addLog(errorMessage, 'error');
      setError(errorMessage);
      setEngineStatus('error'); // Or back to 'running' if stop failed but it was running
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: EngineStatus): string => {
    switch (status) {
      case 'running': return 'text-success';
      case 'stopped':
      case 'idle': return 'text-info';
      case 'error': return 'text-error';
      case 'starting':
      case 'stopping':
      case 'test_sending': return 'text-warning';
      default: return 'text-neutral-content';
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-base-200">
      <h1 className="text-3xl font-bold mb-6 text-center">ELI5 Engine Control Panel</h1>

      {error && (
        <Alert status="error" icon={<AlertTriangle />} className="mb-4">
          {error}
        </Alert>
      )}

      <Card className="card bordered shadow-lg bg-base-100 mb-6">
        <Card.Body className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Engine Status: <span className={`font-bold ${getStatusColor(engineStatus)}`}>{engineStatus.toUpperCase()}</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button 
              color="primary" 
              startIcon={<Mail />} 
              onClick={handleSendTestEmail}
              loading={isLoading && engineStatus === 'test_sending'}
              disabled={isLoading && engineStatus !== 'test_sending'}
            >
              Send Test Email
            </Button>
            <Button 
              color="success" 
              startIcon={<PlayCircle />} 
              onClick={handleStartEngine}
              loading={isLoading && engineStatus === 'starting'}
              disabled={isLoading && engineStatus !== 'starting' || engineStatus === 'running'}
            >
              Start Engine
            </Button>
            <Button 
              color="error" 
              startIcon={<StopCircle />} 
              onClick={handleStopEngine}
              loading={isLoading && engineStatus === 'stopping'}
              disabled={isLoading && engineStatus !== 'stopping' || engineStatus === 'idle' || engineStatus === 'stopped'}
            >
              Stop Engine
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Card className="card bordered shadow-lg bg-base-100">
        <Card.Body className="p-4">
          <h2 className="text-xl font-semibold mb-3">Real-time Engine Log</h2>
          <div className="h-96 overflow-y-auto bg-neutral text-neutral-content p-3 rounded-md text-sm font-mono">
            {consoleLogs.length === 0 && <p>No log messages yet. Waiting for ELI5 Engine activity...</p>}
            {consoleLogs.map(log => (
              <div key={log.id} className={`whitespace-pre-wrap ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : ''}`}>
                <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()} | </span>
                <span>{log.message}</span>
                {log.data && <details className="text-xs text-gray-600"><summary>Raw Data</summary><pre>{JSON.stringify(log.data, null, 2)}</pre></details>}
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Eli5EngineControlView;
