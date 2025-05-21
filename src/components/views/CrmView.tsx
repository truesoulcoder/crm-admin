'use client'

import { PlusCircle, Search, Edit3, Trash2, X, Mail, MapPin, ChevronUp, ChevronDown, Map, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import { supabase } from '@/lib/supabase/client';
import { formatAddress } from '@/utils/address';
import { useTable, useSortBy, Column, Row } from 'react-table';
import LeadCard from '@/components/crm/LeadCard'; // Placeholder: Adjust path as needed


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
  status: string;
  created_at?: string;
  updated_at?: string;
  
  // Address fields
  property_address_full?: string;
  property_address_street?: string;
  property_address_city?: string;
  property_address_state?: string;
  property_address_zip?: string;
  
  // Property details
  appraised_value?: number;
  beds?: number;
  baths?: number;
  sq_ft?: number;
  
  // Additional fields
  notes?: string;
  mls_curr_status?: string;
  mls_curr_days_on_market?: string;
  market_region?: string;
  
  // Legacy fields (keep for backward compatibility)
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_postal_code?: string;
  assessed_total?: number;
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
  const [isLeadCardOpen, setIsLeadCardOpen] = useState<boolean>(false);
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
    status: 'NEW',
    address: '',
    city: '',
    state: '',
    zip_code: ''
  });
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    status: true,
    email: true,
    phone: true,
    address: true,
    market_region: false,
    assessed_total: false,
    mls_curr_status: false,
    mls_curr_days_on_market: false
  });

  // Refs

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);


  
  // Initialize Supabase client
  

  // Sort Indicator Component
  const SortIndicator = ({ field }: { field: keyof Lead }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />;
  };

  // Handle sorting
  const handleSort = (field: keyof Lead) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusBadgeClass = (statusValue: string): string => {
    const option = statusOptions.find(opt => opt.value === statusValue);
    return option ? option.color : 'badge-neutral'; // Using DaisyUI badge class
  };
  
  // Column configuration - only show status, name, email, phone, and address
  const tableColumns = useMemo<Column<Lead>[]>(() => [
    { Header: 'Name', accessor: (row: Lead) => `${row.first_name || ''} ${row.last_name || ''}`.trim(), id: 'name' },
    { 
      Header: 'Status', 
      accessor: 'status',
      Cell: ({ value }: { value: string }) => (
        <span className={`badge ${getStatusBadgeClass(value)}`}>
          {statusOptions.find(s => s.value === value)?.label || value}
        </span>
      ),
    },
    { Header: 'Address', accessor: 'property_address_full' }, // Or use formatFullAddress if more complex
    { Header: 'Phone', accessor: 'phone' },
    { Header: 'Email', accessor: 'email' },
  ], [getStatusBadgeClass]); // Added getStatusBadgeClass to dependencies

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Helper function to get display name from first and last name
  const getDisplayName = (lead: Partial<Lead>): string => {
    return [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'New Lead';
  };

  // Helper function to format full address
  const formatFullAddress = (lead: Lead): string => {
    const address = lead.property_address || lead.address || '';
    const city = lead.property_city || lead.city || '';
    const state = lead.property_state || lead.state || '';
    const zip = lead.property_postal_code || lead.zip_code || '';
    
    const parts = [address];
    if (city || state || zip) {
      const cityStateZip = [city, state, zip].filter(Boolean).join(' ');
      parts.push(cityStateZip);
    }
    
    return parts.filter(Boolean).join(' ');
  };


  // Handle closing the lead card/modal
  const handleCloseLeadCard = useCallback(() => {
    setIsLeadCardOpen(false);
    setCurrentLead(null);
  }, [setIsLeadCardOpen, setCurrentLead]);

  // Handle row click to show lead details
  const handleRowClick = useCallback((lead: Lead) => {
    setCurrentLead(lead);
    setIsLeadCardOpen(true);
  }, [setCurrentLead, setIsLeadCardOpen]);

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
      
      setIsLeadCardOpen(false);
      setCurrentLead(null); 
      alert('Lead updated successfully!');
    } catch (err) {
      console.error('Error updating lead:', err);
      alert(`Error updating lead: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentLead, supabase, setIsLoading, setLeads, setIsLeadCardOpen, setCurrentLead]);

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
        setIsLeadCardOpen(false);
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
  }, [supabase, setIsLoading, setLeads, currentLead, setIsLeadCardOpen, setIsFormOpen, setCurrentLead]);

  // Handle form submission (for Add/Edit Lead Form)
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const leadDataToSubmit: Partial<Lead> = { ...formData };

      if (currentLead && currentLead.id) { // Editing existing lead
        const { data, error } = await supabase
          .from('crm_leads')
          .update(leadDataToSubmit)
          .eq('id', currentLead.id)
          .select();
        
        if (error) throw error;
        if (data && data.length > 0) {
          setLeads((prev: Lead[]) => prev.map((l: Lead) => l.id === data[0].id ? data[0] : l));
        }
        alert('Lead updated successfully!');
      } else { // Adding new lead
        const { data, error } = await supabase
          .from('crm_leads')
          .insert([leadDataToSubmit])
          .select();
          
        if (error) throw error;
        if (data && data[0]) {
          setLeads((prev: Lead[]) => [data[0] as Lead, ...prev]);
        }
        alert('Lead added successfully!');
      }
      
      setIsFormOpen(false);
      setCurrentLead(null);
      setFormData({ 
        first_name: '', last_name: '', email: '', phone: '', status: 'NEW',
        address: '', city: '', state: '', zip_code: ''
      });
    } catch (error) {
      console.error('Error submitting lead:', error);
      alert(`Error submitting lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, formData, currentLead, setIsLoading, setLeads, setIsFormOpen, setCurrentLead, setFormData]);

  // Fetch initial leads
  useEffect(() => {
    const fetchLeads = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('crm_leads')
          .select('*')
          .order('updated_at', { ascending: false });

        if (error) throw error;
        setLeads(data || []);
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
    useSortBy);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return rows.slice(start, end); // `rows` comes from useTable
  }, [rows, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(rows.length / rowsPerPage); // `rows` from useTable
  }, [rows, rowsPerPage]);

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
    setIsLeadCardOpen(false);
  }, [setFormData, setCurrentLead, setIsFormOpen, setIsLeadCardOpen]);

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
                      onClick={() => column.id && column.id !== 'actions' ? handleSort(column.id as keyof Lead) : null}
                    >
                      {column.render('Header')}
                      {(column.id && column.id !== 'actions') && (
                        (column as any).isSorted
                        ? ((column as any).isSortedDesc
                          ? <ChevronDown size={16} className="inline ml-1" />
                          : <ChevronUp size={16} className="inline ml-1" />)
                        : <SortIndicator field={column.id as keyof Lead} />
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
            Showing {paginatedRows.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' '}to{' '}
            {Math.min(currentPage * rowsPerPage, rows.length)} {/* Use rows.length from useTable for total items */}
            {' '}of {rows.length} leads
          </div>
          <div className="join">
            <button
              className="join-item btn btn-sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              « Prev
            </button>
            {[...Array(totalPages)].map((_, i) => {
              const pageNum = i + 1;
              if (
                totalPages <= 7 || 
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
              ) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`join-item btn btn-sm ${currentPage === pageNum ? 'btn-active btn-primary' : ''}`}
                  >
                    {pageNum}
                  </button>
                );
              } else if (
                (pageNum === currentPage - 3 && pageNum !== 1) ||
                (pageNum === currentPage + 3 && pageNum !== totalPages)
              ) {
                return <button key={`ellipsis-${pageNum}`} className="join-item btn btn-sm btn-disabled">...</button>;
              }
              return null;
            })}
            <button
              className="join-item btn btn-sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next »
            </button>
                
            </div>
            <div>
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
            </div>
          </div>
        </>
      )}
    </div>
  );
              {isLoading && !leads.length ? (
                <tr><td colSpan={columnConfigurations.length} className="text-center py-10">Loading leads...</td></tr>
              ) : !isLoading && !leads.length ? (
                <tr><td colSpan={columnConfigurations.length} className="text-center py-10">No leads found.</td></tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-base-200 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(lead)}
                  >
                    {/* Name */}
                    <td className="py-4">
                      <div className="font-medium">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'No Name'}
                      </div>
                    </td>
                    
                    {/* Status */}
                    <td>
                      <span className={`badge ${getStatusBadgeClass(lead.status)}`}>
                        {statusOptions.find(s => s.value === lead.status)?.label || lead.status}
                      </span>
                    </td>
                    
                    {/* Address */}
                    <td>
                      <div className="flex items-start">
                        <MapPin size={16} className="mr-1.5 mt-0.5 flex-shrink-0 text-red-500" />
                        <div>
                          {formatFullAddress(lead) || '-'}
                        </div>
                      </div>
                    </td>
                    
                    {/* Phone */}
                    <td>{lead.phone || '-'}</td>
                    
                    {/* Email */}
                    <td>
                      {lead.email ? (
                        <div className="text-sm opacity-90 flex items-center">
                          <Mail className="w-3 h-3 mr-1.5 flex-shrink-0 opacity-70" />
                          <span className="truncate max-w-xs" title={lead.email}>
                            {lead.email}
                          </span>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 border-t">
          <div className="text-sm text-gray-500">
            Showing {Math.min((currentPage - 1) * rowsPerPage + 1, filteredLeads.length)} to {Math.min(currentPage * rowsPerPage, filteredLeads.length)} of {filteredLeads.length} entries
          </div>
          <div className="join">
            <button 
              className="join-item btn btn-sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button className="join-item btn btn-sm btn-active">
              {currentPage}
            </button>
            <button 
              className="join-item btn btn-sm"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage * rowsPerPage >= filteredLeads.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Edit/Add Lead Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-base-100 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            {/* Close Button - Fixed in top-right corner */}
            <button 
              className="btn btn-circle btn-ghost btn-sm absolute right-2 top-2 z-10"
              onClick={() => {
                setIsFormOpen(false);
                setCurrentLead(null);
                setFormData({
                  status: 'NEW',
                  first_name: '',
                  last_name: '',
                  email: '',
                  phone: '',
                  address: '',
                  city: '',
                  state: '',
                  zip_code: ''
                });
              }}
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-6">
              {currentLead && (
                <div className="mb-6 rounded-lg overflow-hidden relative">
                  <div className="flex items-center bg-base-200 px-4 py-2">
                    <MapPin className="w-5 h-5 mr-2 text-primary" />
                    <h3 className="font-medium">Property Location - {formatAddress(currentLead)}</h3>
                  </div>
                  <StreetViewMap 
                    address={formatAddress(currentLead)} 
                    containerStyle={{
                      width: '100%',
                      height: '300px',
                      borderRadius: '0 0 0.5rem 0.5rem',
                    }}
                  />
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-xl font-semibold">
                  {currentLead ? `Edit Lead: ${getDisplayName(currentLead)}` : 'Add New Lead'}
                </h2>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(e).catch(console.error);
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">First Name</span>
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name || ''}
                      onChange={handleInputChange}
                      className="input input-bordered w-full"
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Last Name</span>
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name || ''}
                      onChange={handleInputChange}
                      className="input input-bordered w-full"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Email</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      className="input input-bordered w-full"
                      value={formData.email || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Phone</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      className="input input-bordered w-full"
                      value={formData.phone || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Status</span>
                    </label>
                    <select
                      name="status"
                      className="select select-bordered w-full"
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
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Property Address</span>
                    </label>
                    <input
                      ref={addressInputRef}
                      type="text"
                      id="property-address"
                      name="property_address"
                      className="input input-bordered w-full"
                      value={formData.property_address || ''}
                      onChange={handleInputChange}
                      placeholder="Start typing an address..."
                      autoComplete="off"
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">City</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      className="input input-bordered w-full"
                      value={formData.city || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">State</span>
                    </label>
                    <input
                      type="text"
                      name="state"
                      className="input input-bordered w-full"
                      value={formData.state || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Postal Code</span>
                    </label>
                    <input
                      type="text"
                      name="zip_code"
                      className="input input-bordered w-full"
                      value={formData.zip_code || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-4">
                  <div className="flex-1">
                    {currentLead && (
                      <div className="dropdown dropdown-top">
                        <button
                          type="button"
                          tabIndex={0}
                          className="btn btn-error btn-sm text-white hover:bg-error/90 transition-colors"
                          disabled={isLoading}
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          Delete Lead
                        </button>
                        <div className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64">
                          <div className="p-3">
                            <h3 className="font-medium text-error">Delete Lead</h3>
                            <p className="text-sm text-base-content/80 mt-1">
                              Are you sure you want to delete this lead? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2 mt-3">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dropdown = document.activeElement as HTMLElement;
                                  if (dropdown) dropdown.blur();
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-error btn-xs text-white"
                                disabled={isLoading}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Use void to explicitly ignore the Promise
                                  void (async () => {
                                    try {
                                      // Call handleDelete with the current lead ID and event
                                      await handleDelete(currentLead.id, e);
                                      // Close the dropdown after successful deletion
                                      const dropdown = document.activeElement as HTMLElement;
                                      if (dropdown) dropdown.blur();
                                    } catch (error) {
                                      console.error('Error deleting lead:', error);
                                      // Optionally show an error message to the user
                                    }
                                  })();
                                  // Explicitly return void to satisfy the type checker
                                  return undefined;
                                }}
                              >
                                {isLoading ? (
                                  <span className="loading loading-spinner loading-xs"></span>
                                ) : (
                                  'Delete'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(false);
                        setCurrentLead(null);
                        setFormData({});
                      }}
                      className="btn btn-ghost"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="loading loading-spinner"></span>
                      ) : currentLead ? (
                        'Update Lead'
                      ) : (
                        'Add Lead'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Lead Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-base-100 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            {/* Close Button - Fixed in top-right corner */}
            <button 
              className="btn btn-circle btn-ghost btn-sm absolute right-2 top-2 z-10"
              onClick={() => {
                setIsFormOpen(false);
                setCurrentLead(null);
                setFormData({
                  status: 'NEW',
                  first_name: '',
                  last_name: '',
                  email: '',
                  phone: '',
                  address: '',
                  city: '',
                  state: '',
                  zip_code: ''
                });
              }}
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6">
              {currentLead && (
                <div className="mb-6 rounded-lg overflow-hidden relative">
                  <div className="flex items-center bg-base-200 px-4 py-2">
                    <MapPin className="w-5 h-5 mr-2 text-primary" />
                    <h3 className="font-medium">Property Location - {formatAddress(currentLead)}</h3>
                  </div>
                  <StreetViewMap 
                    address={formatAddress(currentLead)} 
                    containerStyle={{
                      width: '100%',
                      height: '300px',
                      borderRadius: '0 0 0.5rem 0.5rem',
                    }}
                  />
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-xl font-semibold">
                  {currentLead ? `Edit Lead: ${getDisplayName(currentLead)}` : 'Add New Lead'}
                </h2>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(e).catch(console.error);
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ...form fields here (see previous snippet)... */}
                </div>
                <div className="flex justify-between items-center pt-4">
                  <div className="flex-1">
                    {currentLead && (
                      <div className="dropdown dropdown-top">
                        <button
                          type="button"
                          tabIndex={0}
                          className="btn btn-error btn-sm text-white hover:bg-error/90 transition-colors"
                          disabled={isLoading}
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          Delete Lead
                        </button>
                        <div className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64">
                          <div className="p-3">
                            <h3 className="font-medium text-error">Delete Lead</h3>
                            <p className="text-sm text-base-content/80 mt-1">
                              Are you sure you want to delete this lead? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2 mt-3">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dropdown = document.activeElement as HTMLElement;
                                  if (dropdown) dropdown.blur();
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-error btn-xs text-white"
                                disabled={isLoading}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void (async () => {
                                    try {
                                      await handleDelete(currentLead.id, e);
                                      const dropdown = document.activeElement as HTMLElement;
                                      if (dropdown) dropdown.blur();
                                    } catch (error) {
                                      console.error('Error deleting lead:', error);
                                    }
                                  })();
                                  return undefined;
                                }}
                              >
                                {isLoading ? (
                                  <span className="loading loading-spinner loading-xs"></span>
                                ) : (
                                  'Delete'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(false);
                        setCurrentLead(null);
                        setFormData({});
                      }}
                      className="btn btn-ghost"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="loading loading-spinner"></span>
                      ) : currentLead ? (
                        'Update Lead'
                      ) : (
                        'Add Lead'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export the CrmView component as default
export default CrmView;