'use client';

import React, { useState, useEffect } from 'react';
import { Mail, BarChart2, Edit3, Trash2, PlayCircle, PauseCircle, AlertTriangle, X, UserPlus, Users as UsersIcon } from 'lucide-react';
import { Avatar, AvatarGroup, AvatarProps, LetterFx } from '../../once-ui/components';

import { Campaign } from '../../types/engine';
import { supabase } from '../../lib/supabaseClient';

interface User {
  id: string;
  name: string;
  avatarUrl: string;
}

const CampaignsView: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignSubject, setNewCampaignSubject] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsersForCampaign, setSelectedUsersForCampaign] = useState<User[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (!campaignsError && campaignsData) setCampaigns(campaignsData);

      // Fetch users (email_senders)
      const { data: usersData, error: usersError } = await supabase
        .from('email_senders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!usersError && usersData) {
        setAvailableUsers(usersData.map(u => ({
          id: u.id.toString(),
          name: u.employee_name,
          avatarUrl: u.avatar_url || `https://i.pravatar.cc/150?u=${u.employee_email}`
        })));
      }
    };
    fetchData();
  }, []);

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'Active':
        return <span className="badge badge-success badge-outline"><PlayCircle size={14} className="mr-1" /> {status}</span>;
      case 'Paused':
        return <span className="badge badge-warning badge-outline"><PauseCircle size={14} className="mr-1" /> {status}</span>;
      case 'Completed':
        return <span className="badge badge-info badge-outline">{status}</span>;
      case 'Draft':
        return <span className="badge badge-ghost badge-outline">{status}</span>;
      case 'Error':
        return <span className="badge badge-error badge-outline"><AlertTriangle size={14} className="mr-1" /> {status}</span>;
      default:
        return <span className="badge badge-ghost">{status || 'Draft'}</span>;
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaignName || !selectedTemplate || selectedUsersForCampaign.length === 0) {
      alert('Please fill in all required fields and select at least one user.');
      return;
    }
    try {
      const { data, error } = await supabase.from('campaigns').insert([
        {
          name: newCampaignName,
          subject: newCampaignSubject,
          template: selectedTemplate,
          assigned_user_ids: selectedUsersForCampaign.map(u => u.id),
          status: 'Draft',
          created_at: new Date().toISOString(),
          is_active: true
        }
      ]).select();
      if (error) {
        alert('Error creating campaign: ' + error.message);
        return;
      }
      setNewCampaignName('');
      setNewCampaignSubject('');
      setSelectedTemplate('');
      setSelectedUsersForCampaign([]);
      setIsModalOpen(false);
      // Refresh campaigns
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (campaignsData) setCampaigns(campaignsData);
      alert('Campaign created successfully!');
    } catch (e) {
      alert('Unexpected error creating campaign.');
    }
  };

  const handleSelectUser = (userId: string) => {
    const user = availableUsers.find(u => u.id === userId);
    if (user) {
      setSelectedUsersForCampaign([...selectedUsersForCampaign, user]);
      setAvailableUsers(availableUsers.filter(u => u.id !== userId));
    }
  };

  const handleDeselectUser = (userId: string) => {
    const user = selectedUsersForCampaign.find(u => u.id === userId);
    if (user) {
      setSelectedUsersForCampaign(selectedUsersForCampaign.filter(u => u.id !== userId));
      setAvailableUsers([...availableUsers, user]);
    }
  };

  // Engine control handlers
  const handleStart = async (id: string) => {
    await fetch(`/api/engine/campaigns/${id}/start`, { method: 'POST' });
    // refresh status
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (data) setCampaigns(data);
  };
  const handleStop = async (id: string) => {
    await fetch(`/api/engine/campaigns/${id}/stop`, { method: 'POST' });
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (data) setCampaigns(data);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-content">
          <LetterFx trigger="instant" speed="medium">
            Email Campaigns
          </LetterFx>
        </h1>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Mail size={18} className="mr-2" /> Create New Campaign
        </button>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {campaigns.length === 0 ? (
            <div className="text-center py-10">
              <Mail size={48} className="mx-auto text-base-content/30 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Campaigns Yet</h2>
              <p className="text-base-content/70 mb-4">Start by creating your first email campaign.</p>
              <button className="btn btn-primary">Create Campaign</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th className="text-right">Emails Sent</th>
                    <th className="text-right">Open Rate</th>
                    <th className="text-right">Click Rate</th>
                    <th>Created</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover">
                      <td>
                        <div className="font-semibold text-base-content">{campaign.name}</div>
                        <div className="text-xs text-base-content/70">ID: {campaign.id}</div>
                      </td>
                      <td>{getStatusBadge(campaign.status)}</td>
                      <td className="text-right">{campaign.emailsSent.toLocaleString()}</td>
                      <td className="text-right">{campaign.openRate.toFixed(1)}%</td>
                      <td className="text-right">{campaign.clickRate.toFixed(1)}%</td>
                      <td>{new Date(campaign.creationDate).toLocaleDateString()}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Start/Stop campaign */}
                          {campaign.status !== 'ACTIVE' && (
                            <button className="btn btn-ghost btn-xs" title="Start Campaign" onClick={() => handleStart(campaign.id)}>
                              <PlayCircle size={16} />
                            </button>
                          )}
                          {campaign.status === 'ACTIVE' && (
                            <button className="btn btn-ghost btn-xs" title="Stop Campaign" onClick={() => handleStop(campaign.id)}>
                              <PauseCircle size={16} />
                            </button>
                          )}
                          <button className="btn btn-ghost btn-xs" title="View Stats">
                            <BarChart2 size={16} />
                          </button>
                          <button className="btn btn-ghost btn-xs" title="Edit">
                            <Edit3 size={16} />
                          </button>
                          <button className="btn btn-ghost btn-xs text-error" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <button 
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
              onClick={() => setIsModalOpen(false)}
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-xl mb-4">Create New Email Campaign</h3>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Campaign Name</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g., Q2 Product Update" 
                className="input input-bordered w-full" 
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Email Subject Line</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g., Exciting News from Our Team!" 
                className="input input-bordered w-full" 
                value={newCampaignSubject}
                onChange={(e) => setNewCampaignSubject(e.target.value)}
              />
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text">Choose Template (Mock)</span>
              </label>
              <select 
                className="select select-bordered w-full"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="" disabled>Select a template</option>
                <option value="template-001">Welcome Email - New User</option>
                <option value="template-002">Monthly Newsletter</option>
                <option value="template-003">Special Promotion Offer</option>
                {/* Add more mock templates as needed */}
              </select>
            </div>

            <div className="my-6">
              <h4 className="text-md font-semibold mb-3 text-base-content/80 flex items-center"><UsersIcon size={18} className="mr-2"/> Selected for Campaign ({selectedUsersForCampaign.length})</h4>
              {selectedUsersForCampaign.length > 0 ? (
                <AvatarGroup
                  avatars={selectedUsersForCampaign.map(user => ({
                    src: user.avatarUrl,
                    value: user.name.split(' ').map(n => n[0]).join(''), // Initials as fallback
                    title: user.name // Tooltip with full name
                  } as AvatarProps))}
                  size="m"
                  limit={5} // Show 5 avatars, then +N
                />
              ) : (
                <p className="text-sm text-base-content/60">No users selected yet.</p>
              )}
            </div>

            <div className="mb-4">
              <h4 className="text-md font-semibold mb-2 text-base-content/80 flex items-center"><UserPlus size={18} className="mr-2"/> Available Users ({availableUsers.length})</h4>
              {availableUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2 p-2 rounded-md max-h-48 overflow-y-auto bg-base-200/50">
                  {availableUsers.map(user => (
                    <button 
                      key={user.id} 
                      onClick={() => handleSelectUser(user.id)} 
                      className="btn btn-ghost btn-sm p-1 h-auto rounded-full focus:ring-2 focus:ring-primary" 
                      title={`Add ${user.name}`}
                    >
                      <Avatar 
                        src={user.avatarUrl}
                        size="m"
                        title={user.name}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-base-content/60">All users have been selected.</p>
              )}
            </div>

            <div className="modal-action mt-6">
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateCampaign} disabled={!newCampaignName || !newCampaignSubject || !selectedTemplate}>
                <Mail size={18} className="mr-1"/> Save Campaign
              </button>
            </div>
          </div>
           {/* Click outside to close */} 
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setIsModalOpen(false)}>close</button>
          </form>
        </div>
      )}
    </div>
  );
};
export default CampaignsView;