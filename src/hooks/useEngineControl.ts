// src/hooks/useEngineControl.ts
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/db_types';

export function useEngineControl() {
  const [engineStatus, setEngineStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const startEngine = useCallback(async (params: any) => {
    setIsLoading(true);
    setError(null);
    try {
      setEngineStatus('starting');
      const { data, error: startError } = await supabase.rpc('start_engine', params);
      if (startError) throw startError;
      setEngineStatus('running');
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start engine');
      setEngineStatus('error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const stopEngine = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setEngineStatus('stopping');
      const { error: stopError } = await supabase.rpc('stop_engine');
      if (stopError) throw stopError;
      setEngineStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop engine');
      setEngineStatus('error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  return {
    engineStatus,
    error,
    isLoading,
    startEngine,
    stopEngine,
  };
}