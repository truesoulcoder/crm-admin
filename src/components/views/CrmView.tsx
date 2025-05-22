'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
  PaginationState,
  ColumnDef,
  CellContext
} from '@tanstack/react-table';
import { Edit3 } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useCallback, useRef, ChangeEvent } from 'react';

import CrmTable, { Lead as LeadType, StatusOption as StatusOptionType } from '@/components/crm/CrmTable'; // Import CrmTable and types // Import CrmTable and types
import { supabase } from '@/lib/supabase/client';

// Dynamically import the GoogleMapsLoader with SSR disabled
const GoogleMapsLoader = dynamic(
  () => import('@/components/maps/GoogleMapsLoader'),
  { ssr: false }
);

// Use imported types
export type Lead = LeadType;
export type StatusOption = StatusOptionType;

// Constants defined in CrmView_temp
const componentStatusOptions: StatusOption[] = [
  { value: 'NEW', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-purple-100 text-purple-800' },
  { value: 'CONTRACT-SENT', label: 'Contract Sent', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'APPOINTMENT-SCHEDULED', label: 'Appointment', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'UNDER-CONTRACT', label: 'Under Contract', color: 'bg-pink-100 text-pink-800' },
  { value: 'CLOSED-WON', label: 'Closed - Won', color: 'bg-green-100 text-green-800' },
  { value: 'CLOSED-LOST', label: 'Closed - Lost', color: 'bg-red-100 text-red-800' },
  { value: 'ON-HOLD', label: 'On Hold', color: 'bg-gray-100 text-gray-800' },
  { value: 'FOLLOW-UP', label: 'Follow Up', color: 'bg-teal-100 text-teal-800' },
  { value: 'NOT-INTERESTED', label: 'Not Interested', color: 'bg-orange-100 text-orange-800' },
  { value: 'WRONG-NUMBER', label: 'Wrong Number', color: 'bg-stone-100 text-stone-800' },
  { value: 'DO-NOT-CONTACT', label: 'Do Not Contact', color: 'bg-slate-100 text-slate-800' },
];

const componentInitialFormData: Partial<Lead> = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  status: 'NEW', // Default status
  property_address_street: '',
  property_address_city: '',
  property_address_state: '',
  property_address_zip: '',
  market_region: '',
  notes: '',
  avm_value: undefined,
  beds: undefined,
  baths: undefined,
  sq_ft: undefined,
  mls_curr_status: '',
  mls_curr_days_on_market: '',
};

const CrmView: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [marketRegionFilter, setMarketRegionFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState<Partial<Lead>>(componentInitialFormData);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const addressInputRef = useRef<HTMLInputElement>(null);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('crm_leads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      setLeads(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Failed to fetch leads:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const handleViewFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | undefined | boolean = value;

    if (type === 'number') {
      processedValue = value === '' ? undefined : parseFloat(value);
    } else if ((e.target as HTMLInputElement).type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
  };
  
  const getDisplayName = useCallback((lead: Partial<Lead>): string => {
    return [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email || lead.property_address_full || 'Unnamed Lead';
  }, []);

  const formatFullAddress = useCallback((lead: Partial<Lead>): string => {
    const parts = [
      lead.property_address_street,
      lead.property_address_city,
      lead.property_address_state,
      lead.property_address_zip,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : (lead.property_address_full || 'N/A');
  }, []);

  const getStatusBadgeClass = useCallback((statusValue: string): string => {
    const option = componentStatusOptions.find(opt => opt.value === statusValue);
    return option ? `${option.color} text-xs p-3` : 'badge-neutral text-xs p-3';
  }, []);

  const filteredLeads = useMemo(() => {
    let tempLeads = leads;
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      tempLeads = tempLeads.filter(lead =>
        Object.values(lead).some(value =>
          String(value).toLowerCase().includes(lowerSearchTerm)
        )
      );
    }
    if (marketRegionFilter) {
      tempLeads = tempLeads.filter(lead => lead.market_region === marketRegionFilter);
    }
    return tempLeads;
  }, [leads, searchTerm, marketRegionFilter]);


  const handleEditLead = useCallback((leadToEdit: Lead) => {
    setCurrentLead(leadToEdit);
    const mappedFormData: Partial<Lead> = {
      ...componentInitialFormData,
      ...leadToEdit,
      property_address_street: leadToEdit.property_address_street || leadToEdit.address || '',
      property_address_city: leadToEdit.property_address_city || leadToEdit.city || '',
      property_address_state: leadToEdit.property_address_state || leadToEdit.state || '',
      property_address_zip: leadToEdit.property_address_zip || leadToEdit.zip_code || '',
      avm_value: leadToEdit.avm_value !== null && leadToEdit.avm_value !== undefined ? Number(leadToEdit.avm_value) : undefined,
      beds: leadToEdit.beds !== null && leadToEdit.beds !== undefined ? Number(leadToEdit.beds) : undefined,
      baths: leadToEdit.baths !== null && leadToEdit.baths !== undefined ? Number(leadToEdit.baths) : undefined,
      sq_ft: leadToEdit.sq_ft !== null && leadToEdit.sq_ft !== undefined ? Number(leadToEdit.sq_ft) : undefined,
    };
    setFormData(mappedFormData);
    setIsFormOpen(true);
  }, [setCurrentLead, setFormData, setIsFormOpen, componentInitialFormData]);

  const columnHelper = createColumnHelper<Lead>();

const columns = useMemo<ColumnDef<Lead, any>[]>(() => [
    {
      header: 'Name',
      accessorFn: (row: Lead) => getDisplayName(row),
      id: 'name',
    },
    {
      header: 'Status',
      accessorKey: 'status',
      id: 'status',
      cell: (info: CellContext<Lead, string>) => {
        const value = info.getValue();
        return (
          <span className={`badge ${getStatusBadgeClass(value)}`}>
            {componentStatusOptions.find(s => s.value === value)?.label || value}
          </span>
        );
      },
    },
    {
      header: 'Email',
      accessorKey: 'email',
      cell: (info: CellContext<Lead, string | undefined>) => info.getValue() || 'N/A',
    },
    {
      header: 'Property Address',
      accessorFn: (row: Lead) => formatFullAddress(row),
      id: 'property_address_full',
    },
    {
      header: 'AVM',
      accessorKey: 'avm_value',
      id: 'avm_value',
      cell: (info: CellContext<Lead, number | undefined>) => {
        const value = info.getValue();
        return value ? `$${value.toLocaleString()}` : 'N/A';
      },
      enableSorting: true,
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: (info: CellContext<Lead, any>) => {
        const row = info.row;
        return (
          <button
            onClick={() => handleEditLead(info.row.original)}
            className="btn btn-xs btn-ghost text-primary hover:bg-primary hover:text-primary-content p-1"
            aria-label={`Edit lead ${getDisplayName(info.row.original)}`}
          >
            <Edit3 size={16} />
          </button>
        );
      },
      enableSorting: false,
    },
  ], [getStatusBadgeClass, getDisplayName, formatFullAddress, handleEditLead]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const tableInstance = useReactTable<Lead>({
    columns,
    data: filteredLeads,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false, // client-side pagination
    debugTable: process.env.NODE_ENV === 'development',
  });

  const { 
    getHeaderGroups,
    getRowModel,
  } = tableInstance;

  const pageIndex = tableInstance.getState().pagination.pageIndex;
  const pageSize = tableInstance.getState().pagination.pageSize;
  const pageCount = tableInstance.getPageCount();
  const canPreviousPage = tableInstance.getCanPreviousPage();
  const canNextPage = tableInstance.getCanNextPage();
  const gotoPage = tableInstance.setPageIndex;
  const nextPage = tableInstance.nextPage;
  const previousPage = tableInstance.previousPage;
  const setPageSize = tableInstance.setPageSize;
  const pageOptions = Array.from({ length: pageCount }, (_, i) => i + 1);


  const handleSubmitForTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const leadDataToSubmit: Partial<Lead> = {
      ...formData,
      avm_value: formData.avm_value ? parseFloat(String(formData.avm_value)) : undefined,
      beds: formData.beds ? parseInt(String(formData.beds), 10) : undefined,
      baths: formData.baths ? parseFloat(String(formData.baths)) : undefined,
      sq_ft: formData.sq_ft ? parseInt(String(formData.sq_ft), 10) : undefined,
      property_address_full: (
        formData.property_address_street || formData.property_address_city || 
        formData.property_address_state || formData.property_address_zip
      ) ? [
        formData.property_address_street,
        formData.property_address_city,
        formData.property_address_state,
        formData.property_address_zip
      ].filter(Boolean).join(', ') : (formData.property_address_full || undefined),
    };

    try {
      if (currentLead?.id) { // Editing
        const { error: updateError } = await supabase
          .from('crm_leads')
          .update(leadDataToSubmit)
          .eq('id', currentLead.id);
        if (updateError) throw updateError;
      } else { // Adding new
        const { error: insertError } = await supabase
          .from('crm_leads')
          .insert([leadDataToSubmit])
          .select(); 
        if (insertError) throw insertError;
      }
      setIsFormOpen(false);
      setCurrentLead(null);
      setFormData(componentInitialFormData);
      await fetchLeads(); 
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('Error saving lead:', err);
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLeadForTable = async (leadId: string) => {
    if (!window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      return;
    }
    setIsSubmitting(true); 
    setFormError(null);
    try {
      const { error: deleteError } = await supabase
        .from('crm_leads')
        .delete()
        .eq('id', leadId);
      if (deleteError) throw deleteError;
      
      if (currentLead?.id === leadId) { 
        setIsFormOpen(false);
        setCurrentLead(null);
        setFormData(componentInitialFormData);
      }
      await fetchLeads(); // Refetch leads to update the table
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('Error deleting lead:', err);
      setFormError(message); // Display error in the form if it's open, or globally
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !isFormOpen && leads.length === 0) { 
    return (
      <div className="flex justify-center items-center min-h-screen bg-base-200">
        <span className="loading loading-lg loading-spinner text-primary"></span>
      </div>
    );
  }

  return (
    <GoogleMapsLoader>
      <CrmTable
      leads={leads} // Pass raw leads for market region filter population
      isLoading={isLoading}
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      marketRegionFilter={marketRegionFilter}
      setMarketRegionFilter={setMarketRegionFilter}
      tableInstance={tableInstance}
      filteredLeadsCount={filteredLeads.length}
      isFormOpen={isFormOpen}
      setIsFormOpen={setIsFormOpen}
      currentLead={currentLead}
      setCurrentLead={setCurrentLead} // Pass down setCurrentLead
      formData={formData}
      setFormData={setFormData} // Pass down setFormData
      handleFormChange={handleViewFormChange} 
      handleSubmit={handleSubmitForTable}
      handleDeleteLead={handleDeleteLeadForTable}
      formError={formError} 
      isSubmitting={isSubmitting}
      addressInputRef={addressInputRef}
      getDisplayName={getDisplayName}
      handleEditLead={handleEditLead}
      initialFormData={componentInitialFormData}
      statusOptions={componentStatusOptions}
    />
    </GoogleMapsLoader>
  );
};

export default CrmView;
