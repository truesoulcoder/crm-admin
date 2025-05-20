'use client'

import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { PlayCircle, AlertCircle, CheckCircle, Info, List } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Alert, Select } from 'react-daisyui';

import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';

// Define types based on Supabase schema
type Campaign = Database['public']['Tables']['campaigns']['Row'];
type EmailEvent = Database['public']['Tables']['email_events']['Row'];

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning' | 'campaign' | 'email';
}

interface CampaignWithStatus extends Campaign {
  current_status?: string; // e.g., idle, running, paused, completed, preflight_pending, preflight_awaiting_confirmation
  settings?: Record<string, any>; // Add this line to include the settings property
}

const DashboardView: React.FC = () => {
  const [campaigns, setCampaigns] = useState<CampaignWithStatus[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<string>('idle'); // Overall or selected campaign status
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const consoleEndRef = useRef<null | HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setConsoleLogs(prevLogs => [
      ...prevLogs,
      { id: Date.now().toString() + Math.random().toString(), timestamp: new Date().toISOString(), message, type },
    ]);
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // Fetch initial campaigns
  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    addLog('Fetching campaigns...', 'info');
    try {
      const { data, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('name', { ascending: true });

      if (campaignsError) throw campaignsError;
      
      const campaignsWithStatus: CampaignWithStatus[] = data.map((c: Campaign) => ({...c, current_status: c.status || 'idle'}));
      setCampaigns(campaignsWithStatus);
      addLog(`Fetched ${campaignsWithStatus.length} campaigns.`, 'success');
      if (campaignsWithStatus.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(campaignsWithStatus[0].id);
        setCampaignStatus(campaignsWithStatus[0].current_status || 'idle');
      }
    } catch (err: any) {
      setError(`Error fetching campaigns: ${err.message}`);
      addLog(`Error fetching campaigns: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addLog, selectedCampaignId]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  // Update local campaign status if selected campaign changes
  useEffect(() => {
    if (selectedCampaignId) {
      const selected = campaigns.find(c => c.id === selectedCampaignId);
      if (selected) {
        setCampaignStatus(selected.current_status || 'idle');
      }
    }
  }, [selectedCampaignId, campaigns]);

  // Supabase real-time subscriptions
  useEffect(() => {
    const campaignChanges = supabase
      .channel('custom-campaign-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        (payload: RealtimePostgresChangesPayload<Campaign>) => {
          addLog(`Campaign update: ${JSON.stringify(payload.new)}`, 'campaign');
          setCampaigns(prev => 
            prev.map(c => c.id === (payload.new as Campaign).id ? {...c, ...(payload.new as Campaign), current_status: (payload.new as Campaign).status || c.current_status} : c)
          );
          if ((payload.new as Campaign).id === selectedCampaignId) {
            setCampaignStatus((payload.new as Campaign).status || 'idle');
          }
        }
      )
      void campaignChanges.subscribe();

    const emailEventsChanges = supabase
      .channel('custom-email-event-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_events' }, // Only new email events
        (payload: RealtimePostgresChangesPayload<EmailEvent>) => {
          const newEvent = payload.new as EmailEvent;
          const leadId = (newEvent.details_json as any)?.lead_id ?? 'unknown';
          addLog(`New email event for lead ${leadId}: ${newEvent.event_type}`, 'email');
        }
      )
      void emailEventsChanges.subscribe();

    return () => {  
      void supabase.removeChannel(campaignChanges);
      void supabase.removeChannel(emailEventsChanges);
    };
  }, [addLog, selectedCampaignId]);

  const handleSelectCampaign = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCampaignId = event.target.value;
    setSelectedCampaignId(newCampaignId);
    const selected = campaigns.find(c => c.id === newCampaignId);
    if (selected) {
      setCampaignStatus(selected.current_status || 'idle');
      addLog(`Campaign "${selected.name}" selected. Status: ${selected.current_status || 'idle'}.`, 'info');
    } else {
      setCampaignStatus('idle');
    }
  };

  const handleInitiatePreflight = async () => {
    if (!selectedCampaignId) {
      setError('Please select a campaign first.');
      addLog('No campaign selected for pre-flight.', 'error');
      return;
    }
    
    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
    if (!selectedCampaign) {
      setError('Selected campaign not found.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setCampaignStatus('preflight_pending');
    addLog(`Starting pre-flight check for campaign: ${selectedCampaign.name}...`, 'info');
    
    try {
      // Call the RPC function
      const { data, error: rpcError } = await supabase.rpc('trigger_preflight_check', {
        campaign_id_param: selectedCampaignId
      });

      if (rpcError) throw rpcError;
      
      // Log detailed results
      if (data) {
        const result = data as { success: boolean; message?: string; results: Array<any> };
        
        // Log overall result
        const statusMessage = result.success 
          ? 'Pre-flight check completed successfully!' 
          : 'Pre-flight check completed with some issues.';
          
        addLog(statusMessage, result.success ? 'success' : 'warning');
        
        // Log individual test results
        if (result.results && Array.isArray(result.results)) {
          result.results.forEach((test: any) => {
            const testStatus = test.success ? 'SUCCESS' : 'FAILED';
            addLog(`${testStatus} - Sender: ${test.sender_email} - ${test.message}`, 
                   test.success ? 'success' : 'error');
          });
        }
        
        // Update campaign status based on pre-flight result
        if (result.success) {
          setCampaignStatus('preflight_awaiting_confirmation');
          addLog('Please check your email at chrisphillips@truesoulpartners.com for the test email.', 'info');
        } else {
          setCampaignStatus('preflight_failed');
          setError('Pre-flight check failed. Please check the logs for details.');
        }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error during pre-flight check';
      setError(`Pre-flight check failed: ${errorMessage}`);
      addLog(`Error during pre-flight: ${errorMessage}`, 'error');
      setCampaignStatus('preflight_failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPreflightAndStart = async () => {
    if (!selectedCampaignId) {
      setError('No campaign selected to start.');
      addLog('No campaign selected to start after pre-flight confirmation.', 'error');
      return;
    }
    
    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
    if (!selectedCampaign) {
      setError('Selected campaign not found.');
      return;
    }
    
    if (campaignStatus !== 'preflight_awaiting_confirmation') {
      setError('Pre-flight not yet confirmed or in incorrect state.');
      addLog('Attempted to start campaign without pre-flight confirmation.', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCampaignStatus('starting');
    addLog(`Starting campaign: ${selectedCampaign.name}...`, 'info');
    
    try {
      // First, update the campaign status to 'ACTIVE' in the database
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ 
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
          settings: {
            ...(selectedCampaign.settings || {}),
            last_started_at: new Date().toISOString()
          }
        })
        .eq('id', selectedCampaignId);

      if (updateError) throw updateError;
      
      // Then call the campaign engine to start processing
      const { data, error: rpcError } = await supabase.rpc('start_campaign_engine', { 
        campaign_id_param: selectedCampaignId 
      });

      if (rpcError) throw rpcError;
      
      addLog(`Campaign "${selectedCampaign.name}" started successfully.`, 'success');
      addLog('Campaign engine is now processing leads...', 'info');
      
      // The real-time subscription will update the status when it changes in the DB
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to start campaign';
      setError(`Error starting campaign: ${errorMessage}`);
      addLog(`Error starting campaign: ${errorMessage}`, 'error');
      
      // Try to set status back to READY on error
      try {
        await supabase
          .from('campaigns')
          .update({ status: 'READY' })
          .eq('id', selectedCampaignId);
      } catch (updateErr) {
        console.error('Failed to update campaign status after error:', updateErr);
      }
      
      setCampaignStatus('preflight_awaiting_confirmation');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Placeholder for stopping campaign, if needed
  const handleStopCampaign = async () => {
    if (!selectedCampaignId || campaignStatus !== 'running') { // Only stop if running
        addLog('No running campaign selected to stop or campaign not running.', 'info');
        return;
    }
    setIsLoading(true);
    addLog(`Stopping campaign ID: ${selectedCampaignId}...`, 'info');
    try {
        const { error: rpcError } = await supabase.rpc('stop_campaign_engine', { 
            campaign_id_param: selectedCampaignId 
        });
        if (rpcError) throw rpcError;
        addLog(`Campaign ID: ${selectedCampaignId} stop command issued.`, 'success');
        // Real-time should update status to 'paused' or 'idle'
    } catch (err: any) {
        setError(`Error stopping campaign: ${err.message}`);
        addLog(`Error stopping campaign: ${err.message}`, 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const getCampaignName = (campaignId: string | null): string => {
    if (!campaignId) return 'N/A';
    return campaigns.find(c => c.id === campaignId)?.name || 'Unknown Campaign';
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center"><List className="mr-2" />Campaign Dashboard</h1>

      {error && (
        <Alert status="error" className="alert-error">
          <AlertCircle className="w-6 h-6" />
          <span>{error}</span>
        </Alert>
      )}

      <Card className="card bordered shadow-lg bg-base-100">
        <div className="card-body">
          <h2 className="card-title">Campaign Control</h2>
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Select Campaign:</span>
            </label>
            <select 
              className="select select-bordered w-full" 
              value={selectedCampaignId || ''} 
              onChange={handleSelectCampaign}
              disabled={isLoading || campaignStatus === 'preflight_pending' || campaignStatus === 'preflight_awaiting_confirmation' || campaignStatus === 'running' || campaignStatus === 'starting'}
            >
              <option value="" disabled>-- Select a Campaign --</option>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>{campaign.name} (Status: {campaign.current_status})</option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              color="primary"
              disabled={
                isLoading ||
                !selectedCampaignId ||
                campaignStatus === 'preflight_pending' ||
                campaignStatus === 'preflight_awaiting_confirmation' ||
                campaignStatus === 'running' ||
                campaignStatus === 'starting'
              }
              onClick={(e) => {
                e.preventDefault();
                handleInitiatePreflight().catch(console.error);
              }}
            >
              Start Campaign (Preflight)
            </Button>
            <Button
              color="success"
              disabled={
                isLoading ||
                !selectedCampaignId ||
                campaignStatus !== 'preflight_awaiting_confirmation'
              }
              onClick={(e) => {
                e.preventDefault();
                handleConfirmPreflightAndStart().catch(console.error);
              }}
            >
              Confirm & Launch
            </Button>
          </div>

          <div className="mt-4">
            <p><strong>Selected Campaign:</strong> {getCampaignName(selectedCampaignId)}</p>
            <p><strong>Status:</strong> <span className={`badge ${campaignStatus === 'running' ? 'badge-success' : campaignStatus === 'idle' ? 'badge-ghost' : 'badge-warning'}`}>{campaignStatus.replace(/_/g, ' ')}</span></p>
          </div>

          <div className="card-actions justify-start mt-4 space-x-2">
            {campaignStatus === 'idle' && selectedCampaignId && (
              <Button 
                className="btn btn-primary" 
                onClick={(e) => {
                  e.preventDefault();
                  handleInitiatePreflight().catch(console.error);
                }} 
                disabled={isLoading || !selectedCampaignId}
              >
                <PlayCircle className="mr-2" /> Initiate Pre-Flight Check
              </Button>
            )}
            {campaignStatus === 'preflight_pending' && (
                <p className='text-info flex items-center'><Info className='mr-1'/> Pre-flight check in progress... Awaiting test email results.</p>
            )}
            {campaignStatus === 'preflight_awaiting_confirmation' && (
              <Button 
                className="btn btn-success" 
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmPreflightAndStart().catch(console.error);
                }} 
                disabled={isLoading}
              >
                <CheckCircle className="mr-2" /> Confirm Pre-Flight OK & Start Campaign
              </Button>
            )}
            {(campaignStatus === 'running' || campaignStatus === 'starting') && selectedCampaignId && (
                 <Button 
                color="error"
                disabled={isLoading || !selectedCampaignId}
                onClick={(e) => {
                  e.preventDefault();
                  handleStopCampaign().catch(console.error);
                }}
              >
                Stop Campaign
              </Button>
            )}
          </div>
        </div>
      </Card>

      {campaignStatus === 'preflight_awaiting_confirmation' && (
        <Alert status="info" className="alert-info">
            <Info className="w-6 h-6"/>
            <span>Pre-flight initiated. Please check <strong>chrisphillips@truesoulpartners.com</strong> for a test email. Once confirmed, click "Confirm Pre-Flight OK & Start Campaign".</span>
        </Alert>
      )}

      <Card className="card bordered shadow-lg bg-base-100 mt-6">
        <div className="card-body">
          <h2 className="card-title">Real-time Monitoring Console</h2>
          <div className="bg-neutral text-neutral-content p-4 rounded-md h-96 overflow-y-auto font-mono text-sm space-y-1">
            {consoleLogs.length === 0 && <p>Console is ready. Waiting for logs...</p>}
            {consoleLogs.map(log => (
              <div key={log.id} className={`flex items-start ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'campaign' ? 'text-blue-400' : log.type === 'email' ? 'text-purple-400' : 'text-gray-300'}`}>
                <span className="w-48 flex-shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className="flex-grow">{log.message}</span>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DashboardView;
