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
  const [panoramaPov, setPanoramaPov] = useState<{ heading: number; pitch: number }>({ heading: 0, pitch: 0 });
  const [modalTitleAddress, setModalTitleAddress] = useState<string>('');

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useGoogleMapsApi(); // Use the context hook

  const initialEditFormData: CrmFormData = {
    contact_first_name: '',
    contact_last_name: '',
    contact_email: '',
    phone: '',
    contact_type: 'manual_entry', // Default for manually added leads
    market_region: '',
    property_address: '',
    property_city: '',
    property_state: '',
    property_postal_code: '',
    beds: '',
    baths: '',
    square_footage: '',
    assessed_total: null,
    status: 'New', // Default status
    notes: '',
    normalized_lead_id: 0, // Default or handle as needed
    converted: false,
    email_sent: false,
  };

  const statusOptions = ['New', 'Attempting Contact', 'Contacted', 'Follow-up', 'Scheduled Meeting', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'On Hold', 'Unqualified'];

  const fetchCrmLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase.from('crm_leads').select('*');
      if (marketFilter) {
        query = query.eq('market_region', marketFilter);
      }
      // Add other filters like searchTerm if needed here, before sorting and pagination

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      if (data) {
        setLeads(data as CrmLead[]);
        // Extract unique markets for filter dropdown
        const markets = Array.from(new Set(data.map(lead => lead.market_region).filter(Boolean) as string[]));
        setAvailableMarkets(markets.sort());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch CRM leads.');
      console.error('Fetch CRM leads error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [marketFilter]);

  useEffect(() => {
    fetchCrmLeads();
  }, [fetchCrmLeads]);

  const handleSort = (key: keyof CrmLead | string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedLeads = useMemo(() => {
    let sortableItems = [...leads];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof CrmLead];
        const bVal = b[sortConfig.key as keyof CrmLead];
        if (aVal === null || aVal === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [leads, sortConfig]);

  const filteredLeads = useMemo(() => {
    return sortedLeads.filter(lead =>
      Object.values(lead).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [sortedLeads, searchTerm]);

  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredLeads.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredLeads, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredLeads.length / rowsPerPage);

  const handleOpenAddModal = () => {
    setEditFormData(initialEditFormData);
    setModalTitleAddress('New Lead');
    setPanoramaPosition(null); // No street view for a brand new lead initially
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (lead: CrmLead) => {
    const [firstName, ...lastNameParts] = (lead.contact_name || '').split(' ');
    const lastName = lastNameParts.join(' ');
    
    setEditFormData({
      ...lead,
      contact_first_name: firstName,
      contact_last_name: lastName,
      phone: (lead as any).phone || '', // Assuming phone might be an untyped field for now
    });
    setModalTitleAddress(lead.property_address || 'Edit Lead');
    // Attempt to geocode address for StreetView
    if (lead.property_address && isLoaded) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: lead.property_address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          setPanoramaPosition({ lat: location.lat(), lng: location.lng() });
        } else {
          setPanoramaPosition(null);
          console.warn('Geocode was not successful for the following reason: ' + status);
        }
      });
    } else {
      setPanoramaPosition(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditFormData({}); 
    autocompleteRef.current = null; // Clear autocomplete instance
  };

  const handleModalInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | boolean | null = value;
    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'assessed_total' || name === 'normalized_lead_id') {
      processedValue = value === '' ? null : parseFloat(value);
      if (isNaN(processedValue as number)) processedValue = null;
    }
    setEditFormData(prev => ({ ...prev, [name]: processedValue }));
  };
  
  const onAutocompleteLoad = (ac: google.maps.places.Autocomplete) => {
    autocompleteRef.current = ac;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        setPanoramaPosition({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
        setModalTitleAddress(place.formatted_address || 'Property Location');
      }
      
      const addressComponents = place.address_components;
      let streetNumber = '';
      let route = '';
      const newFormData: Partial<CrmFormData> = {};

      newFormData.property_address = place.formatted_address || '';

      if (addressComponents) {
        for (const component of addressComponents) {
          const types = component.types;
          if (types.includes('street_number')) streetNumber = component.long_name;
          if (types.includes('route')) route = component.long_name;
          if (types.includes('locality')) newFormData.property_city = component.long_name;
          if (types.includes('administrative_area_level_1')) newFormData.property_state = component.short_name;
          if (types.includes('postal_code')) newFormData.property_postal_code = component.long_name;
        }
      }
      // If you want a separate street_address field, you can construct it:
      // newFormData.street_address_line1 = `${streetNumber} ${route}`.trim();

      setEditFormData(prev => ({ 
        ...prev, 
        ...newFormData,
        // property_address is set to full formatted address from autocomplete
      }));
    }
  };

  const handleModalSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const { contact_first_name, contact_last_name, phone, ...restOfFormData } = editFormData;
    const leadDataPayload: Partial<Omit<CrmLead, 'id' | 'created_at' | 'updated_at'>> & { phone?: string } = {
      ...restOfFormData,
      contact_name: `${contact_first_name || ''} ${contact_last_name || ''}`.trim(),
      phone: phone, // Include phone
      // Ensure numeric fields are numbers or null
      assessed_total: typeof editFormData.assessed_total === 'string' ? parseFloat(editFormData.assessed_total) : editFormData.assessed_total,
      normalized_lead_id: typeof editFormData.normalized_lead_id === 'string' ? parseInt(editFormData.normalized_lead_id, 10) : editFormData.normalized_lead_id ?? 0,
    };

    // Remove id from payload if it's for creation
    if (!editFormData.id) {
      delete (leadDataPayload as any).id;
    }

    try {
      let response;
      if (editFormData.id) {
        response = await updateCrmLeadAction(editFormData.id, leadDataPayload as Partial<CrmLead>); // Cast might be needed if phone is not in CrmLead
      } else {
        response = await createCrmLeadAction(leadDataPayload as Partial<Omit<CrmLead, 'id' | 'created_at' | 'updated_at'>>);
      }

      if (response.success) {
        await fetchCrmLeads();
        handleCloseModal();
      } else {
        setError(response.error || 'Failed to save lead.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      console.error('Save lead error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!editFormData.id) return;
    if (!confirm('Are you sure you want to delete this lead?')) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await deleteCrmLeadAction(editFormData.id);
      if (response.success) {
        await fetchCrmLeads();
        handleCloseModal();
      } else {
        setError(response.error || 'Failed to delete lead.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      console.error('Delete lead error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const columns: ColumnConfig[] = [
    { key: 'contact_name', label: 'Contact Name', sortable: true },
    { key: 'property_address', label: 'Property Address', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'market_region', label: 'Market', sortable: true },
    { key: 'contact_email', label: 'Email', sortable: true },
    { key: 'updated_at', label: 'Last Updated', sortable: true },
  ];

  const renderCellContent = (lead: CrmLead, columnKey: keyof CrmLead | string) => {
    const value = lead[columnKey as keyof CrmLead];
    if (columnKey === 'updated_at' || columnKey === 'created_at') {
      return value ? new Date(value as string).toLocaleDateString() : 'N/A';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return value !== null && value !== undefined ? String(value) : 'N/A';
  };

  if (loadError) {
    return <div className="p-4 text-error">Error loading Google Maps: {loadError.message}</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold mb-6">CRM Leads Management</h1>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-xs btn-ghost">
            <XCircle size={16} />
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <button onClick={handleOpenAddModal} className="btn btn-primary">
          <PlusCircle size={18} className="mr-2" /> Add New Lead
        </button>
        <div className="form-control flex-grow min-w-[200px]">
          <input
            type="text"
            placeholder="Search leads..."
            className="input input-bordered w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="form-control min-w-[150px]">
          <select 
            className="select select-bordered w-full"
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
          >
            <option value="">All Markets</option>
            {availableMarkets.map(market => (
              <option key={market} value={market}>{market}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <div className="text-center p-4"><span className="loading loading-spinner loading-lg"></span></div>}

      {!isLoading && paginatedLeads.length === 0 && (
        <p className="text-center text-gray-500 py-8">No CRM leads found.</p>
      )}

      {!isLoading && paginatedLeads.length > 0 && (
        <>
          <div className="overflow-x-auto shadow-lg rounded-lg bg-base-100">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key as string} onClick={() => col.sortable && handleSort(col.key)} className={col.sortable ? 'cursor-pointer hover:bg-base-200' : ''}>
                      {col.label}
                      {col.sortable && sortConfig && sortConfig.key === col.key && (
                        sortConfig.direction === 'ascending' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />
                      )}
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map((lead) => (
                  <tr key={lead.id} className="hover" onClick={() => handleOpenEditModal(lead)}>
                    {columns.map(col => (
                      <td key={`${lead.id}-${col.key as string}`}>{renderCellContent(lead, col.key)}</td>
                    ))}
                    <td onClick={(e) => e.stopPropagation()}> {/* Prevent row click from triggering on action buttons */}
                      <button onClick={() => handleOpenEditModal(lead)} className="btn btn-xs btn-ghost text-blue-500">
                        <Edit3 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap justify-between items-center gap-4">
            <div className="form-control">
              <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="select select-bordered select-sm">
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            <div className="join">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="join-item btn btn-sm">«</button>
              <button className="join-item btn btn-sm">Page {currentPage} of {totalPages}</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="join-item btn btn-sm">»</button>
            </div>
          </div>
        </>
      )}

      {isModalOpen && (
        <div className={`modal modal-open ${isLoaded ? '' : 'pointer-events-none'}`}> {/* Disable interaction if maps not loaded */}
          <div className="modal-box w-11/12 max-w-3xl bg-base-200 shadow-xl rounded-lg">
            <button onClick={handleCloseModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-20">✕</button>
            <h3 className="font-bold text-lg mb-1 flex items-center">
              <MapPin size={20} className="mr-2 text-primary" /> 
              {modalTitleAddress}
            </h3>
            
            {isLoaded && panoramaPosition && (
              <div className="w-full h-64 mb-4 rounded-md overflow-hidden border border-base-300">
                <StreetViewPanorama
                  position={panoramaPosition}
                  pov={panoramaPov}
                  visible={true}
                  options={{ addressControl: true, enableCloseButton: false, fullscreenControl: false, linksControl: false, panControl: true, zoomControl: true }}
                  onPovChanged={(pov) => pov && setPanoramaPov(pov)}
                />
              </div>
            )}
            {isLoaded && !panoramaPosition && editFormData.property_address && (
                 <div className="w-full h-64 mb-4 rounded-md overflow-hidden border border-base-300 flex items-center justify-center bg-gray-100 text-gray-500">
                    Street View not available or address not found.
                 </div>
            )}
            {!isLoaded && <div className="w-full h-64 mb-4 flex items-center justify-center"><span className="loading loading-spinner"></span> Loading Maps...</div>}

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <h4 className="text-md font-semibold mt-2 border-b pb-1 text-primary">LOCATION</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal-status" className="label"><span className="label-text">Status</span></label>
                  <select id="modal-status" name="status" value={editFormData.status || ''} onChange={handleModalInputChange} className="select select-bordered w-full">
                    {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="modal-property_address" className="label"><span className="label-text">Property Address (type to search)</span></label>
                  {isLoaded && (
                    <Autocomplete
                      onLoad={onAutocompleteLoad}
                      onPlaceChanged={onPlaceChanged}
                      options={{ types: ['address'] }}
                    >
                      <input 
                        type="text" 
                        id="modal-property_address" 
                        name="property_address" 
                        defaultValue={editFormData.property_address || ''} 
                        className="input input-bordered w-full" 
                        placeholder="Start typing an address..."
                      />
                    </Autocomplete>
                  )}
                  {!isLoaded && <input type="text" defaultValue={editFormData.property_address || ''} className="input input-bordered w-full" placeholder="Maps loading..." disabled />}
                </div>
                {/* Street Address, City, State, Zip will be auto-filled by Autocomplete, but can be editable */}
                <div>
                  <label htmlFor="modal-property_city" className="label"><span className="label-text">City</span></label>
                  <input type="text" id="modal-property_city" name="property_city" value={editFormData.property_city || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div>
                  <label htmlFor="modal-property_state" className="label"><span className="label-text">State</span></label>
                  <input type="text" id="modal-property_state" name="property_state" value={editFormData.property_state || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div>
                  <label htmlFor="modal-property_postal_code" className="label"><span className="label-text">Zip Code</span></label>
                  <input type="text" id="modal-property_postal_code" name="property_postal_code" value={editFormData.property_postal_code || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                 <div>
                  <label htmlFor="modal-assessed_total" className="label"><span className="label-text">Appraised Value</span></label>
                  <input type="number" step="any" id="modal-assessed_total" name="assessed_total" value={editFormData.assessed_total || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
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
                  <label htmlFor="modal-square_footage" className="label"><span className="label-text">SQ FT</span></label>
                  <input type="text" id="modal-square_footage" name="square_footage" value={editFormData.square_footage || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
              </div>

              <h4 className="text-md font-semibold mt-6 border-b pb-1 text-primary">CONTACT</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal-contact_first_name" className="label"><span className="label-text">First Name</span></label>
                  <input type="text" id="modal-contact_first_name" name="contact_first_name" value={editFormData.contact_first_name || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div>
                  <label htmlFor="modal-contact_last_name" className="label"><span className="label-text">Last Name</span></label>
                  <input type="text" id="modal-contact_last_name" name="contact_last_name" value={editFormData.contact_last_name || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div>
                  <label htmlFor="modal-contact_email" className="label"><span className="label-text">Email</span></label>
                  <input type="email" id="modal-contact_email" name="contact_email" value={editFormData.contact_email || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
                <div>
                  <label htmlFor="modal-phone" className="label"><span className="label-text">Phone</span></label>
                  <input type="tel" id="modal-phone" name="phone" value={editFormData.phone || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
                </div>
              </div>

              <h4 className="text-md font-semibold mt-6 border-b pb-1 text-primary">NOTES</h4>
              <div>
                <label htmlFor="modal-notes" className="label"><span className="label-text">Notes</span></label>
                <textarea id="modal-notes" name="notes" value={editFormData.notes || ''} onChange={handleModalInputChange} className="textarea textarea-bordered w-full" rows={3}></textarea>
              </div>
              
              {/* Hidden or less prominent fields if needed, e.g., market_region, normalized_lead_id */}
              {/* Example: 
              <div>
                <label htmlFor="modal-market_region" className="label"><span className="label-text">Market Region</span></label>
                <input type="text" id="modal-market_region" name="market_region" value={editFormData.market_region || ''} onChange={handleModalInputChange} className="input input-bordered w-full" />
              </div>
              */}

              <div className="modal-action mt-8 flex justify-between items-center">
                <div> {/* Delete button on the left */}
                  {editFormData.id && (
                    <button type="button" onClick={handleDeleteLead} className="btn btn-error btn-outline" disabled={isSaving} style={{backgroundColor: '#FF6B6B', color: 'white'}}>
                      <Trash2 size={16}/> DELETE LEAD
                    </button>
                  )}
                </div>
                <div className="flex gap-2"> {/* Cancel and Save/Update buttons on the right */}
                  <button type="button" onClick={handleCloseModal} className="btn btn-ghost" disabled={isSaving}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={isSaving} style={{backgroundColor: '#3B82F6', color: 'white'}}>
                    <Save size={16}/> {isSaving ? 'Saving...' : (editFormData.id ? 'UPDATE LEAD' : 'SAVE LEAD')}
                  </button>
                </div>
              </div>
            </form>
          </div>
          {/* Click outside to close, if not using modal-backdrop form method */}
          {/* <div className="modal-backdrop fixed inset-0 bg-black opacity-50 z-0" onClick={handleCloseModal}></div> */}
        </div>
      )}
    </div>
  );
};

export default CrmView;
