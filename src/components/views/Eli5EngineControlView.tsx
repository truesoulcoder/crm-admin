'use client';
//region Imports
import { PlayCircle, StopCircle, Mail, AlertTriangle, Info, CheckCircle, RefreshCw, MapPin } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Alert, Input, Select } from 'react-daisyui';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/db_types';

import type { JSX } from 'react';
//endregion
//region Types

type Eli5EmailLogEntry = Database['public']['Tables']['eli5_email_log']['Row'];
type MarketRegion = Database['public']['Tables']['market_regions']['Row'];

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning' | 'engine';
  data?: any;
}

type EngineStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'test_sending';

const Eli5EngineControlView: React.FC = () => {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [marketRegions, setMarketRegions] = useState<MarketRegion[]>([]);
  const [selectedMarketRegion, setSelectedMarketRegion] = useState<string>('');
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDryRun, setIsDryRun] = useState<boolean>(false);
  const consoleEndRef = useRef<null | HTMLDivElement>(null);
  const [availableSenders, setAvailableSenders] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [selectedSenderIds, setSelectedSenderIds] = useState<string[]>([]);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState<number>(100);
  const [maxIntervalSeconds, setMaxIntervalSeconds] = useState<number>(1000);
  const [limitPerRun, setLimitPerRun] = useState<number>(10);
//endregion
//region Functions
  const addLog = useCallback((message: string, type: LogEntry['type'], data?: any) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      message,
      type,
      data,
    };
    setConsoleLogs(prevLogs => [newLog, ...prevLogs.slice(0, 199)]);
  }, []);

  // Fetch market regions on component mount
  useEffect(() => {
    const fetchMarketRegions = async () => {
      try {
        const { data, error } = await supabase
          .from('market_regions')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          setMarketRegions(data);
          // Set the first market region as default if none selected
          if (!selectedMarketRegion) {
            setSelectedMarketRegion(data[0].name);
          }
        }
      } catch (err) {
        console.error('Error fetching market regions:', err);
        addLog('Failed to load market regions', 'error');
      }
    };

    void fetchMarketRegions();
  }, [addLog, selectedMarketRegion]); // Added addLog and selectedMarketRegion to dependency array

  // Update the handleSendTestEmail function to use selectedMarketRegion
  const handleSendTestEmail = async () => {
    if (!selectedMarketRegion) {
      const msg = 'Please select a market region first.';
      addLog(msg, 'warning');
      setError(msg);
      return;
    }

    addLog('Sending test email...', 'info');
    setIsLoading(true);
    setEngineStatus('test_sending');
    setError(null);

    try {
      const response = await fetch('/api/eli5-engine/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_region: selectedMarketRegion
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `API request failed with status ${response.status}`);
      }

      if (result.success) {
        addLog(`Test email sent successfully: ${result.message}`, 'success');
      } else {
        throw new Error(result.error || 'Test email failed');
      }
    } catch (err: any) {
      const errorMessage = `Error sending test email: ${err.message}`;
      addLog(errorMessage, 'error');
      setError(errorMessage);
      setEngineStatus('error');
    } finally {
      setIsLoading(false);
      if (engineStatus !== 'error') {
        setEngineStatus('idle');
      }
    }
  };
// endregion
// region Start Engine
  // Update the handleStartEngine function to use selectedMarketRegion
// 1. Update the startEli5Engine function
const startEli5Engine = async () => {
  if (!selectedMarketRegion) {
    const msg = 'Please select a market region.';
    addLog(msg, 'warning');
    setError(msg);
    return;
  }

  addLog(`Starting ELI5 Engine for market region: ${selectedMarketRegion}...`, 'engine');
  setIsLoading(true);
  setError(null);

  try {
    const { data, error } = await supabase.rpc('start_eli5_engine', {
      p_dry_run: isDryRun,
      p_limit_per_run: limitPerRun,
      p_market_region: selectedMarketRegion,
      p_min_interval_seconds: minIntervalSeconds,
      p_max_interval_seconds: maxIntervalSeconds,
      p_selected_sender_ids: selectedSenderIds.length ? selectedSenderIds : null
    });

    if (error) throw error;

    addLog('Engine started successfully', 'success');
    setEngineStatus('running');
    
    // Start polling for job updates
    startJobPolling();
  } catch (err: any) {
    const errorMsg = `Failed to start engine: ${err.message}`;
    addLog(errorMsg, 'error');
    setError(errorMsg);
    setEngineStatus('error');
  } finally {
    setIsLoading(false);
  }
};

// 2. Add job polling
const startJobPolling = () => {
  const interval = setInterval(async () => {
    if (engineStatus !== 'running') {
      clearInterval(interval);
      return;
    }
    await fetchCampaignStatus();
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(interval);
};

// 3. Add campaign status fetching
const fetchCampaignStatus = async () => {
  if (!selectedMarketRegion) return;

  try {
    const { data: jobs } = await supabase
      .from('campaign_jobs')
      .select('*')
      .eq('market_region', selectedMarketRegion)
      .order('created_at', { ascending: false })
      .limit(10);

    // Update UI with job status
    // You can add more sophisticated state management here
    console.log('Latest jobs:', jobs);
  } catch (err) {
    console.error('Error fetching job status:', err);
  }
};

// 4. Update the stopEli5Engine function
const stopEli5Engine = async () => {
  addLog('Stopping ELI5 Engine...', 'engine');
  setIsLoading(true);

  try {
    const { error } = await supabase.rpc('stop_eli5_engine');

    if (error) throw error;

    addLog('Engine stopped successfully', 'success');
    setEngineStatus('idle');
  } catch (err: any) {
    const errorMsg = `Failed to stop engine: ${err.message}`;
    addLog(errorMsg, 'error');
    setError(errorMsg);
    setEngineStatus('error');
  } finally {
    setIsLoading(false);
  }
};

// 5. Add real-time subscription
useEffect(() => {
  if (engineStatus !== 'running') return;

  const channel = supabase
    .channel('campaign-jobs')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'campaign_jobs',
        filter: `market_region=eq.${selectedMarketRegion}`
      },
      (payload) => {
        console.log('Job update:', payload);
        // Update UI based on job status changes
        fetchCampaignStatus();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [engineStatus, selectedMarketRegion]);
 
// #endregion
// region Stop Engine
const handleStopEngine = async () => {
  try {
    setEngineStatus('stopping');
    await stopEli5Engine();
    setEngineStatus('idle');
  } catch (error) {
    console.error('Engine stop failed:', error);
    setEngineStatus('error');
  }
};

const stopEli5Engine = async () => {
  addLog('Stopping ELI5 Engine...', 'engine');
  setIsLoading(true);
  setError(null);

  try {
    const { data, error } = await supabase.rpc('stop_eli5_engine', {
      p_market_region: selectedMarketRegion,
      // Add any additional parameters that your stop_eli5_engine function expects
      // For example:
      // p_force_stop: true,
      // p_cleanup: true
    });

    if (error) throw error;

    // If the RPC returns data, you can handle it here
    if (data) {
      console.log('Stop engine response:', data);
      addLog(data.message || 'Engine stopped successfully', 'success');
    } else {
      addLog('Engine stopped successfully', 'success');
    }

    return data;
  } catch (err: any) {
    const errorMsg = `Failed to stop engine: ${err.message}`;
    addLog(errorMsg, 'error');
    setError(errorMsg);
    throw err; // Re-throw to be caught by handleStopEngine
  } finally {
    setIsLoading(false);
  }
};
// #endregion
// region Helpers
  // Helper function to get log color based on type
  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'text-error';
      case 'success':
        return 'text-success';
      case 'warning':
        return 'text-warning';
      case 'engine':
        return 'text-primary';
      default:
        return 'text-base-content';
    }
  };
// endregion
// region Html
  return (
    <>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">ELI5 Engine Control Panel</h1>
        
        {error && (
          <Alert
            status="error"
            className="mb-4"
            icon={<AlertTriangle />}
          >
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="form-control w-full">
            <label className="label" htmlFor="marketRegionSelect">
              <span className="label-text flex items-center">
                <MapPin size={16} className="mr-1" /> Market Region
              </span>
            </label>
            <Select
              id="marketRegionSelect"
              value={selectedMarketRegion}
              onChange={(e) => setSelectedMarketRegion(e.target.value)}
              className="select select-bordered w-full"
              disabled={isLoading && (engineStatus === 'starting' || engineStatus === 'running')}
            >
              <option value="">Select a market region</option>
              {marketRegions.map((region) => (
                <option key={region.id} value={region.name}>
                  {region.name} {region.lead_count ? `(${region.lead_count})` : ''}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button 
              color="primary" 
              startIcon={<PlayCircle />}
              loading={engineStatus === 'starting' || engineStatus === 'running'}
              onClick={() => {
                void (async () => {
                  try {
                    await handleStartEngine();
                  } catch (error) {
                    console.error('Engine start failed:', error);
                  }
                })();
              }}
              disabled={isLoading || !selectedMarketRegion}
              className="flex-1"
            >
              {engineStatus === 'running' ? 'Running...' : 'Start Engine'}
            </Button>
            
            <Button 
              color="error" 
              startIcon={<StopCircle />}
              loading={engineStatus === 'stopping'}
              onClick={() => { handleStopEngine().catch(console.error) }}
              disabled={!['running', 'starting'].includes(engineStatus)}
              className="flex-1"
            >
              Stop Engine
            </Button>
            
            <Button 
              color="secondary" 
              startIcon={<Mail />}
              loading={engineStatus === 'test_sending'}
              onClick={handleSendTestEmail}
              disabled={isLoading || !selectedMarketRegion}
              className="flex-1"
            >
              Send Test Email
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-base-100 shadow-xl">
          <Card.Body>
            <Card.Title className="flex items-center">
              <Info className="text-info mr-2" />
              Engine Status
            </Card.Title>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Current Status:</span>
                <span className="font-semibold capitalize">{engineStatus}</span>
              </div>
              <div className="flex justify-between">
                <span>Selected Market:</span>
                <span className="font-semibold">
                  {selectedMarketRegion || 'None selected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Log Entries:</span>
                <span className="font-semibold">{consoleLogs.length}</span>
              </div>
            </div>
            <Card.Actions className="mt-4">
              <Button
                color="secondary"
                size="sm"
                startIcon={<RefreshCw size={14} />}
                onClick={() => setConsoleLogs([])}
                disabled={consoleLogs.length === 0}
              >
                Clear Logs
              </Button>
              <Button
                color="accent"
                size="sm"
                startIcon={<Mail size={14} />}
                onClick={handleSendTestEmail}
                disabled={isLoading || !selectedMarketRegion}
              >
                Send Test Email
              </Button>
            </Card.Actions>
          </Card.Body>
        </Card>

        <Card className="bg-base-100 shadow-xl">
          <Card.Body>
            <Card.Title>Engine Logs</Card.Title>
            <div className="h-64 overflow-y-auto bg-base-200 rounded p-4">
              {consoleLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-base-content/50">
                  No logs available. Start the engine to see activity.
                </div>
              ) : (
                <div className="space-y-2">
                  {consoleLogs.map((log) => (
                    <div key={log.id} className={`text-sm font-mono ${getLogColor(log.type)}`}>
                      <span className="opacity-70">
                        [{new Date(log.timestamp).toLocaleTimeString()}]{' '}
                      </span>
                      {log.message}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      </div>
    </>
  );
};
// endregion
export default Eli5EngineControlView;