'use client'

import { ChevronUp, ChevronDown, Edit3, Trash2, PlusCircle, Search, UploadCloud, AlertTriangle, XCircle, Save, Eye, Mail, Phone, MapPin } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, FormEvent, useRef } from 'react';

// Using shared Supabase client
import { Badge } from 'react-daisyui';
import { supabase } from '@/lib/supabase/client';

// Define types (adjust based on your actual schema)
interface ColumnConfig {
  key: keyof NormalizedLead | string; // Allow string for keys not directly in NormalizedLead if needed, but prefer keyof for type safety
  label: string;
  sortable?: boolean;
}

export interface NormalizedLead {
  id: string;
  market_region?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  mls_curr_list_agent_name?: string | null;
  mls_curr_list_agent_email?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_postal_code?: string | null;
  property_type?: string | null;
  beds?: string | null; // Assuming text, adjust if numeric
  baths?: string | null; // Assuming text, adjust if numeric
  year_built?: string | null; // Assuming text, adjust if numeric
  square_footage?: string | null; // Assuming text, adjust if numeric (schema has it as 'text')
  lot_size_sqft?: string | null; // Assuming text, adjust if numeric
  wholesale_value?: number | null; // numeric
  assessed_total?: number | null; // numeric
  avm_value?: number | null; // numeric
  price_per_sq_ft?: number | null; // numeric
  mls_curr_status?: string | null;
  mls_curr_days_on_market?: string | null;
  converted: boolean; // not null default false
  status?: string | null; // This is lead_status in table view, aligning with 'status' field in schema
  source?: string | null; // This is lead_source in table view
  notes?: string | null;
  created_at: string; // timestamp with time zone
  updated_at: string; // timestamp with time zone
  // Fields from previous interface not directly in new schema but kept for potential future use or if schema expands:
  company_name?: string | null;
  company_industry?: string | null;
  company_website?: string | null;
  company_notes?: string | null;
  county?: string | null;
  country?: string | null;
  lead_score?: number | null;
  assigned_to?: string | null;
  last_contacted_date?: string | null; // separate from updated_at
  next_follow_up_date?: string | null;
  conversion_date?: string | null;
  lost_reason?: string | null;
  tags?: string[] | null;
  custom_fields?: Record<string, any> | null;
  property_sf?: number | null; // old name for square_footage, kept if used in old data
  // The 'lead_status' and 'lead_source' used in UI might map to 'status' and 'source' from the schema respectively.
  // For clarity, the UI will use lead.status and lead.source which map to these schema fields.
  // The table column header 'lead_status' will display data from 'lead.status'.
  _primaryContact?: {
    name: string | null;
    email: string;
    type: string;
    contactType: 'owner' | 'agent';
  } | null;
}

const initialNewLeadData: Partial<NormalizedLead> = {
  contact_name: '',
  contact_email: '',
  notes: '',
  market_region: '',
  status: 'UNQUALIFIED', // Default status for new leads
  // Add other fields as necessary for editing/creation
};

const LeadsView: React.FC = () => {
  const [leads, setLeads] = useState<NormalizedLead[]>([]);
  const [marketRegions, setMarketRegions] = useState<string[]>([]);
  const [filterMarketRegion, setFilterMarketRegion] = useState<string>('All');
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Table State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [sortField, setSortField] = useState<keyof NormalizedLead>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedLead, setSelectedLead] = useState<NormalizedLead | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<NormalizedLead>>(initialNewLeadData);

  // CSV Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMarketRegion, setUploadMarketRegion] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columnConfigurations: ColumnConfig[] = [
    { key: 'contact_name', label: 'Contact Info', sortable: true },
    { key: 'property_address', label: 'Property Address', sortable: true }, 
    { key: 'market_region', label: 'Market Region', sortable: true },
    { key: 'status', label: 'Lead Status', sortable: true },
    { key: 'assessed_total', label: 'Assessed Value', sortable: true },
    { key: 'mls_curr_status', label: 'MLS Status', sortable: true },
    { key: 'mls_curr_days_on_market', label: 'Days on Market', sortable: true },
  ];

  // Fetch Market Regions
  const fetchMarketRegions = useCallback(async () => {
    console.log('Fetching market regions...');
    try {
      // First, get a count of distinct market regions to decide on the best approach
      const { count, error: countError } = await supabase
        .from('normalized_leads')
        .select('market_region', { count: 'exact', head: true })
        .not('market_region', 'is', null);

      if (countError) throw countError;
      
      console.log(`Found ${count} non-null market regions in database`);
      
      // If we have a reasonable number of distinct values, fetch them directly
      if (count && count <= 1000) {
        const { data, error } = await supabase
          .from('normalized_leads')
          .select('market_region')
          .not('market_region', 'is', null)
          .order('market_region', { ascending: true });
          
        if (error) throw error;
        
        const uniqueRegions = Array.from(
          new Set(data.map(item => item.market_region).filter(Boolean))
        ).sort() as string[];
        
        console.log(`Found ${uniqueRegions.length} unique market regions`);
        setMarketRegions(uniqueRegions);
      } else {
        // If too many regions, use a more efficient approach with pagination
        console.log('Large dataset detected, using paginated approach...');
        const BATCH_SIZE = 1000;
        let offset = 0;
        const allRegions = new Set<string>();
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('normalized_leads')
            .select('market_region')
            .not('market_region', 'is', null)
            .order('market_region', { ascending: true })
            .range(offset, offset + BATCH_SIZE - 1);
            
          if (error) throw error;
          
          // Add new regions to our set (automatically handles duplicates)
          data.forEach(item => {
            if (item.market_region) {
              allRegions.add(item.market_region);
            }
          });
          
          // If we got fewer items than requested, we've reached the end
          if (!data || data.length < BATCH_SIZE) {
            hasMore = false;
          } else {
            offset += BATCH_SIZE;
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Convert set to array and sort
        const sortedRegions = Array.from(allRegions).sort();
        console.log(`Found ${sortedRegions.length} unique market regions`);
        setMarketRegions(sortedRegions);
      }
    } catch (err) {
      console.error('Error fetching market regions:', err);
      setMarketRegions([]);
    }
  }, [setMarketRegions]); // Fix variable scope issue by adding setMarketRegions to the dependency array

  // Check if a lead has any valid email address
  const hasValidEmail = (lead: NormalizedLead) => {
    return !!lead.contact_email || !!lead.mls_curr_list_agent_email;
  };

  // Get status badge color based on status
  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) status = 'UNCONTACTED';
    
    const baseClasses = 'badge text-xs font-medium px-2 py-1 rounded-md';
    
    switch (status.toUpperCase()) {
      case 'CONTACTED':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'INTERESTED':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'NOT INTERESTED':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'FOLLOW UP':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'UNCONTACTED':
      default:
        return `${baseClasses} bg-cyan-100 text-cyan-800`; // Light blue for UNCONTACTED
    }
  };

  // Fetch Leads from useful_leads view
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('useful_leads')
        .select('*', { count: 'exact' });

      // Apply market region filter if one is selected
      if (filterMarketRegion && filterMarketRegion !== 'All') {
        query = query.eq('market_region', filterMarketRegion);
      }

      // Apply search term filter
      if (tableSearchTerm && tableSearchTerm.trim() !== '') {
        const searchTermQuery = `%${tableSearchTerm.trim()}%`;
        query = query.or(
          `contact_name.ilike.${searchTermQuery},` +
          `contact_email.ilike.${searchTermQuery},` +
          `property_address.ilike.${searchTermQuery},` +
          `property_city.ilike.${searchTermQuery},` +
          `property_state.ilike.${searchTermQuery},` +
          `property_postal_code.ilike.${searchTermQuery},` +
          `notes.ilike.${searchTermQuery},` +
          `status.ilike.${searchTermQuery}`
        );
      }

      // Apply sorting
      query = query.order(sortField, { ascending: sortDirection === 'asc' });

      const from = (currentPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to);

      const { data, error: supabaseError, count } = await query;

      if (supabaseError) throw supabaseError;

      setLeads(data || []);
      setTotalLeads(count || 0);

    } catch (err: any) {
      console.error('Error fetching leads:', err);
      setError(err.message || 'Failed to fetch leads.');
    } finally {
      setIsLoading(false);
    }
  }, [filterMarketRegion, sortField, sortDirection, currentPage, rowsPerPage, tableSearchTerm]);

  const fetchNormalizedLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('normalized_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
      alert('Error loading leads');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      // Assuming these can be fetched in parallel.
      // If fetchNormalizedLeads depends on fetchMarketRegions, they should be awaited sequentially.
      await Promise.all([
        fetchMarketRegions(),
        fetchLeads()
      ]);
    };

    loadInitialData().catch(error => {
      // This catches errors if loadInitialData itself fails, 
      // or if Promise.all rejects due to an unhandled error in one of the fetches.
      // Individual fetches also have their own error handling, which is good.
      console.error('Error during initial data loading:', error);
      // Optionally set a general error state if appropriate
      // setError('Failed to load initial page data.'); 
    });
  }, [fetchMarketRegions, fetchLeads]); // Initial fetch

  // Effect to reset page to 1 when search term or region filter changes
  useEffect(() => {
    if (tableSearchTerm || (filterMarketRegion && filterMarketRegion !== 'All')) {
      setCurrentPage(1);
    }
  }, [tableSearchTerm, filterMarketRegion]);

  // Handlers
  const handleSort = (field: keyof NormalizedLead) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page on sort change
  };

  const handleOpenModal = (lead: NormalizedLead) => {
    setSelectedLead(lead);
    setEditFormData(lead);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLead(null);
    setEditFormData(initialNewLeadData);
  };

  const handleModalInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveLead = async () => {
    if (!selectedLead?.id) return;

    setIsLoading(true); // Consider a more specific loading state like isSaving
    try {
      const { error: updateError } = await supabase
        .from('normalized_leads')
        .update(editFormData)
        .eq('id', selectedLead.id);
      if (updateError) throw updateError;

      await fetchNormalizedLeads(); // Refresh data
      handleCloseModal();
    } catch (err: any) {
      console.error('Error saving lead:', err);
      alert(`Failed to save lead: ${err?.message || JSON.stringify(err) || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };


  const handleDeleteLead = async () => {
    if (!selectedLead || !confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('normalized_leads')
        .delete()
        .eq('id', selectedLead.id);

      if (error) throw error;

      setLeads(prev => prev.filter(l => l.id !== selectedLead.id));
      alert('Lead deleted successfully!');
      handleCloseModal();
    } catch (err: any) {
      console.error('Error deleting lead:', err);
      alert(`Failed to delete lead: ${err.message}`);
      setError(`Failed to delete lead: ${err.message}`);
    }
    setIsLoading(false);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null);
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload.');
      return;
    }
    if (!uploadMarketRegion.trim()) {
      alert('Please specify a Market Region for the uploaded leads.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('market_region', uploadMarketRegion); // Pass market region to API

    try {
      const response = await fetch('/api/leads/upload', { // Assuming API endpoint for upload
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }
      setUploadStatus(`Successfully uploaded ${result.count || 0} leads.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
      await fetchNormalizedLeads(); // Refresh leads list
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadStatus(`Upload failed: ${err.message}`);
    }
    setIsUploading(false);
  };

  // Sort Indicator Component
  const SortIndicator = ({ field }: { field: keyof NormalizedLead | '' }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />;
  };
  
  const totalPages = Math.ceil(totalLeads / rowsPerPage) || 1;

  const getStatusBadgeClass = (status: string | null | undefined): string => {
    if (!status) return 'badge-ghost';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('new') || lowerStatus.includes('open')) return 'badge-info';
    if (lowerStatus.includes('contacted') || lowerStatus.includes('step')) return 'badge-success';
    if (lowerStatus.includes('offer sent') || lowerStatus.includes('pending')) return 'badge-warning';
    if (lowerStatus.includes('not interested') || lowerStatus.includes('closed') || lowerStatus.includes('lost')) return 'badge-error';
    return 'badge-neutral'; // Default
  };

  // Helper to get displayable value
  const displayValue = (value: any) => value === null || value === undefined ? '-' : String(value);

  const getCleanEmailDisplay = (emailString?: string | null): string => {
    if (!emailString) return 'No Email';
    const emailParts = emailString.split(';').map(part => part.trim()).filter(part => part.length > 0);
    if (emailParts.length === 0) {
      return 'No Email';
    }
    return emailParts[0]; 
  };

  return (
    <div className="p-4 md:p-6 bg-base-200 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-base-content">Lead Management</h1>

      {/* CSV Upload Section */}
      <div className="mb-6 p-4 bg-base-100 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3 text-base-content">Upload Leads CSV</h2>
        <form onSubmit={(e) => { e.preventDefault(); void handleFileUpload(e); }} className="space-y-3">
          <div>
            <label htmlFor="uploadMarketRegion" className="label-text block mb-1">Market Region for Uploaded Leads:</label>
            <input 
              type="text" 
              id="uploadMarketRegion"
              placeholder="e.g., Northern California"
              className="input input-bordered input-sm w-full max-w-xs"
              value={uploadMarketRegion}
              onChange={(e) => setUploadMarketRegion(e.target.value)}
              required
            />
          </div>
          <div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileSelect} 
              accept=".csv"
              className="file-input file-input-bordered file-input-sm w-full max-w-xs hidden"
              id="csvFile"
            />
            <button 
              type="button" 
              onClick={handleUploadButtonClick} 
              className="btn btn-outline btn-sm mr-2"
              disabled={isUploading}
            >
              <UploadCloud size={16} className="mr-1"/> {selectedFile ? selectedFile.name : 'Choose CSV File'}
            </button>
            <button 
              type="submit" 
              className="btn btn-primary btn-sm"
              disabled={isUploading || !selectedFile || !uploadMarketRegion.trim()}
            >
              {isUploading ? 'Uploading...' : 'Upload Leads'}
            </button>
          </div>
        </form>
        {uploadStatus && (
          <div className={`mt-3 p-2 rounded-md text-sm ${uploadStatus.includes('failed') ? 'bg-error text-error-content' : 'bg-success text-success-content'}`}>
            {uploadStatus}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <AlertTriangle size={20}/>
          <span><strong>Error:</strong> {error}</span>
        </div>
      )}

      {/* Table Search, Filter, and Rows per Page */}
      <div className="mb-6 p-4 bg-base-200 rounded-lg">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {/* Search */}
          <div className="form-control flex-1">
            <label className="label">
              <span className="label-text">Search Leads</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, address, etc..."
                className="input input-bordered w-full pl-10 pr-10"
                value={tableSearchTerm}
                onChange={(e) => setTableSearchTerm(e.target.value)}
              />
              {tableSearchTerm && (
                <button
                  onClick={() => setTableSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Region Filter */}
          <div className="form-control w-full sm:w-48">
            <label className="label">
              <span className="label-text">Market Region</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterMarketRegion}
              onChange={(e) => setFilterMarketRegion(e.target.value)}
            >
              <option value="">All Regions</option>
              {marketRegions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          
          {/* Rows per Page */}
          <div className="form-control w-full sm:w-32">
            <label className="label">
              <span className="label-text">Rows</span>
            </label>
            <select 
              className="select select-bordered w-full"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-base-100 rounded-lg shadow overflow-hidden">
        <table className="table table-zebra table-sm w-full">
          <thead>
            <tr className="text-base-content">
              {columnConfigurations.map(col => (
                <th 
                  key={col.key} 
                  onClick={() => col.sortable !== false && handleSort(col.key as keyof NormalizedLead)}
                  className={col.sortable !== false ? 'cursor-pointer hover:bg-base-300' : ''}
                >
                  {col.label} {col.sortable !== false && <SortIndicator field={col.key as keyof NormalizedLead} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && !leads.length ? (
              <tr><td colSpan={5} className="text-center py-10">Loading leads...</td></tr>
            ) : !isLoading && !leads.length ? (
              <tr><td colSpan={5} className="text-center py-10">No leads found.</td></tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover cursor-pointer" onClick={() => handleOpenModal(lead)}>
                  <td>{lead.contact_name}</td>
                  <td>{lead.contact_email}</td>
                  <td>{lead.market_region}</td>
                  <td>{lead.property_address}</td>
                  <td>{lead.status}</td>
                  <td className="text-right">
                    <Badge variant={lead.converted ? 'success' : 'warning'}> 
                      {lead.converted ? 'Converted' : 'Pending'}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="mt-6 flex flex-wrap justify-between items-center gap-4 p-4 bg-base-100 rounded-lg shadow">
        <div>
          <span className="text-sm text-base-content opacity-70">
            Page {currentPage} of {totalPages} (Total: {totalLeads} leads)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="select select-bordered select-sm"
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
          >
            <option value={25}>25/page</option>
            <option value={50}>50/page</option>
            <option value={100}>100/page</option>
          </select>
          <div className="join">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="join-item btn btn-sm"
              disabled={currentPage === 1 || isLoading}
            >
              Â« Prev
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="join-item btn btn-sm"
              disabled={currentPage >= totalPages || isLoading}
            >
              Next Â»
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && selectedLead && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <button onClick={handleCloseModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><XCircle size={20}/></button>
            <h3 className="font-bold text-xl mb-4">Edit Lead: {editFormData.contact_name || 'N/A'}</h3>
            
            <form onSubmit={(e) => { e.preventDefault(); void handleSaveLead(); }} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <label htmlFor="modal-contact_name" className="label"><span className="label-text">Contact Name</span></label>
                <input type="text" id="modal-contact_name" name={`contact_name`} value={editFormData[`contact_name`] || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-contact_email" className="label"><span className="label-text">Contact Email</span></label>
                <input type="email" id="modal-contact_email" name={`contact_email`} value={editFormData[`contact_email`] || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-market_region" className="label"><span className="label-text">Market Region</span></label>
                <input type="text" id="modal-market_region" name="market_region" value={editFormData.market_region || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-property_address" className="label"><span className="label-text">Property Address</span></label>
                <input type="text" id="modal-property_address" name="property_address" value={editFormData.property_address || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-property_city" className="label"><span className="label-text">City</span></label>
                <input type="text" id="modal-property_city" name="property_city" value={editFormData.property_city || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-property_state" className="label"><span className="label-text">State</span></label>
                <input type="text" id="modal-property_state" name="property_state" value={editFormData.property_state || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-property_postal_code" className="label"><span className="label-text">Postal Code</span></label>
                <input type="text" id="modal-property_postal_code" name="property_postal_code" value={editFormData.property_postal_code || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-status" className="label"><span className="label-text">Status</span></label>
                <input type="text" id="modal-status" name="status" value={editFormData.status || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-notes" className="label"><span className="label-text">Notes</span></label>
                <textarea id="modal-notes" name="notes" value={editFormData.notes || ''} onChange={handleModalInputChange} className="textarea textarea-bordered w-full" rows={3}></textarea>
              </div>
              <div>
                <label htmlFor="modal-property_type" className="label"><span className="label-text">Property Type</span></label>
                <input type="text" id="modal-property_type" name="property_type" value={editFormData.property_type || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-beds" className="label"><span className="label-text">Beds</span></label>
                <input type="text" id="modal-beds" name="beds" value={editFormData.beds || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-baths" className="label"><span className="label-text">Baths</span></label>
                <input type="text" id="modal-baths" name="baths" value={editFormData.baths || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-year_built" className="label"><span className="label-text">Year Built</span></label>
                <input type="text" id="modal-year_built" name="year_built" value={editFormData.year_built || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-square_footage" className="label"><span className="label-text">Square Footage</span></label>
                <input type="text" id="modal-square_footage" name="square_footage" value={editFormData.square_footage || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-lot_size_sqft" className="label"><span className="label-text">Lot Size Sqft</span></label>
                <input type="text" id="modal-lot_size_sqft" name="lot_size_sqft" value={editFormData.lot_size_sqft || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-assessed_total" className="label"><span className="label-text">Assessed Total</span></label>
                <input type="number" id="modal-assessed_total" name="assessed_total" value={editFormData.assessed_total || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-mls_curr_status" className="label"><span className="label-text">MLS Current Status</span></label>
                <input type="text" id="modal-mls_curr_status" name="mls_curr_status" value={editFormData.mls_curr_status || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-mls_curr_days_on_market" className="label"><span className="label-text">MLS Current Days on Market</span></label>
                <input type="text" id="modal-mls_curr_days_on_market" name="mls_curr_days_on_market" value={editFormData.mls_curr_days_on_market || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div className="modal-action mt-6">
                <button type="button" onClick={() => void handleDeleteLead()} className="btn btn-error btn-outline mr-auto" disabled={isLoading}>
                  <Trash2 size={16}/> Delete Lead
                </button>
                <button type="button" onClick={handleCloseModal} className="btn btn-ghost" disabled={isLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  <Save size={16}/> {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={handleCloseModal}>close</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default LeadsView;
