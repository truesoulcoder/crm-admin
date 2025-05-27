// src/hooks/useMarketRegions.ts
import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/ssr';

export function useMarketRegions() {
  const supabase = useSupabaseClient();
  const [marketRegions, setMarketRegions] = useState<any[]>([]);
  const [selectedMarketRegion, setSelectedMarketRegion] = useState<string>('');

  const fetchMarketRegions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('market_regions')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      if (data?.length) {
        setMarketRegions(data);
        if (!selectedMarketRegion) {
          setSelectedMarketRegion(data[0]?.name || '');
        }
      }
    } catch (err) {
      console.error('Error fetching market regions:', err);
    }
  }, [supabase, selectedMarketRegion]);

  useEffect(() => {
    fetchMarketRegions();
  }, [fetchMarketRegions]);

  return {
    marketRegions,
    selectedMarketRegion,
    setSelectedMarketRegion,
    fetchMarketRegions,
  };
}