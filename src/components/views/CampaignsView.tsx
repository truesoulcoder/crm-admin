'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, BarChart2, Edit3, Trash2, PlayCircle, PauseCircle, AlertTriangle, X, Check } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { LetterFx } from '../../once-ui/components';

import { Campaign } from '../../types/engine';

// Environment variables are automatically loaded in Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Define TypeScript interfaces
interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

// Main component
const CampaignsView: React.FC = () => {
  // Initialize Supabase client with the modern SSR package
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  
  // State management
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status badge helper
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

  // Fetch campaigns data
  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setCampaigns(data || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError('Failed to load campaigns. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Fetch users data
  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('email_senders')
        .select('*');
      
      if (error) throw error;
      
      if (data) {
        const formattedUsers = data.map(u => ({
          id: u.id.toString(),
          name: u.employee_name || u.name,
          email: u.employee_email || u.email,
          avatarUrl: u.avatar_url
        }));
        
        setAvailableUsers(formattedUsers);
        
        // Set the first user as selected by default if available
        if (formattedUsers.length > 0 && !selectedUser) {
          setSelectedUser(formattedUsers[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [supabase, selectedUser]);

  // Load data on component mount
  useEffect(() => {
    fetchCampaigns();
    fetchUsers();
  }, [fetchCampaigns, fetchUsers]);

  // Handle campaign actions
  const handleStart = async (id: string) => {
    try {
      await fetch(`/api/engine/campaigns/${id}/start`, { method: 'POST' });
      // Refresh campaigns after action
      fetchCampaigns();
    } catch (err) {
      console.error('Error starting campaign:', err);
      setError('Failed to start campaign. Please try again.');
    }
  };
  
  const handleStop = async (id: string) => {
    try {
      await fetch(`/api/engine/campaigns/${id}/stop`, { method: 'POST' });
      // Refresh campaigns after action
      fetchCampaigns();
    } catch (err) {
      console.error('Error stopping campaign:', err);
      setError('Failed to stop campaign. Please try again.');
    }
  };

  // Form submission handler
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!campaignName || !selectedTemplate || !selectedUser) {
      setError('Please fill in all required fields.');
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert([
          {
            name: campaignName,
            subject: campaignSubject,
            template: selectedTemplate,
            assigned_user_id: selectedUser,
            status: 'Draft',
            created_at: new Date().toISOString(),
            is_active: true
          }
        ])
        .select();
      
      if (error) throw error;
      
      // Reset form
      setCampaignName('');
      setCampaignSubject('');
      setSelectedTemplate('');
      setIsModalOpen(false);
      setError(null);
      
      // Refresh campaigns list
      fetchCampaigns();
    } catch (err) {
      console.error('Error creating campaign:', err);
      setError('Failed to create campaign. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
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

      {/* Debug alert */}
      <div className="alert alert-info mb-6">
        <AlertTriangle className="h-6 w-6" />
        <span>Debug mode: Main campaign content temporarily removed to diagnose image display issue.</span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center items-center py-16">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      )}
      
      {/* Error message */}
      {error && !isLoading && (
        <div className="alert alert-error mb-6">
          <AlertTriangle className="h-6 w-6" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Empty state */}
      {!isLoading && !error && campaigns.length === 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="text-center py-10">
              <Mail size={48} className="mx-auto text-base-content/30 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Campaigns Yet</h2>
              <p className="text-base-content/70 mb-4">
                Start by creating your first email campaign.
              </p>
              <button 
                className="btn btn-primary" 
                onClick={() => setIsModalOpen(true)}
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
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
            
            <form onSubmit={handleCreateCampaign}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Campaign Name</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g., Spring 2025 Outreach" 
                  className="input input-bordered w-full" 
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Email Subject Line</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g., New Properties Available in Your Area!" 
                  className="input input-bordered w-full" 
                  value={campaignSubject}
                  onChange={(e) => setCampaignSubject(e.target.value)}
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Choose Template</span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a template</option>
                  <option value="template-001">Welcome Email</option>
                  <option value="template-002">Monthly Newsletter</option>
                  <option value="template-003">Special Promotion</option>
                </select>
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Select Sender</span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a sender</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Modal actions */}
              <div className="modal-action">
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="loading loading-spinner loading-sm mr-2"></span>
                  ) : (
                    <Check size={18} className="mr-2" />
                  )}
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsView;
