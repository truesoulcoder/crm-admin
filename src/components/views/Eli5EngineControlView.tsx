// src/components/views/Eli5EngineControlView.tsx
import { createBrowserClient } from '@supabase/ssr';
import { useState, useEffect, useRef, FC, useCallback } from 'react';
import { Badge, Card, Button, Select, Table, Toggle, Range, Alert } from 'react-daisyui';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useEngineControl } from '@/hooks/useEngineControl';
import { useMarketRegions } from '@/hooks/useMarketRegions';
import { Database } from '@/types/db_types';

// Define types for our data
interface Sender {
  id: string;
  email: string;
  status: string;
  quota: number;
}

interface MarketRegion {
  name: string;
  id: string;
  normalized_name: string;
}

interface EngineControlProps {
  // Add any props here if needed
  className?: string;
  children?: React.ReactNode;
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning' | 'engine';
  data?: any
}

type EngineStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'test_sending';

type EmailMetrics = {
  email: string;
  name: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  total_sent: number;
  delivery_rate: number;
  bounce_rate: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
};

type MetricsPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: EmailMetrics;
  old?: EmailMetrics | null;
};

const handleError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unknown error occurred';
};

const Eli5EngineControlViewInner: React.FC = () => {
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [consoleLogs] = useState<LogEntry[]>([]);
  const [isDryRun, setIsDryRun] = useState<boolean>(false);
  const [senderQuota, setSenderQuota] = useState<number>(10);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState<number>(100);
  const [maxIntervalSeconds, setMaxIntervalSeconds] = useState<number>(1000);
  const [selectedSenderIds, setSelectedSenderIds] = useState<string[]>([]);
  const [availableSenders, setAvailableSenders] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [error, setError] = useState<string | null>(null);

  // Use the custom hooks
  const {
    engineStatus,
    engineState,
    error: engineError,
    isLoading,
    startEngine,
    stopEngine,
  } = useEngineControl();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    marketRegions, 
    selectedMarketRegion, 
    setSelectedMarketRegion,
    error: regionsError,
    isLoading: regionsLoading
  } = useMarketRegions();
  
  // State for email metrics
  const [emailMetrics, setEmailMetrics] = useState<EmailMetrics[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Fetch available senders
  const fetchSenders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('senders')
        .select('id, name, email')
        .order('name');

      if (error) throw error;
      setAvailableSenders(data || []);
    } catch (err) {
      console.error('Error fetching senders:', err);
      setError(handleError(err));
    }
  }, [supabase]);

  // Handle start engine
  const handleStartEngine = useCallback(async () => {
    if (!selectedMarketRegion) {
      setError('Please select a market region');
      return;
    }

    try {
      await startEngine({
        marketRegion: selectedMarketRegion,
        isDryRun,
        limitPerRun: senderQuota, // Using senderQuota as limitPerRun for backward compatibility
        minIntervalSeconds,
        maxIntervalSeconds,
        selectedSenderIds: selectedSenderIds.length ? selectedSenderIds : undefined
      });
      setError(null);
    } catch (err) {
      console.error('Failed to start engine:', err);
      setError(handleError(err));
    }
  }, [selectedMarketRegion, isDryRun, senderQuota, minIntervalSeconds, maxIntervalSeconds, selectedSenderIds, startEngine]);

  // Handle stop engine
  const handleStopEngine = useCallback(async () => {
    if (!selectedMarketRegion) {
      setError('Please select a market region');
      return;
    }

    try {
      await stopEngine();
      setError(null);
    } catch (err) {
      console.error('Failed to stop engine:', err);
      setError(handleError(err));
    }
  }, [selectedMarketRegion, stopEngine]);

  // Toggle sender selection
  const toggleSenderSelection = useCallback((senderId: string) => {
    setSelectedSenderIds((prev: string[]) => 
      prev.includes(senderId)
        ? prev.filter((id: string) => id !== senderId)
        : [...prev, senderId]
    );
  }, []);

  // Fetch email metrics
  const fetchEmailMetrics = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('email_metrics_by_sender')
        .select('*')
        .order('sent', { ascending: false });

      if (error) throw error;
      setEmailMetrics(data || []);
    } catch (err) {
      console.error('Error fetching email metrics:', err);
      setMetricsError(handleError(err));
    } finally {
      setMetricsLoading(false);
    }
  }, [supabase]);

  // Set up real-time subscription to email metrics
  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchEmailMetrics();
      } catch (err) {
        console.error('Failed to fetch email metrics:', err);
      }
    };
    // Explicitly void the Promise since we handle errors via catch
    // This is done to avoid TypeScript complaining about unhandled Promises
    void fetchData().catch(error => {
      console.error('Error in fetchData:', error);
      // TODO: Add proper error handling for your use case
    });

    // Set up subscription
    const subscription = supabase
      .channel('email_metrics_changes')
      .on<MetricsPayload>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_metrics_by_sender' },
        (payload) => {
          console.log('Change received:', payload);
          // Explicitly voiding Promise since we handle errors via .catch()
          void fetchEmailMetrics().catch(err => 
            console.error('Failed to refresh metrics:', handleError(err))
          );
        }
      );
    void subscription.subscribe();

    // Clean up subscription on unmount
    return () => {
      void subscription.unsubscribe();
    };
  }, [fetchEmailMetrics, supabase]);

  // Effect to fetch senders on mount
  useEffect(() => {
    fetchSenders().catch((error) => {
      console.error('Failed to fetch senders:', error);
      setError(handleError(error));
    });
  }, [fetchSenders]);

  // Effect to handle engine errors
  useEffect(() => {
    if (engineError) {
      setError(handleError(engineError));
    }
  }, [engineError]);

  // Effect to auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // Get status badge based on engine status
  const getStatusBadge = (status: string) => {
    const statusText = status.charAt(0).toUpperCase() + status.slice(1);
    let color: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'neutral';
    
    switch (status) {
      case 'running':
        color = 'success';
        break;
      case 'starting':
      case 'stopping':
        color = 'warning';
        break;
      case 'error':
        color = 'error';
        break;
      case 'idle':
      case 'stopped':
      default:
        color = 'info';
    }
    
    return (
      <Badge color={color} className="font-mono">
        {statusText}
        {status === 'running' && (
          <span className="ml-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </span>
        )}
      </Badge>
    );
  };

  // Handle metrics update
  const handleMetricsUpdate = (payload: MetricsPayload) => {
    console.log('Metrics updated:', payload);  };

  const handleStartEngineWrapper = async () => {
    await startEngine({
      marketRegion: selectedMarketRegion,
      isDryRun,
      limitPerRun: senderQuota,
      minIntervalSeconds,
      maxIntervalSeconds,
      selectedSenderIds
    });
  };

  const handleStopEngineWrapper = async () => {
    await handleStopEngine().catch(console.error);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ELI5 Engine Control</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Status:</span>
          {getStatusBadge(engineStatus)}
        </div>
      </div>
      
      {error && (
        <div className="alert alert-error">
          <div>
            <span>{error}</span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <Card className="relative">
        {engineStatus === 'running' && (
          <div className="absolute top-4 right-4">
            <div className="flex items-center space-x-1 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
              </span>
              <span>Active</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-4">
              <label htmlFor="marketRegion" className="block mb-2">Market Region</label>
              <Select 
                id="marketRegion"
                value={selectedMarketRegion}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMarketRegion(e.target.value)}
                disabled={isLoading || regionsLoading}
              >
                {marketRegions.map(region => (
                  <option key={region.id} value={region.name}>
                    {region.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mb-4">
              <label htmlFor="senderQuota" className="block mb-2">{`Sender Quota: ${senderQuota}`}</label>
              <Range
                id="senderQuota"
                min={1}
                max={100}
                value={senderQuota}
                onChange={(e) => setSenderQuota(Number(e.target.value))}
                disabled={isLoading}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="minInterval" className="block mb-2">{`Min interval: ${minIntervalSeconds}s`}</label>
              <Range
                id="minInterval"
                min={10}
                max={300}
                value={minIntervalSeconds}
                onChange={(e) => setMinIntervalSeconds(Number(e.target.value))}
                disabled={isLoading}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="maxInterval" className="block mb-2">{`Max interval: ${maxIntervalSeconds}s`}</label>
              <Range
                id="maxInterval"
                min={minIntervalSeconds + 10}
                max={600}
                value={maxIntervalSeconds}
                onChange={(e) => setMaxIntervalSeconds(Number(e.target.value))}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center mb-4">
              <label className="label cursor-pointer">
                <span className="label-text mr-2">Dry Run</span>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  disabled={isLoading}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block mb-2">Available Senders</label>
            <div className="max-h-48 overflow-y-auto border rounded p-2">
              {availableSenders.map(sender => (
                <div key={sender.id} className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id={`sender-${sender.id}`}
                    checked={selectedSenderIds.includes(sender.id)}
                    onChange={() => toggleSenderSelection(sender.id)}
                    disabled={isLoading}
                    className="mr-2"
                  />
                  <label htmlFor={`sender-${sender.id}`} className="text-sm">
                    {sender.name} &lt;{sender.email}&gt;
                  </label>
                </div>
              ))}
              {availableSenders.length === 0 && (
                <p className="text-sm text-gray-500">No senders available</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex space-x-4 mt-6">
          <Button
            color="primary"
            onClick={() => {
              handleStartEngineWrapper().catch(console.error);
            }}
            disabled={isLoading || ['running', 'starting'].includes(engineStatus)}
          >
            {isLoading && ['starting'].includes(engineStatus) ? (
              <div className="flex items-center">
                <div className="loading loading-spinner loading-sm mr-2"></div>
                Starting...
              </div>
            ) : 'Start Engine'}
          </Button>
          
          <Button
            color="error"
            onClick={() => void handleStopEngineWrapper()}
            disabled={isLoading || ['idle', 'stopping'].includes(engineStatus)}
          >
            {isLoading && ['stopping'].includes(engineStatus) ? (
              <div className="flex items-center">
                <div className="loading loading-spinner loading-sm mr-2"></div>
                Stopping...
              </div>
            ) : 'Stop Engine'}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Console Output</h2>
          <div className="text-sm text-gray-500">
            {engineStatus === 'running' ? (
              <span className="flex items-center">
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Logging active
              </span>
            ) : (
              'Logging paused'
            )}
          </div>
        </div>
        <div className="bg-gray-900 text-green-400 p-4 rounded h-64 overflow-y-auto font-mono text-sm">
          {consoleLogs.length === 0 ? (
            <p className="text-gray-500">No logs yet. Start the engine to see activity.</p>
          ) : (
            consoleLogs.map((log, index) => (
              <div key={index} className={`mb-1 ${getLogColor(log.type)}`}>
                <span className="text-gray-500">[{log.timestamp}] </span>
                {log.message}
              </div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>
      </Card>

      {/* Email Metrics Table */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Email Metrics by Sender</h2>
          <Button 
            size="sm" 
            onClick={() => {
              fetchEmailMetrics().catch(console.error);
            }}
            disabled={metricsLoading}
          >
            {metricsLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        
        {metricsError && (
          <Alert status="error" className="mb-4">
            {metricsError}
          </Alert>
        )}

        <div className="overflow-x-auto">
          <Table zebra className="w-full">
            <Table.Head>
              <span>Sender</span>
              <span>Sent</span>
              <span>Delivered</span>
              <span>Bounced</span>
              <span>Opened</span>
              <span>Clicked</span>
              <span>Replied</span>
              <span>Delivery Rate</span>
              <span>Open Rate</span>
            </Table.Head>
            <Table.Body>
              {metricsLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-4">
                    <span className="loading loading-spinner loading-md"></span>
                    <span className="ml-2">Loading metrics...</span>
                  </td>
                </tr>
              ) : emailMetrics.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-gray-500">
                    No email metrics available
                  </td>
                </tr>
              ) : (
                emailMetrics.map((metric) => (
                  <tr key={metric.email}>
                    <td>
                      <div className="font-medium">{metric.name}</div>
                      <div className="text-xs text-gray-500">{metric.email}</div>
                    </td>
                    <td>{metric.sent.toLocaleString()}</td>
                    <td>{metric.delivered.toLocaleString()}</td>
                    <td>{metric.bounced.toLocaleString()}</td>
                    <td>{metric.opened.toLocaleString()}</td>
                    <td>{metric.clicked.toLocaleString()}</td>
                    <td>{metric.replied.toLocaleString()}</td>
                    <td>
                      <span className={`font-medium ${metric.delivery_rate >= 90 ? 'text-success' : metric.delivery_rate >= 80 ? 'text-warning' : 'text-error'}`}>
                        {metric.delivery_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className={`font-medium ${metric.open_rate >= 30 ? 'text-success' : metric.open_rate >= 20 ? 'text-warning' : 'text-error'}`}>
                        {metric.open_rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </Table.Body>
          </Table>
        </div>
      </Card>
    </div>
  );
};

// Helper function to get log color based on type
function getLogColor(type: LogEntry['type']): string {
  switch (type) {
    case 'error':
      return 'text-red-500';
    case 'success':
      return 'text-green-500';
    case 'warning':
      return 'text-yellow-500';
    case 'engine':
      return 'text-blue-400';
    default:
      return 'text-gray-300';
  }
}

export default function Eli5EngineControlView() {
  return (
    <ErrorBoundary 
      fallback={
        <div className="alert alert-error">
          Engine control failed to load. Please try refreshing the page.
        </div>
      }
      onError={(error) => console.error('Engine control error:', error)}
    >
      <Eli5EngineControlViewInner />
    </ErrorBoundary>
  );
}