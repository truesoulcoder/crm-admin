'use client';

import { Autocomplete, StreetViewPanorama } from '@react-google-maps/api';
import { ChevronUp, ChevronDown, Edit3, Trash2, PlusCircle, Search, AlertTriangle, XCircle, Save, MapPin } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, FormEvent, useRef } from 'react';
import { toast } from 'react-hot-toast';

import { createCrmLeadAction, updateCrmLeadAction, deleteCrmLeadAction } from '@/app/crm/actions';
import { useGoogleMapsApi } from '@/components/maps/GoogleMapsLoader';
import { supabase } from '@/lib/supabase/client';

import type { CrmLead } from '@/types/crm';

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
  contact_type?: string; // Added contact type
  beds?: number; // Change to number | undefined
  baths?: number; // Change to number | undefined
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

  const columnConfigurations: ColumnConfig[] = [
    { key: 'contact_name', label: 'Contact Name', sortable: true },
    { key: 'contact_email', label: 'Email', sortable: true },
    { key: 'property_address', label: 'Property Address', sortable: true },
    { key: 'market_region', label: 'Market', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'created_at', label: 'Date Added', sortable: true },
  ];


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
    contact_email: '',
    phone: '', // Added phone
    contact_type: 'Owner', // Ensure contact_type is populated
    market_region: '', // Added for completeness, might be set differently
    property_address: '',
    property_city: '',
    property_state: '',
    property_postal_code: '',
    property_type: '',
    beds: undefined, // Initialize as undefined
    baths: undefined, // Initialize as undefined
    year_built: '',
    square_footage: undefined,
    lot_size: undefined,
    last_sale_date: '',
    last_sale_price: undefined,
    owner_name: '',
    owner_mailing_address: '',
    owner_mailing_city: '',
    owner_mailing_state: '',
    owner_mailing_postal_code: '',
    owner_occupied: false,
    notes: '',
    tags: [],
    custom_fields: {},
  };

  const handleOpenModal = (lead?: CrmLead, normalizedLeadId?: number) => {
    if (lead) {
      let firstName = '';
      let lastName = '';
      if (lead.contact_name) {
        const nameParts = lead.contact_name.trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      const formData: CrmFormData = {
        // Spread all properties from lead first
        id: lead.id,
        contact_email: lead.contact_email || '',
        phone: lead.phone || '',
        contact_type: lead.contact_type || 'Owner', // Ensure contact_type is populated
        market_region: lead.market_region || '',
        property_address: lead.property_address || '',
        property_city: lead.property_city || '',
        property_state: lead.property_state || '',
        property_postal_code: lead.property_postal_code || '',
        property_type: lead.property_type || '',
        beds: lead.beds === null ? undefined : lead.beds, // Handle null for numeric fields
        baths: lead.baths === null ? undefined : lead.baths,
        year_built: lead.year_built || '',
        square_footage: lead.square_footage === null ? undefined : lead.square_footage,
        lot_size_sqft: lead.lot_size_sqft || '',
        assessed_total: lead.assessed_total === null ? undefined : lead.assessed_total,
        mls_curr_status: lead.mls_curr_status || '',
        mls_curr_days_on_market: lead.mls_curr_days_on_market || '',
        converted: lead.converted || false,
        status: lead.status || '',
        notes: lead.notes || '',
        // Then set the split names
        contact_first_name: firstName,
        contact_last_name: lastName,
      };
      setEditFormData(formData);
      const addressDisplayParts = [];
      if (lead.property_address && lead.property_address.trim()) {
        addressDisplayParts.push(lead.property_address.trim());
      }
      if (lead.property_city && lead.property_city.trim()) {
        addressDisplayParts.push(lead.property_city.trim());
      }
      if (lead.property_state && lead.property_state.trim()) {
        addressDisplayParts.push(lead.property_state.trim());
      }

      let constructedTitleAddress = addressDisplayParts.join(', ');

      if (lead.property_postal_code && lead.property_postal_code.trim()) {
        const trimmedPostalCode = lead.property_postal_code.trim();
        if (constructedTitleAddress) {
          constructedTitleAddress = `${constructedTitleAddress} ${trimmedPostalCode}`;
        } else {
          constructedTitleAddress = trimmedPostalCode;
        }
      }
      const titleAddr = constructedTitleAddress;
      setModalTitleAddress(titleAddr);

      if (lead.property_address && isLoaded && window.google && window.google.maps && window.google.maps.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        const fullAddress = `${lead.property_address}, ${lead.property_city}, ${lead.property_state} ${lead.property_postal_code}`;
        geocoder.geocode({ address: fullAddress }, (results, status) => {
          if (status === 'OK' && results && results[0] && results[0].geometry && results[0].geometry.location) {
            setPanoramaPosition({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
          } else {
            console.warn(`Geocode was not successful for existing lead: ${status}`);
            setPanoramaPosition(null);
          }
        }).catch(error => {
          console.error('Error in geocode Promise:', error);
          setPanoramaPosition(null); // Ensure panorama is cleared on such errors
        });
      } else {
        if (!isLoaded) console.warn('Google Maps API not loaded. Cannot fetch panorama.');
        setPanoramaPosition(null);
      }
    } else {
      setEditFormData({
        ...initialEditFormData,
      });
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

    // Combine first and last name into contact_name
    const contact_name = `${editFormData.contact_first_name || ''} ${editFormData.contact_last_name || ''}`.trim();

    // Prepare the object to be saved, excluding frontend-only fields
    const { contact_first_name, contact_last_name, ...dataForBackend } = editFormData;
    const leadDataToSave = {
      ...dataForBackend,
      contact_name: contact_name || null, // Ensure contact_name is null if empty, matching DB schema
      contact_type: editFormData.contact_type || 'Owner', // Ensure contact_type has a default if somehow empty
    };

    if (!leadDataToSave.id) {
      delete leadDataToSave.id;
    }

    try {
      let successOp = false; // Use a different variable name to avoid conflict if 'success' is used elsewhere
      // Remove frontend-only fields before sending to backend
      const finalDataForAction = { ...leadDataToSave };
      delete (finalDataForAction as any).contact_first_name;
      delete (finalDataForAction as any).contact_last_name;

      if (editFormData.id) {
        const result = await updateCrmLeadAction(editFormData.id, finalDataForAction);
        if (result.error) throw new Error(result.error);
        if (result.data) {
            successOp = true;
        } else {
            await fetchLeads(); 
        }
      } else {
        // For new leads, ensure id is not sent
        const { id, ...createData } = finalDataForAction;
        const result = await createCrmLeadAction(createData as typeof createData & { id?: undefined });
        if (result.error) throw new Error(result.error);
        if (result.data) {
          successOp = true;
        } else {
          await fetchLeads(); 
        }
      }

      if (successOp) {
        toast.success(editFormData.id ? 'Lead updated successfully!' : 'Lead created successfully!');
        await fetchLeads(); // Ensure data consistency
        handleCloseModal();
      }
    } catch (e: unknown) {
      console.error('Error saving lead:', e);
      if (e instanceof Error) {
        setError(`Failed to save lead: ${e.message}`);
      } else {
        setError('An unknown error occurred while saving the lead.');
      }
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
  }, [setEditFormData, setModalTitleAddress, setPanoramaPosition]); // Dependencies kept as per your last successful structure

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
    const sortableLeads = [...leads];
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
              className="input input-bordered w-full"
              value={searchTerm}
              onChange={handleSearchChange} />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Search className="h-5 w-5 text-gray-400" />
            </span>
          </div>
        </div>

        {/* Market Region Filter */}
        <div className="form-control">
          <label className="label"><span className="label-text">Filter by Market</span></label>
          <select
            className="select select-bordered w-full"
            value={marketFilter}
            onChange={handleMarketFilterChange}
          >
            <option value="">All Markets</option> {/* Assuming empty string for 'All' to match marketFilter initial state '' */}
            {availableMarkets.map((region: string) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>

        {/* Add New Lead Button */}
        <div className="form-control">
          <button
            className="btn btn-primary w-full md:w-auto md:justify-self-end"
            onClick={() => handleOpenModal()}
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Add New Lead
          </button>
        </div>
      </div>
      {/* Leads Table */}
      <div className="overflow-x-auto bg-base-100 shadow-lg rounded-lg mt-6">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              {columnConfigurations.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-base-200' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {col.sortable && sortConfig && sortConfig.key === col.key && (
                    sortConfig.direction === 'ascending' ? <ChevronUp className="inline w-4 h-4 ml-1" /> : <ChevronDown className="inline w-4 h-4 ml-1" />
                  )}
                  {col.sortable && (!sortConfig || sortConfig.key !== col.key) && (
                    <ChevronDown className="inline w-4 h-4 ml-1 text-gray-300" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={columnConfigurations.length} className="text-center p-4"><span className="loading loading-spinner"></span> Loading leads...</td></tr>
            )}
            {!isLoading && error && (
              <tr><td colSpan={columnConfigurations.length} className="text-center p-4 text-error">{error}</td></tr>
            )}
            {!isLoading && !error && leads.length === 0 && (
              <tr><td colSpan={columnConfigurations.length} className="text-center p-4">No leads found. Adjust filters or add new leads.</td></tr>
            )}
            {!isLoading && !error && leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-base-200 cursor-pointer" onClick={() => handleOpenModal(lead)}>
                {columnConfigurations.map(col => (
                  <td key={`${lead.id}-${col.key}`} className="px-4 py-3 whitespace-nowrap text-sm">
                    {col.key === 'created_at' || col.key === 'updated_at'
                      ? new Date(lead[col.key as keyof CrmLead] as string).toLocaleDateString()
                      : String(lead[col.key as keyof CrmLead] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!isLoading && !error && (leads.length > 0 || currentPage > 1) && (
        <div className="mt-6 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={handleRowsPerPageChange}
              className="select select-bordered select-sm"
              disabled={isLoading}
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">
              Page {currentPage}
            </span>
            <div className="join">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className="join-item btn btn-sm btn-outline"
              >
                « Prev
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={leads.length < rowsPerPage || isLoading}
                className="join-item btn btn-sm btn-outline"
              >
                Next »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Adding/Editing Leads */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-4xl">
            <button onClick={handleCloseModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            <h3 className="font-bold text-lg mb-4">{modalTitleAddress || (editFormData.id ? 'Edit Lead' : 'Add New Lead')}</h3>
            
            <form onSubmit={(e) => { e.preventDefault(); void handleFormSubmit(e); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact Info */}
                <div>
                  <label className="label"><span className="label-text">First Name</span></label>
                  <input type="text" name="contact_first_name" placeholder="First Name" className="input input-bordered w-full" value={editFormData.contact_first_name || ''} onChange={handleModalInputChange} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Last Name</span></label>
                  <input type="text" name="contact_last_name" placeholder="Last Name" className="input input-bordered w-full" value={editFormData.contact_last_name || ''} onChange={handleModalInputChange} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Email</span></label>
                  <input type="email" name="contact_email" placeholder="Email" className="input input-bordered w-full" value={editFormData.contact_email || ''} onChange={handleModalInputChange} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Phone</span></label>
                  <input type="tel" name="phone" placeholder="Phone" className="input input-bordered w-full" value={editFormData.phone || ''} onChange={handleModalInputChange} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Contact Type</span></label>
                  <select name="contact_type" className="select select-bordered w-full" value={editFormData.contact_type || 'Owner'} onChange={handleModalInputChange}>
                    <option value="Owner">Owner</option>
                    <option value="Agent">Agent</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Property Info */}
              <h4 className="text-md font-semibold mt-4">Property Information</h4>
              <div>
                <label className="label"><span className="label-text">Property Address</span></label>
                {isLoaded ? (
                  <Autocomplete
                    onLoad={(ref) => autocompleteRef.current = ref}
                    onPlaceChanged={onPlaceChangedStreetView}
                    options={{ fields: ['address_components', 'formatted_address', 'geometry', 'name'], types: ['address'] }}
                  >
                    <input type="text" name="property_address" placeholder="Enter Property Address" className="input input-bordered w-full" defaultValue={editFormData.property_address || ''} onChange={handleModalInputChange} />
                  </Autocomplete>
                ) : (
                  <input type="text" name="property_address" placeholder="Enter Property Address (Maps loading...)" className="input input-bordered w-full" value={editFormData.property_address || ''} onChange={handleModalInputChange} disabled />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label"><span className="label-text">City</span></label>
                  <input type="text" name="property_city" placeholder="City" className="input input-bordered w-full" value={editFormData.property_city || ''} onChange={handleModalInputChange} />
                </div>
                <div>
                  <label className="label"><span className="label-text">State</span></label>
                  <input type="text" name="property_state" placeholder="State" className="input input-bordered w-full" value={editFormData.property_state || ''} onChange={handleModalInputChange} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Postal Code</span></label>
                  <input type="text" name="property_postal_code" placeholder="Postal Code" className="input input-bordered w-full" value={editFormData.property_postal_code || ''} onChange={handleModalInputChange} />
                </div>
              </div>
               <div>
                  <label className="label"><span className="label-text">Property Type</span></label>
                  <input type="text" name="property_type" placeholder="e.g., Single Family" className="input input-bordered w-full" value={editFormData.property_type || ''} onChange={handleModalInputChange} />
                </div>

              {/* Street View Panorama - Only if position is set */}
              {isLoaded && panoramaPosition && (
                <div className="mt-4 h-64 w-full bg-gray-200 rounded">
                  <StreetViewPanorama
                    options={{ visible: true, position: panoramaPosition, controlSize: 20, enableCloseButton: false, addressControl: false, linksControl: false, panControl: true, zoomControl: true, scrollwheel: true }}
                  />
                </div>
              )}
              {!isLoaded && <p className='text-xs text-gray-500'>Google Street View loading...</p>}
              {isLoaded && !panoramaPosition && editFormData.id && <p className='text-xs text-gray-500'>Street View not available or address not geocoded.</p>}

              {/* Notes */}
              <div>
                <label className="label"><span className="label-text">Notes</span></label>
                <textarea name="notes" placeholder="Notes about the lead..." className="textarea textarea-bordered w-full" value={editFormData.notes || ''} onChange={handleModalInputChange}></textarea>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="modal-action mt-6">
                {/* Delete Button - visible but disabled if no ID or saving */}
                <button 
                  type="button" 
                  onClick={() => { void handleDeleteLead(); }} 
                  className={`btn btn-error mr-auto ${!editFormData.id ? 'btn-disabled' : ''}`} 
                  disabled={!editFormData.id || isSaving}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </button>
                <button type="button" onClick={handleCloseModal} className="btn btn-ghost" disabled={isSaving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving || !isLoaded}>
                  {isSaving ? <span className="loading loading-spinner loading-xs"></span> : <Save className="mr-2 h-4 w-4" />} 
                  {editFormData.id ? 'Save Changes' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div> 
  );
}

export default CrmView;