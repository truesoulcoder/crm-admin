'use client';

import React, { useState, useEffect } from 'react';
import { Mail, BarChart2, Edit3, Trash2, PlayCircle, PauseCircle, AlertTriangle, X, UserPlus, Users as UsersIcon } from 'lucide-react';
import { Avatar, AvatarGroup, AvatarProps, LetterFx } from '../../once-ui/components';

import { Campaign } from '../../types';
import { supabase } from '../../lib/supabaseClient';

interface User {
  id: string;
  name: string;
  avatarUrl: string;
}

const mockCampaigns: Campaign[] = [
  {
    id: 'campaign-001',
    name: 'Q1 Newsletter Blast',
    status: 'Completed',
    emailsSent: 12500,
    openRate: 28.5,
    clickRate: 4.2,
    creationDate: '2024-01-15',
  },
  {
    id: 'campaign-002',
    name: 'New Product Launch: Gadget X',
    status: 'Active',
    emailsSent: 8500,
    openRate: 35.1,
    clickRate: 6.8,
    creationDate: '2024-03-01',
  },
  {
    id: 'campaign-003',
    name: 'Summer Sale Early Access',
    status: 'Paused',
    emailsSent: 5000,
    openRate: 15.0, // Assuming it was paused due to low performance initially
    clickRate: 1.5,
    creationDate: '2024-04-10',
  },
  {
    id: 'campaign-004',
    name: 'Win-Back Inactive Users',
    status: 'Draft',
    emailsSent: 0,
    openRate: 0,
    clickRate: 0,
    creationDate: '2024-04-20',
  },
  {
    id: 'campaign-005',
    name: 'Holiday Season Promo',
    status: 'Error',
    emailsSent: 200,
    openRate: 1.0,
    clickRate: 0.1,
    creationDate: '2024-04-25',
  },
];

const allMockUsers: User[] = [
  { id: 'user-1', name: 'Alice Wonderland', avatarUrl: 'https://i.pravatar.cc/150?u=alice' },
  { id: 'user-2', name: 'Bob The Builder', avatarUrl: 'https://i.pravatar.cc/150?u=bob' },
  { id: 'user-3', name: 'Charlie Brown', avatarUrl: 'https://i.pravatar.cc/150?u=charlie' },
  { id: 'user-4', name: 'Diana Prince', avatarUrl: 'https://i.pravatar.cc/150?u=diana' },
  { id: 'user-5', name: 'Edward Scissorhands', avatarUrl: 'https://i.pravatar.cc/150?u=edward' },
  { id: 'user-6', name: 'Fiona Gallagher', avatarUrl: 'https://i.pravatar.cc/150?u=fiona' },
];

const getStatusBadge = (status: Campaign['status']) => {
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
      return <span className="badge badge-ghost">{status}</span>;
  }
};

const CampaignsView: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignSubject, setNewCampaignSubject] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>(allMockUsers);
  const [selectedUsersForCampaign, setSelectedUsersForCampaign] = useState<User[]>([]);

  const handleCreateCampaign = () => {
    console.log('Creating campaign:', {
      name: newCampaignName,
      subject: newCampaignSubject,
      template: selectedTemplate,
      assignedUsers: selectedUsersForCampaign.map(u => u.id)
    });
    setNewCampaignName('');
    setNewCampaignSubject('');
    setSelectedTemplate('');
    setIsModalOpen(false);
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
          {mockCampaigns.length === 0 ? (
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
                  {mockCampaigns.map((campaign) => (
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
                        value={user.name.split(' ').map(n => n[0]).join('')} 
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