'use client';

import { createBrowserClient } from '@supabase/ssr';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  PlayCircle, PauseCircle, Users, Send, MailCheck, MailWarning, AlertTriangle, Zap, Activity, BarChart3, LineChart as LineChartIcon, CheckCircle, XCircle, Settings, ExternalLink, Info, RefreshCw
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';

import { useUser } from '@/contexts/UserContext'; // Added import

// Interfaces
interface SenderKpi {
  sender_id: string;
  sender_name: string; 
  emails_sent: number;
  emails_delivered: number;
  emails_bounced: number;
  emails_opened: number; 
  links_clicked: number; 
}

interface CampaignEngineStatus {
  is_running: boolean;
  last_status_change: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string; 
  // Add other campaign properties if needed for display or logic here
}

// StatCardItem component for individual stat cards
interface StatCardItemProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

const StatCardItem: React.FC<StatCardItemProps> = ({ title, value, icon, description }) => (
  <div className="card bg-base-200 shadow-md hover:shadow-lg transition-shadow">
    <div className="card-body items-center text-center">
      <div className="p-3 bg-primary/10 rounded-full mb-2 text-primary">
        {icon}
      </div>
      <h2 className="card-title text-lg font-semibold text-base-content/80">{title}</h2>
      <p className="text-3xl font-bold text-primary">{value}</p>
      {description && <p className="text-xs text-base-content/60 mt-1">{description}</p>}
    </div>
  </div>
);

const DashboardView: React.FC = () => {
  const { user, isLoading: isUserLoading, role } = useUser(); // Added useUser hook
  const [supabase] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));
  const [kpiData, setKpiData] = useState<SenderKpi[]>([]);
  const [campaignEngineStatus, setCampaignEngineStatus] = useState<CampaignEngineStatus | null>(null);
  const [isLoadingKpis, setIsLoadingKpis] = useState<boolean>(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState<boolean>(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [consoleLogs, setConsoleLogs] = useState<Array<{timestamp: string; message: string; type: 'info' | 'success' | 'error' | 'warning'}>>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const campaignRealtimeChannel = useRef<RealtimeChannel | null>(null);
  const emailRealtimeChannel = useRef<RealtimeChannel | null>(null);

  // Function to add a log to the console
  const addConsoleLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toISOString();
    setConsoleLogs(prevLogs => [...prevLogs, { timestamp, message, type }].slice(-100)); // Keep last 100 logs
  }, []);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  // Set up realtime subscription for campaign activities
  useEffect(() => {
    if (!supabase) return;

    // Clean up any existing subscriptions
    const cleanupChannels = () => {
      if (campaignRealtimeChannel.current) {
        supabase.removeChannel(campaignRealtimeChannel.current).catch(console.error);
        campaignRealtimeChannel.current = null;
      }
      if (emailRealtimeChannel.current) {
        supabase.removeChannel(emailRealtimeChannel.current).catch(console.error);
        emailRealtimeChannel.current = null;
      }
    };

    cleanupChannels();

    // Only subscribe if we have a selected campaign
    if (!selectedCampaignId) return;

    // Add a small delay before setting up new subscriptions
    const setupDelay = 500; // 500ms delay
    const timeoutId = setTimeout(() => {
      setupCampaignRealtime();
      setupEmailRealtime();
    }, setupDelay);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      cleanupChannels();
    };
  }, [supabase, selectedCampaignId, addConsoleLog]);

  // Set up realtime subscription for campaign status changes
  const setupCampaignRealtime = () => {
    if (!supabase || !selectedCampaignId) return;

    const handleRealtimeUpdate = (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
      const { eventType, new: newData, old: oldData } = payload;
      
      try {
        switch (eventType) {
          case 'INSERT':
            if (newData?.name) {
              addConsoleLog(`New campaign created: ${newData.name}`, 'info');
            }
            break;
            
          case 'UPDATE':
            if (newData?.status !== oldData?.status) {
              addConsoleLog(
                `Campaign status changed from ${oldData?.status || 'N/A'} to ${newData?.status || 'N/A'}`, 
                'info'
              );
            }
            if (newData?.updated_at && newData.updated_at !== oldData?.updated_at) {
              addConsoleLog(
                `Campaign updated at ${new Date(newData.updated_at).toLocaleTimeString()}`, 
                'info'
              );
            }
            break;
            
          case 'DELETE':
            if (oldData?.name) {
              addConsoleLog(`Campaign deleted: ${oldData.name}`, 'warning');
            }
            break;
        }
      } catch (error) {
        console.error('Error processing realtime update:', error);
        addConsoleLog('Error processing update. Check console for details.', 'error');
      }
    };

    try {
      campaignRealtimeChannel.current = supabase
        .channel(`campaign-activity-${selectedCampaignId}`)
        .on(
          'postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'campaigns',
            filter: `id=eq.${selectedCampaignId}`
          }, 
          handleRealtimeUpdate
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            addConsoleLog('Connected to realtime campaign updates', 'success');
          } else if (status === 'CHANNEL_ERROR') {
            addConsoleLog('Error connecting to campaign updates', 'error');
          } else if (status === 'TIMED_OUT') {
            addConsoleLog('Campaign updates connection timed out', 'warning');
          }
        });

      // Add error handler for the channel
      campaignRealtimeChannel.current.on('broadcast', { event: 'error' }, (payload: any) => {
        console.error('Campaign realtime channel error:', payload);
        addConsoleLog('Error in campaign updates connection', 'error');
      });
    } catch (error) {
      console.error('Error setting up campaign realtime subscription:', error);
      addConsoleLog('Failed to set up campaign updates', 'error');
    }
  };

  // Set up realtime subscription for email activities
  const setupEmailRealtime = () => {
    if (!supabase || !selectedCampaignId) return;

    const handleEmailActivity = (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
      const { eventType, new: newData, old: oldData } = payload;
      
      try {
        switch (eventType) {
          case 'INSERT':
            if (newData?.status === 'queued') {
              addConsoleLog(`Email queued for lead ${newData.lead_id}`, 'info');
            } else if (newData?.status === 'sending') {
              addConsoleLog(`Sending email to ${newData.recipient_email}`, 'info');
            } else if (newData?.status === 'sent') {
              addConsoleLog(`Email sent to ${newData.recipient_email}`, 'success');
            } else if (newData?.status === 'failed') {
              addConsoleLog(`Failed to send email to ${newData.recipient_email}`, 'error');
            }
            break;
            
          case 'UPDATE':
            if (newData?.status === 'sent' && oldData?.status !== 'sent') {
              addConsoleLog(`Email delivered to ${newData.recipient_email}`, 'success');
            } else if (newData?.status === 'failed' && oldData?.status !== 'failed') {
              const errorMsg = newData.error_message ? `: ${newData.error_message}` : '';
              addConsoleLog(`Email failed for ${newData.recipient_email}${errorMsg}`, 'error');
            } else if (newData?.status === 'opened' && oldData?.status !== 'opened') {
              addConsoleLog(`Email opened by ${newData.recipient_email}`, 'success');
            } else if (newData?.status === 'clicked' && oldData?.status !== 'clicked') {
              addConsoleLog(`Link clicked by ${newData.recipient_email}`, 'success');
            }
            break;
        }
      } catch (error) {
        console.error('Error processing email activity:', error);
      }
    };

    try {
      emailRealtimeChannel.current = supabase
        .channel(`email-activity-${selectedCampaignId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'email_activities',
            filter: `campaign_id=eq.${selectedCampaignId}`
          },
          handleEmailActivity
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            addConsoleLog('Connected to email activity updates', 'success');
          } else if (status === 'CHANNEL_ERROR') {
            addConsoleLog('Error connecting to email updates', 'error');
          } else if (status === 'TIMED_OUT') {
            addConsoleLog('Email updates connection timed out', 'warning');
          }
        });

      // Add error handler for the email channel
      emailRealtimeChannel.current.on('broadcast', { event: 'error' }, (payload: any) => {
        console.error('Email realtime channel error:', payload);
        addConsoleLog('Error in email updates connection', 'error');
      });
    } catch (error) {
      console.error('Error setting up email realtime subscription:', error);
      addConsoleLog('Failed to set up email updates', 'error');
    }
  };

  // --- Data Fetching --- 
  const fetchKpiData = useCallback(async () => {
    setIsLoadingKpis(true);
    setError(null);
    try {
      // Fetch raw data from kpi_stats and join with senders to get sender_name
      const { data: rawKpiData, error: dbError } = await supabase
        .from('kpi_stats')
        .select(`
          sender_id,
          emails_sent,
          emails_delivered,
          emails_bounced,
          emails_opened,
          links_clicked,
          senders (name)
        `); // Assumes 'senders' table has 'id' and 'name', and RLS allows this join.

      if (dbError) throw dbError;

      if (rawKpiData) {
        // Perform client-side aggregation: sum up all stats for each sender.
        const aggregatedKpis = rawKpiData.reduce<SenderKpi[]>((acc, currentRow) => {
          // Supabase returns joined tables as nested objects. Ensure 'senders' is correctly typed or handled if null.
          const senderTable = currentRow.senders as { name: string }[] | null; 
          const senderName = senderTable?.[0]?.name || currentRow.sender_id; // Fallback to sender_id if name is not available

          const existingEntry = acc.find(item => item.sender_id === currentRow.sender_id);
          if (existingEntry) {
            existingEntry.emails_sent += currentRow.emails_sent || 0;
            existingEntry.emails_delivered += currentRow.emails_delivered || 0;
            existingEntry.emails_bounced += currentRow.emails_bounced || 0;
            existingEntry.emails_opened += currentRow.emails_opened || 0;
            existingEntry.links_clicked += currentRow.links_clicked || 0;
          } else {
            acc.push({
              sender_id: currentRow.sender_id,
              sender_name: senderName,
              emails_sent: currentRow.emails_sent || 0,
              emails_delivered: currentRow.emails_delivered || 0,
              emails_bounced: currentRow.emails_bounced || 0,
              emails_opened: currentRow.emails_opened || 0,
              links_clicked: currentRow.links_clicked || 0,
            });
          }
          return acc;
        }, []);
        setKpiData(aggregatedKpis);
      } else {
        setKpiData([]);
      }
    } catch (err: any) {
      // console.error('Error fetching KPI data:', err);
      setError(`Failed to load KPI data. ${err.message}`);
      setKpiData([]);
    } finally {
      setIsLoadingKpis(false);
    }
  }, [supabase]);

  const fetchManageableCampaigns = useCallback(async () => {
    if (!supabase) return;
    setIsLoadingCampaigns(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('campaigns')
        .select('id, name, status') // Select fields needed for display and logic
        .in('status', ['DRAFT', 'PAUSED', 'AWAITING_CONFIRMATION']) // Fetch campaigns that can be started
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }
      setCampaigns(data || []);
      if (data && data.length > 0 && !selectedCampaignId) {
        // Only set default if selectedCampaignId is not already set, to preserve selection
        setSelectedCampaignId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching manageable campaigns:', err);
      setError(prevError => prevError ? `${prevError}\nFailed to load campaigns: ${err.message}` : `Failed to load campaigns: ${err.message}`);
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, [supabase, selectedCampaignId]);

  const fetchCampaignEngineStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      // TODO: Replace with your actual Supabase query to get campaign engine status
      const { data, error: dbError } = await supabase
        .from('application_settings')
        .select('value, updated_at')
        .eq('key', 'campaign_engine_status')
        .single();

      if (dbError) {
        if (dbError.code === 'PGRST116') { // No rows found
          // If the setting doesn't exist, assume engine is off. Consider creating it here if appropriate.
          setCampaignEngineStatus({ is_running: false, last_status_change: new Date().toISOString() });
          // console.warn('Campaign engine status setting not found in application_settings. Defaulting to OFF.');
        } else {
          throw dbError;
        }
      } else if (data) {
        setCampaignEngineStatus({
          is_running: data.value === 'true',
          last_status_change: data.updated_at
        });
      } else {
        // Should not happen if PGRST116 is handled, but as a fallback:
        setCampaignEngineStatus({ is_running: false, last_status_change: new Date().toISOString() });
      }
    } catch (err: any) {
      // console.error('Error fetching campaign engine status:', err);
      setError((prev) => prev ? `${prev}\nFailed to load campaign status.` : `Failed to load campaign status. ${err.message}`);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [supabase]);

  useEffect(() => {
    const loadDashboardData = async () => {
      // It's good practice to ensure dependent data (like user) is available
      // before making calls that rely on it.
      if (supabase && user) { // Ensure user is also loaded
        try {
          // Run these in parallel since they don't depend on each other
          await Promise.all([
            fetchKpiData(),
            fetchCampaignEngineStatus(),
            fetchManageableCampaigns()
          ]);
        } catch (err) {
          // Individual errors are already handled in each function
          console.error('Error in dashboard data loading:', err);
        }
      }
    };

    // Only attempt to load data if the user is loaded and present
    if (user && !isUserLoading) { 
      void loadDashboardData();
    }
  }, [user, isUserLoading, supabase, fetchKpiData, fetchCampaignEngineStatus, fetchManageableCampaigns]);

  // Placeholder for backend pre-flight check simulation
  const triggerPreFlightCheck = async (campaignId: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) return { success: false, error: 'Supabase client not available' };
    console.log(`SIMULATING PRE-FLIGHT: For campaign ${campaignId}. Triggering test emails...`);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
    // In a real backend function, actual emails would be sent here.
    // This function's responsibility is just to *trigger* the pre-flight.
    // The status update to AWAITING_CONFIRMATION happens in handleToggleCampaignEngine.
    console.log(`SIMULATING PRE-FLIGHT: Test email trigger completed for campaign ${campaignId}.`);
    return { success: true };
  };

  const getButtonProps = () => {
    if (!selectedCampaignId || isLoadingStatus || isLoadingCampaigns) {
      let text = 'Loading...';
      if (isLoadingStatus) text = 'Processing...';
      else if (!selectedCampaignId && !isLoadingCampaigns) text = 'Select Campaign';
      return { text, disabled: true, className: 'btn-disabled' };
    }
    const campaign = campaigns.find(c => c.id === selectedCampaignId);
    if (!campaign) {
      // This can happen if the selected campaign was deleted or its status changed it from the list
      return { text: 'Select Campaign', disabled: true, className: 'btn-disabled' };
    }

    switch (campaign.status) {
      case 'DRAFT':
      case 'PAUSED':
        return { text: 'Initiate Pre-flight', disabled: false, className: 'btn-primary' };
      case 'AWAITING_CONFIRMATION':
        return { text: 'Confirm & Activate Campaign', disabled: false, className: 'btn-success' };
      case 'ACTIVE':
        return { text: 'Pause Campaign', disabled: false, className: 'btn-error' };
      default:
        return { text: 'N/A', disabled: true, className: 'btn-disabled gizmo-inaccurate-target-content' }; // Added gizmo-inaccurate-target-content for potential mismatch
    }
  };

  // --- Campaign Engine Control --- 
  const handleToggleCampaignEngine = async () => {
    if (!selectedCampaignId) {
      addConsoleLog('No campaign selected. Please select a campaign to manage.', 'error');
      alert('Please select a campaign to manage.');
      return;
    }
    if (!supabase) {
      addConsoleLog('Database connection not available.', 'error');
      alert('Database connection not available.');
      return;
    }

    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
    if (!selectedCampaign) {
      const errorMsg = 'Selected campaign not found. It might have been updated. Please refresh or re-select.';
      addConsoleLog(errorMsg, 'error');
      alert(errorMsg);
      setSelectedCampaignId(null); // Clear selection
      void fetchManageableCampaigns();
      return;
    }

    const campaignName = selectedCampaign.name;
    setIsLoadingStatus(true);
    addConsoleLog(`Processing campaign: ${campaignName} (${selectedCampaign.status})`, 'info');

    try {
      switch (selectedCampaign.status) {
        case 'DRAFT':
        case 'PAUSED':
          if (window.confirm(`This will initiate a pre-flight check for "${campaignName}". Test emails will be sent to your review address. Continue?`)) {
            addConsoleLog(`Initiating pre-flight check for campaign: ${campaignName}`, 'info');
            try {
              const preflightResult = await triggerPreFlightCheck(selectedCampaignId);
              if (preflightResult.success) {
                addConsoleLog('Pre-flight check completed successfully', 'success');
                const { error: updateError } = await supabase
                  .from('campaigns')
                  .update({ 
                    status: 'AWAITING_CONFIRMATION',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', selectedCampaignId);
                
                if (updateError) throw updateError;
                
                setCampaigns(prev => prev.map(c => c.id === selectedCampaignId ? { ...c, status: 'AWAITING_CONFIRMATION' } : c));
                const successMsg = `Pre-flight initiated for "${campaignName}". Please review test emails and then confirm to activate.`;
                addConsoleLog(successMsg, 'success');
                alert(successMsg);
              } else {
                const errorMsg = preflightResult.error || 'Pre-flight check failed to initiate.';
                addConsoleLog(`Pre-flight check failed: ${errorMsg}`, 'error');
                throw new Error(errorMsg);
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error during pre-flight check';
              addConsoleLog(`Error during pre-flight: ${errorMsg}`, 'error');
              throw error;
            }
          }
          break;

        case 'AWAITING_CONFIRMATION':
          if (window.confirm(`Are you sure you've reviewed the test emails for "${campaignName}" and want to activate it now?`)) {
            addConsoleLog(`Activating campaign: ${campaignName}`, 'info');
            // 1. Update campaign to ACTIVE
            const { error: campaignUpdateError } = await supabase
              .from('campaigns')
              .update({ 
                status: 'ACTIVE',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', selectedCampaignId);
            if (campaignUpdateError) throw campaignUpdateError;

            // 2. Update global engine status to true
            const { error: appSettingsUpdateError } = await supabase
              .from('application_settings')
              .update({ value: 'true', updated_at: new Date().toISOString() })
              .eq('key', 'campaign_engine_status');
            if (appSettingsUpdateError) throw appSettingsUpdateError;

            setCampaigns(prev => prev.map(c => c.id === selectedCampaignId ? { ...c, status: 'ACTIVE' } : c));
            setCampaignEngineStatus({ is_running: true, last_status_change: new Date().toISOString() });
            const successMsg = `Campaign "${campaignName}" is now active and processing leads.`;
            addConsoleLog(successMsg, 'success');
            alert(successMsg);
          }
          break;

        case 'ACTIVE':
          if (window.confirm(`Pausing "${campaignName}" will stop all email sending. Continue?`)) {
            addConsoleLog(`Pausing campaign: ${campaignName}`, 'warning');
            // 1. Update campaign to PAUSED
            const { error: campaignUpdateError } = await supabase
              .from('campaigns')
              .update({ 
                status: 'PAUSED',
                updated_at: new Date().toISOString()
              })
              .eq('id', selectedCampaignId);
            if (campaignUpdateError) throw campaignUpdateError;

            // 2. Update global engine status to false
            // (Assuming only one campaign runs at a time for this global flag)
            const { error: appSettingsUpdateError } = await supabase
              .from('application_settings')
              .update({ value: 'false', updated_at: new Date().toISOString() })
              .eq('key', 'campaign_engine_status');
            if (appSettingsUpdateError) throw appSettingsUpdateError;

            setCampaigns(prev => prev.map(c => c.id === selectedCampaignId ? { ...c, status: 'PAUSED' } : c));
            setCampaignEngineStatus({ is_running: false, last_status_change: new Date().toISOString() });
            const successMsg = `Campaign "${campaignName}" has been paused.`;
            addConsoleLog(successMsg, 'warning');
            alert(successMsg);
          }
          break;

        default:
          alert(`Unknown status for campaign "${campaignName}": ${selectedCampaign.status}`);
      }
    } catch (err: any) {
      const errorMsg = `Operation failed for campaign "${campaignName}": ${err.message}`;
      console.error('Error in campaign engine control:', err);
      addConsoleLog(errorMsg, 'error');
      setError(errorMsg);
      // Potentially revert optimistic UI updates or re-fetch state here if needed
    } finally {
      setIsLoadingStatus(false);
      // Refresh the list of manageable campaigns after any action
      // This ensures the dropdown reflects correct statuses (e.g., ACTIVE campaign disappears)
      void fetchManageableCampaigns(); 
      
      // Auto-open console when there are errors
      if (err) {
        setIsConsoleOpen(true);
      }
    }
  };
  
  // --- Render Helper: Custom Tooltip for Charts ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-base-300 border border-base-content/20 rounded shadow-lg">
          <p className="label font-bold text-base-content">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}-${entry.name}`} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${typeof entry.value === 'number' ? entry.value.toLocaleString() : 'N/A'}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // --- Render Logic --- 
  // --- Render Logic --- 
  if (isUserLoading || isLoadingKpis || isLoadingStatus) { // Added isUserLoading to the condition
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center bg-base-100 p-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-lg">Loading Dashboard Data...</p>
      </div>
    );
  }

  const overallStats = kpiData.reduce((acc, kpi) => {
    acc.emails_sent += kpi.emails_sent || 0;
    acc.emails_delivered += kpi.emails_delivered || 0;
    acc.emails_bounced += kpi.emails_bounced || 0;
    // You can also sum emails_opened and links_clicked here if you add corresponding stat cards
    return acc;
  }, { emails_sent: 0, emails_delivered: 0, emails_bounced: 0 });
  
  const overallDeliveryRate = overallStats.emails_sent > 0 ? (overallStats.emails_delivered / overallStats.emails_sent) * 100 : 0;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-base-content flex items-center">
          <Activity className="mr-3 text-primary" size={32} /> CRM Dashboard
        </h1>
      </header>

      {error && (
        <div role="alert" className="alert alert-error shadow-lg mb-6">
          <AlertTriangle size={24} />
          <div>
            <h3 className="font-bold">Dashboard Error</h3>
            <div className="text-xs whitespace-pre-line">{error}</div>
          </div>
          <button 
            className="btn btn-sm btn-ghost" 
            onClick={() => {
              setError(null);
              // Use void IIFE to handle the async operation
              void (async () => {
                try {
                  await Promise.all([
                    fetchKpiData(),
                    fetchCampaignEngineStatus()
                  ]);
                } catch (err) {
                  console.error('Error during retry:', err);
                  setError('Failed to reload data. Please try again.');
                }
              })();
            }}
          >
            Clear & Retry
          </button>
        </div>
      )}

      {/* Campaign Engine Control */}
      <section className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title text-xl font-semibold text-base-content mb-4 flex items-center">
            <Zap className="mr-2 text-info" /> Campaign Engine
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Campaign Selector */}
            <div className="form-control w-full sm:w-auto sm:min-w-[200px]">
              <label className="label pb-1">
                <span className="label-text">Select Campaign to Manage:</span>
              </label>
              <select 
                className="select select-bordered w-full"
                value={selectedCampaignId || ''}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                disabled={isLoadingCampaigns || campaigns.length === 0}
              >
                <option value="" disabled>
                  {isLoadingCampaigns ? 'Loading...' : campaigns.length === 0 ? 'No DRAFT/PAUSED campaigns' : 'Choose a campaign'}
                </option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} ({campaign.status})
                  </option>
                ))}
              </select>
            </div>

            <button 
              className={`btn ${getButtonProps().className}`}
              onClick={() => void handleToggleCampaignEngine()}
              disabled={getButtonProps().disabled}
            >
              {isLoadingStatus ? 'Processing...' : getButtonProps().text}
            </button>
            <div className="text-sm p-3 bg-base-200 rounded-md w-full sm:w-auto">
              <strong className='block mb-1'>Current Status:</strong> 
              {campaignEngineStatus?.is_running 
                ? <span className="badge badge-lg badge-success gap-2"><CheckCircle size={16}/> Running</span> 
                : <span className="badge badge-lg badge-error gap-2"><XCircle size={16}/> Stopped</span>}
              <p className='text-xs text-base-content/70 mt-2'>Last change: {campaignEngineStatus?.last_status_change ? new Date(campaignEngineStatus.last_status_change).toLocaleString() : 'N/A'}</p>
            </div>
          </div>
           <p className="text-xs text-base-content/60 mt-4">Controls the automated processing of email campaigns and lead assignments. Pre-flight checks are performed before starting.</p>
        </div>
      </section>

      {/* Console Panel */}
      <div className="card bg-base-200 shadow-xl mb-6">
        <div 
          className="card-body p-0"
          onClick={() => setIsConsoleOpen(!isConsoleOpen)}
        >
          <div className="flex justify-between items-center p-4 cursor-pointer bg-base-300">
            <h2 className="card-title text-lg">Campaign Console</h2>
            <div className="flex items-center gap-2">
              <span className="badge badge-sm">{consoleLogs.length} logs</span>
              <button className="btn btn-ghost btn-sm" onClick={(e) => {
                e.stopPropagation();
                setConsoleLogs([]);
              }}>
                Clear
              </button>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConsoleOpen(prev => !prev);
                }}
              >
                {isConsoleOpen ? 'Hide' : 'Show'}
              </button>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  addConsoleLog('Manually refreshed campaign data', 'info');
                  void fetchManageableCampaigns();
                  void fetchCampaignEngineStatus();
                }}
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          
          {isConsoleOpen && (
            <div className="p-4 bg-base-100 max-h-96 overflow-y-auto font-mono text-sm">
              {consoleLogs.length === 0 ? (
                <div className="text-base-content/50 italic">No logs available. Start a campaign to see activity.</div>
              ) : (
                <>
                  {consoleLogs.map((log, index) => (
                    <div 
                      key={`${log.timestamp}-${index}`}
                      className={`py-1 border-b border-base-300 last:border-0 ${
                        log.type === 'error' ? 'text-error' : 
                        log.type === 'success' ? 'text-success' :
                        log.type === 'warning' ? 'text-warning' : 'text-base-content/80'
                      }`}
                    >
                      <span className="text-base-content/50 text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()} | 
                      </span>
                      {log.message}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overall KPI Stats Cards */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center">
          <BarChart3 className="mr-2 text-secondary" /> Overall Performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardItem title="Total Emails Sent" value={typeof overallStats.emails_sent === 'number' ? overallStats.emails_sent.toLocaleString() : '0'} icon={<Send size={28} />} description="All campaigns, all senders" />
          <StatCardItem title="Total Delivered" value={typeof overallStats.emails_delivered === 'number' ? overallStats.emails_delivered.toLocaleString() : '0'} icon={<MailCheck size={28} />} description={`${overallDeliveryRate.toFixed(1)}% delivery rate`} />
          <StatCardItem title="Total Bounced" value={typeof overallStats.emails_bounced === 'number' ? overallStats.emails_bounced.toLocaleString() : '0'} icon={<MailWarning size={28} />} description={`${(overallStats.emails_sent > 0 ? (overallStats.emails_bounced / overallStats.emails_sent) * 100 : 0).toFixed(1)}% bounce rate`} />
          <StatCardItem title="Active Senders" value={kpiData.length} icon={<Users size={28} />} description="Senders with reported activity" />
        </div>
      </section>

      {/* KPI Charts Section */}
      <section>
        <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center">
          <LineChartIcon className="mr-2 text-accent" /> Sender Performance Breakdown
        </h2>
        {isLoadingKpis && !kpiData.length ? (
          <div className="text-center p-6 bg-base-200 rounded-lg">
            <span className="loading loading-dots loading-md text-primary"></span>
            <p>Loading sender KPI data...</p>
          </div>
        ) : !kpiData.length && !error ? (
          <div role="alert" className="alert alert-info">
            <Info size={24}/>
            <span>No sender KPI data available. Ensure your 'sender_kpis_summary_view' is populated.</span>
          </div>
        ) : kpiData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg font-medium text-base-content mb-3">Emails by Sender</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={kpiData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                    <XAxis dataKey="sender_name" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '15px'}} />
                    <Bar dataKey="emails_sent" fill="hsl(var(--in))" name="Sent" radius={[4,4,0,0]} barSize={15}/>
                    <Bar dataKey="emails_delivered" fill="hsl(var(--su))" name="Delivered" radius={[4,4,0,0]} barSize={15}/>
                    <Bar dataKey="emails_bounced" fill="hsl(var(--er))" name="Bounced" radius={[4,4,0,0]} barSize={15}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg font-medium text-base-content mb-3">Delivery & Bounce Rates (%) by Sender</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={kpiData.map(k => ({ 
                      sender_name: k.sender_name,
                      delivery_rate: k.emails_sent > 0 ? (k.emails_delivered / k.emails_sent) * 100 : 0,
                      bounce_rate: k.emails_sent > 0 ? (k.emails_bounced / k.emails_sent) * 100 : 0,
                    }))} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                    <XAxis dataKey="sender_name" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" />
                    <YAxis unit="%" allowDecimals={false}/>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '15px'}} />
                    <Line type="monotone" dataKey="delivery_rate" stroke="hsl(var(--su))" strokeWidth={2} name="Delivery Rate" activeDot={{ r: 6 }}/>
                    <Line type="monotone" dataKey="bounce_rate" stroke="hsl(var(--er))" strokeWidth={2} name="Bounce Rate" activeDot={{ r: 6 }}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default DashboardView;
