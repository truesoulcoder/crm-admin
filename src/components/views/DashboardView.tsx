'use client';

import { createBrowserClient } from '@supabase/ssr';
import {
  PlayCircle, PauseCircle, Users, Send, MailCheck, MailWarning, AlertTriangle, Zap, Activity, BarChart3, LineChart as LineChartIcon, CheckCircle, XCircle, Settings, ExternalLink, Info
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
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
      setError('Failed to load KPI data. ' + err.message);
      setKpiData([]);
    } finally {
      setIsLoadingKpis(false);
    }
  }, [supabase]);

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
      setError((prev) => prev ? prev + '\nFailed to load campaign status.' : 'Failed to load campaign status. ' + err.message);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [supabase]);

  useEffect(() => {
    const loadDashboardData = async () => {
      // It's good practice to ensure dependent data (like user) is available
      // before making calls that rely on it.
      await fetchCampaignEngineStatus();
      await fetchKpiData();
    };

    // Only attempt to load data if the user is loaded and present
    if (!isUserLoading && user) {
      void loadDashboardData();
    }
    // Adding user and isUserLoading to the dependency array ensures this effect re-runs appropriately.
  }, [fetchCampaignEngineStatus, fetchKpiData, user, isUserLoading]);

  // --- Campaign Engine Control --- 
  const handleToggleCampaignEngine = async () => {
    if (!campaignEngineStatus) return;
    const newStatus = !campaignEngineStatus.is_running;
    
    if (newStatus) {
      const confirmStart = window.confirm(
        'This will start the campaign engine. A pre-flight check will be performed, including sending a test email from each active sender to chrisphillips@truesoulpartners.com. Continue?'
      );
      if (!confirmStart) return;

      // TODO: Implement actual pre-flight check logic (e.g., RPC call)
      // console.log('Pre-flight check: Initiating test emails...');
      // Example: await supabase.rpc('run_campaign_preflight_check');
      // alert('Pre-flight check initiated. Engine will start upon success.');
    }

    setIsLoadingStatus(true);
    try {
      // TODO: Replace with your actual Supabase update logic for campaign engine status
      const { error: updateError } = await supabase
        .from('application_settings')
        .update({ value: newStatus.toString(), updated_at: new Date().toISOString() })
        .eq('key', 'campaign_engine_status');

      if (updateError) throw updateError;
      setCampaignEngineStatus({ is_running: newStatus, last_status_change: new Date().toISOString() });
      alert(`Campaign engine ${newStatus ? 'started' : 'stopped'} successfully.`);
    } catch (err: any) {
      // console.error('Error toggling campaign engine:', err);
      alert('Failed to toggle campaign engine: ' + err.message);
    } finally {
      setIsLoadingStatus(false);
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
          <button className="btn btn-sm btn-ghost" onClick={() => { setError(null); fetchKpiData(); fetchCampaignEngineStatus(); }}>Clear & Retry</button>
        </div>
      )}

      {/* Campaign Engine Control */}
      <section className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title text-xl font-semibold text-base-content mb-4 flex items-center">
            <Zap className="mr-2 text-info" /> Campaign Engine
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <button 
              className={`btn ${campaignEngineStatus?.is_running ? 'btn-error' : 'btn-success'} gap-2 w-full sm:w-auto`}
              onClick={handleToggleCampaignEngine}
              disabled={isLoadingStatus}
            >
              {isLoadingStatus ? <span className="loading loading-spinner loading-xs"></span> :
                campaignEngineStatus?.is_running ? <PauseCircle size={20} /> : <PlayCircle size={20} />
              }
              {campaignEngineStatus?.is_running ? 'Stop Engine' : 'Start Engine'}
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
