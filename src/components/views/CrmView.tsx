'use client'

// Removed UploadCloud, Eye, Mail, Phone, MapPin from lucide-react imports
import { ChevronUp, ChevronDown, Edit3, Trash2, PlusCircle, Search, AlertTriangle, XCircle, Save } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, FormEvent, useRef } from 'react';
import { Autocomplete, StreetViewPanorama } from '@react-google-maps/api'; 
import { useGoogleMapsApi } from '../maps/GoogleMapsLoader'; 

// Using shared Supabase client
// import { Badge } from 'react-daisyui'; // Removed Badge from react-daisyui
import { supabase } from '@/lib/supabase/client';
import {
  createCrmLeadAction,
  updateCrmLeadAction,
  deleteCrmLeadAction
} from '../../app/crm/actions'; // Added server action imports

// Define types (adjust based on your actual schema)
// NormalizedLead interface removed, CrmLead will be inserted below

// CrmLead interface (from previous CrmView.tsx)
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
  key: keyof CrmLead | string; // Changed NormalizedLead to CrmLead
  label: string;
  sortable?: boolean;
}

// export interface NormalizedLead { // This block is removed
//   id: string;
//   market_region?: string | null;
//   contact_name?: string | null;
  // contact_email?: string | null;
  // mls_curr_list_agent_name?: string | null;
  // mls_curr_list_agent_email?: string | null;
  // property_address?: string | null;
//   property_city?: string | null;
//   property_state?: string | null;
//   property_postal_code?: string | null;
//   property_type?: string | null;
//   beds?: string | null; // Assuming text, adjust if numeric
//   baths?: string | null; // Assuming text, adjust if numeric
//   year_built?: string | null; // Assuming text, adjust if numeric
//   square_footage?: string | null; // Assuming text, adjust if numeric (schema has it as 'text')
//   lot_size_sqft?: string | null; // Assuming text, adjust if numeric
//   wholesale_value?: number | null; // numeric
//   assessed_total?: number | null; // numeric
//   avm_value?: number | null; // numeric
//   price_per_sq_ft?: number | null; // numeric
//   mls_curr_status?: string | null;
//   mls_curr_days_on_market?: string | null;
//   converted: boolean; // not null default false
//   status?: string | null; // This is lead_status in table view, aligning with 'status' field in schema
//   source?: string | null; // This is lead_source in table view
//   notes?: string | null;
//   created_at: string; // timestamp with time zone
//   updated_at: string; // timestamp with time zone
//   // Fields from previous interface not directly in new schema but kept for potential future use or if schema expands:
//   company_name?: string | null;
//   company_industry?: string | null;
//   company_website?: string | null;
//   company_notes?: string | null;
//   county?: string | null;
//   country?: string | null;
//   lead_score?: number | null;
//   assigned_to?: string | null;
//   last_contacted_date?: string | null; // separate from updated_at
//   next_follow_up_date?: string | null;
//   conversion_date?: string | null;
//   lost_reason?: string | null;
//   tags?: string[] | null;
//   custom_fields?: Record<string, any> | null;
//   property_sf?: number | null; // old name for square_footage, kept if used in old data
//   // The 'lead_status' and 'lead_source' used in UI might map to 'status' and 'source' from the schema respectively.
//   // For clarity, the UI will use lead.status and lead.source which map to these schema fields.
//   // The table column header 'lead_status' will display data from 'lead.status'.
//   _primaryContact?: {
//     name: string | null;
//     email: string;
//     type: string;
//     contactType: 'owner' | 'agent';
//   } | null;
// }

const initialNewLeadData: Partial<CrmLead> = {
  normalized_lead_id: null, // Changed from 0 to null
  contact_name: '',
  contact_email: '',
  contact_type: 'Prospect',
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
  status: 'New',
  notes: '',
  email_sent: false,
};

const CrmLeads: React.FC = () => { // Renamed LeadsView to CrmLeads
  const [leads, setLeads] = useState<CrmLead[]>([]); // Changed NormalizedLead to CrmLead
  const [marketRegions, setMarketRegions] = useState<string[]>([]);
  const [filterMarketRegion, setFilterMarketRegion] = useState<string>('All');
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Table State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [sortField, setSortField] = useState<keyof CrmLead>('created_at'); // Changed NormalizedLead to CrmLead
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null); 
  const [editFormData, setEditFormData] = useState<Partial<CrmLead>>(initialNewLeadData); 

  // Google Maps State and Refs
  const { isLoaded: isGoogleMapsLoaded, loadError: googleMapsLoadError } = useGoogleMapsApi();
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [streetViewPosition, setStreetViewPosition] = useState<{ lat: number; lng: number } | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Renamed columnConfigurations to columns and updated content
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
  ];

  // Fetch Market Regions
  const fetchMarketRegions = useCallback(async () => {
    console.log('Fetching market regions...');
    try {
      // First, get a count of distinct market regions to decide on the best approach
      const { count, error: countError } = await supabase
        .from('crm_leads') // Changed to crm_leads
        .select('market_region', { count: 'exact', head: true })
        .not('market_region', 'is', null);

      if (countError) throw countError;
      
      console.log(`Found ${count} non-null market regions in database`);
      
      // If we have a reasonable number of distinct values, fetch them directly
      if (count && count <= 1000) {
        const { data, error } = await supabase
          .from('crm_leads') // Changed to crm_leads
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
            .from('crm_leads') // Changed to crm_leads
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
  }, []); // Removed setMarketRegions from deps as it's a setState function from useState

  // Removed hasValidEmail function
  // Removed getStatusBadge function (getStatusBadgeClass is used)

  // Fetch Leads from useful_leads view
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('crm_leads') // Changed to crm_leads
        .select('*', { count: 'exact' });

      // Apply market region filter if one is selected
      if (filterMarketRegion && filterMarketRegion !== 'All') {
        query = query.eq('market_region', filterMarketRegion);
      }

      // Apply search term filter
      if (tableSearchTerm && tableSearchTerm.trim() !== '') {
        const searchTermQuery = `%${tableSearchTerm.trim()}%`;
        // Ensure these fields are valid for CrmLead and crm_leads table
        query = query.or(
          `contact_name.ilike.${searchTermQuery},` +
          `contact_email.ilike.${searchTermQuery},` +
          `property_address.ilike.${searchTermQuery},` +
          `property_city.ilike.${searchTermQuery},` +
          // `property_state.ilike.${searchTermQuery},` + // property_state is in CrmLead
          // `property_postal_code.ilike.${searchTermQuery},` + // property_postal_code is in CrmLead
          `notes.ilike.${searchTermQuery},` + // notes is in CrmLead
          `status.ilike.${searchTermQuery}` // status is in CrmLead
        );
      }

      // Apply sorting - ensure sortField is a valid key of CrmLead
      if (sortField) { // Check if sortField is set
        query = query.order(sortField, { ascending: sortDirection === 'asc' });
      } else {
        // Default sort if sortField is empty (e.g., by created_at)
        query = query.order('created_at', { ascending: false });
      }

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

  // fetchNormalizedLeads function is removed as per Step 7

  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        fetchMarketRegions(),
        fetchLeads()
      ]);
    };

    loadInitialData().catch(console.error); 
  }, [fetchMarketRegions, fetchLeads]); 

  // Effect to reset page to 1 when search term or region filter changes
  useEffect(() => {
    if (tableSearchTerm || (filterMarketRegion && filterMarketRegion !== 'All')) {
      setCurrentPage(1);
    }
  }, [tableSearchTerm, filterMarketRegion]);

  // Google Maps Autocomplete and Geocoder Initialization
  useEffect(() => {
    if (isGoogleMapsLoaded && window.google?.maps?.places && window.google?.maps?.Geocoder) {
      if (addressInputRef.current && !autocomplete) {
        const autoCompInstance = new google.maps.places.Autocomplete(addressInputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
        });
        autoCompInstance.addListener('place_changed', handlePlaceSelect);
        setAutocomplete(autoCompInstance);
      }
      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder();
      }
    }
    // Note: Cleanup for autocomplete listeners might be added here if necessary,
    // e.g. if the modal could be destroyed and recreated frequently without full unmounts.
    // For now, relying on handleCloseModal and component unmount for cleanup.
  }, [isGoogleMapsLoaded, autocomplete, handlePlaceSelect]); // Added handlePlaceSelect to dependency array

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

  const handleOpenModal = (lead: CrmLead | null = null) => {
    if (lead) {
      setSelectedLead(lead);
      setEditFormData(lead);
      // Geocode address for Street View if Maps API is loaded and address exists
      if (isGoogleMapsLoaded && geocoderRef.current && lead.property_address && lead.property_city && lead.property_state) {
        geocoderRef.current.geocode(
          { address: `${lead.property_address}, ${lead.property_city}, ${lead.property_state}` },
          (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results && results[0]?.geometry?.location) {
              setStreetViewPosition({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
            } else {
              setStreetViewPosition(null);
              console.warn('Geocode was not successful for ' + lead.property_address + ': ' + status);
            }
          }
        );
      } else {
        setStreetViewPosition(null);
        if (!isGoogleMapsLoaded && lead.property_address) {
            console.warn("Maps API not loaded, cannot geocode address for Street View.");
        }
      }
    } else { // New lead
      setSelectedLead(null);
      setEditFormData(initialNewLeadData);
      setStreetViewPosition(null); // Clear street view for new lead
    }
    setIsModalOpen(true);
  };

  const handleOpenNewLeadModal = () => {
    handleOpenModal(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLead(null);
    setEditFormData(initialNewLeadData);
    setStreetViewPosition(null);
    if (autocomplete && typeof google !== 'undefined' && google.maps?.event) {
      google.maps.event.clearInstanceListeners(autocomplete); // Clear listeners
    }
    setAutocomplete(null); // Reset autocomplete state
    // if (addressInputRef.current) addressInputRef.current.value = ''; // Optionally clear input
  };

  const handleModalInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { // Added HTMLSelectElement
    const { name, value, type } = e.target; // Added type
    // Basic handling, might need adjustment for checkbox/numeric types later
    // For now, assuming most inputs are text or can be processed as string.
    let processedValue: any = value;
    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number' || e.target.dataset.type === 'number') {
      processedValue = value === '' ? null : parseFloat(value);
      if (isNaN(processedValue as number)) processedValue = null;
    }
    setEditFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

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
        const locality = getAddressComponent('locality'); // City
        const administrativeAreaLevel1 = getAddressComponent('administrative_area_level_1', 'short_name'); // State
        const postalCode = getAddressComponent('postal_code');

        setEditFormData(prev => ({
          ...prev,
          property_address: `${streetNumber} ${route}`.trim(),
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
  }, [autocomplete, setEditFormData, setStreetViewPosition]);

  const handleSaveLead = async () => {
    if (!editFormData.contact_type) { // Example validation
      alert('Contact Type is required.');
      return;
    }
    // Add other necessary client-side validation for CrmLead fields.
    // Client-side validation for contact_type (already present)
    if (!editFormData.contact_type) {
      alert('Contact Type is required.');
      return;
    }
    
    setIsLoading(true); 
    let response;
    
    // Prepare data, ensuring normalized_lead_id is correctly handled as number or null
    // handleModalInputChange should have already set it to null if empty/invalid
    let preparedNormalizedLeadId: number | null = null;
    if (editFormData.normalized_lead_id !== null && editFormData.normalized_lead_id !== undefined) {
        const parsedId = parseInt(String(editFormData.normalized_lead_id), 10);
        if (!isNaN(parsedId)) {
            preparedNormalizedLeadId = parsedId;
        } else {
            // If it was some non-numeric string that didn't become null in handleModalInputChange
            // (which it should have), ensure it becomes null here.
            preparedNormalizedLeadId = null; 
        }
    }

    const dataForAction = {
        ...editFormData,
        normalized_lead_id: preparedNormalizedLeadId
    };

    if (selectedLead && selectedLead.id) { // Existing lead: UPDATE
      const { id, created_at, updated_at, ...dataToUpdate } = dataForAction as CrmLead; 
      response = await updateCrmLeadAction(selectedLead.id, dataToUpdate);
    } else { // New lead: INSERT
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, updated_at, ...dataToInsert } = dataForAction;
      response = await createCrmLeadAction(dataToInsert as Partial<Omit<CrmLead, 'id' | 'created_at' | 'updated_at'>>);
    }

    setIsLoading(false);
    if (response.success) {
      alert(response.message || (selectedLead ? 'Lead updated successfully!' : 'Lead created successfully!'));
      fetchLeads(); 
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
      fetchLeads(); 
      handleCloseModal();
    } else {
      console.error('Error deleting lead:', response.error);
      alert(`Failed to delete lead: ${response.error || 'Unknown error'}`);
    }
  };

  // handleFileSelect, handleUploadButtonClick, handleFileUpload removed

  // Sort Indicator Component
  const SortIndicator = ({ field }: { field: keyof CrmLead | '' }) => { // Changed NormalizedLead to CrmLead
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
      <div className="bg-base-100 rounded-lg shadow overflow-hidden">
        <table className="table table-zebra table-sm w-full">
          <thead>
            <tr className="text-base-content">
              {columns.map(col => ( // Changed columnConfigurations to columns
                <th 
                  key={col.key} 
                  onClick={() => col.sortable !== false && handleSort(col.key as keyof CrmLead)}
                  className={col.sortable !== false ? 'cursor-pointer hover:bg-base-300' : ''}
                >
                  {col.label} {col.sortable !== false && <SortIndicator field={col.key as keyof CrmLead} />} 
                </th>
              ))}
               <th>Actions</th> {/* Added Actions header for consistency with old CrmView */}
            </tr>
          </thead>
          <tbody>
            {isLoading && !leads.length ? (
              <tr><td colSpan={columns.length + 1} className="text-center py-10">Loading leads...</td></tr> 
            ) : !isLoading && !leads.length ? (
              <tr><td colSpan={columns.length + 1} className="text-center py-10">No leads found.</td></tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover cursor-pointer" onClick={() => handleOpenModal(lead)}>
                  {/* Dynamically render cells based on new columns definition */}
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
                  <td> {/* Actions column */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenModal(lead); }}
                      className="btn btn-xs btn-ghost text-primary hover:bg-primary hover:text-primary-content p-1"
                      aria-label={`Edit lead ${lead.contact_name}`}
                    >
                      <Edit3 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
           <tfoot> {/* Added tfoot for consistency with old CrmView pagination style */}
              <tr>
                <td colSpan={columns.length + 1}>
                  {/* Pagination will be handled by the controls below, but structure is here */}
                </td>
              </tr>
            </tfoot>
        </table>
      </div>

      {/* Pagination Controls - (Structure might need to be merged with tfoot or kept separate) */}
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

      {isModalOpen && ( // Modal can open for new lead (selectedLead is null) or edit
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <button onClick={handleCloseModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><XCircle size={20}/></button>
            <h3 className="font-bold text-xl mb-4">
              {selectedLead ? `Edit Lead: ${editFormData.contact_name || 'N/A'}` : 'Add New Lead'}
            </h3>
            
            <form onSubmit={(e) => { e.preventDefault(); void handleSaveLead(); }} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <label htmlFor="modal-contact_name" className="label"><span className="label-text">Contact Name</span></label>
                <input type="text" id="modal-contact_name" name={`contact_name`} value={editFormData[`contact_name`] || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-contact_email" className="label"><span className="label-text">Contact Email</span></label>
                <input type="email" id="modal-contact_email" name="contact_email" value={editFormData.contact_email || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
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
              <div>
                <label htmlFor="modal-market_region" className="label"><span className="label-text">Market Region</span></label>
                <input type="text" id="modal-market_region" name="market_region" value={editFormData.market_region || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              <div>
                <label htmlFor="modal-property_address" className="label"><span className="label-text">Property Address</span></label>
                <input
                  ref={addressInputRef}
                  type="text"
                  id="modal-property_address"
                  name="property_address"
                  value={editFormData.property_address || ''}
                  onChange={handleModalInputChange}
                  className="input input-bordered w-full"
                  placeholder={isGoogleMapsLoaded ? "Start typing address..." : "Loading Maps API..."}
                  disabled={!isGoogleMapsLoaded || !!googleMapsLoadError}
                />
                {googleMapsLoadError && <p className="text-error text-xs mt-1">Maps Error: {googleMapsLoadError.message}</p>}
                {!isGoogleMapsLoaded && !googleMapsLoadError && <p className="text-info text-xs mt-1">Initializing address search...</p>}
              </div>

              {isGoogleMapsLoaded && streetViewPosition && (
                <div className="md:col-span-2 h-64 rounded-lg overflow-hidden border border-base-300 my-4">
                  <StreetViewPanorama
                    position={streetViewPosition}
                    visible={true}
                    options={{ addressControl: false, linksControl: false, panControl: true, zoomControl: true, enableCloseButton: false, fullscreenControl: false }}
                  />
                </div>
              )}
              {!isGoogleMapsLoaded && selectedLead?.property_address && !streetViewPosition && (
                   <div className="md:col-span-2 h-64 rounded-lg border border-base-300 my-4 flex items-center justify-center bg-base-200">
                      <p className="text-base-content opacity-70">Loading Street View...</p>
                  </div>
              )}

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
                      placeholder="Enter Normalized Lead ID (number, optional)" // Updated placeholder
                  />
              </div>

              {/* Boolean Flags */}
              <div className="form-control mt-4 md:col-span-2"> {/* Spanning across 2 columns for better layout */}
                <label className="label cursor-pointer justify-start gap-2">
                  <input type="checkbox" name="converted" checked={!!editFormData.converted} onChange={handleModalInputChange} className="checkbox checkbox-primary" />
                  <span className="label-text">Converted Lead</span> 
                </label>
              </div>
              <div className="form-control md:col-span-2">
                <label className="label cursor-pointer justify-start gap-2">
                  <input type="checkbox" name="email_sent" checked={!!editFormData.email_sent} onChange={handleModalInputChange} className="checkbox checkbox-primary" />
                  <span className="label-text">Email Sent</span> 
                </label>
              </div>

              <div className="modal-action mt-6 md:col-span-2"> {/* Ensure actions span full width */}
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

export default CrmLeads; // Updated export default
