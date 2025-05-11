'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, BarChart2, Edit3, Trash2, PlayCircle, PauseCircle, AlertTriangle, X, Check } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { LetterFx, Avatar, AvatarGroup, AvatarProps } from '../../once-ui/components';

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
  const [emailTemplates, setEmailTemplates] = useState<{id: string, name: string}[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<{id: string, name: string}[]>([]);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState('');
  const [selectedDocumentTemplate, setSelectedDocumentTemplate] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      default:
        return <span className="badge badge-outline">{status || 'Unknown'}</span>;
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
      setError('Failed to load campaigns. Please refresh and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Fetch available users
  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('email_senders')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Transform data to match User interface
      const users = data.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url
      }));
      
      setAvailableUsers(users);
      
      // Set default selected email template if available
      const { data: emailTemplateData } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle();
      
      if (emailTemplateData) {
        setSelectedEmailTemplate(emailTemplateData.id);
      }
      
      // Set default selected document template if available
      const { data: documentTemplateData } = await supabase
        .from('document_templates')
        .select('*')
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle();
      
      if (documentTemplateData) {
        setSelectedDocumentTemplate(documentTemplateData.id);
      }
      
      // Fetch all email templates
      const { data: emailTemplates, error: emailTemplatesError } = await supabase
        .from('email_templates')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
        
      if (!emailTemplatesError) {
        setEmailTemplates(emailTemplates || []);
      }
      
      // Fetch all document templates
      const { data: documentTemplates, error: documentTemplatesError } = await supabase
        .from('document_templates')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
        
      if (!documentTemplatesError) {
        setDocumentTemplates(documentTemplates || []);
      }
      
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [supabase]);

  // Toggle user selection
  const toggleUserSelection = (user: User) => {
    setSelectedUsers(prev => {
      const isAlreadySelected = prev.some(u => u.id === user.id);
      return isAlreadySelected 
        ? prev.filter(u => u.id !== user.id) 
        : [...prev, user];
    });
  };

  // Load data on component mount
  useEffect(() => {
    fetchCampaigns();
    fetchUsers();
  }, [fetchCampaigns, fetchUsers]);

  // Start campaign handler
  const handleStart = async (id: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'Active' })
        .eq('id', id);
      
      if (error) throw error;
      
      fetchCampaigns();
    } catch (err) {
      console.error('Error starting campaign:', err);
      setError('Failed to start campaign. Please try again.');
    }
  };

  // Stop campaign handler
  const handleStop = async (id: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'Paused' })
        .eq('id', id);
      
      if (error) throw error;
      
      fetchCampaigns();
    } catch (err) {
      console.error('Error stopping campaign:', err);
      setError('Failed to stop campaign. Please try again.');
    }
  };

  // Form submission handler
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!campaignName || !selectedEmailTemplate || selectedUsers.length === 0) {
      setError('Please fill in all required fields and select at least one sender.');
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert([{
          name: campaignName,
          subject: campaignSubject,
          email_template_id: selectedEmailTemplate,
          document_template_id: selectedDocumentTemplate,
          assigned_user_ids: selectedUsers.map(u => u.id),
          status: 'Draft',
          created_at: new Date().toISOString(),
          is_active: true
        }])
        .select();
      
      if (error) throw error;
      
      // Reset form
      setCampaignName('');
      setCampaignSubject('');
      setSelectedUsers([]);
      setIsModalOpen(false);
      setError(null);
      
      // Set success message
      setSuccess(`Campaign "${campaignName}" created successfully.`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
      
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Email Campaigns</h1>
          <p className="text-base-content/70">Manage your ongoing and upcoming email campaigns</p>
        </div>
        <button 
          className="btn btn-primary mt-4 md:mt-0"
          onClick={() => setIsModalOpen(true)}
        >
          <Mail size={16} className="mr-2" />
          New Campaign
        </button>
      </div>
      
      {/* Campaigns list */}
      {!isLoading && !error && campaigns.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Created</th>
                <th>Assigned To</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover">
                  <td>
                    <div className="font-medium">{campaign.name}</div>
                    <div className="text-sm text-base-content/70 truncate max-w-xs">
                      {campaign.subject || 'No subject'}
                    </div>
                  </td>
                  <td>{getStatusBadge(campaign.status)}</td>
                  <td>{new Date(campaign.created_at).toLocaleDateString()}</td>
                  <td>
                    <AvatarGroup 
                      avatars={campaign.assigned_user_ids?.map((userId: string) => {
                        const user = availableUsers.find(u => u.id === userId);
                        return user ? {
                          src: user.avatarUrl,
                          value: user.name.split(' ').map(n => n[0]).join(''),
                          title: user.name
                        } as AvatarProps : null;
                      }).filter(Boolean) || []}
                      size="s"
                      limit={3}
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {campaign.status === 'Draft' || campaign.status === 'Paused' ? (
                        <button 
                          className="btn btn-xs btn-success"
                          onClick={() => handleStart(campaign.id)}
                          title="Start Campaign"
                        >
                          <PlayCircle size={14} />
                        </button>
                      ) : (
                        <button 
                          className="btn btn-xs btn-warning"
                          onClick={() => handleStop(campaign.id)}
                          title="Pause Campaign"
                        >
                          <PauseCircle size={14} />
                        </button>
                      )}
                      <button 
                        className="btn btn-xs btn-ghost"
                        title="Edit Campaign"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        className="btn btn-xs btn-ghost text-error"
                        title="Delete Campaign"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
      
      {/* Success message */}
      {success && (
        <div className="alert alert-success mb-6">
          <Check className="h-6 w-6" />
          <span>{success}</span>
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
                  <span className="label-text font-medium">Campaign Name</span>
                  <span className="label-text-alt text-error">Required</span>
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Enter campaign name" 
                    className="input input-bordered w-full pl-9" 
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    required
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <BarChart2 size={16} className="text-base-content/50" />
                  </div>
                </div>
                <div className="text-xs mt-1 text-base-content/70">
                  Give your campaign a descriptive name for internal reference
                </div>
              </div>
              
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Email Subject</span>
                  <span className="label-text-alt text-error">Required</span>
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Enter email subject line" 
                    className="input input-bordered w-full pl-9" 
                    value={campaignSubject}
                    onChange={(e) => setCampaignSubject(e.target.value)}
                    required
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Mail size={16} className="text-base-content/50" />
                  </div>
                </div>
                <div className="text-xs mt-1 text-base-content/70">
                  This will be the subject line recipients see in their inbox
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Choose Email Template</span>
                    {selectedEmailTemplate && (
                      <span className="label-text-alt bg-success/10 px-2 py-0.5 rounded-full text-success">Selected</span>
                    )}
                  </label>
                  <div className="relative">
                    <select 
                      className="select select-bordered w-full pr-10"
                      value={selectedEmailTemplate}
                      onChange={(e) => setSelectedEmailTemplate(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select an email template</option>
                      {emailTemplates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <Mail size={16} className="text-base-content/50" />
                    </div>
                  </div>
                  <div className="text-xs mt-2 text-base-content/70">
                    Required: This template will be used for the email body
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Choose Document Template</span>
                    {selectedDocumentTemplate && (
                      <span className="label-text-alt bg-success/10 px-2 py-0.5 rounded-full text-success">Selected</span>
                    )}
                  </label>
                  <div className="relative">
                    <select 
                      className="select select-bordered w-full pr-10"
                      value={selectedDocumentTemplate}
                      onChange={(e) => setSelectedDocumentTemplate(e.target.value)}
                    >
                      <option value="" disabled>Select a document template</option>
                      {documentTemplates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <Edit3 size={16} className="text-base-content/50" />
                    </div>
                  </div>
                  <div className="text-xs mt-2 text-base-content/70">
                    Optional: For PDF attachments to emails
                  </div>
                </div>
              </div>

              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text font-medium">Select Email Senders</span>
                  <span className="label-text-alt bg-primary/10 px-2 py-0.5 rounded-full text-primary-content">{selectedUsers.length} selected</span>
                </label>
                
                {/* Show selected users as an avatar group */}
                {selectedUsers.length > 0 && (
                  <div className="mb-4 bg-base-100 p-3 rounded-lg border border-base-300">
                    <div className="text-sm mb-2 text-base-content/70">Selected senders:</div>
                    <AvatarGroup
                      avatars={selectedUsers.map(user => ({
                        src: user.avatarUrl,
                        value: user.name.split(' ').map(n => n[0]).join(''),
                        title: user.name
                      } as AvatarProps))}
                      size="m"
                      limit={5}
                    />
                    {selectedUsers.length > 5 && (
                      <div className="text-xs mt-1 text-base-content/70">
                        and {selectedUsers.length - 5} more...
                      </div>
                    )}
                  </div>
                )}
                
                {/* Available users selection */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-3 bg-base-200/50 rounded-lg overflow-auto max-h-64 border border-base-300">
                  {availableUsers.map(user => {
                    const isSelected = selectedUsers.some(u => u.id === user.id);
                    return (
                      <div 
                        key={user.id}
                        onClick={() => toggleUserSelection(user)}
                        className={`cursor-pointer p-2 rounded-lg transition-all hover:bg-base-300/50 ${isSelected ? 'bg-primary/10 border border-primary/30' : 'border border-transparent'}`}
                        title={isSelected ? `Remove ${user.name}` : `Add ${user.name}`}
                      >
                        <div className="flex flex-col items-center">
                          <Avatar
                            size="m"
                            src={user.avatarUrl}
                            value={user.name.split(' ').map(n => n[0]).join('')}
                            statusIndicator={isSelected ? { color: 'green' } : undefined}
                          />
                          <div className="text-xs text-center mt-2 max-w-full truncate font-medium">{user.name}</div>
                          <div className="text-[10px] text-center text-base-content/60 truncate">{user.email.split('@')[0]}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs mt-2 text-base-content/70 flex items-center">
                  <span className="inline-block w-3 h-3 rounded-full bg-success mr-1"></span>
                  Indicates selected senders
                </div>
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
