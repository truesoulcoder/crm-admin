// src/components/crm/CrmTable.tsx
'use client';

import { Autocomplete } from '@react-google-maps/api';
import { Table, flexRender } from '@tanstack/react-table';
import { ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';

// Re-export Lead and StatusOption if they are defined here and used by CrmView
// Otherwise, CrmView should import them from their original source (e.g., a types file)
export interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  property_address_full?: string;
  property_address_street?: string;
  property_address_city?: string;
  property_address_state?: string;
  property_address_zip?: string;
  avm_value?: number;
  beds?: number;
  baths?: number;
  sq_ft?: number;
  notes?: string;
  mls_curr_status?: string;
  mls_curr_days_on_market?: string;
  market_region?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_postal_code?: string;
}

export interface StatusOption { // This might not be needed in CrmTable if CrmView handles status display logic
  value: string;
  label: string;
  color: string;
}

interface CrmTableProps {
  tableInstance: Table<Lead>;
  leads: Lead[]; 
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  marketRegionFilter: string;
  setMarketRegionFilter: React.Dispatch<React.SetStateAction<string>>;
  filteredLeadsCount: number;
  isFormOpen: boolean;
  setIsFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentLead: Lead | null;
  setCurrentLead: React.Dispatch<React.SetStateAction<Lead | null>>;
  formData: Partial<Lead>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Lead>>>;
  handleFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  handleDeleteLead: (leadId: string) => Promise<void>;
  formError: string | null;
  isSubmitting: boolean;
  addressInputRef: React.RefObject<HTMLInputElement | null>;
  getDisplayName: (lead: Partial<Lead>) => string;
  handleEditLead: (lead: Lead) => void; 
  initialFormData: Partial<Lead>;
  statusOptions: StatusOption[];
}

const CrmTable: React.FC<CrmTableProps> = ({
  tableInstance,
  isLoading,
  error,
  handleEditLead,
  isFormOpen,
  setIsFormOpen,
  currentLead,
  formData,
  setFormData,
  handleFormChange,
  handleSubmit,
  handleDeleteLead,
  formError,
  isSubmitting,
  addressInputRef,
  getDisplayName,
  initialFormData,
  statusOptions,
  // Unused props from CrmView, but defined in interface for completeness
  // leads, searchTerm, setSearchTerm, marketRegionFilter, setMarketRegionFilter, filteredLeadsCount, setCurrentLead 
}) => {
  const [autocompleteInstance, setAutocompleteInstance] = useState<google.maps.places.Autocomplete | null>(null);

  const onLoadAutocomplete = (autocomplete: google.maps.places.Autocomplete) => {
    setAutocompleteInstance(autocomplete);
  };

  const onPlaceChanged = () => {
    if (autocompleteInstance) {
      const place = autocompleteInstance.getPlace();
      if (place.address_components) {
        const getAddressComponent = (type: string, useShortName: boolean = false) => {
          const component = place.address_components?.find(c => c.types.includes(type));
          return component ? (useShortName ? component.short_name : component.long_name) : '';
        };

        const street_number = getAddressComponent('street_number');
        const route = getAddressComponent('route');
        const locality = getAddressComponent('locality'); // city
        const administrative_area_level_1 = getAddressComponent('administrative_area_level_1', true); // state (short)
        const postal_code = getAddressComponent('postal_code');
        // const country = getAddressComponent('country', true); // country (short)

        const streetAddress = `${street_number} ${route}`.trim();
        const fullAddress = place.formatted_address || '';

        setFormData((prev: Partial<Lead>) => ({
          ...prev,
          property_address_street: streetAddress,
          property_address_city: locality,
          property_address_state: administrative_area_level_1,
          property_address_zip: postal_code,
          property_address_full: fullAddress,
        }));
      } else if (place.formatted_address) {
        setFormData((prev: Partial<Lead>) => ({
            ...prev,
            property_address_full: place.formatted_address,
            property_address_street: '',
            property_address_city: '',
            property_address_state: '',
            property_address_zip: '',
         }));
      }
    } else {
      console.log('Autocomplete is not loaded yet!');
    }
  };
  const {
    getHeaderGroups,
    getRowModel,
    getCanPreviousPage,
    getCanNextPage,
    getPageCount,
    setPageIndex,
    nextPage,
    previousPage,
    setPageSize,
    getState,
  } = tableInstance;

  const { pageIndex, pageSize } = getState().pagination;
  const pageCount = getPageCount();
  const canPreviousPage = getCanPreviousPage();
  const canNextPage = getCanNextPage();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <span className="loading loading-lg loading-spinner text-primary"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error shadow-lg mb-4">
        <div>
          <AlertCircle size={24} />
          <span><strong>Error:</strong> {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-table-container">
      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table table-zebra w-full">
          <thead>
            {getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-base-300">
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    colSpan={header.colSpan} 
                    className="p-3 cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      <span className="ml-2">
                        {header.column.getIsSorted() === 'asc' ? <ChevronUp size={16} /> :
                         header.column.getIsSorted() === 'desc' ? <ChevronDown size={16} /> : null}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {getRowModel().rows.map(row => (
              <tr 
                key={row.id} 
                className="hover:bg-base-200 cursor-pointer" 
                onClick={() => handleEditLead(row.original)}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="p-3 border-b border-base-300 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={tableInstance.getAllColumns().length} className="text-center p-4">
                  No leads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Lead Edit/Add Modal Form */}
      {isFormOpen && (
        <dialog id="lead_form_modal" className={`modal modal-open`}>
          <form method="dialog" className="modal-box w-11/12 max-w-3xl" onSubmit={(e) => { e.preventDefault(); void handleSubmit(e); }}>
            <h3 className="font-bold text-lg mb-4">
              {currentLead ? `Edit Lead: ${getDisplayName(currentLead)}` : 'Add New Lead'}
            </h3>

            {formError && (
              <div className="alert alert-error shadow-lg mb-4">
                <div>
                  <AlertCircle size={20} />
                  <span>{formError}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label htmlFor="first_name" className="label">
                  <span className="label-text">First Name</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  id="first_name"
                  value={formData.first_name || ''}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                />
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="last_name" className="label">
                  <span className="label-text">Last Name</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  id="last_name"
                  value={formData.last_name || ''}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="label">
                  <span className="label-text">Email</span>
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email || ''}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="label">
                  <span className="label-text">Phone</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  value={formData.phone || ''}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                />
              </div>

              {/* Full Property Address with Autocomplete */}
              <div className="md:col-span-2">
                <label htmlFor="property_address_full_autocomplete" className="label">
                  <span className="label-text">Property Address</span>
                </label>
                <Autocomplete
                  onLoad={onLoadAutocomplete}
                  onPlaceChanged={onPlaceChanged}
                  options={{
                    types: ['address'],
                    fields: ['address_components', 'formatted_address', 'geometry', 'name'],
                  }}
                >
                  <input
                    type="text"
                    id="property_address_full_autocomplete"
                    name="property_address_full" // Name matches formData key for direct updates
                    placeholder="Start typing an address..."
                    defaultValue={formData.property_address_full || ''} // For initial display
                    onChange={handleFormChange} // Allows manual typing to update formData.property_address_full
                    ref={addressInputRef} // Attach the ref here
                    className="input input-bordered w-full"
                  />
                </Autocomplete>
              </div>

              {/* Street Address (potentially read-only or hidden if Autocomplete is primary) */}
              <div>
                <label htmlFor="property_address_street" className="label">
                  <span className="label-text">Street</span>
                </label>
                <input
                  type="text"
                  name="property_address_street"
                  id="property_address_street"
                  value={formData.property_address_street || ''}
                  onChange={handleFormChange} // Or make read-only if purely derived from Autocomplete
                  className="input input-bordered w-full"
                />
              </div>

              {/* City */}
              <div>
                <label htmlFor="property_address_city" className="label">
                  <span className="label-text">City</span>
                </label>
                <input
                  type="text"
                  name="property_address_city"
                  id="property_address_city"
                  value={formData.property_address_city || ''}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                />
              </div>

              {/* State */}
              <div>
                <label htmlFor="property_address_state" className="label">
                  <span className="label-text">State</span>
                </label>
                <input
                  type="text"
                  name="property_address_state"
                  id="property_address_state"
                  value={formData.property_address_state || ''}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                />
              </div>

              {/* Zip Code */}
              <div>
                <label htmlFor="property_address_zip" className="label">
                  <span className="label-text">Zip Code</span>
                </label>
                <input
                  type="text"
                  name="property_address_zip"
                  id="property_address_zip"
                  value={formData.property_address_zip || ''}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                />
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="label">
                  <span className="label-text">Status</span>
                </label>
                <select
                  name="status"
                  id="status"
                  value={formData.status || 'NEW'}
                  onChange={handleFormChange}
                  className="select select-bordered w-full"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Market Region */}
              <div>
                <label htmlFor="market_region" className="label">
                  <span className="label-text">Market Region</span>
                </label>
                <input
                  type="text"
                  name="market_region"
                  id="market_region"
                  value={formData.market_region || ''}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                />
              </div>

              {/* AVM Value */}
              <div>
                <label htmlFor="avm_value" className="label">
                  <span className="label-text">AVM ($)</span>
                </label>
                <input
                  type="number"
                  name="avm_value"
                  id="avm_value"
                  value={formData.avm_value === undefined ? '' : formData.avm_value}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                  step="any"
                />
              </div>
              
              {/* Beds */}
              <div>
                <label htmlFor="beds" className="label">
                  <span className="label-text">Beds</span>
                </label>
                <input
                  type="number"
                  name="beds"
                  id="beds"
                  value={formData.beds === undefined ? '' : formData.beds}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                  step="1"
                />
              </div>

              {/* Baths */}
              <div>
                <label htmlFor="baths" className="label">
                  <span className="label-text">Baths</span>
                </label>
                <input
                  type="number"
                  name="baths"
                  id="baths"
                  value={formData.baths === undefined ? '' : formData.baths}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                  step="0.1"
                />
              </div>

              {/* Square Feet */}
              <div>
                <label htmlFor="sq_ft" className="label">
                  <span className="label-text">Sq Ft</span>
                </label>
                <input
                  type="number"
                  name="sq_ft"
                  id="sq_ft"
                  value={formData.sq_ft === undefined ? '' : formData.sq_ft}
                  onChange={handleFormChange}
                  className="input input-bordered w-full"
                  step="1"
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label htmlFor="notes" className="label">
                  <span className="label-text">Notes</span>
                </label>
                <textarea
                  name="notes"
                  id="notes"
                  value={formData.notes || ''}
                  onChange={handleFormChange}
                  className="textarea textarea-bordered w-full h-24"
                ></textarea>
              </div>
            </div>

            <div className="modal-action mt-6">
              <button 
                type="button" 
                className="btn btn-ghost mr-2" 
                onClick={() => {
                  setIsFormOpen(false);
                  // setFormData(initialFormData); // Reset form on close if desired
                }}
              >
                Cancel
              </button>
              {currentLead && (
                <button
                  type="button"
                  className="btn btn-error mr-2"
                  onClick={() => { void handleDeleteLead(currentLead!.id); }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <span className="loading loading-spinner loading-xs"></span> : 'Delete'}
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner loading-xs"></span> : (currentLead ? 'Save Changes' : 'Add Lead')}
              </button>
            </div>
          </form>
        </dialog>
      )}

      {/* Pagination Controls */} 
      {getRowModel().rows.length > 0 && pageCount > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-base-100 rounded-lg shadow">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPageIndex(0)} 
              disabled={!canPreviousPage}
              className="btn btn-sm btn-outline"
              aria-label="Go to first page"
            >
              {'<<'}
            </button>
            <button 
              onClick={() => previousPage()} 
              disabled={!canPreviousPage}
              className="btn btn-sm btn-outline"
              aria-label="Go to previous page"
            >
              {'<'}
            </button>
            <span className="text-sm">
              Page{' '}
              <strong>
                {pageIndex + 1} of {pageCount}
              </strong>
            </span>
            <button 
              onClick={() => nextPage()} 
              disabled={!canNextPage}
              className="btn btn-sm btn-outline"
              aria-label="Go to next page"
            >
              {'>'}
            </button>
            <button 
              onClick={() => setPageIndex(pageCount - 1)} 
              disabled={!canNextPage}
              className="btn btn-sm btn-outline"
              aria-label="Go to last page"
            >
              {'>>'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Go to page:</span>
            <input
              type="number"
              defaultValue={pageIndex + 1}
              min={1}
              max={pageCount}
              onChange={e => {
                const pageNum = e.target.value ? Number(e.target.value) - 1 : 0;
                if (pageNum >= 0 && pageNum < pageCount) {
                  setPageIndex(pageNum);
                }
              }}
              className="input input-sm input-bordered w-20 text-center"
              aria-label="Go to specific page"
            />
          </div>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
            }}
            className="select select-sm select-bordered"
            aria-label="Select page size"
          >
            {[10, 25, 50, 100].map(size => (
              <option key={size} value={size}>
                Show {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default CrmTable;