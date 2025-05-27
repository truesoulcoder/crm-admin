import { useState, useEffect } from 'react';
import { Badge, Alert } from 'react-daisyui';
import { FiPlay, FiStopCircle, FiRefreshCw, FiAlertCircle, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/db_types';

// Loading spinner component
const LoadingSpinner = () => (
  <button color="ghost" loading className="loading">
    Loading...
  </button>
);

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'running' | 'paused' | 'completed';
  is_active: boolean;
  market_region: string;
  created_at: string;
}

interface CampaignJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  contact_name: string;
  email_address: string;
  assigned_sender_id: string;
  next_processing_time: string;
  error_message?: string;
  processed_at?: string;
}

export default function CampaignsView() {
  // Using the centralized supabase client
  const user = useUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [jobs, setJobs] = useState<CampaignJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
      
      // Auto-select the first campaign if none selected
      if (data?.length && !selectedCampaign) {
        setSelectedCampaign(data[0]);
      }
    } catch (err) {
      setError('Failed to load campaigns');
      console.error('Error fetching campaigns:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch jobs for selected campaign
  const fetchJobs = async (campaignId: string) => {
    if (!campaignId) return;
    
    try {
      const { data, error } = await supabase
        .from('campaign_jobs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('next_processing_time', { ascending: true });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      setError('Failed to load jobs');
      console.error('Error fetching jobs:', err);
    }
  };

  // Start campaign
  const startCampaign = async (campaignId: string) => {
    setIsStarting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { data, error } = await supabase
        .rpc('start_eli5_engine', {
          p_dry_run: false,
          p_limit_per_run: 10,
          p_market_region: selectedCampaign?.market_region || null
        });

      if (error) throw error;
      
      setSuccess('Campaign started successfully!');
      // Refresh data
      await fetchCampaigns();
      if (selectedCampaign) {
        await fetchJobs(selectedCampaign.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to start campaign');
      console.error('Error starting campaign:', err);
    } finally {
      setIsStarting(false);
    }
  };

  // Stop campaign
  const stopCampaign = async () => {
    if (!selectedCampaign) return;
    
    setIsStopping(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { data, error } = await supabase
        .rpc('stop_eli5_engine');

      if (error) throw error;
      
      setSuccess('Campaign stopped successfully!');
      // Refresh data
      await fetchCampaigns();
      await fetchJobs(selectedCampaign.id);
    } catch (err) {
      setError(err.message || 'Failed to stop campaign');
      console.error('Error stopping campaign:', err);
    } finally {
      setIsStopping(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Fetch jobs when selected campaign changes
  useEffect(() => {
    if (selectedCampaign) {
      fetchJobs(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  // Set up real-time subscription
  useEffect(() => {
    if (!selectedCampaign) return;

    const channel = supabase
      .channel('campaign_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_jobs',
          filter: `campaign_id=eq.${selectedCampaign.id}`
        },
        (payload) => {
          console.log('Change received!', payload);
          fetchJobs(selectedCampaign.id);
        }
      )
      .subscribe();

    // Clean up subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCampaign]);

  // Calculate campaign stats
  const campaignStats = {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  const progress = campaignStats.total > 0 
    ? Math.round((campaignStats.completed / campaignStats.total) * 100) 
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Campaigns</h1>
      
      {error && (
        <Alert color="failure" className="mb-4" onDismiss={() => setError(null)}>
          <span className="font-medium">Error:</span> {error}
        </Alert>
      )}
      
      {success && (
        <Alert color="success" className="mb-4" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Campaign List */}
        <div className="card lg:col-span-1 bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Your Campaigns</h2>
              <button className="btn btn-xs btn-ghost" onClick={fetchCampaigns}>
                <FiRefreshCw className="h-4 w-4" />
                <span className="ml-1">Refresh</span>
              </button>
            </div>
            
            <div className="space-y-2">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedCampaign?.id === campaign.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedCampaign(campaign)}
              >
                <div className="font-medium">{campaign.name}</div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    {new Date(campaign.created_at).toLocaleDateString()}
                  </span>
                  <Badge
                    color={
                      campaign.status === 'running'
                        ? 'success'
                        : campaign.status === 'paused'
                        ? 'warning'
                        : campaign.status === 'completed'
                        ? 'indigo'
                        : 'gray'
                    }
                  >
                    {campaign.status}
                  </Badge>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>

        {/* Campaign Details */}
        {selectedCampaign ? (
          <div className="lg:col-span-2 space-y-6">
            <div className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">{selectedCampaign.name}</h2>
                  <div className="flex gap-2">
                    {selectedCampaign.status === 'running' ? (
                      <button
                        className="btn btn-sm btn-error"
                        onClick={stopCampaign}
                        disabled={isStopping}
                      >
                        {isStopping ? (
                          <LoadingSpinner />
                        ) : (
                          <>
                            <FiStopCircle className="h-4 w-4" />
                            <span className="ml-1">Stop Campaign</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => startCampaign(selectedCampaign.id)}
                        disabled={isStarting}
                      >
                        {isStarting ? (
                          <LoadingSpinner />
                        ) : (
                          <>
                            <FiPlay className="h-4 w-4" />
                            <span className="ml-1">Start Campaign</span>
                          </>
                        )}
                      </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <div className="mt-1">
                    <Badge
                      color={
                        selectedCampaign.status === 'running'
                          ? 'success'
                          : selectedCampaign.status === 'paused'
                          ? 'warning'
                          : selectedCampaign.status === 'completed'
                          ? 'indigo'
                          : 'gray'
                      }
                      size="lg"
                    >
                      {selectedCampaign.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Progress</h3>
                  <div className="mt-2">
                    <Progress
                      progress={progress}
                      color="blue"
                      size="lg"
                      labelProgress
                      labelText
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{campaignStats.completed} of {campaignStats.total} completed</span>
                      <span>{progress}%</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-gray-500">Pending</div>
                    <div className="text-2xl font-bold">{campaignStats.pending}</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-blue-700">In Progress</div>
                    <div className="text-2xl font-bold text-blue-700">{campaignStats.processing}</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-green-700">Completed</div>
                    <div className="text-2xl font-bold text-green-700">{campaignStats.completed}</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-red-700">Failed</div>
                    <div className="text-2xl font-bold text-red-700">{campaignStats.failed}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Jobs Table */}
            <div className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Email Jobs</h3>
                  <button 
                    className="btn btn-sm btn-ghost"
                    onClick={() => selectedCampaign && fetchJobs(selectedCampaign.id)}
                  >
                    <FiRefreshCw className="h-4 w-4" />
                    <span className="ml-1">Refresh</span>
                  </button>
                </div>
              
              <div className="overflow-x-auto w-full">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Sender</th>
                      <th>Scheduled For</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.length > 0 ? (
                      jobs.map((job) => (
                        <tr key={job.id}>
                          <td className="font-medium">{job.contact_name}</td>
                          <td>{job.email_address}</td>
                          <td>
                            <span 
                              className={`badge ${
                                job.status === 'completed'
                                  ? 'badge-success'
                                  : job.status === 'failed'
                                  ? 'badge-error'
                                  : job.status === 'processing'
                                  ? 'badge-warning'
                                  : 'badge-ghost'
                              } capitalize`}
                            >
                              {job.status}
                            </span>
                          </td>
                          <td>
                            {job.assigned_sender_id ? (
                              <span className="text-sm opacity-70">
                                {job.assigned_sender_id.slice(0, 8)}...
                              </span>
                            ) : (
                              <span className="text-gray-400">Not assigned</span>
                            )}
                          </td>
                          <td>
                            {job.next_processing_time
                              ? new Date(job.next_processing_time).toLocaleString()
                              : 'N/A'}
                          </td>
                          <td>
                            {job.status === 'failed' && (
                              <button
                                className="btn btn-xs btn-ghost"
                                onClick={() => {
                                  // Add retry logic here
                                }}
                              >
                                Retry
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">
                          No jobs found for this campaign.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center h-64 bg-base-200 rounded-lg">
            <p className="text-gray-500">Select a campaign to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}