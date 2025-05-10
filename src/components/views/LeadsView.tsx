'use client';

import React, { useState, useMemo, ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import { Users, PlusCircle, Edit3, Trash2, Eye, Search, Filter, ChevronUp, ChevronDown, Briefcase, AtSign, Phone, CalendarDays, Tag, UserCheck, Save, XCircle, AlertTriangle, UploadCloud } from 'lucide-react';
import { Background } from '../../once-ui/components/Background';

import { NormalizedLead } from '../../types'; 
import { createClient } from '../../lib/supabase/client'; 

const LeadsView: React.FC = () => {
  const supabase = createClient(); 

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMlsStatus, setFilterMlsStatus] = useState<'All' | string>('All'); 
  const [filterMarketRegion, setFilterMarketRegion] = useState<'All' | string>('All');
  const [uploadMarketRegion, setUploadMarketRegion] = useState<string>(""); // New state for upload

  const [sortField, setSortField] = useState<keyof NormalizedLead | ''>('created_at'); 
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); 
  
  const [leads, setLeads] = useState<NormalizedLead[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for modals - temporarily disable triggers
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Define initial state for the new lead form, based on NormalizedLead
  const initialNewNormalizedLeadData: Partial<NormalizedLead> = {
    contact_name: '',
    contact_email: '',
    property_address: '',
    // property_city (legacy, now unused for filtering): '',
    property_state: '',
    property_postal_code: '',
    property_type: '',
    market_region: '',
    mls_curr_status: '', // Perhaps a default like 'New' or 'Active'
    avm_value: null, // Or 0
    // Add other relevant fields, ensuring types match NormalizedLead
    // Fields like id, created_at, updated_at will be handled by DB or later logic
  };
  const [newLeadData, setNewLeadData] = useState<Partial<NormalizedLead>>(initialNewNormalizedLeadData);
  const [editingLead, setEditingLead] = useState<NormalizedLead | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // State for CSV Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Server-side filter options
  const [allMarketRegions, setAllMarketRegions] = useState<string[]>(['All']);
  const [allMlsStatuses, setAllMlsStatuses] = useState<string[]>(['All']);

  // Fetch distinct filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const { data: regionsData, error: regionsError } = await supabase.rpc('get_distinct_market_regions');
        if (regionsError) throw regionsError;
        if (regionsData) {
          setAllMarketRegions(['All', ...regionsData.map((r: any) => r.market_region)]);
        }
        const { data: statusesData, error: statusesError } = await supabase.rpc('get_distinct_mls_statuses');
        if (statusesError) throw statusesError;
        if (statusesData) {
          setAllMlsStatuses(['All', ...statusesData.map((s: any) => s.mls_curr_status)]);
        }
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };
    fetchFilterOptions();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const fetchNormalizedLeads = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('normalized_leads')
          .select('*');
        if (filterMarketRegion !== 'All') {
          query = query.eq('market_region', filterMarketRegion);
        }
        if (filterMlsStatus !== 'All') {
          query = query.eq('mls_curr_status', filterMlsStatus);
        }
        query = query.order(sortField || 'created_at', { ascending: sortDirection === 'asc' });
        const { data, error: supabaseError } = await query;
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
  }, [sortField, sortDirection, supabase, filterMarketRegion, filterMlsStatus]);

  // Only filter by search term on client; all other filters are server-side
  const sortedAndFilteredLeads = useMemo(() => {
    if (!searchTerm) return leads;
    const search = searchTerm.toLowerCase();
    return leads.filter(lead =>
      (lead.contact_name?.toLowerCase().includes(search) || false) ||
      (lead.contact_email?.toLowerCase().includes(search) || false) ||
      (lead.property_address?.toLowerCase().includes(search) || false) ||
      (lead.market_region?.toLowerCase().includes(search) || false)
    );
  }, [searchTerm, leads]);

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

  // --- Modal handlers - Temporarily disabled or simplified ---
  const handleOpenModal = () => {
    setNewLeadData(initialNewNormalizedLeadData); // Reset form data
    setIsModalOpen(true);
  };
  const handleCloseModal = () => setIsModalOpen(false);

  const handleOpenEditModal = (lead: NormalizedLead) => {
    alert('Editing leads is temporarily disabled while we upgrade the system.');
  };
  const handleCloseEditModal = () => { setIsEditModalOpen(false); setEditingLead(null); };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setNewLeadData(prev => ({
      ...prev,
      [name]: type === 'number' ? (parseFloat(value) || null) : value,
    }));
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  };

  const handleSaveLead = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newLeadData.contact_name || !newLeadData.contact_email || !newLeadData.market_region) {
      alert('Contact Name, Email, and Market Region are required.');
      return;
    }

    setIsLoading(true); // Use a more specific loading state for the modal if preferred
    setError(null);

    try {
      const leadToInsert: Omit<NormalizedLead, 'id' | 'created_at' | 'updated_at'> & { original_lead_id: string } = {
        ...initialNewNormalizedLeadData, // Start with defaults for any potentially missing fields
        ...newLeadData, // Overlay with user-entered data
        original_lead_id: crypto.randomUUID(), // Generate UUID
        // Ensure all required fields for DB that aren't auto-generated are present
        // Convert empty strings to null for optional numeric/text fields if DB expects null
        avm_value: newLeadData.avm_value ? Number(newLeadData.avm_value) : null,
        // Ensure other fields like // property_city (legacy, now unused for filtering), property_state etc. are handled
      };

      // Remove undefined properties that might have come from Partial<NormalizedLead>
      Object.keys(leadToInsert).forEach(key => leadToInsert[key as keyof typeof leadToInsert] === undefined && delete leadToInsert[key as keyof typeof leadToInsert]);

      const { data: insertedLead, error: insertError } = await supabase
        .from('normalized_leads')
        .insert(leadToInsert as any) // Using 'as any' temporarily if TS complains about exact type match for insert
        .select()
        .single(); // Assuming you want the inserted record back

      if (insertError) {
        throw insertError;
      }

      if (insertedLead) {
        setLeads(prevLeads => [insertedLead, ...prevLeads]); // Add to local state
      }
      handleCloseModal();
    } catch (err) {
      console.error('Error saving new lead:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while saving the lead.');
      // Keep modal open for user to see error or retry, or close and show a toast
    } finally {
      setIsLoading(false); // Reset general loading state, or modal-specific loading state
    }
  };

  const handleSaveEditedLead = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const handleDeleteLead = (leadId: number) => {
    alert(`Deleting lead ${leadId} is temporarily disabled.`);
  };

  // --- CSV Upload Handlers ---
  const handleUploadButtonClick = () => {
    fileInputRef.current?.click(); // Trigger hidden file input
  };

  const fetchLeadsAndResetUpload = async () => {
    // Re-fetch leads (assuming fetchNormalizedLeads is defined in the useEffect or can be extracted)
    // For simplicity, we'll trigger the useEffect by changing a dummy state or calling a refetch function if available
    // A more direct way if fetchNormalizedLeads is callable:
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('normalized_leads')
        .select('*')
        .order(sortField || 'created_at', { ascending: sortDirection === 'asc' });
      if (supabaseError) throw supabaseError;
      setLeads(data || []);
    } catch (err) {
      console.error('Error refetching leads:', err);
      setError(err instanceof Error ? err.message : 'Error refetching leads.');
    }
    setIsLoading(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!uploadMarketRegion || uploadMarketRegion.trim() === "") {
        const errorMsg = 'Please enter a Market Region for the upload before selecting a file.';
        console.error('Upload error: LeadsView -', errorMsg);
        setUploadStatus(`Upload failed: ${errorMsg}`);
        // Clear file input and selected file state
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setSelectedFile(null);
        setIsUploading(false); // Ensure uploading state is reset
        return; // Stop the upload process
      }

      setSelectedFile(file);
      // Immediately attempt to upload
      setIsUploading(true);
      setUploadStatus('Uploading... Please wait.');
      setError(null); // Clear previous main errors

      const formData = new FormData();
      formData.append('file', file); 
      formData.append('market_region', uploadMarketRegion); // Use the new state here

      try {
        const response = await fetch('/api/leads/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || `Upload failed with status: ${response.status}`);
        }
        
        setUploadStatus(`Upload successful: ${result.message || 'Leads processed.'}. Refreshing table...`);
        await fetchLeadsAndResetUpload(); // Refresh data
        setTimeout(() => setUploadStatus(null), 5000); // Clear status after 5s
      } catch (err) {
        console.error('Upload error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during upload.';
        setUploadStatus(`Upload failed: ${errorMessage}`);
        // setError(`Upload failed: ${errorMessage}`); // Optionally set main error too
      } finally {
        setIsUploading(false);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Reset file input
        }
      }
    }
  };
  // --- End CSV Upload Handlers ---

  if (isLoading && !isUploading) { // Don't show main loading if only uploading
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
            {allMlsStatuses.map(status => <option key={status} value={status}>{status}</option>) }
          </select>
        </div>
        <div className="form-control min-w-[150px]">
          <select 
            className="select select-bordered"
            value={filterMarketRegion}
            onChange={(e) => setFilterMarketRegion(e.target.value)}
          >
            {allMarketRegions.map(region => <option key={region} value={region}>{region}</option>) }
          </select>
        </div>
        <button onClick={handleOpenModal} className="btn btn-primary">
          <PlusCircle size={20} className="mr-2" /> Add New Lead
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange}
          accept=".csv"
          style={{ display: 'none' }} 
        />
        <button onClick={handleUploadButtonClick} className="btn btn-secondary" disabled={isUploading}>
          {isUploading ? (
            <><span className="loading loading-spinner loading-xs mr-2"></span> Uploading...</>
          ) : (
            <><UploadCloud size={20} className="mr-2" /> Upload CSV</>
          )}
        </button>
        <div className="ml-4">
          <input 
            type="text" 
            placeholder="Market Region for Upload"
            value={uploadMarketRegion}
            onChange={(e) => setUploadMarketRegion(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      {uploadStatus && (
        <div className={`p-4 my-4 rounded-md ${uploadStatus.startsWith('Upload failed') ? 'bg-error text-error-content' : 'bg-success text-success-content'}`}>
          {uploadStatus}
        </div>
      )}

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
        <dialog open className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box w-11/12 max-w-3xl">
            <button type="button" onClick={handleCloseModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            <h3 className="font-bold text-lg mb-6">Add New Normalized Lead</h3>
            <form onSubmit={handleSaveLead} className="space-y-4">
              {/* Form fields would need to map to NormalizedLead or a creation DTO */}
              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label"><span className="label-text">Contact Name <span className="text-error">*</span></span></label><input type="text" name="contact_name" value={newLeadData.contact_name || ''} onChange={handleInputChange} className="input input-bordered w-full" required /></div>
                <div><label className="label"><span className="label-text">Contact Email <span className="text-error">*</span></span></label><input type="email" name="contact_email" value={newLeadData.contact_email || ''} onChange={handleInputChange} className="input input-bordered w-full" required /></div>
              </div>
              {/* Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label"><span className="label-text">Market Region <span className="text-error">*</span></span></label><input type="text" name="market_region" value={newLeadData.market_region || ''} onChange={handleInputChange} className="input input-bordered w-full" required /></div>
                <div><label className="label"><span className="label-text">MLS Current Status</span></label><input type="text" name="mls_curr_status" value={newLeadData.mls_curr_status || ''} onChange={handleInputChange} className="input input-bordered w-full" /></div>
              </div>
              {/* Row 3: Property Address Details */}
              <div><label className="label"><span className="label-text">Property Full Address</span></label><input type="text" name="property_address" value={newLeadData.property_address || ''} onChange={handleInputChange} className="input input-bordered w-full" /></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="label"><span className="label-text">Property State</span></label><input type="text" name="property_state" value={newLeadData.property_state || ''} onChange={handleInputChange} className="input input-bordered w-full" /></div>
                <div><label className="label"><span className="label-text">Property Postal Code</span></label><input type="text" name="property_postal_code" value={newLeadData.property_postal_code || ''} onChange={handleInputChange} className="input input-bordered w-full" /></div>
              </div>
              {/* Row 4 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label"><span className="label-text">Property Type</span></label><input type="text" name="property_type" value={newLeadData.property_type || ''} onChange={handleInputChange} className="input input-bordered w-full" /></div>
                <div><label className="label"><span className="label-text">AVM Value</span></label><input type="number" name="avm_value" value={newLeadData.avm_value || ''} onChange={handleInputChange} className="input input-bordered w-full" /></div>
              </div>
              
              {error && <p className="text-error text-sm">Error: {error}</p>}

              <div className="modal-action mt-6">
                <button type="button" onClick={handleCloseModal} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>{isLoading ? <span className='loading loading-spinner loading-xs'></span> : 'Save Lead'}</button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* Edit Lead Modal (Example - kept for structure, but trigger is disabled) */}
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
