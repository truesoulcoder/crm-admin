'use client';

import React, { useState, useMemo, ChangeEvent, FormEvent, useEffect } from 'react';
import { Users, PlusCircle, Edit3, Trash2, Eye, Search, Filter, ChevronUp, ChevronDown, Briefcase, AtSign, Phone, CalendarDays, Tag, UserCheck, Save, XCircle, AlertTriangle } from 'lucide-react';
import { Background } from '../../once-ui/components/Background';

import { NormalizedLead } from '../../types'; 
import { createClient } from '../../lib/supabase/client'; 

const LeadsView: React.FC = () => {
  const supabase = createClient(); 

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMlsStatus, setFilterMlsStatus] = useState<'All' | string>('All'); 
  const [filterMarketRegion, setFilterMarketRegion] = useState<'All' | string>('All');

  const [sortField, setSortField] = useState<keyof NormalizedLead | ''>('created_at'); 
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); 
  
  const [leads, setLeads] = useState<NormalizedLead[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLeadData, setNewLeadData] = useState<any>({}); 
  const [editingLead, setEditingLead] = useState<NormalizedLead | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Moved useMemo hooks before conditional returns to fix lint error
  const uniqueMarketRegions = useMemo(() => 
    ['All', ...Array.from(new Set(leads.map(lead => lead.market_region).filter(Boolean) as string[]))], 
    [leads]
  );
  const uniqueMlsStatuses = useMemo(() => 
    ['All', ...Array.from(new Set(leads.map(lead => lead.mls_curr_status).filter(Boolean) as string[]))], 
    [leads]
  );

  useEffect(() => {
    const fetchNormalizedLeads = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: supabaseError } = await supabase
          .from('normalized_leads')
          .select('*')
          .order(sortField || 'created_at', { ascending: sortDirection === 'asc' }); 

        if (supabaseError) {
          throw supabaseError;
        }
        setLeads(data || []);
      } catch (err) {
        console.error('Error fetching normalized leads:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching leads.');
      }
      setIsLoading(false);
    };

    fetchNormalizedLeads();
  }, [sortField, sortDirection, supabase]); 

  const sortedAndFilteredLeads = useMemo(() => {
    let filtered = leads.filter(lead => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        (lead.contact_name?.toLowerCase().includes(search) || false) ||
        (lead.contact_email?.toLowerCase().includes(search) || false) ||
        (lead.property_address?.toLowerCase().includes(search) || false) ||
        (lead.market_region?.toLowerCase().includes(search) || false);

      const matchesMlsStatus = filterMlsStatus === 'All' || lead.mls_curr_status === filterMlsStatus;
      const matchesMarketRegion = filterMarketRegion === 'All' || lead.market_region === filterMarketRegion;
      
      return matchesSearch && matchesMlsStatus && matchesMarketRegion;
    });

    if (sortField && leads.length > 0) {
      filtered.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (valA === undefined || valA === null) return sortDirection === 'asc' ? 1 : -1;
        if (valB === undefined || valB === null) return sortDirection === 'asc' ? -1 : 1;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA);
        const strB = String(valB);
        return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }
    return filtered;
  }, [searchTerm, filterMlsStatus, filterMarketRegion, sortField, sortDirection, leads]);

  const handleSort = (field: keyof NormalizedLead | '') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIndicator = ({ field }: { field: keyof NormalizedLead | '' }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  const handleOpenModal = () => {
    alert('Adding new leads is temporarily disabled while we upgrade the system.');
  };
  const handleCloseModal = () => setIsModalOpen(false);

  const handleOpenEditModal = (lead: NormalizedLead) => {
    alert('Editing leads is temporarily disabled while we upgrade the system.');
  };
  const handleCloseEditModal = () => { setIsEditModalOpen(false); setEditingLead(null); };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  };

  const handleSaveLead = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const handleSaveEditedLead = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const handleDeleteLead = (leadId: number) => {
    alert(`Deleting lead ${leadId} is temporarily disabled.`);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  if (error) {
    return <div className="flex flex-col justify-center items-center h-screen text-error">
      <AlertTriangle size={48} className="mb-4" />
      <p className="text-xl">Error loading leads:</p>
      <p>{error}</p>
    </div>;
  }

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return <span className="badge badge-ghost badge-sm">Unknown</span>;
    const normalizedStatus = status.toLowerCase();
    let badgeClass = 'badge-ghost'; 

    if (normalizedStatus.includes('active') || normalizedStatus.includes('new')) badgeClass = 'badge-info';
    else if (normalizedStatus.includes('pending') || normalizedStatus.includes('contract')) badgeClass = 'badge-warning';
    else if (normalizedStatus.includes('sold') || normalizedStatus.includes('closed')) badgeClass = 'badge-success';
    else if (normalizedStatus.includes('expired') || normalizedStatus.includes('cancelled')) badgeClass = 'badge-error';
  
    return <span className={`badge ${badgeClass} badge-sm`}>{status}</span>;
  };

  return (
    <Background className="p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-content flex items-center">
          <Users size={32} className="mr-3 text-primary" /> Normalized Leads Management
        </h1>
      </header>

      <div className="mb-6 p-4 bg-base-200 rounded-lg shadow flex flex-wrap gap-4 items-center">
        <div className="relative flex-grow min-w-[200px]">
          <input 
            type="text" 
            placeholder="Search leads (name, email, address, market)..." 
            className="input input-bordered w-full pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content opacity-50" />
        </div>
        <div className="form-control min-w-[150px]">
          <select 
            className="select select-bordered"
            value={filterMlsStatus}
            onChange={(e) => setFilterMlsStatus(e.target.value)}
          >
            {uniqueMlsStatuses.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="form-control min-w-[150px]">
          <select 
            className="select select-bordered"
            value={filterMarketRegion}
            onChange={(e) => setFilterMarketRegion(e.target.value)}
          >
            {uniqueMarketRegions.map(region => <option key={region} value={region}>{region}</option>)}
          </select>
        </div>
        <button onClick={handleOpenModal} className="btn btn-primary btn-outline" disabled>
          <PlusCircle size={20} className="mr-2" /> Add New Lead (Disabled)
        </button>
      </div>

      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="text-base-content">
              <th onClick={() => handleSort('contact_name')} className="cursor-pointer hover:bg-base-200">
                Contact Name <SortIndicator field="contact_name" />
              </th>
              <th onClick={() => handleSort('contact_email')} className="cursor-pointer hover:bg-base-200">
                Email <SortIndicator field="contact_email" />
              </th>
              <th onClick={() => handleSort('property_address')} className="cursor-pointer hover:bg-base-200">
                Property Address <SortIndicator field="property_address" />
              </th>
              <th onClick={() => handleSort('market_region')} className="cursor-pointer hover:bg-base-200">
                Market Region <SortIndicator field="market_region" />
              </th>
              <th onClick={() => handleSort('avm_value')} className="cursor-pointer hover:bg-base-200">
                AVM Value <SortIndicator field="avm_value" />
              </th>
              <th onClick={() => handleSort('mls_curr_status')} className="cursor-pointer hover:bg-base-200">
                MLS Status <SortIndicator field="mls_curr_status" />
              </th>
              <th onClick={() => handleSort('created_at')} className="cursor-pointer hover:bg-base-200">
                Created At <SortIndicator field="created_at" />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredLeads.length > 0 ? (
              sortedAndFilteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-base-200 transition-colors duration-150">
                  <td>{lead.contact_name || 'N/A'}</td>
                  <td>{lead.contact_email || 'N/A'}</td>
                  <td>{lead.property_address || 'N/A'}</td>
                  <td>{lead.market_region || 'N/A'}</td>
                  <td>{lead.avm_value ? `$${lead.avm_value.toLocaleString()}` : 'N/A'}</td>
                  <td>{getStatusBadge(lead.mls_curr_status)}</td>
                  <td>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td className="space-x-1">
                    <button onClick={() => handleOpenEditModal(lead)} className="btn btn-xs btn-ghost text-info btn-disabled" title="Edit Lead (Disabled)" disabled><Edit3 size={16} /></button>
                    <button onClick={() => handleDeleteLead(lead.id)} className="btn btn-xs btn-ghost text-error btn-disabled" title="Delete Lead (Disabled)" disabled><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-8 text-base-content opacity-70">
                  <Users size={32} className="mx-auto mb-2" />
                  No leads found. Try adjusting your search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <dialog open className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Add New Lead (Temporarily Disabled)</h3>
            <form onSubmit={handleSaveLead} className="space-y-4">
              <div><label className="label"><span className="label-text">Contact Name</span></label><input type="text" name="contact_name" className="input input-bordered w-full" disabled /></div>
              <div className="modal-action">
                <button type="button" onClick={handleCloseModal} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled>Save Lead</button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {isEditModalOpen && editingLead && (
         <dialog open className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Edit Lead (Temporarily Disabled) - {editingLead.contact_name}</h3>
            <form onSubmit={handleSaveEditedLead} className="space-y-4">
              <div><label className="label"><span className="label-text">Contact Name</span></label><input type="text" name="contact_name" defaultValue={editingLead.contact_name || ''} className="input input-bordered w-full" disabled /></div>
              <div className="modal-action">
                <button type="button" onClick={handleCloseEditModal} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled>Save Changes</button>
              </div>
            </form>
          </div>
        </dialog>
      )}

    </Background>
  );
};

export default LeadsView;
