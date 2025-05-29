'use client';

// src/components/views/Eli5EngineControlView.tsx

// External libraries
import { createBrowserClient } from '@supabase/ssr';
import { useState, useEffect, FC, useCallback, useRef } from 'react';
import { Badge, Card, Button, Select, Table, Range, Alert } from 'react-daisyui';
import { toast } from 'react-hot-toast';

import { ErrorBoundary } from '@/components/ErrorBoundary';
// Components
// Hooks
import { Database } from '@/db_types';
import { useEngineControl } from '@/hooks/useEngineControl';
import { useMarketRegions } from '@/hooks/useMarketRegions';
// Utilities
import { getErrorMessage } from '@/lib/utils';
// Types

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
  email: string | null;
  name: string | null;
  sent: number | null;
  delivered: number | null;
  bounced: number | null;
  opened: number | null;
  clicked: number | null;
  replied: number | null;
  total_sent: number | null;
  delivery_rate: number | null;
  bounce_rate: number | null;
  open_rate: number | null;
  click_rate: number | null;
  reply_rate: number | null;
};

type MetricsPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: EmailMetrics;
  old?: EmailMetrics | null;
};

const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

console.log('Supabase client initialized with:', {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
});

const Eli5EngineControlViewInner: FC<EngineControlProps> = ({ className, children }) => {
  console.log('Dashboard component mounting');
  
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [consoleLogs] = useState<LogEntry[]>([]);
  const [isDryRun, setIsDryRun] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [senderQuota, setSenderQuota] = useState<number>(10);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState<number>(100);
  const [maxIntervalSeconds, setMaxIntervalSeconds] = useState<number>(1000);
  const [selectedSenderIds, setSelectedSenderIds] = useState<string[]>([]);
  const [availableSenders, setAvailableSenders] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [error, setError] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<Error | null>(null);

  // Use the custom hooks
  const {
    status: engineControlStatus,
    startEngine,
    stopEngine,
  } = useEngineControl();
  const {
    marketRegions, 
    selectedMarketRegion, 
    setSelectedMarketRegion,
    loading: regionsLoading,
    fetchMarketRegions
  } = useMarketRegions();
  
  // State for email metrics
  const [emailMetrics, setEmailMetrics] = useState<EmailMetrics[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Fetch available senders
  const fetchSenders = useCallback(async () => {
    try {
      setMetricsLoading(true);
      const { data, error } = await supabase
        .from('senders')
        .select('id, name, email')
        .order('name');

      if (error) throw error;
      setAvailableSenders(data || []);
    } catch (err) {
      console.error('Error fetching senders:', getErrorMessage(err));
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Handle start engine
  const handleStartEngine = useCallback(async () => {
    try {
      setEngineError(null);
      setError(null);
      
      if (!selectedMarketRegion) {
        const error = new Error('Please select a market region');
        setEngineError(error);
        setError(error.message);
        return;
      }

      await startEngine();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to start engine:', error.message);
      setEngineError(error);
      setError(error.message);
    }
  }, [selectedMarketRegion, startEngine]);

  // Handle stop engine
  const handleStopEngine = useCallback(async () => {
    try {
      setEngineError(null);
      setError(null);
      
      if (!selectedMarketRegion) {
        const error = new Error('Please select a market region');
        setEngineError(error);
        setError(error.message);
        return;
      }

      await stopEngine();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to stop engine:', error.message);
      setEngineError(error);
      setError(error.message);
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
      setMetricsLoading(true);
      const { data, error } = await supabase
        .from('email_metrics_by_sender')
        .select('*')
        .order('sent', { ascending: false });

      if (error) {
        console.error('Failed to fetch email metrics:', getErrorMessage(error));
        setEmailMetrics([]);
        return;
      }
      setEmailMetrics(data || []);
    } catch (err) {
      console.error('Error fetching email metrics:', getErrorMessage(err));
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Set up real-time subscription to email metrics
  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchEmailMetrics();
      } catch (err) {
        console.error('Failed to fetch email metrics:', getErrorMessage(err));
      }
    };
    
    void fetchData();

    const subscription = supabase
      .channel('email_metrics_changes')
      .on<MetricsPayload>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_metrics_by_sender' },
        () => {
          void fetchEmailMetrics().catch(err => 
            console.error('Failed to refresh metrics:', getErrorMessage(err))
          );
        }
      );
    
    void subscription.subscribe();

    return () => {
      void subscription.unsubscribe();
    };
  }, [fetchEmailMetrics]);

  // Effect to fetch senders on mount
  useEffect(() => {
    void fetchSenders();
  }, [fetchSenders]);

  // Effect to handle engine errors
  useEffect(() => {
    if (engineError) {
      setError(getErrorMessage(engineError));
    }
  }, [engineError]);

  // Effect to auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // Get status badge based on engine status
  const getStatusBadge = (status: string | undefined) => {
    const displayStatus = status || 'idle';
    const statusText = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);
    let color: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'neutral';
    
    switch (displayStatus) {
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

  const [engineStatus, setEngineStatus] = useState<{
    isRunning: boolean;
    currentCampaign?: string;
    lastStarted?: string;
    lastStopped?: string;
  }>({ isRunning: false });

  const fetchEngineStatus = useCallback(async () => {
    console.log('Fetching engine status...');
    try {
      console.log('Making Supabase query to engine_control');
      const { data, error } = await supabase
        .from('engine_control')
        .select('*')
        .limit(1)
        .single()
        .throwOnError();

      console.log('Supabase query completed', { data, error });

      if (!data) {
        // If no data exists, initialize the table
        const { error: initError } = await supabase
          .from('engine_control')
          .insert([{ is_running: false }]);
        
        if (initError) throw initError;
        
        setEngineStatus({
          isRunning: false,
          currentCampaign: undefined,
          lastStarted: undefined,
          lastStopped: undefined
        });
        return;
      }

      setEngineStatus({
        isRunning: data?.is_running || false,
        currentCampaign: data?.current_campaign_id ? data.current_campaign_id : undefined,
        lastStarted: data?.last_started_at || undefined,
        lastStopped: data?.last_stopped_at || undefined
      });
    } catch (err) {
      console.error('Error fetching engine status:', getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void fetchEngineStatus();
  }, [fetchEngineStatus]);

  const handleStartEngineSupabase = async () => {
    try {
      const { error } = await supabase
        .from('engine_control')
        .update({ 
          is_running: true,
          last_started_at: new Date().toISOString()
        })
        .eq('is_running', false);

      if (error) throw error;
      await fetchEngineStatus();
    } catch (err) {
      console.error('Error starting engine:', getErrorMessage(err));
    }
  };

  const handleStopEngineSupabase = async () => {
    try {
      const { error } = await supabase
        .from('engine_control')
        .update({ 
          is_running: false,
          last_stopped_at: new Date().toISOString()
        })
        .eq('is_running', true);

      if (error) throw error;
      await fetchEngineStatus();
    } catch (err) {
      console.error('Error stopping engine:', getErrorMessage(err));
    }
  };

  const handleButtonClick = (handler: () => Promise<void>) => {
    return () => void handler().catch(console.error);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ELI5 Engine Control</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Status:</span>
          {getStatusBadge(engineControlStatus)}
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
        {engineControlStatus === 'running' && (
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
                value={selectedMarketRegion || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMarketRegion(e.target.value || null)}
                disabled={metricsLoading || regionsLoading}
              >
                {marketRegions.map(region => (
                  <option key={region.id} value={region.id}>
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
            onClick={handleButtonClick(handleStartEngine)}
            disabled={isLoading || ['running', 'starting'].includes(engineControlStatus)}
          >
            {isLoading && ['starting'].includes(engineControlStatus) ? (
              <div className="flex items-center">
                <div className="loading loading-spinner loading-sm mr-2"></div>
                Starting...
              </div>
            ) : 'Start Engine'}
          </Button>
          
          <Button
            color="error"
            onClick={handleButtonClick(handleStopEngine)}
            disabled={isLoading || ['idle', 'stopping'].includes(engineControlStatus)}
          >
            {isLoading && ['stopping'].includes(engineControlStatus) ? (
              <div className="flex items-center">
                <div className="loading loading-spinner loading-sm mr-2"></div>
                Stopping...
              </div>
            ) : 'Stop Engine'}
          </Button>

          <Button
            color="primary"
            onClick={handleButtonClick(handleStartEngineSupabase)}
            disabled={isLoading || engineStatus.isRunning}
          >
            Start Engine (Supabase)
          </Button>

          <Button
            color="error"
            onClick={handleButtonClick(handleStopEngineSupabase)}
            disabled={isLoading || !engineStatus.isRunning}
          >
            Stop Engine (Supabase)
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Console Output</h2>
          <div className="text-sm text-gray-500">
            {engineControlStatus === 'running' ? (
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
            onClick={handleButtonClick(fetchEmailMetrics)}
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
                    <td>{metric.sent?.toLocaleString() ?? 'N/A'}</td>
                    <td>{metric.delivered?.toLocaleString() ?? 'N/A'}</td>
                    <td>{metric.bounced?.toLocaleString() ?? 'N/A'}</td>
                    <td>{metric.opened?.toLocaleString() ?? 'N/A'}</td>
                    <td>{metric.clicked?.toLocaleString() ?? 'N/A'}</td>
                    <td>{metric.replied?.toLocaleString() ?? 'N/A'}</td>
                    <td>
                      <span className={`font-medium ${(metric.delivery_rate ?? 0) >= 90 ? 'text-success' : (metric.delivery_rate ?? 0) >= 80 ? 'text-warning' : 'text-error'}`}>
                        {(metric.delivery_rate?.toFixed(1) ?? '0.0')}%
                      </span>
                    </td>
                    <td>
                      <span className={`font-medium ${(metric.open_rate ?? 0) >= 50 ? 'text-success' : (metric.open_rate ?? 0) >= 30 ? 'text-warning' : 'text-error'}`}>
                        {(metric.open_rate?.toFixed(1) ?? '0.0')}%
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
      onError={(error) => console.error('Engine control error:', getErrorMessage(error))}
    >
      <Eli5EngineControlViewInner />
    </ErrorBoundary>
  );
}