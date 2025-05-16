'use client';

import Image from 'next/image';
import { UserCog, PlusCircle, Edit3, Trash2, ShieldCheck, ShieldAlert, Search, Filter, Users, KeyRound, Mail, Power, PowerOff } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Sender } from '@/types';

const SendersView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'senders'>('users');
  const [filterRole, setFilterRole] = useState<'All' | 'Admin' | 'Manager' | 'Agent' | 'Viewer'>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Pending' | 'Suspended'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [senders, setSenders] = useState<Sender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State for Senders
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSender, setEditingSender] = useState<Sender | null>(null);
  const [senderFormData, setSenderFormData] = useState<{ employee_name: string; employee_email: string }>({ employee_name: '', employee_email: '' });
  const [modalError, setModalError] = useState<string | null>(null);

  // TODO: Replace with real user accounts data fetching and filtering
  const filteredUsers: any[] = [];

  const filteredSenders = senders.filter(sender =>
    sender.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sender.employee_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fetch Senders (only @truesoulpartners.com)
  const fetchSenders = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/email-senders');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch senders: ${response.statusText}`);
      }
      const data = await response.json();
      setSenders(
        data
          .map((s: any) => ({
            ...s,
            employee_name: s.employee_name ?? s.name,
            employee_email: s.employee_email ?? s.email,
          }))
          .filter((s: Sender) => s.employee_email.endsWith('@truesoulpartners.com'))
      );
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  const openModalToAdd = () => {
    setEditingSender(null);
    setSenderFormData({ employee_name: '', employee_email: '' });
    setModalError(null);
    setIsModalOpen(true);
  };

  const openModalToEdit = (sender: Sender) => {
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
      setModalError('Both employee name and email are required.');
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

      await fetchSenders(); // Re-fetch the list to show changes
      closeModal();

    } catch (err: any) {
      setModalError(err.message || `An unexpected error occurred.`);
    }
  };

  const handleDeleteSender = async (senderId: number) => {
    if (!window.confirm('Are you sure you want to delete this email sender?')) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/email-senders/${senderId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete sender: ${response.statusText}`);
      }
      setSenders((prevSenders: Sender[]) => prevSenders.filter((s: Sender) => s.id !== senderId));
    } catch (err: any) {
      console.error('Error deleting sender:', err);
      setError(err.message || 'An unexpected error occurred while deleting.');
    }
  };

  const handleToggleSenderActiveStatus = async (sender: Sender) => {
    const newStatus = !sender.is_active;
    setError(null);
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
      setSenders((prevSenders: Sender[]) =>
        prevSenders.map((s: Sender) => s.id === updatedSender.id ? updatedSender : s)
      );
    } catch (err: any) {
      console.error('Error toggling active status:', err);
      setError(err.message || 'An unexpected error occurred while updating status.');
    }
  };

  const handleAddNewSender = () => {
    openModalToAdd();
  };

  const handleEditSender = (sender: Sender) => {
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
                  {filteredSenders.map((sender) => (
                    <tr key={sender.id} className="hover">
                      <td>
                        <div className="flex items-center space-x-3">
                          <div className="avatar">
                            <div className="mask mask-squircle w-10 h-10">
                              <Image
                                src={
                                  sender.photo_url ??
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(sender.employee_name)}&background=random`
                                }
                                alt={`${sender.employee_name}'s avatar`}
                                width={40}
                                height={40}
                                className="mask mask-squircle"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="font-bold text-base-content">{sender.employee_name}</div>
                            <div className="text-xs text-base-content/70">ID: {sender.id}</div>
                          </div>
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

          {error && (
            <div className="alert alert-error shadow-lg mb-4">
              <div>
                <ShieldAlert size={24} />
                <span><strong>Error:</strong> {error}</span>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-10">
              <span className="loading loading-lg loading-spinner text-primary"></span>
              <p className="mt-2">Loading email senders...</p>
            </div>
          ) : senders.length === 0 && !error ? (
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
                  {senders.map((sender) => (
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

export default SendersView;