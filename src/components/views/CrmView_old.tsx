'use client'

import { PlusCircle, Search, Edit3, Trash2, X, Mail, MapPin, ChevronUp, ChevronDown, Map, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef, useCallback, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase/client';
import { formatAddress } from '@/utils/address';
import { useTable, useSortBy, Column } from 'react-table';


// Dynamically import the GoogleMapsLoader with SSR disabled
const GoogleMapsLoader = dynamic(
  () => import('@/components/maps/GoogleMapsLoader'),
  { ssr: false }
);


// Dynamically import the StreetViewMap component with no SSR
const StreetViewMap = dynamic(
  () => import('@/components/maps/StreetViewMap'),
  { ssr: false }
);

// Define types
interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status: string; // e.g., 'NEW', 'CONTACTED', etc.
  created_at?: string;
  updated_at?: string;

  // Address fields (Normalized)
  property_address_full?: string;   // Combined full address
  property_address_street?: string; // Street name and number
  property_address_city?: string;
  property_address_state?: string;
  property_address_zip?: string;

  // Property details
  avm_value?: number;             // Automated Valuation Model value (consistent with LeadsView)
  beds?: number;
  baths?: number;
  sq_ft?: number;

  // Additional CRM fields
  notes?: string;
  mls_curr_status?: string;         // Current MLS status
  mls_curr_days_on_market?: string; // Days on market (can be string for flexibility, e.g., 'N/A')
  market_region?: string;           // Market region a lead belongs to

  // Legacy fields (primarily for data ingestion/mapping from older sources if necessary)
  // Avoid using these for new data entry or primary logic if normalized fields are available.
  address?: string;                 // Legacy flat address
  city?: string;                    // Legacy city
  state?: string;                   // Legacy state
  zip_code?: string;                // Legacy zip code
  property_address?: string;        // Potentially redundant legacy field
  property_city?: string;           // Potentially redundant legacy field
  property_state?: string;          // Potentially redundant legacy field
  property_postal_code?: string;    // Potentially redundant legacy field
  // assessed_total?: number;       // Replaced by/consolidated into avm_value
}



interface StatusOption {
  value: string;
  label: string;
  color: string;
}

const statusOptions: StatusOption[] = [
  { value: 'NEW', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-purple-100 text-purple-800' },
  { value: 'CONTRACT-SENT', label: 'Contract Sent', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'CONTRACT-SIGNED', label: 'Contract Signed', color: 'bg-green-100 text-green-800' },
  { value: 'NEEDS-DISPO', label: 'Needs Disposition', color: 'bg-orange-100 text-orange-800' },
  { value: 'ASSIGNED', label: 'Assigned', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'CLOSED', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
  { value: 'DEAD', label: 'Dead', color: 'bg-red-100 text-red-800' },
  // Legacy statuses for backward compatibility
  { value: 'QUALIFIED', label: 'Qualified', color: 'bg-green-100 text-green-800' },
  { value: 'UNQUALIFIED', label: 'Unqualified', color: 'bg-red-100 text-red-800' },
];

// Main CrmView component
const CrmView: React.FC = () => {
  // State hooks
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof Lead>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [formData, setFormData] = useState<Partial<Lead>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    status: 'NEW', // Default status for new leads
    property_address_street: '',
    property_address_city: '',
    property_address_state: '',
    property_address_zip: '',
    market_region: '',
    notes: '',
    // avm_value is typically not manually set for a new lead, so not included here
  });
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true, // Column ID: 'name'
    status: true, // Column ID: 'status'
    email: true, // Column ID: 'email'
    phone: true, // Column ID: 'phone'
    property_address_full: true, // Column ID: 'property_address_full' (was 'address')
    market_region: true, // Column ID: 'market_region'
    avm_value: true, // Column ID: 'avm_value' (was 'assessed_total')
    mls_curr_status: true, // Column ID: 'mls_curr_status'
    mls_curr_days_on_market: true // Column ID: 'mls_curr_days_on_market'
  });
  
  // Refs
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Initialize Supabase client
  

  // Custom Sort Indicator Component (Consider using react-table's built-in sort indicators provided by getSortByToggleProps)
  /*
  const SortIndicator = ({ field }: { field: keyof Lead }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />;
  };
  */

  // Custom Handle sorting (Consider using react-table's useSortBy props for headers, applied via getSortByToggleProps)
  /*
  const handleSort = (field: keyof Lead) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  */

  const getStatusBadgeClass = useCallback((statusValue: string): string => {
    const option = statusOptions.find(opt => opt.value === statusValue);
    return option ? option.color : 'badge-neutral'; // Using DaisyUI badge class
  }, []); // Added empty dependency array as statusOptions is stable
  
  // Column configuration - expanded for more lead details
  const tableColumns = useMemo<Column<Lead>[]>(() => [
    { Header: 'Name', accessor: (row: Lead) => `${row.first_name || ''} ${row.last_name || ''}`.trim(), id: 'name' },
    { 
      Header: 'Status', 
      accessor: 'status',
      id: 'status',
      Cell: ({ value }: { value: string }) => (
        <span className={`badge ${getStatusBadgeClass(value)} text-xs`}>
          {statusOptions.find(s => s.value === value)?.label || value}
        </span>
      ),
    },
    { Header: 'Address', accessor: 'property_address_full', id: 'property_address_full' },
    { Header: 'Phone', accessor: 'phone', id: 'phone' },
    { Header: 'Email', accessor: 'email', id: 'email' },
    { Header: 'Market', accessor: 'market_region', id: 'market_region' },
    {
      Header: 'AVM',
      accessor: 'avm_value',
      id: 'avm_value',
      Cell: ({ value }: { value?: number }) => value ? `$${value.toLocaleString()}` : 'N/A',
    },
    { Header: 'MLS Status', accessor: 'mls_curr_status', id: 'mls_curr_status' },
    { Header: 'DOM', accessor: 'mls_curr_days_on_market', id: 'mls_curr_days_on_market' },
  ], [getStatusBadgeClass]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };



  // Handle form submission - single source of truth
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const leadDataToSubmit = { ...formData };

      if (currentLead?.id) { // Editing existing lead
        const { data, error } = await supabase
          .from('crm_leads')
          .update(leadDataToSubmit)
          .eq('id', currentLead.id)
          .select();
        
        if (error) throw error;
        if (data && data.length > 0) {
          setLeads((prev: Lead[]) => prev.map((l: Lead) => l.id === data[0].id ? data[0] : l));
        }
      } else { // Adding new lead
        const { data, error } = await supabase
          .from('crm_leads')
          .insert([leadDataToSubmit])
          .select();
          
        if (error) throw error;
        if (data && data[0]) {
          setLeads((prev: Lead[]) => [data[0] as Lead, ...prev]);
        }
      }
      
      setIsFormOpen(false);
      setCurrentLead(null);
      setFormData({ 
        first_name: '', 
        last_name: '', 
        email: '', 
        phone: '', 
        status: 'NEW',
        address: '', 
        city: '', 
        state: '', 
        zip_code: ''
      });
      
      // Refresh leads to ensure we have the latest data
      await fetchLeads();
    } catch (error) {
      console.error('Error saving lead:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to save lead'}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentLead, formData, fetchLeads, supabase, setIsFormOpen, setCurrentLead, setLeads]);

  // Helper function to get display name from first and last name
  const getDisplayName = (lead: Partial<Lead>): string => {
    return [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'New Lead';
  };

  // Helper function to format full address
  const formatFullAddress = (lead: Lead): string => {
    const parts = [
      lead.property_address_street,
      lead.property_address_city,
      lead.property_address_state,
      lead.property_address_zip
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Handle row click to open edit form
  const handleRowClick = useCallback((lead: Lead) => {
    setCurrentLead(lead);
    setIsFormOpen(true);
    setFormData({
      ...lead,
      // Map property_* fields to address, city, state, zip_code if they exist
      address: lead.property_address || lead.property_address_street || '',
      city: lead.property_city || lead.property_address_city || '',
      state: lead.property_state || lead.property_address_state || '',
      zip_code: lead.property_postal_code || lead.property_address_zip || '',
    });
  }, []);

  // Handle lead update
  const handleUpdateLead = useCallback(async (updatedLeadData: Partial<Lead>) => {
    if (!currentLead || !currentLead.id) {
      console.error('No current lead selected for update or lead ID is missing.');
      alert('Error: No lead selected for update.');
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .update(updatedLeadData)
        .eq('id', currentLead.id)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const updatedLeadFromServer = data[0] as Lead;
        setLeads((prevLeads: Lead[]) =>
          prevLeads.map((l: Lead) => (l.id === updatedLeadFromServer.id ? updatedLeadFromServer : l))
        );
      }
      
      setIsFormOpen(false);
      setCurrentLead(null); 
      alert('Lead updated successfully!');
    } catch (err) {
      console.error('Error updating lead:', err);
      alert(`Error updating lead: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentLead, supabase]);

  // Handle delete lead
  const handleDeleteLead = useCallback(async (leadId: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) {
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('crm_leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      setLeads((prevLeads: Lead[]) => prevLeads.filter((lead: Lead) => lead.id !== leadId));

      if (currentLead?.id === leadId) {

        setIsFormOpen(false);
        setCurrentLead(null);
      }
      alert('Lead deleted successfully!');
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert(`Error deleting lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, setIsLoading, setLeads, currentLead, setIsFormOpen, setCurrentLead]);



  // Define fetchLeads using useCallback to be stable and usable in other hooks/handlers
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_leads') // Corrected to 'crm_leads' table
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      // Optionally set an error state here to display to the user
    } finally {
      setIsLoading(false);
    }
  }, [supabase, setIsLoading, setLeads]); // Dependencies for fetchLeads

  // Fetch initial leads on component mount
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]); // useEffect depends on the stable fetchLeads callback
      } catch (error) {
        console.error('Error fetching leads:', error);
        alert(`Error fetching leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLeads([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeads();
  }, [supabase, setIsLoading, setLeads]);

  // Filter and sort leads
  useEffect(() => {
    let processedLeads = [...leads];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      processedLeads = processedLeads.filter(lead =>
        Object.values(lead).some(value =>
          String(value).toLowerCase().includes(searchLower)
        )
      );
    }

    if (statusFilter !== 'ALL') {
      processedLeads = processedLeads.filter(lead => lead.status === statusFilter);
    }

    if (sortField) {
      processedLeads.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    setFilteredLeads(processedLeads);
  }, [leads, searchTerm, statusFilter, sortField, sortDirection, setFilteredLeads]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable<Lead>(
    {
      columns: tableColumns,
      data: filteredLeads, 
    },
    useSortBy
  );

  // Paginate rows
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return rows.slice(start, end); // `rows` comes from useTable
  }, [rows, currentPage, rowsPerPage]);

  // Calculate total pages for pagination
  const totalPages = Math.ceil(filteredLeads.length / rowsPerPage); // `rows` from useTable

  const handleOpenAddLeadModal = useCallback(() => {
    setCurrentLead(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      status: 'NEW',
      property_address_full: '', // For direct input before autocomplete
      property_address_street: '',
      property_address_city: '',
      property_address_state: '',
      property_address_zip: '',
      // Keep legacy fields if your DB schema still uses them as primary
      address: '', 
      city: '',
      state: '',
      zip_code: '',
      notes: '',
      market_region: '',
    });
    if (addressInputRef.current) { // Clear previous autocomplete input
      addressInputRef.current.value = '';
    }
    setIsFormOpen(true);

  }, [setFormData, setCurrentLead, setIsFormOpen]);

  const handleCloseFormModal = useCallback(() => {
    setIsFormOpen(false);
    setCurrentLead(null);
  }, [setIsFormOpen, setCurrentLead]);

  return (
    <div className="p-4 md:p-6 bg-base-200 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-base-content">CRM Leads</h1>

      {/* Controls: Search, Filter, Add Lead Button */}
      <div className="mb-6 p-4 bg-base-100 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Search Leads</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Name, email, address..."
                className="input input-bordered w-full pr-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute top-1/2 right-3 transform -translate-y-1/2 h-5 w-5 text-base-content opacity-50" />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Filter by Status</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <button className="btn btn-primary md:mt-auto" onClick={handleOpenAddLeadModal}>
            <PlusCircle size={20} className="mr-2" />
            Add New Lead
          </button>
        </div>
      </div>
      
      {isLoading && (
        <div className="flex justify-center items-center my-10">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="ml-3 text-lg">Loading leads...</p>
        </div>
      )}

      {/* Leads Table */}
      {!isLoading && filteredLeads.length > 0 && (
        <div className="overflow-x-auto bg-base-100 rounded-lg shadow-md">
          <table {...getTableProps()} className="table table-zebra w-full">
            <thead>
              {headerGroups.map(headerGroup => (
                <tr {...headerGroup.getHeaderGroupProps()} key={headerGroup.id || Math.random().toString()}>
                  {headerGroup.headers.map(column => (
                    <th 
                      {...column.getHeaderProps((column as any).getSortByToggleProps ? (column as any).getSortByToggleProps() : {})}
                      key={column.id}
                      className="p-3 cursor-pointer select-none"
                      // onClick prop removed, getSortByToggleProps handles sorting on click
                    >
                      {column.render('Header')}
                      {/* Display sort indicators using react-table's state */}
                      {(column.id && column.id !== 'actions' && (column as any).canSort) && (
                        (column as any).isSorted
                          ? ((column as any).isSortedDesc
                            ? <ChevronDown size={16} className="inline ml-1" />
                            : <ChevronUp size={16} className="inline ml-1" />)
                          : <ChevronUp size={16} className="inline ml-1 opacity-30 hover:opacity-70" /> // Show a generic sort icon if not sorted
                      )}
                    </th>
                  ))}
                  <th className="p-3 text-center">Actions</th>
                </tr>
              ))}
            </thead>
            <tbody {...getTableBodyProps()}>
              {paginatedRows.map(rowInstance => { // Renamed 'row' to 'rowInstance' to avoid conflict with useTable's 'rows'
                prepareRow(rowInstance);
                return (
                  <tr 
                    {...rowInstance.getRowProps()} 
                    key={rowInstance.original.id} 
                    className="hover:bg-base-300 cursor-pointer"
                    onClick={() => handleRowClick(rowInstance.original)}
                  >
                    {rowInstance.cells.map(cell => (
                      <td {...cell.getCellProps()} key={cell.column.id} className="p-3 align-middle">
                        {cell.column.id === 'status' ? (
                          <span className={`badge ${getStatusBadgeClass(cell.value as string)}`}>
                            {statusOptions.find(s => s.value === cell.value)?.label || cell.value}
                          </span>
                        ) : cell.column.id === 'name' ? (
                           <div className="font-medium">{getDisplayName(rowInstance.original)}</div>
                        ) : cell.column.id === 'property_address_full' ? (
                           <div>{formatFullAddress(rowInstance.original)}</div>
                        ) : (
                          cell.render('Cell')
                        )}
                      </td>
                    ))}
                    <td className="p-3 text-center">
                      <button 
                        className="btn btn-ghost btn-sm text-info mr-2" 
                        onClick={(e) => { e.stopPropagation(); handleRowClick(rowInstance.original); }}
                        title="Edit/View Lead"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm text-error" 
                        onClick={(e) => { e.stopPropagation(); handleDeleteLead(rowInstance.original.id); }}
                        title="Delete Lead"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && filteredLeads.length === 0 && (
         <div className="text-center py-10 bg-base-100 rounded-lg shadow-md">
           <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
           <p className="text-xl font-semibold">No leads found.</p>
           <p className="text-gray-500">Try adjusting your search or filters, or add a new lead.</p>
         </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && totalPages > 0 && (
        <div className="mt-6 flex flex-wrap justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            Showing {filteredLeads.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' '}to{' '}
            {Math.min(currentPage * rowsPerPage, filteredLeads.length)}
            {' '}of {filteredLeads.length} leads
          </div>
          <div className="flex items-center gap-2">
            <select
              className="select select-bordered select-sm"
              value={rowsPerPage}
              onChange={e => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              {[10, 25, 50, 100].map(pageSize => (
                <option key={pageSize} value={pageSize}>
                  Show {pageSize}
                </option>
              ))}
            </select>
            <div className="join">
              <button 
                className="join-item btn btn-sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                «
              </button>
              <button className="join-item btn btn-sm">
                {currentPage}
              </button>
              <button 
                className="join-item btn btn-sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                »
              </button>
            </div>
          </div>
        </div>
      )}
            
          <div className="modal modal-open">
            <div className="modal-box w-11/12 max-w-5xl relative">
              {/* Modal Body */}
            <div className="relative p-0 max-w-4xl mx-auto">
              {/* Modal Header */}
              <div className="bg-base-200 p-4 border-b border-base-300 flex justify-between items-center">
                <h1 className="text-xl font-bold">
                  Property Location: {formatFullAddress(currentLead || {})}
                </h1>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Google Map Display */}
              <div className="h-64 w-full bg-gray-200 relative mb-4">
                {/* Placeholder for Standard Map Component */}
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  Map Placeholder
                </div>
                <button 
                  className="btn btn-sm absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-700"
                  onClick={() => {
                    if (currentLead?.property_address_full) {
                      window.open(`https://www.google.com/maps?q=${encodeURIComponent(currentLead.property_address_full)}`, '_blank');
                    }
                  }}
                >
                  <MapPin size={16} className="mr-1" /> Show Map
                </button>
              </div>

              <div className="p-6 space-y-6">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit(e).catch(console.error);
                }} className="space-y-6">
                  {/* Location Section */}
                  <div>
                    <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-base-300">Location</h2>
                    <div className="form-control md:col-span-2 mb-4"> {/* Added mb-4 for spacing */}
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Property Address (Search)</span>
                      </label>
                      <input
                        ref={addressInputRef} // Attach the ref here
                        type="text"
                        name="property_address_search" // A different name to distinguish from direct property_address_full manipulation
                        className="input input-bordered input-sm w-full"
                        placeholder="Start typing an address..."
                        // onChange will be handled by autocomplete, or manually if needed for uncontrolled typing
                        // defaultValue can be set from currentLead?.property_address_full when modal opens if desired
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Address</span>
                        </label>
                        <input
                          type="text"
                          name="property_address_street"
                          className="input input-bordered input-sm w-full"
                          value={formData.property_address_street || ''}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">City</span>
                        </label>
                        <input
                          type="text"
                          name="property_address_city"
                          className="input input-bordered input-sm w-full"
                          value={formData.property_address_city || ''}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">State</span>
                        </label>
                        <input
                          type="text"
                          name="property_address_state"
                          className="input input-bordered input-sm w-full"
                          value={formData.property_address_state || ''}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">ZIP Code</span>
                        </label>
                        <input
                          type="text"
                          name="property_address_zip"
                          className="input input-bordered input-sm w-full"
                          value={formData.property_address_zip || ''}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Contact Section */}
                  <div>
                    <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-base-300">Contact</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">First Name</span>
                        </label>
                        <input
                          type="text"
                          name="first_name"
                          className="input input-bordered input-sm w-full"
                          value={formData.first_name || ''}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Last Name</span>
                        </label>
                        <input
                          type="text"
                          name="last_name"
                          className="input input-bordered input-sm w-full"
                          value={formData.last_name || ''}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Email</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          className="input input-bordered input-sm w-full"
                          value={formData.email || ''}
                          onChange={handleInputChange}
                        />
                      </div>
                      
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Phone</span>
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          className="input input-bordered input-sm w-full"
                          value={formData.phone || ''}
                          onChange={handleInputChange}
                        />
                      </div>
                      
                      <div className="form-control md:col-span-2">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Notes</span>
                        </label>
                        <textarea
                          name="notes"
                          className="textarea textarea-bordered w-full"
                          rows={3}
                          value={formData.notes || ''}
                          onChange={handleInputChange}
                        />
                      </div>
                      
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Status</span>
                        </label>
                        <select
                          name="status"
                          className="select select-bordered select-sm w-full"
                          value={formData.status || 'NEW'}
                          onChange={handleInputChange}
                        >
                          {statusOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-4 border-t border-base-300">
                    <button
                      type="button"
                      onClick={() => currentLead && handleDeleteLead(currentLead.id)}
                      className="btn btn-error btn-sm text-white hover:bg-error/90"
                      disabled={isLoading}
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete Lead
                    </button>
                    
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="btn btn-ghost btn-sm"
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          'Update Lead'
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div> {/* Closes .p-6 .space-y-6 */}
            </div> {/* Closes .relative .p-0 .max-w-4xl .mx-auto */}
          </div> {/* Closes .modal-box */}
        </div> {/* Closes .modal .modal-open */}
      )}
    </div>
  );
};

// Export the CrmView component as default
export default CrmView;