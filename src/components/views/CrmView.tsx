'use client';

// Removed UploadCloud, kept PlusCircle & Eye for now
import { ChevronUp, ChevronDown, Edit3, Trash2, PlusCircle, Search, AlertTriangle, XCircle, Save, Eye, Mail, Phone, MapPin } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, FormEvent, useRef } from 'react';
import { useJsApiLoader, Autocomplete, StreetViewPanorama } from '@react-google-maps/api';


// Using shared Supabase client
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
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [sortField, setSortField] = useState<keyof CrmLead>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CrmLead>>(initialNewLeadData);

  // Google Maps API Loader
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'], 
  });

  // State for Autocomplete and StreetView
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [streetViewPosition, setStreetViewPosition] = useState<{ lat: number; lng: number } | null>(null);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);


  // fileInputRef was for CSV upload, can be removed if PlusCircle isn't used to trigger a hidden file input.
  // For "Add Lead" button, it's not needed.
  // const fileInputRef = useRef<HTMLInputElement>(null); 

  const columnConfigurations: ColumnConfig[] = [
    { key: 'contact_name', label: 'Contact Info', sortable: true }, // Will render name + email + type badge
    { key: 'property_address', label: 'Property Address', sortable: true },
    { key: 'market_region', label: 'Market Region', sortable: true },
    { key: 'status', label: 'Lead Status', sortable: true },
    { key: 'converted', label: 'Converted', sortable: true }, 
    // Optional columns for consideration:
    // { key: 'contact_type', label: 'Raw Contact Type', sortable: true }, 
    // { key: 'assessed_total', label: 'Assessed Value', sortable: true },
    // { key: 'mls_curr_status', label: 'MLS Status', sortable: true },
    // { key: 'normalized_lead_id', label: 'Normalized ID', sortable: true },
    // { key: 'id', label: 'CRM ID', sortable: true },
    // { key: 'email_sent', label: 'Email Sent', sortable: true },
  ];

  // Fetch Market Regions
  const fetchMarketRegions = useCallback(async () => {
    console.log('Fetching market regions for CRM Leads...');
    try {
      // First, get a count of distinct market regions to decide on the best approach
      const { count, error: countError } = await supabase
        .from('crm_leads') // Target crm_leads
        .select('market_region', { count: 'exact', head: true })
        .not('market_region', 'is', null);

      if (countError) throw countError;
      
      console.log(`Found ${count} non-null market regions in crm_leads`);
      
      // If we have a reasonable number of distinct values, fetch them directly
      if (count && count <= 1000) {
        const { data, error } = await supabase
          .from('crm_leads') // Target crm_leads
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
        console.log('Large dataset detected, using paginated approach for crm_leads market regions...');
        const BATCH_SIZE = 1000;
        let offset = 0;
        const allRegions = new Set<string>();
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('crm_leads') // Target crm_leads
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

  // Check if a lead has any valid email address - updated to use CrmLead interface
  const hasValidEmail = (lead: CrmLead) => {
    return !!lead.contact_email; 
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

  // Fetch Leads from crm_leads table
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('crm_leads') // Target crm_leads table
        .select('*', { count: 'exact' });

      // Apply market region filter if one is selected
      if (filterMarketRegion && filterMarketRegion !== 'All') {
        query = query.eq('market_region', filterMarketRegion);
      }

      // Apply search term filter - ensure fields match CrmLead and crm_leads table
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
          `status.ilike.${searchTermQuery},` +
          `contact_type.ilike.${searchTermQuery}`
          // normalized_lead_id is a number, typically not searched with ilike.
        );
      }

      // Apply sorting - sortField is keyof CrmLead
      query = query.order(sortField as string, { ascending: sortDirection === 'asc' });

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

  const handleOpenNewLeadModal = () => {
    setSelectedLead(null);
    setEditFormData({ ...initialNewLeadData }); // Use a fresh copy
    setStreetViewPosition(null); // Clear street view position for new lead
    if (autocompleteInputRef.current) {
      autocompleteInputRef.current.value = ''; // Clear autocomplete input
    }
    setIsModalOpen(true);
  };

  // Handlers
  const handleSort = (field: keyof CrmLead) => { 
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field); 
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page on sort change
  };

  const handleOpenModal = (lead: CrmLead) => { 
    setSelectedLead(lead);
    setEditFormData(lead);
    // Set initial street view position if address exists
    if (lead.property_address) {
      // For simplicity, we'll let StreetViewPanorama geocode the address string.
      // If more precise control is needed, geocode here and set streetViewPosition {lat,lng}
      setStreetViewPosition(null); // Or attempt geocoding: geocodeAddressToPosition(lead.property_address);
    } else {
      setStreetViewPosition(null);
    }
    if (autocompleteInputRef.current) {
      autocompleteInputRef.current.value = ''; // Clear autocomplete input
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLead(null);
    setEditFormData(initialNewLeadData);
  };

  const handleModalInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    
    // Removed special handling for custom_fields as it's not in the Lead interface.
    // If custom_fields are needed, they should be added to the Lead interface and handled.
    
    let processedValue: string | boolean | number | string[] | null = value;
    
    if (target.type === 'checkbox') {
      processedValue = (target as HTMLInputElement).checked;
    } else if (target.type === 'number') {
      processedValue = value === '' ? null : parseFloat(value);
    } else if (target instanceof HTMLSelectElement && target.multiple) { // For multi-select
      processedValue = Array.from(target.selectedOptions).map(option => option.value);
    }
    // Add more type coercions if needed, e.g., for date, tags (string to array), custom_fields (string to object)

    setEditFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSaveLead = async () => {
    // Validate required fields based on the CrmLead schema
    if (!editFormData.contact_type) { 
      alert('Contact Type is required.');
      return;
    }
    // normalized_lead_id is NOT NULL in DB. Ensure it's a valid number.
    // A value of 0 might be problematic if it's a FK to a table where 0 is not a valid ID.
    // For this implementation, we'll assume 0 is acceptable if no specific normalized_lead_id is provided for a new lead.
    // Or, we could enforce that normalized_lead_id must be > 0 for new leads if that's the business rule.
    if (typeof editFormData.normalized_lead_id !== 'number' || editFormData.normalized_lead_id < 0) {
       alert('Normalized Lead ID must be a valid non-negative number.');
       return;
    }

    setIsLoading(true);

    // Prepare data for insert/update.
    // For insert, Supabase handles serial `id`. For update, we use `editFormData.id`.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, ...dataToSave } = editFormData; 

    if (selectedLead && selectedLead.id) { // Existing lead: UPDATE
      dataToSave.updated_at = new Date().toISOString(); // Set updated_at for updates
      try {
        const { error: updateError } = await supabase
          .from('crm_leads') 
          .update(dataToSave as Partial<CrmLead>) 
          .eq('id', selectedLead.id);

        if (updateError) throw updateError;
        
        alert('Lead updated successfully!');
        await fetchLeads(); 
        handleCloseModal();
      } catch (err: any) {
        console.error('Error updating lead:', err);
        alert(`Failed to update lead: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    } else { // New lead: INSERT
      // For insert, `id` should not be in dataToSave as it's auto-generated by DB (bigserial)
      // `created_at` and `updated_at` will be set by DB.
      // Ensure `normalized_lead_id` and `contact_type` are correctly part of the object to insert.
      const insertData: Omit<CrmLead, 'id' | 'created_at' | 'updated_at'> = {
        normalized_lead_id: dataToSave.normalized_lead_id!, // Already validated to be a number
        contact_name: dataToSave.contact_name || null,
        contact_email: dataToSave.contact_email || null,
        contact_type: dataToSave.contact_type!, // Already validated
        market_region: dataToSave.market_region || null,
        property_address: dataToSave.property_address || null,
        property_city: dataToSave.property_city || null,
        property_state: dataToSave.property_state || null,
        property_postal_code: dataToSave.property_postal_code || null,
        property_type: dataToSave.property_type || null,
        baths: dataToSave.baths || null,
        beds: dataToSave.beds || null,
        year_built: dataToSave.year_built || null,
        square_footage: dataToSave.square_footage || null,
        lot_size_sqft: dataToSave.lot_size_sqft || null,
        assessed_total: dataToSave.assessed_total || null,
        mls_curr_status: dataToSave.mls_curr_status || null,
        mls_curr_days_on_market: dataToSave.mls_curr_days_on_market || null,
        converted: dataToSave.converted || false,
        status: dataToSave.status || null,
        notes: dataToSave.notes || null,
        email_sent: dataToSave.email_sent || false,
      };

      try {
        const { data: newLead, error: insertError } = await supabase
          .from('crm_leads') 
          .insert([insertData])
          .select(); 

        if (insertError) throw insertError;
        
        alert(`New lead created successfully! ${newLead && newLead.length > 0 ? `ID: ${newLead[0].id}` : ''}`);
        await fetchLeads();
        handleCloseModal();
      } catch (err: any) {
        console.error('Error creating lead:', err);
        alert(`Failed to create lead: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    }
  };


  const handleDeleteLead = async () => {
    if (!selectedLead || !selectedLead.id || !confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('crm_leads') // Target crm_leads table
        .delete()
        .eq('id', selectedLead.id);
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
        .from('useful_leads') // Target useful_leads table
        .delete()
        .eq('id', selectedLead.id);

      if (error) throw error;

      // Update local state
      setLeads(prevLeads => prevLeads.filter(l => l.id !== selectedLead.id));
      setTotalLeads(prevTotal => prevTotal -1); // Decrement total leads

      alert('Lead deleted successfully!');
      handleCloseModal();
    } catch (err: any) {
      console.error('Error deleting lead:', err);
      alert(`Failed to delete lead: ${err.message || 'Unknown error'}`);
      setError(`Failed to delete lead: ${err.message || 'Unknown error'}`);
    }
    setIsLoading(false);
  };

  const handlePlaceSelect = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place && place.address_components) {
        const addressComponents = place.address_components;
        const getAddressComponent = (type: string, part: 'long_name' | 'short_name' = 'long_name') => {
          return addressComponents.find(c => c.types.includes(type))?.[part] || '';
        };

        const streetNumber = getAddressComponent('street_number');
        const route = getAddressComponent('route');
        const locality = getAddressComponent('locality'); // city
        const administrativeAreaLevel1 = getAddressComponent('administrative_area_level_1', 'short_name'); // state
        const postalCode = getAddressComponent('postal_code');
        const country = getAddressComponent('country', 'short_name');


        const newAddress = `${streetNumber} ${route}`.trim();
        setEditFormData(prev => ({
          ...prev,
          property_address: newAddress,
          property_city: locality,
          property_state: administrativeAreaLevel1,
          property_postal_code: postalCode,
          // property_country: country, // If you have a country field
        }));

        if (place.geometry?.location) {
          setStreetViewPosition({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        } else {
          // Fallback if no geometry, StreetViewPanorama can try to resolve address string
          setStreetViewPosition(null); 
        }
         if (autocompleteInputRef.current) {
          autocompleteInputRef.current.value = ''; // Clear after selection
        }

      } else {
        console.error('Place selected but no address components found or place invalid:', place);
        // Potentially clear address fields or show error
      }
    }
  };


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
      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table table-zebra table-sm w-full">
          <thead>
            <tr className="text-base-content">
              {columnConfigurations.map(col => (
                <th 
                  key={col.key as string} 
                  onClick={() => col.sortable !== false && handleSort(col.key as keyof CrmLead)}
                  className={col.sortable !== false ? 'cursor-pointer hover:bg-base-300' : ''}
                >
                  {col.label} {col.sortable !== false && <SortIndicator field={col.key as keyof CrmLead} />}
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
              leads.map((lead: CrmLead) => (
                <tr key={lead.id} className="hover:bg-base-200 cursor-pointer transition-colors" onClick={() => handleOpenModal(lead)}>
                  {columnConfigurations.map(col => {
                    const value = lead[col.key as keyof CrmLead];
                    let cellContent: React.ReactNode;

                    switch (col.key) {
                      case 'contact_name':
                        cellContent = (
                          <div className="flex items-center space-x-3">
                            <div>
                              <div className="flex items-center">
                                <span className="font-medium">{lead.contact_name || 'No Name'}</span>
                                {lead.contact_type && (
                                  <span className={`badge badge-xs ml-2 ${
                                    lead.contact_type.toLowerCase().startsWith('owner') 
                                      ? 'badge-info' 
                                      : lead.contact_type.toLowerCase() === 'agent' 
                                        ? 'badge-secondary' 
                                        : 'badge-outline' // Default or for 'Prospect' etc.
                                    }`} title={`Contact Type: ${lead.contact_type}`}>
                                    {lead.contact_type}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm opacity-70 flex items-center mt-1">
                                <Mail className="w-3 h-3 mr-1 flex-shrink-0" />
                                <span className="truncate max-w-xs" title={getCleanEmailDisplay(lead.contact_email)}>
                                  {getCleanEmailDisplay(lead.contact_email)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                        break;
                      case 'property_address':
                        cellContent = (
                          <div className="flex items-start">
                            <MapPin size={16} className="mr-1.5 mt-0.5 flex-shrink-0 text-red-500" />
                            <div>
                              {displayValue(lead.property_address)}
                              {(lead.property_city || lead.property_state || lead.property_postal_code) && <br />}
                              {lead.property_city || lead.property_state || lead.property_postal_code
                                ? `${displayValue(lead.property_city)}, ${displayValue(lead.property_state)} ${displayValue(lead.property_postal_code)}`
                                : ''}
                            </div>
                          </div>
                        );
                        break;
                      case 'status':
                        cellContent = (
                          <span className={getStatusBadge(lead.status)}>
                            {lead.status || 'N/A'}
                          </span>
                        );
                        break;
                      case 'converted':
                      case 'email_sent':
                        cellContent = <input type="checkbox" checked={!!value} readOnly className="checkbox checkbox-xs checkbox-disabled" />;
                        break;
                      case 'assessed_total':
                        cellContent = value ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-';
                        break;
                      default:
                        cellContent = displayValue(value);
                    }
                    return <td key={col.key as string} className="py-3 px-4">{cellContent}</td>;
                  })}
                </tr>
              ))
                })
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
              « Prev
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="join-item btn btn-sm"
              disabled={currentPage >= totalPages || isLoading}
            >
              Next »
            </button>
          </div>
        </div>
      </div>

      {/* Modal for Editing Lead */}
      {isModalOpen && ( // selectedLead can be null for new lead
        <dialog open className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box w-11/12 max-w-3xl">
            <button onClick={handleCloseModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><XCircle size={20}/></button>
            <h3 className="font-bold text-xl mb-4">
              {selectedLead ? `Edit CRM Lead: ${editFormData.contact_name || selectedLead.contact_name || 'N/A'}` : 'Add New CRM Lead'}
            </h3>
            
            <form onSubmit={(e) => { e.preventDefault(); void handleSaveLead(); }} className="space-y-4 max-h-[70vh] sm:max-h-[60vh] overflow-y-auto pr-2">
              {isLoaded && (
                <>
                  <div style={{ width: '100%', height: '250px', marginBottom: '1rem', background: '#e0e0e0' }}>
                    {(streetViewPosition || editFormData.property_address) && (
                       <StreetViewPanorama
                        position={streetViewPosition || editFormData.property_address!}
                        visible={true}
                        options={{
                          addressControl: false,
                          enableCloseButton: false,
                          fullscreenControl: false,
                          panControl: true,
                          zoomControl: true,
                        }}
                        containerStyle={{ width: '100%', height: '100%' }}
                      />
                    )}
                    {!(streetViewPosition || editFormData.property_address) && (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Street View appears here (Enter an address below)
                        </div>
                    )}
                  </div>
                  <Autocomplete
                    onLoad={(autoC) => setAutocomplete(autoC)}
                    onPlaceChanged={handlePlaceSelect}
                    options={{
                      types: ['address'],
                      // componentRestrictions: { country: 'us' }, // Optional
                    }}
                  >
                    <input
                      ref={autocompleteInputRef}
                      type="text"
                      placeholder="Search Full Address (e.g., 123 Main St, Anytown, USA)"
                      className="input input-bordered w-full mb-2"
                    />
                  </Autocomplete>
                </>
              )}
              {loadError && <div className="text-error">Error loading Google Maps: {loadError.message}</div>}

              {/* Address fields will be populated by Autocomplete */}
              <div>
                <label htmlFor="modal-normalized_lead_id" className="label"><span className="label-text">Normalized Lead ID (System)</span></label>
                <input 
                  type="number" 
                  id="modal-normalized_lead_id" 
                  name="normalized_lead_id" 
                  value={editFormData.normalized_lead_id ?? ''} 
                  onChange={handleModalInputChange} 
                  className="input input-bordered w-full input-disabled" // Using input-disabled for read-only appearance
                  readOnly // Make it strictly read-only
                />
              </div>
              {selectedLead && selectedLead.id && ( // Display CRM ID only for existing leads
                <div>
                  <label htmlFor="modal-id" className="label"><span className="label-text">CRM ID</span></label>
                  <input type="text" id="modal-id" name="id" value={selectedLead.id} className="input input-bordered w-full input-disabled" readOnly />
                </div>
              )}
              <div>
                <label htmlFor="modal-contact_name" className="label"><span className="label-text">Contact Name</span></label>
                <input type="text" id="modal-contact_name" name="contact_name" value={editFormData.contact_name || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-contact_email" className="label"><span className="label-text">Contact Email</span></label>
                <input type="email" id="modal-contact_email" name="contact_email" value={editFormData.contact_email || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-contact_type" className="label"><span className="label-text">Contact Type*</span></label>
                <input type="text" id="modal-contact_type" name="contact_type" value={editFormData.contact_type || ''} onChange={handleModalInputChange} className="input input-bordered w-full" required />
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
                <input type="number" id="modal-assessed_total" name="assessed_total" value={editFormData.assessed_total === null ? '' : editFormData.assessed_total} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-mls_curr_status" className="label"><span className="label-text">MLS Current Status</span></label>
                <input type="text" id="modal-mls_curr_status" name="mls_curr_status" value={editFormData.mls_curr_status || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-mls_curr_days_on_market" className="label"><span className="label-text">MLS Current Days on Market</span></label>
                <input type="text" id="modal-mls_curr_days_on_market" name="mls_curr_days_on_market" value={editFormData.mls_curr_days_on_market || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div className="form-control">
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
