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
import { Edit3, PlusCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useCallback, useRef, ChangeEvent } from 'react';

import CrmTable, { Lead as LeadType, StatusOption as StatusOptionType } from '@/components/crm/CrmTable'; 
import { supabase } from '@/lib/supabase/client';

// Extend the imported LeadType to include optional address fields
export interface Lead extends Omit<LeadType, 'address' | 'city' | 'state' | 'zip_code'> {
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  [key: string]: any; 
}

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
  status: 'NEW', 
  property_address_street: '',
  property_address_city: '',
  property_address_state: '',
  property_address_zip: '',
  market_region: '',
  notes: '',
  assessed_value: undefined,
  beds: undefined,
  baths: undefined,
  sq_ft: undefined,
  mls_curr_status: '',
  mls_curr_days_on_market: '',
};

const CrmView = () => {
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
  const [totalLeads, setTotalLeads] = useState(0);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError, count } = await supabase
        .from('crm_leads')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      
      setLeads(data || []);
      setTotalLeads(count || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leads');
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

  const handleEditLead = useCallback((lead: Lead) => {
    setCurrentLead(lead);
    setFormData({
      ...lead,
      ...componentInitialFormData,
      ...lead,
    });
    setIsFormOpen(true);
  }, []);

  const columnHelper = createColumnHelper<Lead>();

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        header: 'Name',
        accessorFn: (row: Lead) => getDisplayName(row),
        id: 'name',
        cell: (info: CellContext<Lead, string>) => {
          const lead = info.row.original;
          return (
            <button 
              className="text-blue-600 hover:text-blue-800 font-medium text-left"
              onClick={() => handleEditLead(lead)}
            >
              {info.getValue() as string}
            </button>
          );
        },
      },
      {
        header: 'Status',
        accessorKey: 'status',
        id: 'status',
        cell: (info: CellContext<Lead, string>) => {
          const statusValue = info.getValue() as string;
          const statusClass = getStatusBadgeClass(statusValue);
          const statusLabel = componentStatusOptions.find(opt => opt.value === statusValue)?.label || statusValue;
          return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
              {statusLabel}
            </span>
          );
        },
      },
      {
        header: 'Email',
        accessorKey: 'email',
        cell: (info: CellContext<Lead, string | undefined>) => (
          <a href={`mailto:${info.getValue()}`} className="text-blue-600 hover:underline">
            {info.getValue()}
          </a>
        ),
      },
      {
        header: 'Property Address',
        accessorFn: (row: Lead) => {
          const parts = [
            row.property_address_street,
            row.property_address_city,
            row.property_address_state,
            row.property_address_zip,
          ].filter(Boolean);
          return parts.join(', ');
        },
        id: 'property_address',
        cell: (info: CellContext<Lead, string>) => (
          <div className="whitespace-nowrap">{info.getValue() as string}</div>
        ),
      },
      {
        header: 'Assessed Total',
        accessorKey: 'assessed_total',
        id: 'assessed_total',
        cell: (info: CellContext<Lead, number | undefined>) => (
          <div>${info.getValue()?.toLocaleString() || 'N/A'}</div>
        ),
        enableSorting: true,
      },
    ], 
    [getStatusBadgeClass, getDisplayName, formatFullAddress, handleEditLead]
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const tableInstance = useReactTable({
    data: filteredLeads,
    columns,
    state: {
      sorting,
      pagination,
    },
    pageCount: Math.ceil(filteredLeads.length / pagination.pageSize),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    debugTable: true,
  });

  const handleSubmitForTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (!formData.id) {
        const { data, error } = await supabase
          .from('crm_leads')
          .insert([formData])
          .select();

        if (error) throw error;
        
        if (data && data[0]) {
          setLeads(prev => [data[0], ...prev]);
        }
      } else {
        const { data, error } = await supabase
          .from('crm_leads')
          .update(formData)
          .eq('id', formData.id)
          .select();

        if (error) throw error;
        
        if (data && data[0]) {
          setLeads(prev => 
            prev.map(lead => lead.id === data[0].id ? data[0] : lead)
          );
        }
      }
      
      setIsFormOpen(false);
      setFormData(componentInitialFormData);
      setCurrentLead(null);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the lead');
      console.error('Error saving lead:', err);
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

  // Loading state is now handled in the main return statement

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setCurrentLead(null);
            setFormData(componentInitialFormData);
            setIsFormOpen(true);
          }}
          className="btn btn-primary gap-2"
        >
          <PlusCircle size={18} />
          Create New Lead
        </button>
      </div>
      
      <CrmTable
        leads={leads} // Pass raw leads for market region filter population
        isLoading={isLoading}
        error={error}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
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
    </div>
  );
}

export default CrmView;
