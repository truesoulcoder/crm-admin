// src/hooks/useEngineControl.ts
import { useState, useCallback, useEffect } from 'react';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/db_types';

export type EngineStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'test_sending';

type EngineState = {
  status: EngineStatus;
  is_enabled: boolean;
  dry_run: boolean;
  limit_per_run: number;
  market_region: string | null;
  min_interval_seconds: number;
  max_interval_seconds: number;
  last_started_at: string | null;
  last_stopped_at: string | null;
  updated_at: string;
  selected_sender_ids: string[] | null;
};

export function useEngineControl() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch the current engine status
  const fetchEngineStatus = useCallback(async (): Promise<EngineState | null> => {
    try {
      const { data, error } = await supabase
        .from('engine_control')
        .select('*')
        .single();

      if (error) throw error;
      if (!data) return null;

      const engineData: EngineState = data;
      const status: EngineStatus = data.is_enabled ? 'running' : 'idle';
      setEngineStatus(status);
      setEngineState(engineData);
      return engineData;
    } catch (err) {
      console.error('Error fetching engine status:', err);
      setError('Failed to fetch engine status');
      setEngineStatus('error');
      return null;
    }
  }, []);

  // Set up real-time subscription to engine status
  useEffect(() => {
    // Initial fetch
    void fetchEngineStatus().catch(console.error);

    // Set up subscription
    const subscription = supabase
      .channel('engine_status_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'engine_control',
          filter: 'status_key=eq.campaign_processing_enabled'
        },
        (payload) => {
          console.log('Engine status change:', payload);
          fetchEngineStatus().catch(console.error);
        }
      )
      .subscribe();

    // Clean up subscription on unmount
    return () => {
      void subscription.unsubscribe();
    };
  }, [fetchEngineStatus]);

  const startEngine = useCallback(async (params: {
    marketRegion: string;
    isDryRun: boolean;
    limitPerRun: number;
    minIntervalSeconds: number;
    maxIntervalSeconds: number;
    selectedSenderIds?: string[];
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      setEngineStatus('starting');
      
      const { data, error: startError } = await supabase.rpc('start_eli5_engine', {
        dry_run: params.isDryRun,
        limit_per_run: params.limitPerRun,
        market_region: params.marketRegion,
        min_interval_seconds: params.minIntervalSeconds,
        max_interval_seconds: params.maxIntervalSeconds,
        selected_sender_ids: params.selectedSenderIds || null
      });
      
      if (startError) throw startError;
      
      // Update local state with the new status
      await fetchEngineStatus();
      
      return data as { status: string, message?: string };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start engine';
      setError(errorMessage);
      setEngineStatus('error');
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchEngineStatus]);

  const stopEngine = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setEngineStatus('stopping');
      
      const { error: stopError } = await supabase.rpc('stop_eli5_engine');
      if (stopError) throw stopError;
      
      // Update local state with the new status
      await fetchEngineStatus();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop engine';
      setError(errorMessage);
      setEngineStatus('error');
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchEngineStatus]);

  return {
    engineStatus,
    engineState,
    error,
    isLoading,
    startEngine,
    stopEngine,
    refreshStatus: fetchEngineStatus,
  };
}