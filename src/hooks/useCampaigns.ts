import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Campaign, CampaignJob } from '@/types/campaign';
import { Database } from '@/types/db_types';

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [jobs, setJobs] = useState<CampaignJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
      return data || [];
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load campaigns';
      setError(errorMessage);
      console.error('Error fetching campaigns:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const fetchJobs = useCallback(async (campaignId: string) => {
    if (!campaignId) return [];
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_jobs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('next_processing_time', { ascending: true });

      if (error) throw error;
      setJobs(data || []);
      return data || [];
    } catch (err) {
      setError('Failed to load jobs');
      console.error('Error fetching jobs:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Add other shared methods like startCampaign, stopCampaign, etc.

  return {
    campaigns,
    jobs,
    isLoading,
    error,
    fetchCampaigns,
    fetchJobs,
    // Add other methods
  };
}