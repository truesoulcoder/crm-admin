'use client';

import React, { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { Users, PlusCircle, Edit3, Trash2, Eye, Search, Filter, ChevronUp, ChevronDown, Briefcase, AtSign, Phone, CalendarDays, Tag, UserCheck, Save, XCircle } from 'lucide-react';
import { Background } from '../../once-ui/components/Background';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone?: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Won';
  source: 'Website' | 'Referral' | 'Advertisement' | 'Cold Call' | 'Event';
  assignedTo: string; // User ID or name
  lastContactDate: string;
  potentialValue?: number;
  notes?: string;
}

const initialMockLeads: Lead[] = [
  {
    id: 'lead-001',
    firstName: 'John',
    lastName: 'Doe',
    company: 'Acme Corp',
    email: 'john.doe@acmecorp.com',
    phone: '555-1234',
    status: 'New',
    source: 'Website',
    assignedTo: 'Alice Wonderland',
    lastContactDate: '2024-05-01',
    potentialValue: 5000,
  },
  {
    id: 'lead-002',
    firstName: 'Jane',
    lastName: 'Smith',
    company: 'Beta Solutions',
    email: 'jane.smith@betasolutions.com',
    status: 'Contacted',
    source: 'Referral',
    assignedTo: 'Bob The Builder',
    lastContactDate: '2024-05-03',
    potentialValue: 12000,
  },
  {
    id: 'lead-003',
    firstName: 'Mike',
    lastName: 'Johnson',
    company: 'Gamma Inc.',
    email: 'mike.j@gamma.co',
    phone: '555-5678',
    status: 'Qualified',
    source: 'Advertisement',
    assignedTo: 'Alice Wonderland',
    lastContactDate: '2024-04-28',
    potentialValue: 8500,
  },
  {
    id: 'lead-004',
    firstName: 'Sarah',
    lastName: 'Williams',
    company: 'Delta LLC',
    email: 's.williams@deltallc.net',
    status: 'Lost',
    source: 'Cold Call',
    assignedTo: 'Charlie Brown',
    lastContactDate: '2024-03-15',
  },
  {
    id: 'lead-005',
    firstName: 'David',
    lastName: 'Brown',
    company: 'Epsilon Ltd.',
    email: 'david.brown@epsilon.org',
    phone: '555-9012',
    status: 'Won',
    source: 'Event',
    assignedTo: 'Diana Prince',
    lastContactDate: '2024-05-05',
    potentialValue: 25000,
  },
];

const defaultNewLead: Omit<Lead, 'id' | 'lastContactDate'> = {
  firstName: '',
  lastName: '',
  company: '',
  email: '',
  phone: '',
  status: 'New',
  source: 'Website',
  assignedTo: '',
  potentialValue: 0,
  notes: '',
};

type SortField = keyof Lead | '';
type SortDirection = 'asc' | 'desc';

const getStatusBadge = (status: Lead['status']) => {
  const colorMap: Record<Lead['status'], string> = {
    New: 'badge-info',
    Contacted: 'badge-primary',
    Qualified: 'badge-success',
    Lost: 'badge-error',
    Won: 'badge-accent',
  };
  return <span className={`badge ${colorMap[status]} badge-sm`}>{status}</span>;
};

const LeadsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | Lead['status']>('All');
  const [filterSource, setFilterSource] = useState<'All' | Lead['source']>('All');
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [leads, setLeads] = useState<Lead[]>(initialMockLeads);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLeadData, setNewLeadData] = useState<Omit<Lead, 'id' | 'lastContactDate'>>(defaultNewLead);
  // State for editing a lead
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const sortedAndFilteredLeads = useMemo(() => {
    let filtered = leads.filter(lead => {
      const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      const search = searchTerm.toLowerCase();
      const matchesSearch = fullName.includes(search) ||
                            lead.company.toLowerCase().includes(search) ||
                            lead.email.toLowerCase().includes(search);
      const matchesStatus = filterStatus === 'All' || lead.status === filterStatus;
      const matchesSource = filterSource === 'All' || lead.source === filterSource;
      return matchesSearch && matchesStatus && matchesSource;
    });

    if (sortField) {
      filtered.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (valA === undefined && valB === undefined) return 0;
        if (valA === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (valB === undefined) return sortDirection === 'asc' ? -1 : 1;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        // Basic fallback for other types (dates as strings)
        const strA = String(valA);
        const strB = String(valB);
        return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }
    return filtered;
  }, [searchTerm, filterStatus, filterSource, sortField, sortDirection, leads]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  const handleOpenModal = () => {
    setNewLeadData(defaultNewLead);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Handlers for Edit Modal
  const handleOpenEditModal = (lead: Lead) => {
    setEditingLead(lead); // Set the lead to be edited
    setIsEditModalOpen(true); // Open the edit modal
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingLead(null); // Clear the editing lead state
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewLeadData(prev => ({ ...prev, [name]: name === 'potentialValue' ? parseFloat(value) || 0 : value }));
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!editingLead) return;
    const { name, value } = e.target;
    setEditingLead({
      ...editingLead,
      [name]: name === 'potentialValue' ? parseFloat(value) || 0 : value,
    });
  };

  const handleSaveLead = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newLeadWithId: Lead = {
      ...newLeadData,
      id: `lead-${Date.now()}`,
      lastContactDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    };
    setLeads(prevLeads => [newLeadWithId, ...prevLeads]);
    console.log('New Lead Saved:', newLeadWithId);
    handleCloseModal();
  };

  const handleUpdateLead = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLead) return;
    
    // Update the lead in the main leads array
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === editingLead.id ? editingLead : lead
      )
    );
    console.log('Lead Updated:', editingLead); // For debugging
    handleCloseEditModal();
  };

  return (
    <div className="relative min-h-screen">
      <Background
        gradient={{
          display: true,
          colorStart: 'rgba(var(--brand-primary-rgb), 0.1)',
          colorEnd: 'rgba(var(--brand-secondary-rgb), 0.05)',
          tilt: 45,
          opacity: 0.5
        }}
        dots={{
          display: true,
          color: 'rgba(var(--brand-on-background-rgb), 0.1)',
          size: '32',
          opacity: 0.3
        }}
        className="absolute inset-0 z-0"
      />
      <div className="relative z-10 p-4 md:p-6 lg:p-8 h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-base-content flex items-center"><Users className="mr-3 text-primary"/> Lead Management</h1>
          <button className="btn btn-primary w-full sm:w-auto" onClick={handleOpenModal}>
            <PlusCircle size={18} className="mr-2" /> Create New Lead
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 p-4 bg-base-200 rounded-lg shadow">
          <div>
            <label htmlFor="search" className="label"><span className="label-text">Search</span></label>
            <input
              id="search"
              type="text"
              placeholder="Search leads..."
              className="input input-bordered w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="statusFilter" className="label"><span className="label-text">Status</span></label>
            <select 
              id="statusFilter"
              className="select select-bordered w-full"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as Lead['status'] | 'All')}
            >
              <option value="All">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Lost">Lost</option>
              <option value="Won">Won</option>
            </select>
          </div>
          <div>
            <label htmlFor="sourceFilter" className="label"><span className="label-text">Source</span></label>
            <select 
              id="sourceFilter"
              className="select select-bordered w-full"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as Lead['source'] | 'All')}
            >
              <option value="All">All Sources</option>
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
              <option value="Advertisement">Advertisement</option>
              <option value="Cold Call">Cold Call</option>
              <option value="Event">Event</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {sortedAndFilteredLeads.length === 0 ? (
            <div className="h-full flex items-center justify-center"> 
              <div className="text-center py-10 card bg-base-100 shadow-md">
                <Users size={48} className="mx-auto text-base-content/30 mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Leads Found</h2>
                <p className="text-base-content/70">Try adjusting your search or filters, or create a new lead.</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr className="sticky top-0 bg-base-100 z-10">
                    <th onClick={() => handleSort('lastName')} className="cursor-pointer">
                      <div className="flex items-center">Name <SortIndicator field='lastName'/></div>
                    </th>
                    <th onClick={() => handleSort('company')} className="cursor-pointer">
                       <div className="flex items-center">Company <SortIndicator field='company'/></div>
                    </th>
                    <th>Contact</th>
                    <th onClick={() => handleSort('status')} className="cursor-pointer">
                       <div className="flex items-center">Status <SortIndicator field='status'/></div>
                    </th>
                    <th onClick={() => handleSort('source')} className="cursor-pointer">
                       <div className="flex items-center">Source <SortIndicator field='source'/></div>
                    </th>
                    <th onClick={() => handleSort('assignedTo')} className="cursor-pointer">
                      <div className="flex items-center">Assigned To <SortIndicator field='assignedTo'/></div>
                    </th>
                    <th onClick={() => handleSort('lastContactDate')} className="cursor-pointer">
                      <div className="flex items-center">Last Contact <SortIndicator field='lastContactDate'/></div>
                    </th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFilteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover">
                      <td>
                        <div className="font-bold">{lead.firstName} {lead.lastName}</div>
                        <div className="text-xs text-base-content/70">ID: {lead.id}</div>
                      </td>
                      <td>{lead.company}</td>
                      <td>
                        <div>{lead.email}</div>
                        {lead.phone && <div className="text-xs text-base-content/70">{lead.phone}</div>}
                      </td>
                      <td><span className={`badge ${getStatusBadge(lead.status)}`}>{lead.status}</span></td>
                      <td>{lead.source}</td>
                      <td>{lead.assignedTo}</td>
                      <td>{new Date(lead.lastContactDate).toLocaleDateString()}</td>
                      <td>
                        <div className="flex items-center justify-center space-x-1">
                          <button className="btn btn-ghost btn-xs" title="Edit Lead" onClick={() => handleOpenEditModal(lead)}><Edit3 size={16}/></button>
                          <button className="btn btn-ghost btn-xs text-error" title="Delete Lead"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {isEditModalOpen && editingLead && (
          <dialog id="edit_lead_modal" className="modal modal-open">
            <form onSubmit={handleUpdateLead} className="modal-box w-11/12 max-w-2xl">
              <button type="button" onClick={handleCloseEditModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
              <h3 className="font-bold text-lg mb-4">Edit Lead: {editingLead.firstName} {editingLead.lastName}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div className="form-control">
                  <label className="label"><span className="label-text">First Name</span></label>
                  <input type="text" name="firstName" placeholder="John" className="input input-bordered" value={editingLead.firstName} onChange={handleEditInputChange} required />
                </div>
                {/* Last Name */}
                <div className="form-control">
                  <label className="label"><span className="label-text">Last Name</span></label>
                  <input type="text" name="lastName" placeholder="Doe" className="input input-bordered" value={editingLead.lastName} onChange={handleEditInputChange} required />
                </div>
                {/* Company */}
                <div className="form-control">
                  <label className="label"><span className="label-text">Company</span></label>
                  <input type="text" name="company" placeholder="Acme Corp" className="input input-bordered" value={editingLead.company} onChange={handleEditInputChange} required />
                </div>
                {/* Email */}
                <div className="form-control">
                  <label className="label"><span className="label-text">Email</span></label>
                  <input type="email" name="email" placeholder="john.doe@example.com" className="input input-bordered" value={editingLead.email} onChange={handleEditInputChange} required />
                </div>
                {/* Phone */}
                <div className="form-control">
                  <label className="label"><span className="label-text">Phone (Optional)</span></label>
                  <input type="tel" name="phone" placeholder="555-1234" className="input input-bordered" value={editingLead.phone || ''} onChange={handleEditInputChange} />
                </div>
                {/* Status */}
                <div className="form-control">
                  <label className="label"><span className="label-text">Status</span></label>
                  <select name="status" className="select select-bordered" value={editingLead.status} onChange={handleEditInputChange}>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Lost">Lost</option>
                    <option value="Won">Won</option>
                  </select>
                </div>
                {/* Source */}
                <div className="form-control">
                  <label className="label"><span className="label-text">Source</span></label>
                  <select name="source" className="select select-bordered" value={editingLead.source} onChange={handleEditInputChange}>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="Advertisement">Advertisement</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Event">Event</option>
                  </select>
                </div>
                {/* Assigned To */}
                <div className="form-control">
                  <label className="label"><span className="label-text">Assigned To</span></label>
                  <input type="text" name="assignedTo" placeholder="User Name" className="input input-bordered" value={editingLead.assignedTo} onChange={handleEditInputChange} required />
                </div>
                {/* Potential Value */}
                <div className="form-control">
                  <label className="label"><span className="label-text">Potential Value (Optional)</span></label>
                  <input type="number" name="potentialValue" placeholder="5000" className="input input-bordered" value={editingLead.potentialValue || ''} onChange={handleEditInputChange} />
                </div>
                
                <div className="form-control md:col-span-2">
                  <label className="label"><span className="label-text">Notes (Optional)</span></label>
                  <textarea name="notes" className="textarea textarea-bordered h-24" placeholder="Any relevant notes..." value={editingLead.notes || ''} onChange={handleEditInputChange}></textarea>
                </div>
              </div>
              <div className="modal-action mt-6">
                <button type="button" onClick={handleCloseEditModal} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </dialog>
        )}
      </div>
    </div>
  );
};

export default LeadsView;
