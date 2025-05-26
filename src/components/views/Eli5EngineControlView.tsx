'use client';

import { PlayCircle, StopCircle, Mail, AlertTriangle, Info, CheckCircle, RefreshCw, MapPin } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Alert, Input, Select } from 'react-daisyui';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/db_types';

import type { JSX } from 'react';

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
  }, []);

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

  // Update the handleStartEngine function to use selectedMarketRegion
  const handleStartEngine = async () => {
    if (!selectedMarketRegion) {
      const msg = 'Please select a market region.';
      addLog(msg, 'warning');
      setError(msg);
      return;
    }

    addLog(`Initiating ELI5 Engine start sequence for market region: ${selectedMarketRegion}...`, 'engine');
    setIsLoading(true);
    setEngineStatus('starting');
    setError(null);

    try {
      const response = await fetch('/api/eli5-engine/start-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_region: selectedMarketRegion,
          selected_sender_ids: selectedSenderIds,
          min_interval_seconds: minIntervalSeconds,
          max_interval_seconds: maxIntervalSeconds,
          limit_per_run: limitPerRun,
          dry_run: isDryRun,
          campaign_id: "default_campaign_id", // Placeholder
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `API request failed with status ${response.status}`);
      }

      if (result.success) {
        addLog(`ELI5 Engine started successfully for market region: ${selectedMarketRegion}. Campaign ID: ${result.campaignId}`, 'success');
        setEngineStatus('running');
      } else {
        throw new Error(result.error || 'Failed to start ELI5 Engine');
      }
    } catch (err: any) {
      const errorMessage = `Error starting ELI5 Engine: ${err.message}`;
      addLog(errorMessage, 'error');
      setError(errorMessage);
      setEngineStatus('error');
    } finally {
      setIsLoading(false);
      // Do not reset to 'idle' immediately if it started successfully or if there was an error.
      // The status should remain 'running' or 'error' until explicitly stopped or resolved.
      if (engineStatus === 'starting' && !error) {
        // If it was 'starting' and no error occurred, it should now be 'running'
        // (set in the try block). If an error occurred, it's 'error'.
      } else if (engineStatus === 'starting' && error) {
        // If an error occurred during starting, it's already 'error'.
      }
    }
  };

  // Dummy handleStopEngine function to be implemented later
  const handleStopEngine = async () => {
    addLog('Stop engine functionality not implemented yet.', 'warning');
    // Placeholder for future implementation
    // setEngineStatus('stopping');
    // setIsLoading(true);
    // try {
    //   // API call to stop the engine
    //   setEngineStatus('stopped');
    //   addLog('Engine stopped.', 'info');
    // } catch (err) {
    //   addLog('Error stopping engine.', 'error');
    //   setEngineStatus('error'); // Or back to 'running' if stop failed
    // } finally {
    //   setIsLoading(false);
    // }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">ELI5 Engine Control Panel</h1>
      
      {error && (
        <Alert status="error" className="mb-4">
          <Alert.Icon><AlertTriangle /></Alert.Icon>
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

export default Eli5EngineControlView;