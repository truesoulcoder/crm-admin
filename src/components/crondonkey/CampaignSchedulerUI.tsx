import { format } from 'date-fns';
import { useState, useEffect } from 'react';

import { createServerClient } from '@/lib/supabase/client';

interface Campaign {
  id: string;
  name: string;
  created_at?: string;
}

export default function CampaignSchedulerUI() {
  const supabase = createServerClient();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name')
        .order('created_at', { ascending: false });
      if (data) setCampaigns(data);
    };
    void fetchCampaigns();
  }, [supabase]);

  const scheduleCampaign = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    setLog((log: string[]) => [...log, `Scheduling campaign ${selectedCampaign}...`]);
    const now = new Date();
    const offsetMs = startTime.getTime() - now.getTime();
    const offsetSec = Math.max(Math.floor(offsetMs / 1000), 0);

    const { error } = await supabase.rpc('schedule_campaign', {
      p_start_offset: `${offsetSec} seconds`,
      p_campaign_id: selectedCampaign
    });

    if (error) {
      setLog((log: string[]) => [...log, `❌ Error: ${error.message}`]);
    } else {
      setLog((log: string[]) => [...log, `✅ Scheduled successfully!`]);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-4 max-w-xl mx-auto mt-6 bg-base-100 rounded-box shadow">
      <h2 className="text-xl font-semibold text-center">📅 Campaign Scheduler</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium">Select Campaign</label>
        <select
          className="select select-bordered w-full"
          value={selectedCampaign || ''}
          onChange={(e) => setSelectedCampaign(e.target.value)}
        >
          <option disabled value="">
            -- Choose a Campaign --
          </option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Start Date & Time</label>
        <input
          type="date"
          className="input input-bordered w-full"
          value={format(startTime, 'yyyy-MM-dd')}
          onChange={(e) => {
            const [year, month, day] = e.target.value.split('-');
            const updated = new Date(startTime);
            updated.setFullYear(+year);
            updated.setMonth(+month - 1);
            updated.setDate(+day);
            setStartTime(updated);
          }}
        />
        <input
          type="time"
          className="input input-bordered w-full"
          value={format(startTime, 'HH:mm')}
          onChange={(e) => {
            const [hours, minutes] = e.target.value.split(':');
            const updated = new Date(startTime);
            updated.setHours(+hours);
            updated.setMinutes(+minutes);
            setStartTime(updated);
          }}
        />
      </div>

      <button
        className="btn btn-primary w-full"
        disabled={loading || !selectedCampaign}
        onClick={() => {
          void scheduleCampaign();
        }}
      >
        {loading ? 'Scheduling...' : 'Schedule Campaign'}
      </button>

      <div className="bg-base-200 p-2 mt-4 text-xs h-40 overflow-y-auto rounded">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
