'use client';

// Removed UploadCloud, kept PlusCircle & Eye for now
import { Autocomplete, StreetViewPanorama } from '@react-google-maps/api'; // Removed useJsApiLoader
import { ChevronUp, ChevronDown, Edit3, Trash2, PlusCircle, Search, AlertTriangle, XCircle, Save, Eye, Mail, Phone, MapPin } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, FormEvent, useRef } from 'react';

// Using shared Supabase client

import {
  createCrmLeadAction,
  updateCrmLeadAction,
  deleteCrmLeadAction
} from '@/app/crm/actions';
import { useGoogleMapsApi } from '@/components/maps/GoogleMapsLoader'; // Import the context hook
import { supabase } from '@/lib/supabase/client';

export interface CrmLead {
  id: number; // bigserial maps to number in TS
  normalized_lead_id: number; // bigint maps to number or string, number is fine if IDs are within JS safe integer range
  contact_name?: string | null;
  contact_email?: string | null;
  contact_type: string; // not null
  market_region?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_postal_code?: string | null;
  property_type?: string | null;
  baths?: string | null;
  beds?: string | null;
  year_built?: string | null;
  square_footage?: string | null;
  lot_size_sqft?: string | null;
  assessed_total?: number | null; // numeric
  mls_curr_status?: string | null;
  mls_curr_days_on_market?: string | null;
  converted: boolean; // not null, default false
  status?: string | null;
  notes?: string | null;
  created_at: string; // timestamp with time zone
  updated_at: string; // timestamp with time zone
  email_sent?: boolean | null; // default false
}

interface ColumnConfig {
  key: keyof CrmLead | string; 
  label: string;
  sortable?: boolean;
}

const initialNewLeadData: Partial<CrmLead> = {
  normalized_lead_id: 0, // Placeholder - to be reviewed
  contact_name: '',
  contact_email: '',
  contact_type: 'Prospect', // Default or first valid type
  market_region: '',
  property_address: '',
  property_city: '',
  property_state: '',
  property_postal_code: '',
  property_type: '',
  baths: '',
  beds: '',
  year_built: '',
  square_footage: '',
  lot_size_sqft: '',
  assessed_total: null,
  mls_curr_status: '',
  mls_curr_days_on_market: '',
  converted: false,
  status: 'New', // Default status
  notes: '',
  email_sent: false,
  // created_at and updated_at are usually handled by DB.
};

const CrmLeads: React.FC = () => {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [marketRegions, setMarketRegions] = useState<string[]>([]);
  const [filterMarketRegion, setFilterMarketRegion] = useState<string>('All');
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Table State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [sortField, setSortField] = useState<keyof CrmLead | ''>(''); // Default sort field
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // Default sort direction
  const [totalLeads, setTotalLeads] = useState<number>(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CrmLead>>(initialNewLeadData);

  // Google Maps - Consume from context
  const { isLoaded: isGoogleMapsLoaded, loadError: googleMapsLoadError } = useGoogleMapsApi();
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [streetViewPosition, setStreetViewPosition] = useState<{ lat: number; lng: number } | null>(null);
  // Add a ref for the geocoder instance
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);


  // Define columns for the table
  const columns: ColumnConfig[] = [
    { key: 'contact_name', label: 'Contact Name', sortable: true },
    { key: 'contact_email', label: 'Email', sortable: true },
    { key: 'contact_type', label: 'Type', sortable: true },
    { key: 'market_region', label: 'Market', sortable: true },
    { key: 'property_address', label: 'Property Address', sortable: true },
    { key: 'property_city', label: 'City', sortable: true },
    { key: 'property_state', label: 'State', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'created_at', label: 'Created', sortable: true },
    { key: 'updated_at', label: 'Updated', sortable: true },
    // Add more columns as needed
  ];

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('crm_leads')
        .select('*', { count: 'exact' }); // Fetch all columns and count

      // Apply market region filter
      if (filterMarketRegion && filterMarketRegion !== 'All') {
        query = query.eq('market_region', filterMarketRegion);
      }

      // Apply search term filter (searching multiple fields)
      if (tableSearchTerm) {
        query = query.or(`contact_name.ilike.%${tableSearchTerm}%,contact_email.ilike.%${tableSearchTerm}%,property_address.ilike.%${tableSearchTerm}%,property_city.ilike.%${tableSearchTerm}%,status.ilike.%${tableSearchTerm}%`);
      }

      // Apply sorting
      if (sortField) {
        query = query.order(sortField, { ascending: sortDirection === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false }); // Default sort
      }

      // Apply pagination
      const startIndex = (currentPage - 1) * rowsPerPage;
      query = query.range(startIndex, startIndex + rowsPerPage - 1);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;
      
      setLeads(data || []);
      setTotalLeads(count || 0);

    } catch (err: any) {
      console.error('Error fetching leads:', err);
      setError(`Failed to fetch leads: ${err.message || 'Unknown error'}`);
      setLeads([]);
      setTotalLeads(0);
    } finally {
      setIsLoading(false);
    }
  }, [filterMarketRegion, tableSearchTerm, sortField, sortDirection, currentPage, rowsPerPage]);

  const fetchMarketRegions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .select('market_region');
      
      if (error) throw error;

      if (data) {
        const uniqueRegions = Array.from(new Set(data.map(item => item.market_region).filter(Boolean))) as string[];
        setMarketRegions(['All', ...uniqueRegions.sort()]);
      }
    } catch (err: any) {
      console.error('Error fetching market regions:', err);
      // setError('Failed to fetch market regions.'); // Optional: display error
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await fetchLeads();
        await fetchMarketRegions();
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    })();
  }, [fetchLeads, fetchMarketRegions]);

  // Handle Google Maps Autocomplete load & Geocoder initialization
  useEffect(() => {
    const initGoogleMaps = async () => {
      try {
        if (isGoogleMapsLoaded && window.google?.maps?.places && window.google?.maps?.Geocoder) {
          if (addressInputRef.current && !autocomplete) {
            const autoCompInstance = new google.maps.places.Autocomplete(addressInputRef.current, {
              types: ['address'],
            });
            setAutocomplete(autoCompInstance);
          }
        }
      } catch (error) {
        console.error('Error initializing Google Maps:', error);
      }
    };

    initGoogleMaps();
  }, [isGoogleMapsLoaded, autocomplete]);

  // Debounce search term
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      try {
        await fetchLeads();
      } catch (error) {
        console.error('Error fetching leads:', error);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(debounceTimer);
  }, [tableSearchTerm, fetchLeads]); // Re-fetch when debounced search term changes


  const handleSort = (field: keyof CrmLead | '') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    // fetchLeads will be called by useEffect due to sortField/sortDirection change
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // fetchLeads will be called by useEffect due to currentPage change
  };

  const handleRowsPerPageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1); // Reset to first page
    // fetchLeads will be called by useEffect due to rowsPerPage change
  };

  const handleOpenModal = (lead: CrmLead | null = null) => {
    setSelectedLead(lead);
    if (lead) {
      setEditFormData({
        ...lead,
        normalized_lead_id: lead.normalized_lead_id ?? 0,
        assessed_total: lead.assessed_total ?? null,
      });
      if (isGoogleMapsLoaded && geocoderRef.current && lead.property_address && lead.property_city && lead.property_state) {
        geocoderRef.current.geocode({ address: `${lead.property_address}, ${lead.property_city}, ${lead.property_state}` }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results[0]?.geometry?.location) {
            setStreetViewPosition({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
          } else {
            setStreetViewPosition(null);
            console.warn('Geocode was not successful for the following reason: ' + status);
          }
        });
      } else {
        setStreetViewPosition(null);
        if (!isGoogleMapsLoaded && lead.property_address) { // Check if API not loaded was the reason for not geocoding
            console.warn("Maps API not loaded, cannot geocode address for Street View.");
        }
      }
    } else {
      setEditFormData(initialNewLeadData);
      setStreetViewPosition(null);
    }
    setIsModalOpen(true);
  };

  const handleOpenNewLeadModal = () => {
    handleOpenModal(null); // Open modal with no pre-filled data (i.e., for a new lead)
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLead(null);
    setEditFormData(initialNewLeadData);
    setStreetViewPosition(null);
    // Autocomplete re-initialization logic on modal close might need review.
    // It's re-created in the useEffect based on isGoogleMapsLoaded and addressInputRef.current.
    // Clearing instance listeners on the old autocomplete instance might be good practice if it's being replaced.
    // However, the current useEffect for autocomplete setup will create a new one if addressInputRef.current exists.
    // Consider if the autocomplete instance needs to be reset or if its input element (addressInputRef.current)
    // is detached/re-attached from the DOM, which might require re-initialization.
    if (autocomplete && typeof google !== 'undefined' && google.maps?.event) {
        google.maps.event.clearInstanceListeners(autocomplete); // Clear listeners to prevent memory leaks or duplicate calls
    }
    // No need to manually re-create autocomplete here; the useEffect will handle it if the input is visible.
    // If addressInputRef.current is null (e.g., modal not fully closed or input removed), then it won't re-init.
  };

  const handleModalInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: any = value;

    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number' || e.target.dataset.type === 'number') {
      // Handle potential empty string for number inputs, convert to null or 0 as appropriate
      processedValue = value === '' ? null : parseFloat(value);
      if (isNaN(processedValue as number)) processedValue = null; // Or 0, depending on requirements
    } else if (name === 'normalized_lead_id' || name === 'assessed_total' || name === 'year_built' || name === 'square_footage' || name === 'lot_size_sqft') {
      // Explicitly handle numeric fields that might not be type='number'
      processedValue = value === '' ? null : parseFloat(value);
      if (isNaN(processedValue as number)) processedValue = null;
    }
    setEditFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSaveLead = async () => {
    // Client-side validation (optional, as server actions also validate)
    if (!editFormData.contact_type) {
      alert('Contact Type is required.');
      return;
    }
    // Ensure normalized_lead_id is a number if it's part of the form and required
    if (typeof editFormData.normalized_lead_id !== 'number' && editFormData.normalized_lead_id !== null && editFormData.normalized_lead_id !== undefined) {
        editFormData.normalized_lead_id = parseInt(String(editFormData.normalized_lead_id), 10);
        if (isNaN(editFormData.normalized_lead_id)) {
            alert('Normalized Lead ID must be a valid number.');
            return;
        }
    } else if (editFormData.normalized_lead_id === undefined || editFormData.normalized_lead_id === null) {
        editFormData.normalized_lead_id = 0; // Default if not provided or null
    }

    setIsLoading(true);
    let response;

    if (selectedLead && selectedLead.id) { // Existing lead: UPDATE
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, updated_at, ...dataToUpdate } = editFormData;
      response = await updateCrmLeadAction(selectedLead.id, dataToUpdate as Partial<Omit<CrmLead, 'id' | 'created_at' | 'updated_at'>>);
    } else { // New lead: INSERT
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, updated_at, ...dataToInsert } = editFormData;
      // Ensure normalized_lead_id is explicitly set if it's not nullable in the DB and not handled above
      if (typeof dataToInsert.normalized_lead_id !== 'number') {
        dataToInsert.normalized_lead_id = dataToInsert.normalized_lead_id ? parseInt(String(dataToInsert.normalized_lead_id), 10) : 0;
      }
      response = await createCrmLeadAction(dataToInsert as Partial<Omit<CrmLead, 'id' | 'created_at' | 'updated_at'>>);
    }

    setIsLoading(false);
    if (response.success) {
      alert(response.message || (selectedLead ? 'Lead updated successfully!' : 'Lead created successfully!'));
      // fetchLeads(); // Revalidation should handle data refresh
      handleCloseModal();
    } else {
      console.error('Error saving lead:', response.error);
      alert(`Failed to save lead: ${response.error || 'Unknown error'}`);
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead || !selectedLead.id || !confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      return;
    }
    setIsLoading(true);
    const response = await deleteCrmLeadAction(selectedLead.id);
    setIsLoading(false);

    if (response.success) {
      alert(response.message || 'Lead deleted successfully!');
      // Optional: Optimistically update UI or rely on revalidatePath from server action
      // setLeads(prevLeads => prevLeads.filter(l => l.id !== selectedLead!.id));
      // setTotalLeads(prevTotal => prevTotal - 1);
      handleCloseModal();
      // fetchLeads(); // Revalidation should handle data refresh
    } else {
      console.error('Error deleting lead:', response.error);
      alert(`Failed to delete lead: ${response.error || 'Unknown error'}`);
      // setError(`Failed to delete lead: ${response.error || 'Unknown error'}`);
    }
  };

  // Wrapped handlePlaceSelect in useCallback to stabilize its reference
  // This is important if it's used in `useEffect` dependencies, though it was removed from there.
  // It's good practice if it's passed to other components or used in event listeners that are set up once.
  const handlePlaceSelect = useCallback(() => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place?.address_components) {
        const addressComponents = place.address_components;
        const getAddressComponent = (type: string, part: 'long_name' | 'short_name' = 'long_name') => {
          return addressComponents.find(c => c.types.includes(type))?.[part] || '';
        };

        const streetNumber = getAddressComponent('street_number');
        const route = getAddressComponent('route');
        const locality = getAddressComponent('locality');
        const administrativeAreaLevel1 = getAddressComponent('administrative_area_level_1', 'short_name');
        const postalCode = getAddressComponent('postal_code');

        const newAddress = `${streetNumber} ${route}`.trim();
        setEditFormData(prev => ({
          ...prev,
          property_address: newAddress,
          property_city: locality,
          property_state: administrativeAreaLevel1,
          property_postal_code: postalCode,
        }));

        if (place.geometry?.location) {
          setStreetViewPosition({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        } else {
          setStreetViewPosition(null);
        }
      } else {
        console.error('Place selected but no address components found or place invalid:', place);
      }
    }
  }, [autocomplete]); // Dependency: autocomplete instance


  // Sort Indicator Component
  const SortIndicator = ({ field }: { field: keyof CrmLead | '' }) => { 
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />;
  };
  
  const totalPages = totalLeads > 0 ? Math.ceil(totalLeads / rowsPerPage) : 1;

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-content">CRM Lead Management</h1>
        <button onClick={handleOpenNewLeadModal} className="btn btn-primary">
          <PlusCircle size={18} className="mr-2" />
          Add New Lead
        </button>
      </div>
      {/* CSV Upload Section Removed */}

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
          <div className="form-control flex-grow">
            <label htmlFor="tableSearch" className="label">
              <span className="label-text">Search Leads</span>
            </label>
            <div className="relative">
              <input 
                id="tableSearch"
                type="text" 
                placeholder="Search by name, email, address, city, status..."
                value={tableSearchTerm}
                onChange={(e) => setTableSearchTerm(e.target.value)}
                className="input input-bordered w-full pr-10" 
              />
              <Search size={20} className="absolute top-1/2 right-3 transform -translate-y-1/2 text-base-content opacity-50" />
            </div>
          </div>

          {/* Market Region Filter */}
          <div className="form-control">
            <label htmlFor="marketFilter" className="label">
              <span className="label-text">Market Region</span>
            </label>
            <select 
              id="marketFilter"
              value={filterMarketRegion}
              onChange={(e) => setFilterMarketRegion(e.target.value)}
              className="select select-bordered"
            >
              {marketRegions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          {/* Rows Per Page */}
          <div className="form-control">
            <label htmlFor="rowsPerPage" className="label">
              <span className="label-text">Rows per page</span>
            </label>
            <select 
              id="rowsPerPage"
              value={rowsPerPage} 
              onChange={handleRowsPerPageChange} 
              className="select select-bordered"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      {isLoading && !leads.length ? (
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-lg loading-spinner text-primary"></span>
        </div>
      ) : !isLoading && !leads.length && !error ? (
        <div className="text-center py-10">
          <XCircle size={48} className="mx-auto text-base-content opacity-50 mb-4" />
          <p className="text-xl text-base-content opacity-70">No leads found.</p>
          <p className="text-base-content opacity-50">Try adjusting your filters or add a new lead.</p>
        </div>
      ) : leads.length > 0 ? (
        <div className="overflow-x-auto bg-base-100 shadow-lg rounded-lg">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                {columns.map(col => (
                  <th 
                    key={col.key} 
                    onClick={() => col.sortable && handleSort(col.key as keyof CrmLead)}
                    className={col.sortable ? 'cursor-pointer hover:bg-base-300' : ''}
                  >
                    {col.label}
                    {col.sortable && <SortIndicator field={col.key as keyof CrmLead} />}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="hover" onClick={() => handleOpenModal(lead)}>
                  {columns.map(col => (
                    <td key={`${lead.id}-${col.key}`}>
                      {col.key === 'contact_email' 
                        ? getCleanEmailDisplay(lead[col.key as keyof CrmLead] as string | undefined)
                        : col.key === 'status'
                        ? <span className={`badge ${getStatusBadgeClass(lead.status)}`}>{displayValue(lead.status)}</span>
                        : col.key === 'created_at' || col.key === 'updated_at'
                        ? new Date(lead[col.key as keyof CrmLead] as string).toLocaleDateString()
                        : displayValue(lead[col.key as keyof CrmLead])}
                    </td>
                  ))}
                  <td>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenModal(lead); }}
                      className="btn btn-xs btn-ghost text-primary hover:bg-primary hover:text-primary-content p-1"
                      aria-label={`Edit lead ${lead.contact_name}`}
                    >
                      <Edit3 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={columns.length + 1}>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-base-content opacity-70">
                      Showing {Math.min((currentPage - 1) * rowsPerPage + 1, totalLeads)} - {Math.min(currentPage * rowsPerPage, totalLeads)} of {totalLeads} leads
                    </span>
                    <div className="join">
                      <button 
                        onClick={() => handlePageChange(currentPage - 1)} 
                        disabled={currentPage === 1 || isLoading}
                        className="join-item btn btn-sm"
                      >
                        «
                      </button>
                      <button className="join-item btn btn-sm">Page {currentPage} of {totalPages}</button>
                      <button 
                        onClick={() => handlePageChange(currentPage + 1)} 
                        disabled={currentPage === totalPages || isLoading}
                        className="join-item btn btn-sm"
                      >
                        »
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {/* Modal for Add/Edit Lead */}
      {isModalOpen && (
        <dialog id="lead_modal" className={`modal modal-open ${isModalOpen ? 'modal-open' : ''}`}>
          <div className="modal-box w-11/12 max-w-4xl bg-base-100 shadow-xl rounded-lg">
            <form method="dialog" onSubmit={(e) => { e.preventDefault(); void handleSaveLead(); }}>
              <button type="button" onClick={handleCloseModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
              <h3 className="font-bold text-2xl mb-6 text-base-content">{selectedLead ? 'Edit Lead' : 'Add New Lead'}</h3>
              
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* Contact Info */}
                <div className="form-control">
                  <label htmlFor="contact_name" className="label"><span className="label-text">Contact Name</span></label>
                  <input type="text" id="contact_name" name="contact_name" value={editFormData.contact_name || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="contact_email" className="label"><span className="label-text">Contact Email</span></label>
                  <input type="email" id="contact_email" name="contact_email" value={editFormData.contact_email || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="contact_type" className="label"><span className="label-text">Contact Type <span className="text-error">*</span></span></label>
                  <select id="contact_type" name="contact_type" value={editFormData.contact_type || ''} onChange={handleModalInputChange} className="select select-bordered w-full" required>
                    <option value="" disabled>Select type</option>
                    <option value="Prospect">Prospect</option>
                    <option value="Lead">Lead</option>
                    <option value="Client">Client</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-control">
                  <label htmlFor="market_region" className="label"><span className="label-text">Market Region</span></label>
                  <input type="text" id="market_region" name="market_region" value={editFormData.market_region || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>

                {/* Property Info */}
                <div className="form-control md:col-span-2">
                  <label htmlFor="property_address" className="label"><span className="label-text">Property Address</span></label>
                  <input 
                    ref={addressInputRef} 
                    type="text" 
                    id="property_address" 
                    name="property_address"
                    value={editFormData.property_address || ''}
                    onChange={handleModalInputChange}
                    className="input input-bordered w-full"
                    placeholder={isGoogleMapsLoaded ? "Start typing address..." : "Loading Maps API..."}
                    disabled={!isGoogleMapsLoaded || !!googleMapsLoadError} // Disable if not loaded or error
                  />
                  {googleMapsLoadError && <p className="text-error text-xs mt-1">Maps Error: {googleMapsLoadError.message}</p>}
                  {!isGoogleMapsLoaded && !googleMapsLoadError && <p className="text-info text-xs mt-1">Initializing address search...</p>}
                </div>

                {isGoogleMapsLoaded && streetViewPosition && (
                  <div className="md:col-span-2 h-64 rounded-lg overflow-hidden border border-base-300">
                    <StreetViewPanorama
                      position={streetViewPosition}
                      visible={true}
                      options={{ addressControl: false, linksControl: false, panControl: true, zoomControl: true, enableCloseButton: false, fullscreenControl: false }}
                    />
                  </div>
                )}
                {/* Show a placeholder or message if Maps API is not loaded yet for StreetView */}
                {!isGoogleMapsLoaded && selectedLead?.property_address && (
                     <div className="md:col-span-2 h-64 rounded-lg border border-base-300 flex items-center justify-center bg-base-200">
                        <p className="text-base-content opacity-70">Loading Street View...</p>
                    </div>
                )}


                <div className="form-control">
                  <label htmlFor="property_city" className="label"><span className="label-text">City</span></label>
                  <input type="text" id="property_city" name="property_city" value={editFormData.property_city || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="property_state" className="label"><span className="label-text">State</span></label>
                  <input type="text" id="property_state" name="property_state" value={editFormData.property_state || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="property_postal_code" className="label"><span className="label-text">Postal Code</span></label>
                  <input type="text" id="property_postal_code" name="property_postal_code" value={editFormData.property_postal_code || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="property_type" className="label"><span className="label-text">Property Type</span></label>
                  <input type="text" id="property_type" name="property_type" value={editFormData.property_type || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>

                {/* Property Details */}
                <div className="form-control">
                  <label htmlFor="beds" className="label"><span className="label-text">Beds</span></label>
                  <input type="text" id="beds" name="beds" value={editFormData.beds || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="baths" className="label"><span className="label-text">Baths</span></label>
                  <input type="text" id="baths" name="baths" value={editFormData.baths || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="square_footage" className="label"><span className="label-text">Square Footage</span></label>
                  <input type="text" data-type="number" id="square_footage" name="square_footage" value={editFormData.square_footage || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="lot_size_sqft" className="label"><span className="label-text">Lot Size (sqft)</span></label>
                  <input type="text" data-type="number" id="lot_size_sqft" name="lot_size_sqft" value={editFormData.lot_size_sqft || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="year_built" className="label"><span className="label-text">Year Built</span></label>
                  <input type="text" data-type="number" id="year_built" name="year_built" value={editFormData.year_built || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="assessed_total" className="label"><span className="label-text">Assessed Total ($)</span></label>
                  <input type="text" data-type="number" id="assessed_total" name="assessed_total" value={editFormData.assessed_total || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                
                {/* MLS Info & Status */}
                <div className="form-control">
                  <label htmlFor="mls_curr_status" className="label"><span className="label-text">MLS Status</span></label>
                  <input type="text" id="mls_curr_status" name="mls_curr_status" value={editFormData.mls_curr_status || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="mls_curr_days_on_market" className="label"><span className="label-text">MLS Days on Market</span></label>
                  <input type="text" id="mls_curr_days_on_market" name="mls_curr_days_on_market" value={editFormData.mls_curr_days_on_market || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                  <label htmlFor="status" className="label"><span className="label-text">Lead Status</span></label>
                  <input type="text" id="status" name="status" value={editFormData.status || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div className="form-control">
                    <label htmlFor="normalized_lead_id" className="label"><span className="label-text">Normalized Lead ID</span></label>
                    <input 
                        type="text" // Use text to allow empty string, parse to number on change
                        data-type="number"
                        id="normalized_lead_id" 
                        name="normalized_lead_id" 
                        value={editFormData.normalized_lead_id === null || editFormData.normalized_lead_id === undefined ? '' : String(editFormData.normalized_lead_id)} 
                        onChange={handleModalInputChange} 
                        className="input input-bordered w-full" 
                        placeholder="Enter Normalized Lead ID (number)"
                    />
                </div>

                {/* Notes */}
                <div className="form-control md:col-span-2">
                  <label htmlFor="notes" className="label"><span className="label-text">Notes</span></label>
                  <textarea id="notes" name="notes" value={editFormData.notes || ''} onChange={handleModalInputChange} className="textarea textarea-bordered w-full h-24"></textarea>
                </div>
              </div>

              {/* Boolean Flags */}
              <div className="form-control mt-4">
                <label className="label cursor-pointer">
                  <span className="label-text">Converted</span> 
                  <input type="checkbox" name="converted" checked={!!editFormData.converted} onChange={handleModalInputChange} className="checkbox checkbox-primary" />
                </label>
              </div>
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Email Sent</span> 
                  <input type="checkbox" name="email_sent" checked={!!editFormData.email_sent} onChange={handleModalInputChange} className="checkbox checkbox-primary" />
                </label>
              </div>

              {/* Display created_at and updated_at for existing leads */}
              {selectedLead && (
                <div className="mt-4 pt-4 border-t border-base-300 text-xs text-base-content opacity-70 space-y-1">
                  <p>Created: {new Date(selectedLead.created_at).toLocaleString()}</p>
                  <p>Last Updated: {new Date(selectedLead.updated_at).toLocaleString()}</p>
                </div>
              )}

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
           {/* Optional: click outside to close */}
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={handleCloseModal}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
};

export default CrmLeads;
