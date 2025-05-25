'use client';

import { PlayCircle, StopCircle, Mail, AlertTriangle, Info, CheckCircle, RefreshCw, MapPin } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Alert, Input } from 'react-daisyui'; // Added Input

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

const Eli5EngineControlView: React.FC = (): JSX.Element => {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [marketRegion, setMarketRegion] = useState<string>('FLORIDA'); // Added marketRegion state
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consoleEndRef = useRef<null | HTMLDivElement>(null);

  // New state variables for sender selection, timeout, and limit
  const [availableSenders, setAvailableSenders] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [selectedSenderIds, setSelectedSenderIds] = useState<string[]>([]);
  const [timeoutIntervalSeconds, setTimeoutIntervalSeconds] = useState<number>(0); // Default to 0 seconds
  const [limitPerRun, setLimitPerRun] = useState<number>(10); // Default to 10, API also defaults to 10

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

  // Fetch available senders on component mount
  useEffect(() => {
    const fetchSenders = async () => {
      addLog('Fetching available senders...', 'info');
      try {
        const { data, error: fetchError } = await supabase
          .from('senders') // Ensure this is your actual table name for senders
          .select('id, name, email')
          .eq('is_active', true) // Assuming you only want active senders
          // .eq('status', 'active') // Add if you have a status field for more granular control
          .order('name', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        if (data) {
          setAvailableSenders(data.map(s => ({ id: s.id, name: s.name || s.email, email: s.email }))); // Ensure name has a fallback
          addLog(`Successfully fetched ${data.length} active senders.`, 'success');
        } else {
          addLog('No active senders found or unable to fetch.', 'warning');
          setAvailableSenders([]);
        }
      } catch (err: any) {
        const errorMessage = `Error fetching senders: ${err.message}`;
        addLog(errorMessage, 'error');
        setError(errorMessage); // Display error in the main error alert
        setAvailableSenders([]); // Ensure it's empty on error
      }
    };

    addLog('ELI5 Engine Control Panel Initialized.', 'info');
    void fetchSenders();
    // No dependencies needed for addLog if it's stable via useCallback,
    // but if supabase client can change, it might be needed.
    // For now, assuming addLog and supabase are stable.
  }, [addLog, supabase]); // Added supabase as dependency for completeness

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
    addLog('Sending request to /api/eli5-engine/test-email...', 'info');
    setIsLoading(true);
    setEngineStatus('test_sending');
    setError(null);

    try {
      const response = await fetch('/api/eli5-engine/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No body needed for test-email as per current API design
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `API request failed with status ${response.status}`);
      }

      if (result.success) {
        addLog(`Test email API success: ${result.message}`, 'success');
        if (result.lead_id) {
            addLog(`Test email processed for lead ID: ${result.lead_id}, Subject: "${result.subject}"`, 'info');
        }
      } else {
        throw new Error(result.error || 'Test email API returned success:false');
      }
    } catch (err: any) {
      const errorMessage = `Error during test email: ${err.message}`;
      addLog(errorMessage, 'error');
      setError(errorMessage);
      setEngineStatus('error'); // Set status to error
    } finally {
      setIsLoading(false);
      // Reset status to 'idle' only if not in an error state
      if (engineStatus !== 'error' && engineStatus === 'test_sending') { // ensure we only reset from test_sending
        setEngineStatus('idle');
      }
    }
  };

  const handleStartEngine = async () => {
    if (!marketRegion.trim()) {
      const msg = 'Market region cannot be empty.';
      addLog(msg, 'warning');
      setError(msg);
      return;
    }
    addLog(`Initiating ELI5 Engine start sequence for market region: ${marketRegion}...`, 'info');
    setIsLoading(true);
    setEngineStatus('starting');
    setError(null);

    try {
      // Step 1: Call resume-campaign
      addLog('Attempting to resume campaign processing flag...', 'info');
      const resumeResponse = await fetch('/api/eli5-engine/resume-campaign', { method: 'POST' });
      const resumeResult = await resumeResponse.json();

      if (!resumeResponse.ok || !resumeResult.success) {
        throw new Error(resumeResult.error || `Failed to resume campaign flag (status ${resumeResponse.status})`);
      }
      addLog('Campaign processing flag successfully set to RESUMED.', 'success');

      // Step 2: Call start-campaign
      addLog(`Sending request to /api/eli5-engine/start-campaign for market: ${marketRegion} with limit: ${limitPerRun}, timeout: ${timeoutIntervalSeconds}s, senders: ${selectedSenderIds.length > 0 ? selectedSenderIds.join(', ') : 'Any'}...`, 'info');
      
      const requestBody: any = { 
        market_region: marketRegion,
        limit_per_run: Number(limitPerRun) || undefined, // API defaults if undefined
        selected_sender_ids: selectedSenderIds,
        timeout_interval_seconds: Number(timeoutIntervalSeconds),
      };
      // The API defaults limit_per_run to 10 if not provided or if value is 0.
      // If Number(limitPerRun) is 0, sending undefined will make API use its default.
      // If you want 0 to mean "no limit" on API side, API needs to handle that.
      // For now, 0 from UI means use API default.

      const startResponse = await fetch('/api/eli5-engine/start-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const startResult = await startResponse.json();

      if (!startResponse.ok) {
        throw new Error(startResult.error || `API request to start-campaign failed with status ${startResponse.status}`);
      }

      if (startResult.success) {
        addLog(`Start campaign API success: ${startResult.message}`, 'success');
        addLog(`Batch details: Attempted: ${startResult.attempted}, Succeeded: ${startResult.succeeded}, Failed: ${startResult.failed}`, 'info');
        if (startResult.processing_errors && startResult.processing_errors.length > 0) {
            addLog(`Encountered ${startResult.processing_errors.length} errors during batch processing. Check logs.`, 'warning', startResult.processing_errors);
        }
        setEngineStatus('running'); // Reflects that a batch was started
      } else {
        throw new Error(startResult.error || 'Start campaign API returned success:false');
      }
    } catch (err: any) {
      const errorMessage = `Error during engine start sequence: ${err.message}`;
      addLog(errorMessage, 'error');
      setError(errorMessage);
      setEngineStatus('error');
    } finally {
      setIsLoading(false);
      // Do not reset to 'idle' here if it successfully started a batch ('running') or errored out.
    }
  };

  const handleStopEngine = async () => {
    addLog('Sending request to /api/eli5-engine/stop-campaign...', 'info');
    setIsLoading(true);
    setEngineStatus('stopping');
    setError(null);
    try {
      const response = await fetch('/api/eli5-engine/stop-campaign', { method: 'POST' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `API request to stop-campaign failed with status ${response.status}`);
      }

      if (result.success) {
        addLog(`Stop campaign API success: ${result.message}`, 'success');
        setEngineStatus('stopped'); 
      } else {
        throw new Error(result.error || 'Stop campaign API returned success:false');
      }
    } catch (err: any) {
      const errorMessage = `Error stopping engine: ${err.message}`;
      addLog(errorMessage, 'error');
      setError(errorMessage);
      setEngineStatus('error'); 
    } finally {
      setIsLoading(false);
      // If it's not an error, it should be 'stopped'. If error, it's 'error'.
      // No automatic reset to 'idle'.
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
            <div className="form-control w-full sm:w-auto mt-3 sm:mt-0">
              <label className="label" htmlFor="marketRegionInput">
                <span className="label-text flex items-center"><MapPin size={16} className="mr-1" /> Market Region</span>
              </label>
              <Input 
                id="marketRegionInput"
                type="text" 
                placeholder="e.g., FLORIDA" 
                value={marketRegion}
                onChange={(e) => setMarketRegion(e.target.value.toUpperCase())}
                className="input input-bordered w-full sm:w-auto"
                disabled={isLoading && (engineStatus === 'starting' || engineStatus === 'running')}
              />
            </div>
          </div>

          {/* Display Current Settings */}
          <div className="my-4 p-3 bg-base-200 rounded-md">
            <h3 className="text-lg font-semibold mb-2">Current Campaign Settings:</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <p><span className="font-medium">Market:</span> {marketRegion || "Not Set"}</p>
              <p><span className="font-medium">Limit/Run:</span> {limitPerRun === 0 ? "API Default" : limitPerRun}</p>
              <p><span className="font-medium">Interval:</span> {timeoutIntervalSeconds}s</p>
              <p><span className="font-medium">Senders:</span> {selectedSenderIds.length === 0 ? "Any Active" : `${selectedSenderIds.length} Selected`}</p>
            </div>
          </div>
          
          {/* New UI Elements for Senders, Timeout, and Limit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
            {/* Sender Selection */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Filter Senders (Optional)</span>
              </label>
              {availableSenders.length > 0 ? (
                <div className="max-h-40 overflow-y-auto border border-base-300 rounded-md p-2 bg-base-200">
                  {availableSenders.map(sender => (
                    <label key={sender.id} className="label cursor-pointer">
                      <span className="label-text">{sender.name} ({sender.email})</span>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary"
                        checked={selectedSenderIds.includes(sender.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSenderIds([...selectedSenderIds, sender.id]);
                          } else {
                            setSelectedSenderIds(selectedSenderIds.filter(id => id !== sender.id));
                          }
                        }}
                        disabled={isLoading && (engineStatus === 'starting' || engineStatus === 'running')}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-base-content-secondary">No active senders found or failed to load.</div>
              )}
            </div>

            {/* Timeout Interval */}
            <div className="form-control">
              <label className="label" htmlFor="timeoutIntervalInput">
                <span className="label-text">Email Send Interval (seconds)</span>
              </label>
              <Input
                id="timeoutIntervalInput"
                type="number"
                min="0"
                placeholder="e.g., 5"
                value={timeoutIntervalSeconds}
                onChange={(e) => setTimeoutIntervalSeconds(Math.max(0, Number(e.target.value)))}
                className="input input-bordered w-full"
                disabled={isLoading && (engineStatus === 'starting' || engineStatus === 'running')}
              />
            </div>

            {/* Limit Per Run */}
            <div className="form-control">
              <label className="label" htmlFor="limitPerRunInput">
                <span className="label-text">Limit Per Run (0 for API default)</span>
              </label>
              <Input
                id="limitPerRunInput"
                type="number"
                min="0"
                placeholder="e.g., 100"
                value={limitPerRun}
                onChange={(e) => setLimitPerRun(Math.max(0, Number(e.target.value)))}
                className="input input-bordered w-full"
                disabled={isLoading && (engineStatus === 'starting' || engineStatus === 'running')}
              />
            </div>
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
              disabled={isLoading && (engineStatus === 'starting' || engineStatus === 'running') || !marketRegion.trim()}
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
