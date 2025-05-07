'use client';

import React, { useState, useEffect } from 'react';
import { UserCog, PlusCircle, Edit3, Trash2, ShieldCheck, ShieldAlert, Search, Filter, Users, KeyRound, Mail, Power, PowerOff } from 'lucide-react';

import { UserAccount } from '../../types';
import { supabase } from '../../lib/supabaseClient'; // This might not be used directly if all data comes via API
import type { EmailSender } from '../../app/api/email-senders/route'; // Import EmailSender type

const mockUserAccounts: UserAccount[] = [
  {
    id: 'user-001',
    name: 'Alice Wonderland',
    email: 'alice.w@example.com',
    role: 'Admin',
    status: 'Active',
    lastLogin: '2024-05-06T10:30:00Z',
    avatarUrl: 'https://i.pravatar.cc/150?u=alice',
  },
  {
    id: 'user-002',
    name: 'Bob The Builder',
    email: 'bob.b@example.com',
    role: 'Manager',
    status: 'Active',
    lastLogin: '2024-05-05T15:00:00Z',
    avatarUrl: 'https://i.pravatar.cc/150?u=bob',
  },
  {
    id: 'user-003',
    name: 'Charlie Brown',
    email: 'charlie.b@example.com',
    role: 'Agent',
    status: 'Pending',
    lastLogin: 'Never',
    avatarUrl: 'https://i.pravatar.cc/150?u=charlie',
  },
  {
    id: 'user-004',
    name: 'Diana Prince',
    email: 'diana.p@example.com',
    role: 'Agent',
    status: 'Active',
    lastLogin: '2024-05-07T09:00:00Z',
    avatarUrl: 'https://i.pravatar.cc/150?u=diana',
  },
  {
    id: 'user-005',
    name: 'Edward Scissorhands',
    email: 'edward.s@example.com',
    role: 'Viewer',
    status: 'Suspended',
    lastLogin: '2024-04-15T12:00:00Z',
    avatarUrl: 'https://i.pravatar.cc/150?u=edward',
  },
];

const getRoleIcon = (role: UserAccount['role']) => {
  switch (role) {
    case 'Admin':
      return <ShieldCheck size={16} className="text-error mr-1" />;
    case 'Manager':
      return <UserCog size={16} className="text-accent mr-1" />;
    case 'Agent':
      return <Users size={16} className="text-info mr-1" />;
    case 'Viewer':
      return <KeyRound size={16} className="text-neutral-focus mr-1" />;
    default:
      return null;
  }
};

const getStatusBadge = (status: UserAccount['status']) => {
  switch (status) {
    case 'Active':
      return <span className="badge badge-success badge-sm">{status}</span>;
    case 'Pending':
      return <span className="badge badge-warning badge-sm">{status}</span>;
    case 'Suspended':
      return <span className="badge badge-error badge-sm">{status}</span>;
    default:
      return <span className="badge badge-ghost badge-sm">{status}</span>;
  }
};

const UserAccountsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'All' | UserAccount['role']>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | UserAccount['status']>('All');
  const [activeTab, setActiveTab] = useState<'users' | 'senders'>('users');

  // State for Email Senders
  const [emailSenders, setEmailSenders] = useState<EmailSender[]>([]);
  const [isLoadingSenders, setIsLoadingSenders] = useState(true);
  const [sendersError, setSendersError] = useState<string | null>(null);

  // Modal State for Email Senders
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSender, setEditingSender] = useState<EmailSender | null>(null);
  const [senderFormData, setSenderFormData] = useState({ employee_name: '', employee_email: '' });
  const [modalError, setModalError] = useState<string | null>(null);

  const filteredUsers = mockUserAccounts.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'All' || user.role === filterRole;
    const matchesStatus = filterStatus === 'All' || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Fetch Email Senders
  const fetchEmailSenders = React.useCallback(async () => {
    setIsLoadingSenders(true);
    setSendersError(null);
    try {
      const response = await fetch('/api/email-senders');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch email senders: ${response.statusText}`);
      }
      const data = await response.json();
      setEmailSenders(data);
    } catch (err: any) {
      console.error('Error fetching email senders:', err);
      setSendersError(err.message || 'An unexpected error occurred.');
    }
    setIsLoadingSenders(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'senders') {
      fetchEmailSenders();
    }
  }, [activeTab, fetchEmailSenders]);

  const openModalToAdd = () => {
    setEditingSender(null);
    setSenderFormData({ employee_name: '', employee_email: '' });
    setModalError(null);
    setIsModalOpen(true);
  };

  const openModalToEdit = (sender: EmailSender) => {
    setEditingSender(sender);
    setSenderFormData({ employee_name: sender.employee_name, employee_email: sender.employee_email });
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSender(null);
    setSenderFormData({ employee_name: '', employee_email: '' });
    setModalError(null);
  };

  const handleSenderFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSenderFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSenderFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setModalError(null);

    if (!senderFormData.employee_name.trim() || !senderFormData.employee_email.trim()) {
      setModalError('Both name and email are required.');
      return;
    }
    // Basic email validation (can be more robust)
    if (!/\S+@\S+\.\S+/.test(senderFormData.employee_email)) {
      setModalError('Please enter a valid email address.');
      return;
    }

    const method = editingSender ? 'PUT' : 'POST';
    const url = editingSender ? `/api/email-senders/${editingSender.id}` : '/api/email-senders';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(senderFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${editingSender ? 'update' : 'add'} sender`);
      }

      // const result = await response.json(); // Result can be used if needed
      await fetchEmailSenders(); // Re-fetch the list to show changes
      closeModal();

    } catch (err: any) {
      console.error(`Error ${editingSender ? 'updating' : 'adding'} sender:`, err);
      setModalError(err.message || `An unexpected error occurred.`);
    }
  };

  const handleDeleteSender = async (senderId: number) => {
    if (!window.confirm('Are you sure you want to delete this email sender?')) {
      return;
    }
    setSendersError(null);
    try {
      const response = await fetch(`/api/email-senders/${senderId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete sender: ${response.statusText}`);
      }
      setEmailSenders(prevSenders => prevSenders.filter(s => s.id !== senderId));
      // alert('Sender deleted successfully.'); // Consider a less disruptive notification
    } catch (err: any) {
      console.error('Error deleting sender:', err);
      setSendersError(err.message || 'An unexpected error occurred while deleting.');
    }
  };

  const handleToggleSenderActiveStatus = async (sender: EmailSender) => {
    const newStatus = !sender.is_active;
    setSendersError(null);
    try {
      const response = await fetch(`/api/email-senders/${sender.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update sender status: ${response.statusText}`);
      }
      const updatedSender = await response.json();
      setEmailSenders(prevSenders => 
        prevSenders.map(s => s.id === updatedSender.id ? updatedSender : s)
      );
    } catch (err: any) {
      console.error('Error toggling active status:', err);
      setSendersError(err.message || 'An unexpected error occurred while updating status.');
    }
  };

  const handleAddNewSender = () => {
    openModalToAdd();
  };

  const handleEditSender = (sender: EmailSender) => {
    openModalToEdit(sender);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Tabs Navigation */}
      <div role="tablist" className="tabs tabs-lifted tabs-lg mb-6">
        <a 
          role="tab" 
          className={`tab ${activeTab === 'users' ? 'tab-active font-semibold' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={20} className="mr-2" /> User Accounts
        </a>
        <a 
          role="tab" 
          className={`tab ${activeTab === 'senders' ? 'tab-active font-semibold' : ''}`}
          onClick={() => setActiveTab('senders')}
        >
          <Mail size={20} className="mr-2" /> Email Senders
        </a>
      </div>

      {activeTab === 'users' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-3xl font-bold text-base-content">User Accounts Management</h1>
            <button className="btn btn-primary w-full sm:w-auto">
              <PlusCircle size={18} className="mr-2" /> Add New User
            </button>
          </div>

          {/* Filters and Search for Users */}
          <div className="mb-6 p-4 card bg-base-200 shadow rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Search Users</span></label>
                <div className="join">
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    className="input input-bordered join-item w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="btn btn-ghost join-item"><Search size={18}/></button>
                </div>
              </div>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Filter by Role</span></label>
                <select 
                  className="select select-bordered w-full"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
                >
                  <option value="All">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Agent">Agent</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Filter by Status</span></label>
                <select 
                  className="select select-bordered w-full"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-10 card bg-base-100 shadow-md">
              <Users size={48} className="mx-auto text-base-content/30 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Users Found</h2>
              <p className="text-base-content/70">Try adjusting your search or filters, or invite a new user.</p>
            </div>
          ) : (
            <div className="overflow-x-auto card bg-base-100 shadow-xl">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover">
                      <td>
                        <div className="flex items-center space-x-3">
                          <div className="avatar">
                            <div className="mask mask-squircle w-10 h-10">
                              <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} alt={`${user.name}'s avatar`} />
                            </div>
                          </div>
                          <div>
                            <div className="font-bold text-base-content">{user.name}</div>
                            <div className="text-xs text-base-content/70">ID: {user.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <div className="flex items-center">
                          {getRoleIcon(user.role)} {user.role}
                        </div>
                      </td>
                      <td>{getStatusBadge(user.status)}</td>
                      <td>{user.lastLogin === 'Never' ? 'Never' : new Date(user.lastLogin).toLocaleString()}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button className="btn btn-ghost btn-xs" title="Edit User">
                            <Edit3 size={16} />
                          </button>
                          <button className="btn btn-ghost btn-xs" title="Manage Permissions">
                            <UserCog size={16} />
                          </button>
                          <button className="btn btn-ghost btn-xs text-error" title="Delete User">
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
        </>
      )}

      {activeTab === 'senders' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-3xl font-bold text-base-content">Email Senders Management</h1>
            <button className="btn btn-primary w-full sm:w-auto" onClick={handleAddNewSender}>
              <PlusCircle size={18} className="mr-2" /> Add New Sender
            </button>
          </div>

          {sendersError && (
            <div className="alert alert-error shadow-lg mb-4">
              <div>
                <ShieldAlert size={24} />
                <span><strong>Error:</strong> {sendersError}</span>
              </div>
            </div>
          )}

          {isLoadingSenders ? (
            <div className="text-center py-10">
              <span className="loading loading-lg loading-spinner text-primary"></span>
              <p className="mt-2">Loading email senders...</p>
            </div>
          ) : emailSenders.length === 0 && !sendersError ? (
            <div className="text-center py-10 card bg-base-100 shadow-md">
              <Mail size={48} className="mx-auto text-base-content/30 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Email Senders Found</h2>
              <p className="text-base-content/70">Click &quot;Add New Sender&quot; to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto card bg-base-100 shadow-xl">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Email Address</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emailSenders.map((sender) => (
                    <tr key={sender.id} className="hover">
                      <td>
                        <div className="font-semibold text-base-content">{sender.employee_name}</div>
                      </td>
                      <td>{sender.employee_email}</td>
                      <td className="text-center">
                        <button 
                          className={`btn btn-xs btn-ghost ${sender.is_active ? 'text-success' : 'text-error'}`}
                          onClick={() => handleToggleSenderActiveStatus(sender)}
                          title={sender.is_active ? 'Deactivate Sender' : 'Activate Sender'}
                        >
                          {sender.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                          <span className="ml-1">{sender.is_active ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button 
                            className="btn btn-ghost btn-xs" 
                            title="Edit Sender"
                            onClick={() => handleEditSender(sender)}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            className="btn btn-ghost btn-xs text-error" 
                            title="Delete Sender"
                            onClick={() => handleDeleteSender(sender.id)}
                          >
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
        </>
      )}

      {/* Email Sender Add/Edit Modal */}
      {isModalOpen && (
        <dialog id="email_sender_modal" className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {editingSender ? 'Edit Email Sender' : 'Add New Email Sender'}
            </h3>
            <form onSubmit={handleSenderFormSubmit}>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Employee Name</span>
                </label>
                <input 
                  type="text" 
                  name="employee_name"
                  placeholder="e.g. John Doe"
                  className="input input-bordered w-full"
                  value={senderFormData.employee_name}
                  onChange={handleSenderFormChange}
                />
              </div>
              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text">Employee Email</span>
                </label>
                <input 
                  type="email" 
                  name="employee_email"
                  placeholder="e.g. john.doe@example.com"
                  className="input input-bordered w-full"
                  value={senderFormData.employee_email}
                  onChange={handleSenderFormChange}
                />
              </div>

              {modalError && (
                <div className="alert alert-error mt-4">
                  <ShieldAlert size={20} />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="modal-action mt-6">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingSender ? 'Save Changes' : 'Add Sender'}
                </button>
              </div>
            </form>
          </div>
          {/* To close modal by clicking backdrop (optional, might need specific DaisyUI setup or custom logic) */}
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeModal}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
};

export default UserAccountsView;