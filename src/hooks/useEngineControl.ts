// src/hooks/useEngineControl.ts
import { useState, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export type EngineStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'test_sending';

interface StartEngineParams {
  marketRegion: string;
  isDryRun: boolean;
  limitPerRun: number;
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  selectedSenderIds?: string[];
}

export function useEngineControl() {
  const supabase = useSupabaseClient();
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEngine = useCallback(async (params: StartEngineParams) => {
    const {
      marketRegion,
      isDryRun,
      limitPerRun,
      minIntervalSeconds,
      maxIntervalSeconds,
      selectedSenderIds = []
    } = params;

    setIsLoading(true);
    setError(null);
    setEngineStatus('starting');

    try {
      const { error: rpcError } = await supabase.rpc('start_eli5_engine', {
        p_dry_run: isDryRun,
        p_limit_per_run: limitPerRun,
        p_market_region: marketRegion,
        p_min_interval_seconds: minIntervalSeconds,
        p_max_interval_seconds: maxIntervalSeconds,
        p_selected_sender_ids: selectedSenderIds.length ? selectedSenderIds : null,
      });

      if (rpcError) throw rpcError;

      setEngineStatus('running');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start engine';
      setError(errorMessage);
      setEngineStatus('error');
      console.error('Engine start error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const stopEngine = useCallback(async (marketRegion: string) => {
    if (!marketRegion) {
      setError('Market region is required');
      return false;
    }

    setIsLoading(true);
    setError(null);
    setEngineStatus('stopping');

    try {
      const { error: rpcError } = await supabase.rpc('stop_eli5_engine', {
        p_market_region: marketRegion,
      });

      if (rpcError) throw rpcError;

      setEngineStatus('stopped');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop engine';
      setError(errorMessage);
      setEngineStatus('error');
      console.error('Engine stop error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const resetEngine = useCallback(() => {
    setEngineStatus('idle');
    setError(null);
  }, []);

  return {
    engineStatus,
    isLoading,
    error,
    startEngine,
    stopEngine,
    resetEngine,
  };
}