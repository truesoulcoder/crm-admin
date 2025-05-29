import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export default function CampaignSchedulerUI() {
  const supabase = useSupabaseClient();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [startTime, setStartTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name')
        .order('created_at', { ascending: false });
      if (data) setCampaigns(data);
    };
    fetchCampaigns();
  }, [supabase]);

  const scheduleCampaign = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    setLog(log => [...log, `Scheduling campaign ${selectedCampaign}...`]);
    const now = new Date();
    const offsetMs = startTime.getTime() - now.getTime();
    const offsetSec = Math.max(Math.floor(offsetMs / 1000), 0);

    const { error } = await supabase.rpc('schedule_campaign', {
      p_start_offset: `${offsetSec} seconds`,
      p_campaign_id: selectedCampaign
    });

    if (error) {
      setLog(log => [...log, `❌ Error: ${error.message}`]);
    } else {
      setLog(log => [...log, `✅ Scheduled successfully!`]);
    }
    setLoading(false);
  };

  return (
    <Card className="p-4 space-y-4 max-w-xl mx-auto mt-6">
      <h2 className="text-xl font-semibold text-center">📅 Campaign Scheduler</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium">Select Campaign</label>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          {campaigns.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Start Date & Time</label>
        <Calendar mode="single" selected={startTime} onSelect={setStartTime} className="rounded-md border" />
        <Input
          type="time"
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

      <Button disabled={loading || !selectedCampaign} onClick={scheduleCampaign}>
        {loading ? 'Scheduling...' : 'Schedule Campaign'}
      </Button>

      <CardContent className="bg-gray-100 p-2 mt-4 text-xs h-40 overflow-y-auto">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </CardContent>
    </Card>
  );
}
