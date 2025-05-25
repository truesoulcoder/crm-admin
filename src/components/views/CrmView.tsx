'use client'

import {
  ChevronUp,
  ChevronDown,
  Edit3,
  Trash2,
  PlusCircle,
  Search,
  AlertTriangle,
  XCircle,
  Save,
  MapPin, // For Street View icon if needed
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, FormEvent, useRef } from 'react';
import { Autocomplete, StreetViewPanorama } from '@react-google-maps/api';
import { useGoogleMapsApi } from '../maps/GoogleMapsLoader'; // Import the hook
import { supabase } from '@/lib/supabase/client';
import type { CrmLead } from '@/types/crm';
import {
  createCrmLeadAction,
  updateCrmLeadAction,
  deleteCrmLeadAction
} from '../../app/crm/actions';


interface ColumnConfig {
  key: keyof CrmLead | string;
  label: string;
  sortable?: boolean;
}

// Define a more specific type for form data if needed, especially for new fields like phone
interface CrmFormData extends Omit<Partial<CrmLead>, 'id' | 'created_at' | 'updated_at' | 'contact_name'> {
  id?: number; // id is present for existing leads
  contact_first_name?: string;
  contact_last_name?: string;
  phone?: string; // New field from modal design
}

const CrmView: React.FC = () => {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<CrmFormData>({});
  const [isSaving, setIsSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof CrmLead | string; direction: 'ascending' | 'descending' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [marketFilter, setMarketFilter] = useState<string>('');
  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);

  const [panoramaPosition, setPanoramaPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [panoramaPov, setPanoramaPov] = useState<google.maps.StreetViewPov>({ heading: 34, pitch: 10 });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [modalTitleAddress, setModalTitleAddress] = useState<string>('');


  const { isLoaded, loadError } = useGoogleMapsApi(); // Use the context hook

  // Memoize Autocomplete options for stability
  const autocompleteOptions = useMemo(() => ({
    types: ['address'] as const,
    componentRestrictions: { country: 'us' },
    fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id', 'type'],
  }), []);

  const initialEditFormData: CrmFormData = {
    contact_first_name: '',
    contact_last_name: '',
    email: '',
    phone: '', // Added phone
    property_address: '',
    property_city: '',
    property_state: '',
    property_postal_code: '',
    appraised_value: 0,
    beds: 0,
    baths: 0,
    sq_ft: 0,
    notes: '',
    market_region: '', // Added for completeness, might be set differently
    normalized_lead_id: null, // Added for completeness
  };

  // Fetch available markets on component mount
  useEffect(() => {
    const fetchMarkets = async () => {
      const { data, error: dbError } = await supabase
        .from('crm_leads') // Assuming markets are derived from existing leads
        .select('market_region');
      
      if (dbError) {
        console.error('Error fetching markets:', dbError);
        setError('Failed to load market regions.');
        return;
      }
      if (data) {
        const uniqueMarkets = Array.from(new Set(data.map(item => item.market_region).filter(Boolean))) as string[];
        setAvailableMarkets(uniqueMarkets.sort());
      }
    };
    void fetchMarkets();
  }, []);


  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let query = supabase.from('crm_leads').select('*');

    if (marketFilter) {
      query = query.eq('market_region', marketFilter);
    }

    if (searchTerm) {
      query = query.or(`email.ilike.%${searchTerm}%,property_address.ilike.%${searchTerm}%,contact_first_name.ilike.%${searchTerm}%,contact_last_name.ilike.%${searchTerm}%`);
    }

    if (sortConfig !== null) {
      query = query.order(sortConfig.key as string, {
        ascending: sortConfig.direction === 'ascending',
      });
    } else {
      query = query.order('created_at', { ascending: false }); // Default sort
    }

    const { data, error: dbError } = await query // Removed count for simplicity, handle pagination based on data length
      .range((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage - 1);

    if (dbError) {
      console.error('Error fetching leads:', dbError);
      setError('Failed to load leads. ' + dbError.message);
      setLeads([]);
    } else {
      setLeads(data || []);
    }
    setIsLoading(false);
  }, [searchTerm, sortConfig, currentPage, rowsPerPage, marketFilter]); // Removed supabase from deps as it's stable

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const handleSort = (key: keyof CrmLead | string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page on sort
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleMarketFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setMarketFilter(event.target.value);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleRowsPerPageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1); // Reset to first page on rows per page change
  };

  const handleModalInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    let processedValue: string | number | null = value;
  
    if (['appraised_value', 'beds', 'baths', 'sq_ft'].includes(name)) {
      processedValue = value === '' ? null : Number(value);
    }
  
    setEditFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
  
    if (['property_address', 'property_city', 'property_state', 'property_postal_code'].includes(name)) {
      // This logic might need refinement if manual address edits should also update panorama
      // For now, it primarily updates the title based on manual input.
      // The Autocomplete's onPlaceChangedStreetView handles panorama for selected addresses.
      setModalTitleAddress(prev => {
        // Create a temporary object with current form data for address parts
        const currentAddressParts = {
          property_address: name === 'property_address' ? value : editFormData.property_address,
          property_city: name === 'property_city' ? value : editFormData.property_city,
          property_state: name === 'property_state' ? value : editFormData.property_state,
          property_postal_code: name === 'property_postal_code' ? value : editFormData.property_postal_code,
        };
        return `${currentAddressParts.property_address || ''}${currentAddressParts.property_city ? `, ${currentAddressParts.property_city}` : ''}${currentAddressParts.property_state ? `, ${currentAddressParts.property_state}` : ''}${currentAddressParts.property_postal_code ? ` ${currentAddressParts.property_postal_code}` : ''}`.trim().replace(/^,|,$/g, '');
      });
    }
  };
  
  const handleOpenModal = (lead?: CrmLead) => {
    if (lead) {
      const nameParts = lead.contact_name?.split(' ') || ['',''];
      const formData: CrmFormData = {
        ...lead,
        contact_first_name: nameParts[0] || '',
        contact_last_name: nameParts.slice(1).join(' ') || '',
        phone: lead.phone || '', 
      };
      setEditFormData(formData);
      const titleAddr = `${lead.property_address || ''}${lead.property_city ? `, ${lead.property_city}` : ''}${lead.property_state ? `, ${lead.property_state}` : ''}${lead.property_postal_code ? ` ${lead.property_postal_code}` : ''}`.trim().replace(/^,|,$/g, '');
      setModalTitleAddress(titleAddr);

      if (lead.property_address && isLoaded && window.google && window.google.maps && window.google.maps.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        const fullAddress = `${lead.property_address}, ${lead.property_city}, ${lead.property_state} ${lead.property_postal_code}`;
        geocoder.geocode({ address: fullAddress }, (results, status) => {
          if (status === 'OK' && results && results[0] && results[0].geometry && results[0].geometry.location) {
            setPanoramaPosition({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
          } else {
            console.warn('Geocode was not successful for existing lead: ' + status);
            setPanoramaPosition(null);
          }
        });
      } else {
        if (!isLoaded) console.warn('Google Maps API not loaded. Cannot fetch panorama.');
        setPanoramaPosition(null);
      }
    } else {
      setEditFormData(initialEditFormData);
      setModalTitleAddress('Add New Lead');
      setPanoramaPosition(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditFormData({}); 
    setModalTitleAddress('');
    setPanoramaPosition(null);
    if (autocompleteRef.current) { // Defensive clear
        // It's good practice to clear, but Google's Autocomplete might not have a formal "destroy" or "unbind" method here.
        // Setting ref to null is the main thing.
    }
    autocompleteRef.current = null; 
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const leadDataToSave = {
      ...editFormData,
      contact_name: `${editFormData.contact_first_name || ''} ${editFormData.contact_last_name || ''}`.trim(),
    };

    if (!leadDataToSave.id) {
      delete leadDataToSave.id;
    }

    try {
      if (editFormData.id) {
        const result = await updateCrmLeadAction(editFormData.id, leadDataToSave);
        if (result.error) throw new Error(result.error);
        // setLeads(leads.map(l => l.id === editFormData.id ? { ...l, ...result.data } : l)); // result.data may be CrmLead | null
        if (result.data) {
            setLeads(leads.map(l => l.id === editFormData.id ? result.data! : l));
        } else {
            void fetchLeads(); // Fallback if data is null
        }
      } else {
        const result = await createCrmLeadAction(leadDataToSave);
        if (result.error) throw new Error(result.error);
        if (result.data) {
          setLeads([result.data, ...leads]);
        } else {
            void fetchLeads(); // Fallback if data is null
        }
      }
      handleCloseModal();
      // void fetchLeads(); // Re-fetch might be redundant if local state update is perfect
    } catch (e: any) {
      console.error('Error saving lead:', e);
      setError(`Failed to save lead: ${e.message}`);
    }
    setIsSaving(false);
  };
  
  const handleDeleteLead = async () => {
    if (!editFormData.id) return;
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return;

    setIsSaving(true); 
    setError(null);
    try {
      const result = await deleteCrmLeadAction(editFormData.id);
      if (result.error) throw new Error(result.error);
      setLeads(leads.filter(l => l.id !== editFormData.id));
      handleCloseModal();
    } catch (e: any) {
      console.error('Error deleting lead:', e);
      setError(`Failed to delete lead: ${e.message}`);
    }
    setIsSaving(false);
  };

  const onLoadStreetViewAutocomplete = useCallback((autocompleteInstance: google.maps.places.Autocomplete) => {
    console.log('[DEBUG] Autocomplete onLoadStreetViewAutocomplete called. Instance:', autocompleteInstance);
    autocompleteRef.current = autocompleteInstance;
  }, []);

  const onPlaceChangedStreetView = useCallback(() => {
    console.log('[DEBUG] onPlaceChangedStreetView triggered. autocompleteRef.current:', autocompleteRef.current);
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      console.log('[DEBUG] Place details from getPlace():', place);

      if (place && place.geometry && place.geometry.location && place.address_components) {
        const streetNumber = place.address_components.find(c => c.types.includes('street_number'))?.long_name || '';
        const route = place.address_components.find(c => c.types.includes('route'))?.long_name || '';
        const city = place.address_components.find(c => c.types.includes('locality'))?.long_name ||
                     place.address_components.find(c => c.types.includes('postal_town'))?.long_name || '';
        const state = place.address_components.find(c => c.types.includes('administrative_area_level_1'))?.short_name || '';
        const zip = place.address_components.find(c => c.types.includes('postal_code'))?.long_name || '';
        const fullAddress = `${streetNumber} ${route}`.trim();

        setEditFormData(prev => ({
          ...prev,
          property_address: fullAddress,
          property_city: city,
          property_state: state,
          property_postal_code: zip,
          // contact_first_name: prev.contact_first_name, // Ensure other fields are not lost
          // contact_last_name: prev.contact_last_name,
          // email: prev.email,
          // phone: prev.phone,
          // appraised_value: prev.appraised_value,
          // beds: prev.beds,
          // baths: prev.baths,
          // sq_ft: prev.sq_ft,
          // notes: prev.notes,
        }));
        setModalTitleAddress(place.formatted_address || fullAddress);
        setPanoramaPosition({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
      } else {
        console.warn('[DEBUG] Autocomplete: No place selected or place details (geometry/location/address_components) missing after getPlace(). Place:', place);
      }
    } else {
      console.warn('[DEBUG] onPlaceChangedStreetView: autocompleteRef.current is null.');
    }
  }, [handleModalInputChange, setEditFormData, setModalTitleAddress, setPanoramaPosition, setPanoramaPov]); // Dependencies kept as per your last successful structure

  const columns: ColumnConfig[] = [
    { key: 'contact_name', label: 'Contact Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone', sortable: true },
    { key: 'property_address', label: 'Property Address', sortable: true },
    { key: 'property_city', label: 'City', sortable: true },
    { key: 'property_state', label: 'State', sortable: true },
    { key: 'market_region', label: 'Market', sortable: true },
    { key: 'actions', label: 'Actions' },
  ];

  const totalPages = Math.ceil(leads.length / rowsPerPage); // This might be incorrect if total count isn't fetched
                                                          // For client-side pagination after full fetch, this is fine.
                                                          // If using server-side pagination with limited fetches, need total count from server.

  // For client-side pagination and sorting after fetching all (or filtered) leads
  const sortedLeads = useMemo(() => {
    let sortableLeads = [...leads];
    if (sortConfig !== null) {
      sortableLeads.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof CrmLead] ?? '';
        const bValue = b[sortConfig.key as keyof CrmLead] ?? '';
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableLeads;
  }, [leads, sortConfig]);

  const paginatedLeads = useMemo(() => {
    return sortedLeads.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [sortedLeads, currentPage, rowsPerPage]);


  if (loadError) {
    return <div className="p-4 text-red-600">Error loading Google Maps: {loadError.message}</div>;
  }

  // if (!isLoaded) { // Commented out to allow page rendering while maps loads, modal will handle disabled state
  //   return <div className="p-4">Loading Google Maps...</div>;
  // }


  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold mb-6">CRM Leads Management</h1>

      {/* Controls: Search, Filter, Add New */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* Search Input */}
        <div className="form-control">
          <label className="label"><span className="label-text">Search Leads</span></label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, email, address..."
              className="input input-