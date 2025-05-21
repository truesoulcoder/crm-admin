// src/components/crm/CrmTable.tsx
'use client';

import { Table, flexRender } from '@tanstack/react-table';
import { ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import React from 'react';

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
  isLoading: boolean;
  error: string | null;
  handleEditLead: (lead: Lead) => void; // Callback to open modal in CrmView
}

const CrmTable: React.FC<CrmTableProps> = ({
  tableInstance,
  isLoading,
  error,
  handleEditLead,
}) => {
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