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

    fetchMarketRegions();
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

  // Update the JSX to use Select component for market regions
  // Replace the existing market region input with this:
  <div className="form-control w-full sm:w-auto mt-3 sm:mt-0">
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

  // Update the handleStartEngine function to use selectedMarketRegion
  const handleStartEngine = async () => {
    if (!selectedMarketRegion) {
      const msg = 'Please select a market region.';
      addLog(msg, 'warning');
      setError(msg);
      return;
    }
    
    addLog(`Initiating ELI5 Engine start sequence for market region: ${selectedMarketRegion}...`, 'info');
    // ... rest of the handleStartEngine function remains the same
    // Just make sure to use selectedMarketRegion instead of marketRegion in the API call
  };
};

export default Eli5EngineControlView;