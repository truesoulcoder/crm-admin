// src/components/views/Eli5EngineControlView.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, Button, Select, Alert } from 'react-daisyui';
import { Toggle } from 'react-daisyui';
import { Range } from 'react-daisyui';
import { useEngineControl } from '@/hooks/useEngineControl';
import { useMarketRegions } from '@/hooks/useMarketRegions';
import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/db_types';

type LogEntry = {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning' | 'engine';
  data?: any;
};

type EngineStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'test_sending';

const Eli5EngineControlView: React.FC = () => {
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [isDryRun, setIsDryRun] = useState<boolean>(false);
  const [limitPerRun, setLimitPerRun] = useState<number>(10);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState<number>(100);
  const [maxIntervalSeconds, setMaxIntervalSeconds] = useState<number>(1000);
  const [selectedSenderIds, setSelectedSenderIds] = useState<string[]>([]);
  const [availableSenders, setAvailableSenders] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [error, setError] = useState<string | null>(null);

  // Use the custom hooks
  const { marketRegions, selectedMarketRegion, setSelectedMarketRegion } = useMarketRegions();
  const { engineStatus, error: engineError, isLoading, startEngine, stopEngine } = useEngineControl();

  // Fetch available senders
  const fetchSenders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('email_senders')
        .select('id, name, email')
        .order('name');

      if (error) throw error;
      setAvailableSenders(data || []);
    } catch (err) {
      console.error('Error fetching senders:', err);
      setError('Failed to load email senders');
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
        limitPerRun,
        minIntervalSeconds,
        maxIntervalSeconds,
        selectedSenderIds: selectedSenderIds.length ? selectedSenderIds : undefined
      });
      setError(null);
    } catch (err) {
      console.error('Failed to start engine:', err);
      setError('Failed to start engine. Please check the console for details.');
    }
  }, [selectedMarketRegion, isDryRun, limitPerRun, minIntervalSeconds, maxIntervalSeconds, selectedSenderIds, startEngine]);

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
      setError('Failed to stop engine. Please check the console for details.');
    }
  }, [selectedMarketRegion, stopEngine]);

  // Toggle sender selection
  const toggleSenderSelection = useCallback((senderId: string) => {
    setSelectedSenderIds(prev => 
      prev.includes(senderId)
        ? prev.filter(id => id !== senderId)
        : [...prev, senderId]
    );
  }, []);

  // Effect to fetch senders on mount
  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  // Effect to handle engine errors
  useEffect(() => {
    if (engineError) {
      setError(engineError);
    }
  }, [engineError]);

  // Effect to auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">ELI5 Engine Control</h1>
      
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-4">
              <label htmlFor="marketRegion" className="block mb-2">Market Region</label>
              <Select
                id="marketRegion"
                value={selectedMarketRegion}
                onChange={(e) => setSelectedMarketRegion(e.target.value)}
                disabled={isLoading}
              >
                {marketRegions.map(region => (
                  <option key={region.id} value={region.name}>
                    {region.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mb-4">
              <label htmlFor="limitPerRun" className="block mb-2">{`Limit per run: ${limitPerRun}`}</label>
              <Range
                id="limitPerRun"
                min={1}
                max={100}
                value={limitPerRun}
                onChange={(e) => setLimitPerRun(Number(e.target.value))}
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
              <Toggle
                checked={isDryRun}
                label="Dry Run"
                onChange={setIsDryRun}
                disabled={isLoading}
              />
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
            color="blue"
            onClick={handleStartEngine}
            disabled={isLoading || engineStatus === 'running' || engineStatus === 'starting'}
          >
            {isLoading && engineStatus === 'starting' ? (
              <div className="flex items-center">
                <Spinner size="sm" className="mr-2" />
                Starting...
              </div>
            ) : (
              'Start Engine'
            )}
          </Button>
          
          <Button
            color="red"
            onClick={handleStopEngine}
            disabled={isLoading || engineStatus === 'idle' || engineStatus === 'stopping'}
          >
            {isLoading && engineStatus === 'stopping' ? (
              <div className="flex items-center">
                <Spinner size="sm" className="mr-2" />
                Stopping...
              </div>
            ) : (
              'Stop Engine'
            )}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-2">Console Output</h2>
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

export default Eli5EngineControlView;