// src/components/crm/CrmTable.tsx
'use client';

import React, { useRef, ChangeEvent } from 'react';
import {
  PlusCircle, Search, X, ChevronUp, ChevronDown, AlertCircle, Save, Trash2
} from 'lucide-react';
import {
  TableInstance,
  HeaderGroup,
  Row,
  Column as ReactTableColumn, // Renamed to avoid conflict with local Column
  Cell,
  UsePaginationInstanceProps,
  UsePaginationState,
  UseSortByInstanceProps,
} from 'react-table';

// Types (ideally, move to a shared types file later)
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
  // Legacy or alternative fields
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_postal_code?: string;
}

export interface StatusOption {
  value: string;
  label: string;
  color: string;
}

// Props interface for CrmTable
interface CrmTableProps extends UsePaginationInstanceProps<Lead>, UseSortByInstanceProps<Lead> {
  leads: Lead[]; // The raw leads data for filtering market regions
  columns: ReactTableColumn<Lead>[]; // react-table columns definition
  isLoading: boolean;
  error: string | null;
  
  // Search and Filter
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  marketRegionFilter: string;
  setMarketRegionFilter: (region: string) => void;

  // React Table instance methods and state
  // getTableProps, getTableBodyProps, headerGroups, page, prepareRow are from TableInstance
  // We'll also need pagination props:
  // canPreviousPage, canNextPage, pageOptions, pageCount, gotoPage, nextPage, previousPage, setPageSize, state: { pageIndex, pageSize }
  
  // Form and Modal state and handlers
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
  currentLead: Lead | null;
  setCurrentLead: (lead: Lead | null) => void;
  formData: Partial<Lead>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Lead>>>;
  handleFormChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>; // Adjusted, original took more params
  handleDeleteLead: (leadId: string) => Promise<void>; // Adjusted
  formError: string | null;
  isSubmitting: boolean;
  
  // Refs and utility functions
  addressInputRef: React.RefObject<HTMLInputElement>;
  getDisplayName: (lead: Lead) => string;
  handleEditLead: (lead: Lead) => void;
  
  // Constants passed from parent
  initialFormData: Partial<Lead>;
  statusOptions: StatusOption[];

  // Table instance
  tableInstance: TableInstance<Lead> & UsePaginationInstanceProps<Lead> & UseSortByInstanceProps<Lead> & { state: UsePaginationState<Lead> };
  filteredLeadsCount: number; // For pagination condition
}

const CrmTable: React.FC<CrmTableProps> = ({
  leads,
  // columns, // columns are part of tableInstance
  isLoading,
  error,
  searchTerm,
  setSearchTerm,
  marketRegionFilter,
  setMarketRegionFilter,
  
  tableInstance,
  filteredLeadsCount,

  isFormOpen,
  setIsFormOpen,
  currentLead,
  setCurrentLead,
  formData,
  setFormData, // Pass setFormData directly
  handleFormChange,
  handleSubmit,
  handleDeleteLead,
  formError,
  isSubmitting,
  
  addressInputRef,
  getDisplayName,
  handleEditLead,
  
  initialFormData,
  statusOptions,
}) => {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    canPreviousPage,
    canNextPage,
    pageOptions,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize },
  } = tableInstance;

  return (
    <div className="p-4 md:p-6 bg-base-200 min-h-screen text-base-content">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">CRM Leads</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setCurrentLead(null);
            setFormData(initialFormData); // Use prop initialFormData
            setIsFormOpen(true);
          }}
        >
          <PlusCircle size={20} className="mr-2" />
          Add New Lead
        </button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 p-4 bg-base-100 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Search Leads</span>
            </label>
            <div className="join">
              <input
                type="text"
                placeholder="Search by name, email, address..."
                className="input input-bordered join-item w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="btn btn-ghost join-item">
                <Search size={20}/>
              </button>
            </div>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Filter by Market Region</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={marketRegionFilter}
              onChange={(e) => setMarketRegionFilter(e.target.value)}
            >
              <option value="">All Regions</option>
              {[...new Set(leads.map(lead => lead.market_region).filter(Boolean) as string[])].map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error &&
        <div className="alert alert-error shadow-lg mb-4">
          <div>
            <AlertCircle size={24} />
            <span><strong>Error:</strong> {error}</span>
          </div>
        </div>
      }

      {/* Table */}
      {(!isLoading || isFormOpen) && !error && (
        <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
          <table {...getTableProps()} className="table table-zebra w-full">
            <thead>
              {headerGroups.map(headerGroup => (
                <tr {...headerGroup.getHeaderGroupProps()} className="bg-base-300">
                  {headerGroup.headers.map(column => (
                    <th {...column.getHeaderProps(column.getSortByToggleProps())} className="p-3">
                      <div className="flex items-center">
                        {column.render('Header')}
                        <span className="ml-2">
                          {column.isSorted
                            ? column.isSortedDesc
                              ? <ChevronDown size={16} />
                              : <ChevronUp size={16} />
                            : ''}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody {...getTableBodyProps()}>
              {page.map(row => {
                prepareRow(row);
                return (
                  <tr {...row.getRowProps()} className="hover:bg-base-200 cursor-pointer" onClick={() => handleEditLead(row.original)}>
                    {row.cells.map(cell => (
                      <td {...cell.getCellProps()} className="p-3 border-b border-base-300 text-sm">
                        {cell.render('Cell')}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {page.length === 0 && (
                <tr>
                  <td colSpan={tableInstance.columns.length} className="text-center p-4">
                    No leads found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {isLoading && !isFormOpen && !error &&
        <div className="flex justify-center items-center p-10">
          <span className="loading loading-lg loading-spinner text-primary"></span>
        </div>
      }

      {/* Pagination */}
      {filteredLeadsCount > pageSize && (
        <div className="mt-6 flex flex-col md:flex-row justify-between items-center p-4 bg-base-100 rounded-lg shadow">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <span className="text-sm">
              Page{' '}
              <strong>
                {pageIndex + 1} of {pageOptions.length}
              </strong>{' '}
            </span>
            <span className="text-sm">| Go to page:</span>
            <input
              type="number"
              defaultValue={pageIndex + 1}
              onChange={e => {
                const pageNum = e.target.value ? Number(e.target.value) - 1 : 0;
                gotoPage(pageNum);
              }}
              className="input input-bordered input-sm w-20"
            />
          </div>
          <div className="flex items-center space-x-2">
            <select
              className="select select-bordered select-sm"
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
              }}
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>
                  Show {size}
                </option>
              ))}
            </select>
            <div className="join">
              <button onClick={() => previousPage()} disabled={!canPreviousPage} className="join-item btn btn-sm">
                « Prev
              </button>
              <button onClick={() => nextPage()} disabled={!canNextPage} className="join-item btn btn-sm">
                Next »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Add/Edit Lead */}
      {isFormOpen && (
        <div className="modal modal-open" role="dialog">
          <div className="modal-box w-11/12 max-w-4xl relative">
            <button
              onClick={() => setIsFormOpen(false)}
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-xl mb-6">
              {currentLead ? `Edit Lead: ${getDisplayName(currentLead)}` : 'Add New Lead'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Property Address Search (Optional)</span></label>
                <input
                  ref={addressInputRef}
                  type="text"
                  placeholder="Start typing address to autofill..."
                  className="input input-bordered w-full"
                  name="property_address_search_temp"
                />
              </div>

              <div className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
                <input type="checkbox" defaultChecked/>
                <div className="collapse-title text-md font-medium">Property Location Details</div>
                <div className="collapse-content">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="form-control">
                      <label className="label"><span className="label-text">Street Address <span className="text-error">*</span></span></label>
                      <input type="text" name="property_address_street" value={formData.property_address_street || ''} onChange={handleFormChange} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">City <span className="text-error">*</span></span></label>
                      <input type="text" name="property_address_city" value={formData.property_address_city || ''} onChange={handleFormChange} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">State <span className="text-error">*</span></span></label>
                      <input type="text" name="property_address_state" value={formData.property_address_state || ''} onChange={handleFormChange} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Zip Code <span className="text-error">*</span></span></label>
                      <input type="text" name="property_address_zip" value={formData.property_address_zip || ''} onChange={handleFormChange} className="input input-bordered w-full" required />
                    </div>
                  </div>
                </div>
              </div>

              <div className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
                <input type="checkbox" defaultChecked/>
                <div className="collapse-title text-md font-medium">Contact Details</div>
                <div className="collapse-content">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="form-control">
                      <label className="label"><span className="label-text">First Name</span></label>
                      <input type="text" name="first_name" value={formData.first_name || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Last Name</span></label>
                      <input type="text" name="last_name" value={formData.last_name || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Email</span></label>
                      <input type="email" name="email" value={formData.email || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Phone</span></label>
                      <input type="tel" name="phone" value={formData.phone || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
                <input type="checkbox" />
                <div className="collapse-title text-md font-medium">Property & MLS Details (Optional)</div>
                <div className="collapse-content">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="form-control">
                      <label className="label"><span className="label-text">AVM Value</span></label>
                      <input type="number" step="any" name="avm_value" value={formData.avm_value || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                     <div className="form-control">
                      <label className="label"><span className="label-text">Beds</span></label>
                      <input type="number" name="beds" value={formData.beds || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Baths</span></label>
                      <input type="number" step="any" name="baths" value={formData.baths || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Sq Ft</span></label>
                      <input type="number" name="sq_ft" value={formData.sq_ft || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">MLS Status</span></label>
                      <input type="text" name="mls_curr_status" value={formData.mls_curr_status || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">MLS Days on Market</span></label>
                      <input type="text" name="mls_curr_days_on_market" value={formData.mls_curr_days_on_market || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                     <div className="form-control">
                      <label className="label"><span className="label-text">Market Region</span></label>
                      <input type="text" name="market_region" value={formData.market_region || ''} onChange={handleFormChange} className="input input-bordered w-full" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label"><span className="label-text">Status <span className="text-error">*</span></span></label>
                  <select name="status" value={formData.status || ''} onChange={handleFormChange} className="select select-bordered w-full" required>
                    <option value="" disabled>Select status</option>
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Notes (Optional)</span></label>
                <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange} className="textarea textarea-bordered h-24"></textarea>
              </div>

              {formError &&
                <div className="alert alert-warning shadow-sm">
                  <div>
                    <AlertCircle size={20} />
                    <span>{formError}</span>
                  </div>
                </div>
              }

              <div className="modal-action mt-8 flex justify-between items-center">
                <div>
                  {currentLead && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLead(currentLead.id)} // Pass only leadId
                      className="btn btn-error btn-outline mr-2"
                      disabled={isSubmitting}
                    >
                      <Trash2 size={16} className="mr-1"/> Delete Lead
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="btn btn-ghost"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      <><Save size={16} className="mr-1"/> {currentLead ? 'Update Lead' : 'Save Lead'}</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmTable;