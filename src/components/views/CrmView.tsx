'use client'

import { PlusCircle, Search, Edit3, Trash2, X, Mail, MapPin, ChevronUp, ChevronDown, Map, AlertCircle, X as XIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef } from 'react';

import { supabase } from '@/lib/supabase/client';
import { formatAddress } from '@/utils/address';

// Dynamically import the GoogleMapsLoader with SSR disabled
const GoogleMapsLoader = dynamic(
  () => import('@/components/maps/GoogleMapsLoader'),
  { ssr: false }
);

// Dynamically import the LeadCard component with no SSR
const LeadCard = dynamic(
  () => import('@/components/leads/LeadCard'),
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
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  created_at?: string;
  updated_at?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_postal_code?: string;
  assessed_total?: number;
  mls_curr_status?: string;
  mls_curr_days_on_market?: string;
  market_region?: string;
}

interface ColumnConfig {
  key: keyof Lead | string;
  label: string;
  sortable?: boolean;
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
const CrmView: React.FC<Record<string, never>> = (): React.JSX.Element => {
  // Column visibility state - only show status, name, email, phone, and address by default
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    status: true,
    email: true,
    phone: true,
    address: true,
    // Hide these by default
    market_region: false,
    assessed_total: false,
    mls_curr_status: false,
    mls_curr_days_on_market: false
  });

  // Sorting & pagination state
  const [sortField, setSortField] = useState<keyof Lead>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isLeadCardOpen, setIsLeadCardOpen] = useState<boolean>(false);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
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
  
  // Initialize Supabase client
  

  // Sort Indicator Component
  const SortIndicator = ({ field }: { field: keyof Lead | '' }) => {
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
  
  // Column configuration - only show status, name, email, phone, and address
  const columnConfigurations: ColumnConfig[] = [
    { key: 'first_name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'property_address', label: 'Address', sortable: true },
    { key: 'phone', label: 'Phone', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
  ];

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

  // Handle delete confirmation
  const handleDelete = async (leadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    if (!window.confirm('Are you sure you want to delete this lead?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('crm_leads')
        .delete()
        .eq('id', leadId);
        
      if (error) throw error;
    
      // Update local state
      setLeads(prev => prev.filter(lead => lead.id !== leadId));
      setFilteredLeads(prev => prev.filter(lead => lead.id !== leadId));
      
      // Close modals if open for this lead
      setIsLeadCardOpen(false);
      if (currentLead?.id === leadId) {
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
      }
      
      alert('Lead deleted successfully!');
    } catch (error) {
      console.error('Error deleting lead:', error instanceof Error ? error.message : 'Unknown error');
      alert(`Error deleting lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Only include fields that exist in the crm_leads table
      const validFields = [
        'first_name', 'last_name', 'email', 'phone', 'status',
        'address', 'city', 'state', 'zip_code', 'market_region'
      ];
      
      // Filter form data to only include valid fields
      const filteredFormData = Object.entries(formData).reduce<Partial<Lead>>((acc, [key, value]) => {
        if (validFields.includes(key) && value !== undefined) {
          // Use type assertion to ensure type safety
          (acc as Record<string, any>)[key] = value;
        }
        return acc;
      }, {});
      
      if (currentLead) {
        // Update existing lead
        const { error } = await supabase
          .from('crm_leads')
          .update(filteredFormData)
          .eq('id', currentLead.id);
          
        if (error) throw error;
        
        // Update local state
        setLeads(leads.map(lead => 
          lead.id === currentLead.id ? { ...lead, ...filteredFormData } : lead
        ));
      } else {
        // Add new lead
        const { data, error } = await supabase
          .from('crm_leads')
          .insert([filteredFormData])
          .select();
          
        if (error) throw error;
        
        // Add to local state
        if (data && data[0]) {
          setLeads([data[0], ...leads]);
        }
      }
      
      // Close modal and reset form
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
      
      // Show success message
      alert(`Lead ${currentLead ? 'updated' : 'added'} successfully!`);
    } catch (error) {
      console.error('Error saving lead:', error);
      alert(`Error ${currentLead ? 'updating' : 'adding'} lead. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Open edit form with lead data
  const handleEdit = (lead: Lead) => {
    setCurrentLead(lead);
    setFormData({
      ...lead,
      // Ensure all required fields have default values
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      status: lead.status || 'NEW',
      address: lead.address || lead.property_address || '',
      city: lead.city || lead.property_city || '',
      state: lead.state || lead.property_state || '',
      zip_code: lead.zip_code || lead.property_postal_code || ''
    });
    setIsFormOpen(true);
    setIsLeadCardOpen(false);
  };

  // Handle row click to show lead card
  const handleRowClick = (lead: Lead) => {
    setCurrentLead(lead);
    setIsLeadCardOpen(true);
  };

  // Initialize Google Places Autocomplete when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google && addressInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        { types: ['address'] }
      );
      
      const placeChangedHandler = () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;
        
        interface AddressComponents {
          address?: string;
          city?: string;
          state?: string;
          zip_code?: string;
        }
        
        const addressObj: AddressComponents = {};
        
        place.address_components.forEach(component => {
          const componentType = component.types[0];
          
          switch (componentType) {
            case 'street_number':
              addressObj.address = component.long_name;
              break;
            case 'route':
              addressObj.address = `${addressObj.address || ''} ${component.long_name}`.trim();
              break;
            case 'locality':
              addressObj.city = component.long_name;
              break;
            case 'administrative_area_level_1':
              addressObj.state = component.short_name;
              break;
            case 'postal_code':
              addressObj.zip_code = component.long_name;
              break;
            default:
              break;
          }
        });
        
        setFormData(prev => ({
          ...prev,
          ...addressObj,
          property_address: addressObj.address || prev.property_address,
          property_city: addressObj.city || prev.property_city,
          property_state: addressObj.state || prev.property_state,
          property_postal_code: addressObj.zip_code || prev.property_postal_code
        }));
      };
      
      // Add the event listener
      autocomplete.addListener('place_changed', placeChangedHandler);
      
      // Store the autocomplete instance in the ref
      autocompleteRef.current = autocomplete;
      
      // Cleanup function
      return () => {
        if (autocompleteRef.current) {
          // Remove the event listener when component unmounts
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
          autocompleteRef.current = null;
        }
      };
    }
  }, []); // Empty dependency array means this effect runs once on mount

  // Fetch leads from Supabase
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('crm_leads')
          .select('*');

        if (error) throw error;

        setLeads(data || []);
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchLeads();
  }, []);

  // Filter and sort leads
  useEffect(() => {
    let result = [...leads];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(lead => 
        (lead.first_name?.toLowerCase().includes(term) || lead.last_name?.toLowerCase().includes(term)) ||
        (lead.email?.toLowerCase().includes(term)) ||
        (lead.phone?.includes(term)) ||
        (lead.status?.toLowerCase().includes(term)) ||
        (lead.property_address?.toLowerCase().includes(term)) ||
        (lead.property_city?.toLowerCase().includes(term)) ||
        (lead.property_state?.toLowerCase().includes(term)) ||
        (lead.property_postal_code?.toLowerCase().includes(term))
      );
    }
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'ALL') {
      result = result.filter(lead => lead.status === statusFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      // Default sort by updated_at descending if no sort field
      const field = sortField || 'updated_at';
      const direction = sortDirection || 'desc';
      
      let aValue = field ? a[field as keyof Lead] : a.updated_at;
      let bValue = field ? b[field as keyof Lead] : b.updated_at;
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return direction === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return direction === 'asc' ? 1 : -1;
      
      // Convert to string for comparison if needed
      if (typeof aValue !== 'string') aValue = String(aValue);
      if (typeof bValue !== 'string') bValue = String(bValue);
      
      // Compare values
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    setFilteredLeads(result);
  }, [leads, searchTerm, statusFilter, sortField, sortDirection]);

  // Helper to get displayable value
  const displayValue = (value: any) => value === null || value === undefined ? '-' : String(value);
  
  // Get status badge color
  const getStatusBadgeClass = (status: string | null | undefined): string => {
    if (!status) return 'badge-ghost';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('new') || lowerStatus.includes('open')) return 'badge-info';
    if (lowerStatus.includes('contacted') || lowerStatus.includes('step')) return 'badge-success';
    if (lowerStatus.includes('offer sent') || lowerStatus.includes('pending')) return 'badge-warning';
    if (lowerStatus.includes('not interested') || lowerStatus.includes('closed') || lowerStatus.includes('lost')) return 'badge-error';
    return 'badge-neutral';
  };

  return (
    <div className="p-4 md:p-6 bg-base-200 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-base-content">CRM Leads</h1>
      {/* Status indicators */}
      {isLoading && (
        <div className="mb-4 p-2 bg-base-300 rounded text-sm">
          Loading leads...
        </div>
      )}
      
      {/* Search and Filters */}
      <div className="mb-6 p-4 bg-base-100 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                className="input input-bordered w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <select 
            className="select select-bordered"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button 
            className="btn btn-primary"
            onClick={() => {
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
              setIsFormOpen(true);
            }}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-base-100 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
          <table className="table table-zebra table-sm w-full">
            <thead>
              <tr className="text-base-content">
                {columnConfigurations.map(col => (
                  <th 
                    key={col.key} 
                    onClick={() => col.sortable !== false && handleSort(col.key as keyof Lead)}
                    className={col.sortable !== false ? 'cursor-pointer hover:bg-base-300' : ''}
                  >
                    {col.label} {col.sortable !== false && <SortIndicator field={col.key as keyof Lead} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
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
                    <td>{displayValue(lead.market_region)}</td>
                    <td>{lead.assessed_total ? `$${Number(lead.assessed_total).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}</td>
                    <td>{displayValue(lead.mls_curr_status)}</td>
                    <td>{displayValue(lead.mls_curr_days_on_market)}</td>
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

      {/* Lead Card Modal */}
      {isLeadCardOpen && currentLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-medium">Lead Details</h3>
              <button 
                onClick={() => setIsLeadCardOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <LeadCard 
                lead={currentLead}
                onEdit={() => handleEdit(currentLead)}
                onDelete={(e) => void handleDelete(currentLead.id, e)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export the CrmView component as default
export default CrmView;