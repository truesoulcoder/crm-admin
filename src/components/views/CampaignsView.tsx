'use client';

// CampaignsView.tsx
// eslint-disable-next-line import/no-unresolved
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { supabase } from '@/lib/supabase/client';

type Campaign = {
  name: string;
  description: string;
  sender_emails: string[];
  min_interval: number;
  max_interval: number;
  market_regions: string[];
  is_dry_run: boolean;
  sender_quotas: Record<string, number>;
};

export default function CampaignsView() {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign>({
    name: '',
    description: '',
    sender_emails: [],
    min_interval: 5,
    max_interval: 60,
    market_regions: [],
    is_dry_run: false,
    sender_quotas: {},
  });
  const [senders, setSenders] = useState<{email: string}[]>([]);
  const [marketRegions, setMarketRegions] = useState<{id: string, name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch senders and market regions on component mount
  useEffect(() => {
    const fetchData = async () => {
      const { data: sendersData } = await supabase
        .from('email_senders')
        .select('email');
      const { data: regionsData } = await supabase
        .from('market_regions')
        .select('id, name');
      
      if (sendersData) setSenders(sendersData);
      if (regionsData) setMarketRegions(regionsData);
    };
    
    void fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('campaigns')
        .insert([campaign]);
      
      if (error) throw error;
      
      // Reset form after successful submission
      setCampaign({
        name: '',
        description: '',
        sender_emails: [],
        min_interval: 5,
        max_interval: 60,
        market_regions: [],
        is_dry_run: false,
        sender_quotas: {},
      });
      
      alert('Campaign created successfully!');
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSenderQuotaChange = (email: string, quota: number) => {
    setCampaign(prev => ({
      ...prev,
      sender_quotas: {
        ...prev.sender_quotas,
        [email]: quota
      }
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Campaign</h1>
      
      <form onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(e).catch(console.error);
      }} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Campaign Name
            </label>
            <input
              type="text"
              value={campaign.name}
              onChange={(e) => setCampaign({...campaign, name: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={campaign.description}
              onChange={(e) => setCampaign({...campaign, description: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              rows={3}
            />
          </div>

          {/* Sender Emails */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Select Senders
            </label>
            <select
              multiple
              value={campaign.sender_emails}
              onChange={(e) => setCampaign({
                ...campaign, 
                sender_emails: Array.from(e.target.selectedOptions, option => option.value)
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              {senders.map(sender => (
                <option key={sender.email} value={sender.email}>
                  {sender.email}
                </option>
              ))}
            </select>
          </div>

          {/* Market Regions */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Select Market Regions
            </label>
            <select
              multiple
              value={campaign.market_regions}
              onChange={(e) => setCampaign({
                ...campaign, 
                market_regions: Array.from(e.target.selectedOptions, option => option.value)
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              {marketRegions.map(region => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>

          {/* Interval Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Minimum Interval (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={campaign.min_interval}
                onChange={(e) => setCampaign({...campaign, min_interval: Number(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Maximum Interval (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={campaign.max_interval}
                onChange={(e) => setCampaign({...campaign, max_interval: Number(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Dry Run Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={campaign.is_dry_run}
              onChange={(e) => setCampaign({...campaign, is_dry_run: e.target.checked})}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label className="ml-2 block text-sm text-gray-700">
              Dry Run (Test Mode)
            </label>
          </div>

          {/* Sender Quotas */}
          {campaign.sender_emails.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Sender Quotas (emails per hour)
              </label>
              {campaign.sender_emails.map(email => (
                <div key={email} className="flex items-center">
                  <span className="w-48 truncate">{email}</span>
                  <input
                    type="number"
                    min="1"
                    value={campaign.sender_quotas[email] || 10}
                    onChange={(e) => handleSenderQuotaChange(email, Number(e.target.value))}
                    className="ml-2 block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}