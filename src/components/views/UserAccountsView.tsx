'use client';

import React, { useState } from 'react';
import { UserCog, PlusCircle, Edit3, Trash2, ShieldCheck, ShieldAlert, Search, Filter, Users, KeyRound } from 'lucide-react';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Agent' | 'Viewer';
  status: 'Active' | 'Pending' | 'Suspended';
  lastLogin: string;
  avatarUrl?: string;
}

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

  const filteredUsers = mockUserAccounts.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'All' || user.role === filterRole;
    const matchesStatus = filterStatus === 'All' || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-base-content">User Accounts</h1>
        <button className="btn btn-primary w-full sm:w-auto">
          <PlusCircle size={18} className="mr-2" /> Add New User
        </button>
      </div>

      {/* Filters and Search */}
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
                        <ShieldAlert size={16} />
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
    </div>
  );
};

export default UserAccountsView;