'use client';

import { RealtimeChannel } from '@supabase/supabase-js';
import { PlayCircle, StopCircle, Mail, AlertTriangle, Info, CheckCircle, RefreshCw, MapPin } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Alert, Input, Select } from 'react-daisyui';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/db_types';

import type { JSX } from 'react';

interface Eli5EmailLogEntry {
  id: string;
  created_at: string;
  message: string;
  market_region: string;
  [key: string]: any; // Allow additional properties
}

type MarketRegion = Database['public']['Tables']['market_regions']['Row'];

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning' | 'engine';
  data?: unknown;
}

type EngineStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'test_sending';

const Eli5EngineControlView: React.FC = () => {
  const [selectedMarketRegion, setSelectedMarketRegion] = useState<string>('');
  const [marketRegions, setMarketRegions] = useState<MarketRegion[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [limitPerRun, setLimitPerRun] = useState<number>(10);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState<number>(60);
  const [availableSenders, setAvailableSenders] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [selectedSenderIds, setSelectedSenderIds] = useState<string[]>([]);
  const [maxIntervalSeconds, setMaxIntervalSeconds] = useState<number>(1000);
  const consoleEndRef = useRef<null | HTMLDivElement>(null);

  // Define addLog first since it's used in the effects
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', data?: unknown): void => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      message,
      type,
      data
    };
    
    setConsoleLogs(prevLogs => [...prevLogs, logEntry]);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (consoleEndRef.current) {
        consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // Set up real-time subscription to eli5_email_log
  useEffect(() => {
    // Only subscribe if we have a selected market region
    if (!selectedMarketRegion) return;

    let channel: RealtimeChannel | null = null;
    
    try {
      channel = supabase
        .channel('realtime-email-logs')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'eli5_email_log',
            filter: `market_region=eq.${selectedMarketRegion}`
          },
          (payload: { new: Eli5EmailLogEntry }) => {
            const newLog = payload.new;
            // Only add logs that match our current market region
            if (newLog.market_region === selectedMarketRegion) {
              addLog(newLog.message || 'New log entry', 'info', newLog);
            }
          }
        )
        .subscribe();

      // Handle potential subscription errors
      channel?.on('error', (event: Event) => {
        const error = event instanceof Error ? event : new Error('Unknown error in logs channel');
        console.error('Error in logs channel:', error);
        addLog(`Error in logs channel: ${error.message}`, 'error');
      });
    } catch (err) {
      const error = err as Error;
      console.error('Error setting up subscription:', error);
      addLog(`Error setting up real-time updates: ${error.message}`, 'error');
    }

    // Cleanup subscription on unmount or when market region changes
    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch((error: Error) => {
          console.error('Error removing channel:', error);
        });
      }
    };
  }, [selectedMarketRegion, addLog]);

  // Load initial logs
  useEffect(() => {
    const fetchInitialLogs = async () => {
      if (!selectedMarketRegion) return;
      
      try {
        const { data: logs, error } = await supabase
          .from('eli5_email_log')
          .select('*')
          .eq('market_region', selectedMarketRegion)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        // Add logs in reverse order (oldest first)
        logs.reverse().forEach((log: Eli5EmailLogEntry) => {
          addLog(log.message || 'Log entry', 'info', log);
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error fetching initial logs:', errorMessage);
        addLog('Failed to load initial logs', 'error');
      }
    };

    fetchInitialLogs().catch((error) => {
      console.error('Error in fetchInitialLogs:', error);
    });
  }, [selectedMarketRegion, addLog]);

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

    fetchMarketRegions().catch(console.error);
  }, [selectedMarketRegion, addLog]);

  // Update the handleSendTestEmail function to use selectedMarketRegion
  const handleSendTestEmail = () => {
    // Wrap the async function to avoid returning a promise to the onClick handler
    void (async () => {
      if (!selectedMarketRegion) {
        setError('Please select a market region first');
        return;
      }

      setEngineStatus('test_sending');
      setError('');
      addLog(`Sending test email for market region: ${selectedMarketRegion}...`, 'info');

      try {
        const response = await fetch('/api/eli5-engine/test-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            marketRegion: selectedMarketRegion,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `API request failed with status ${response.status}`);
        }

        if (result.success) {
          addLog(`Test email sent successfully for market region: ${selectedMarketRegion}`, 'success');
        } else {
          throw new Error(result.error || 'Failed to send test email');
        }
      } catch (err: unknown) {
        const errorMessage = `Error sending test email: ${err instanceof Error ? err.message : 'Unknown error'}`;
        addLog(errorMessage, 'error');
        setError(errorMessage);
      } finally {
        setEngineStatus('idle');
      }
    })();
  };

  // Update the handleStartEngine function to use selectedMarketRegion
  const handleStartEngine = (): void => {
    const startEngine = async (): Promise<void> => {
      if (!selectedMarketRegion) {
        setError('Please select a market region first');
        return;
      }

      setEngineStatus('starting');
      setError('');
      addLog(`Starting ELI5 Engine for market region: ${selectedMarketRegion}...`, 'engine');
      setIsLoading(true);

      try {
        const response = await fetch('/api/eli5-engine/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            marketRegion: selectedMarketRegion,
            limitPerRun,
            minIntervalSeconds,
            maxIntervalSeconds,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `API request failed with status ${response.status}`);
        }

        if (result.success) {
          addLog(`ELI5 Engine started successfully for market region: ${selectedMarketRegion}`, 'success');
          setEngineStatus('running');
        } else {
          throw new Error(result.error || 'Failed to start ELI5 Engine');
        }
      } catch (err: unknown) {
        const errorMessage = `Error starting ELI5 Engine: ${err instanceof Error ? err.message : 'Unknown error'}`;
        addLog(errorMessage, 'error');
        setError(errorMessage);
        setEngineStatus('error');
      } finally {
        setIsLoading(false);
      }
    };
    
    void startEngine();
  };

  const handleStopEngine = () => {
    const stopEngine = async () => {
      setEngineStatus('stopping');
      setError('');
      addLog('Stopping ELI5 Engine...', 'engine');
      setIsLoading(true);

      try {
        const response = await fetch('/api/eli5-engine/stop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `API request failed with status ${response.status}`);
        }

        if (result.success) {
          addLog('ELI5 Engine stopped successfully', 'success');
          setEngineStatus('stopped');
        } else {
          throw new Error(result.error || 'Failed to stop ELI5 Engine');
        }
      } catch (err: unknown) {
        const errorMessage = `Error stopping ELI5 Engine: ${err instanceof Error ? err.message : 'Unknown error'}`;
        addLog(errorMessage, 'error');
        setError(errorMessage);
        setEngineStatus('error');
      } finally {
        setIsLoading(false);
      }
    })();
  };
    //   setIsLoading(false);
    // }
  };

  // return (
  //   <div className="container mx-auto p-4">
  //     <h1 className="text-2xl font-bold mb-6">ELI5 Engine Control Panel</h1>
      
  //     {error && (
  //       <Alert status="error" className="mb-4">
  //         <Alert.Icon><AlertTriangle /></Alert.Icon>
  //         {error}
  //       </Alert>
  //     )}

  //     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
  //       <div className="form-control w-full">
  //         <label className="label" htmlFor="marketRegionSelect">
  //           <span className="label-text flex items-center">
  //             <MapPin size={16} className="mr-1" /> Market Region
  //           </span>
  //         </label>
  //         <Select
  //           id="marketRegionSelect"
  //           value={selectedMarketRegion}
  //           onChange={(e) => setSelectedMarketRegion(e.target.value)}
  //           className="select select-bordered w-full"
  //           disabled={isLoading && (engineStatus === 'starting' || engineStatus === 'running')}
  //         >
  //           <option value="">Select a market region</option>
  //           {marketRegions.map((region) => (
  //             <option key={region.id} value={region.name}>
  //               {region.name} {region.lead_count ? `(${region.lead_count})` : ''}
  //             </option>
  //           ))}
  //         </Select>
  //       </div>

  //       <div className="flex items-end gap-2">
  //         <Button 
  //           color="primary" 
  //           startIcon={<PlayCircle />}
  //           loading={engineStatus === 'starting' || engineStatus === 'running'}
  //           onClick={handleStartEngine}
  //           disabled={isLoading || !selectedMarketRegion}
  //         >
  //           {engineStatus === 'running' ? 'Running...' : 'Start Engine'}
  //         </Button>
          
  //         <Button 
  //           color="error" 
  //           startIcon={<StopCircle />}
  //           loading={engineStatus === 'stopping'}
  //           onClick={handleStopEngine}
  //           disabled={!['running', 'starting'].includes(engineStatus)}
  //         >
  //           Stop Engine
  //         </Button>
          
  //         <Button 
  //           color="secondary" 
  //           startIcon={<Mail />}
  //           loading={engineStatus === 'test_sending'}
  //           onClick={handleSendTestEmail}
  //           disabled={isLoading || !selectedMarketRegion}
  //         >
  //           Send Test Email
  //         </Button>
  //       </div>
  //     </div>

  //     <div className="mt-6">
  //       <h2 className="text-xl font-semibold mb-2">Console Logs</h2>
  //       <div className="bg-base-200 p-4 rounded-lg h-96 overflow-y-auto">
  //         {consoleLogs.length === 0 ? (
  //           <div className="text-base-content/50 italic">No logs yet. Start the engine to see activity.</div>
  //         ) : (
  //           <div className="space-y-2">
  //             {consoleLogs.map((log) => (
  //               <div key={log.id} className={`text-sm font-mono ${getLogColor(log.type)}`}>
  //                 <span className="opacity-70">[{new Date(log.timestamp).toLocaleTimeString()}] </span>
  //                 {log.message}
  //               </div>
  //             ))}
  //             <div ref={consoleEndRef} />
  //           </div>
  //         )}
  //       </div>
  //     </div>
  //   </div>
  // );

  // return (
  //   <div style={{ padding: '20px', backgroundColor: 'lightyellow', border: '1px solid orange' }}>
  //     <h1>ELI5 Engine Control View - Simplified for Debugging</h1>
  //     <p>If you see this, the basic component is rendering.</p>
  //   </div>
  // );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">ELI5 Engine Control Panel</h1>
      
      {error && (
        <div className="alert alert-error mb-4">
          <div className="flex items-center">
            {renderAlertIcon('error')}
            <span>{error}</span>
          </div>
        </div>
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
            onClick={handleStartEngine}
            disabled={isLoading || !selectedMarketRegion}
          >
            {engineStatus === 'running' ? 'Running...' : 'Start Engine'}
          </Button>
          
          <Button 
            color="error" 
            startIcon={<StopCircle />}
            loading={engineStatus === 'stopping'}
            onClick={handleStopEngine}
            disabled={!['running', 'starting'].includes(engineStatus)}
          >
            Stop Engine
          </Button>
          
          <Button 
            color="secondary" 
            startIcon={<Mail />}
            loading={engineStatus === 'test_sending'}
            onClick={handleSendTestEmail}
            disabled={isLoading || !selectedMarketRegion}
          >
            Send Test Email
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Console Logs</h2>
        <div className="bg-base-200 p-4 rounded-lg h-96 overflow-y-auto">
          {consoleLogs.length === 0 ? (
            <div className="text-base-content/50 italic">No logs yet. Start the engine to see activity.</div>
          ) : (
            <div className="space-y-2">
              {consoleLogs.map((log) => (
                <div key={log.id} className={`text-sm font-mono ${getLogColor(log.type)}`}>
                  <span className="opacity-70">[{new Date(log.timestamp).toLocaleTimeString()}] </span>
                  {log.message}
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
// Helper function to get log color based on type
const getLogColor = (type: LogEntry['type']) => {
  switch (type) {
    case 'error':
      return 'text-red-500';
    case 'success':
      return 'text-green-500';
    case 'warning':
      return 'text-yellow-500';
    case 'engine':
      return 'text-blue-500';
    default:
      return 'text-base-content';
  }
};

// Helper function to render alert icon
const renderAlertIcon = (status: 'info' | 'error' | 'success' | 'warning' | undefined) => {
  switch (status) {
    case 'error':
      return <AlertTriangle className="h-5 w-5" />;
    case 'success':
      return <CheckCircle className="h-5 w-5" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5" />;
    case 'info':
    default:
      return <Info className="h-5 w-5" />;
  }
};

export default Eli5EngineControlView;