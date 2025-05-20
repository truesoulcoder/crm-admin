import { PlusCircle, Search, Edit3, Trash2, X, Mail, MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';

import { supabase } from '@/lib/supabase/client';

// Define types
interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  created_at?: string;
  updated_at?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_postal_code?: string;
  assessed_total?: number;
  mls_curr_status?: string;
  mls_curr_days_on_market?: string;
  market_region?: string;
}

interface ColumnConfig {
  key: keyof Lead | string;
  label: string;
  sortable?: boolean;
}

interface StatusOption {
  value: string;
  label: string;
  color: string;
}

const statusOptions: StatusOption[] = [
  { value: 'NEW', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-purple-100 text-purple-800' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'bg-green-100 text-green-800' },
  { value: 'UNQUALIFIED', label: 'Unqualified', color: 'bg-red-100 text-red-800' },
];

const CrmView: React.FC = () => {
  // Sorting & pagination state
  const [sortField, setSortField] = useState<keyof Lead>('first_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Data state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState<Partial<Lead>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    status: 'NEW',
    address: '',
    city: '',
    state: '',
    zip_code: ''
  });
  
  // Initialize Supabase client
  

  // Sort Indicator Component
  const SortIndicator = ({ field }: { field: keyof Lead | '' }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />;
  };

  // Handle sorting
  const handleSort = (field: keyof Lead) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Column configuration
  const columnConfigurations: ColumnConfig[] = [
    { key: 'first_name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'property_address', label: 'Address', sortable: true },
    { key: 'phone', label: 'Phone', sortable: true },
    { key: 'market_region', label: 'Market Region', sortable: true },
    { key: 'assessed_total', label: 'Assessed Value', sortable: true },
    { key: 'mls_curr_status', label: 'MLS Status', sortable: true },
    { key: 'mls_curr_days_on_market', label: 'DOM', sortable: true },
  ];

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Helper function to get display name from first and last name
  const getDisplayName = (lead: Partial<Lead>): string => {
    return [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'New Lead';
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (currentLead) {
        // Update existing lead
        const { error } = await supabase
          .from('crm_leads')
          .update(formData)
          .eq('id', currentLead.id);
          
        if (error) throw error;
        
        // Update local state
        setLeads(leads.map(lead => 
          lead.id === currentLead.id ? { ...lead, ...formData } : lead
        ));
      } else {
        // Create new lead
        const { data, error } = await supabase
          .from('crm_leads')
          .insert([formData])
          .select();
          
        if (error) throw error;
        
        // Add new lead to local state
        if (data && data[0]) {
          setLeads([...leads, data[0]]);
        }
      }
      
      // Reset form and close modal
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        status: 'NEW',
        address: '',
        city: '',
        state: '',
        zip_code: ''
      });
      setIsFormOpen(false);
      setCurrentLead(null);
    } catch (error) {
      console.error('Error saving lead:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Open edit form with lead data
  const handleEdit = (lead: Lead) => {
    setCurrentLead(lead);
    setFormData({
      ...lead,
      // Ensure all required fields have default values
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      status: lead.status || 'NEW',
      address: lead.address || lead.property_address || '',
      city: lead.city || lead.property_city || '',
      state: lead.state || lead.property_state || '',
      zip_code: lead.zip_code || lead.property_postal_code || ''
    });
    setIsFormOpen(true);
  };

  // Handle deleting a lead
  const handleDeleteLead = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click from triggering
    
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('crm_leads')
        .delete()
        .eq('id', leadId);
        
      if (error) throw error;
      
      // Update local state instead of refetching
      setLeads(prev => prev.filter(lead => lead.id !== leadId));
      
      // Close modal if open for this lead
      if (currentLead?.id === leadId) {
        setIsFormOpen(false);
        setCurrentLead(null);
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert(`Error deleting lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Get badge color based on status
  const getStatusBadgeColor = (status: string) => getStatusBadgeClass(status);

  // Fetch leads from Supabase
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('crm_leads')
          .select('*');

        console.log('Fetched leads:', data, 'Error:', error);
        if (error) throw error;

        setLeads(data || []);
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchLeads();
  }, []);

  // Filter and sort leads
  useEffect(() => {
    let result = [...leads];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(lead => 
        (lead.first_name?.toLowerCase().includes(term) || lead.last_name?.toLowerCase().includes(term)) ||
        (lead.email?.toLowerCase().includes(term)) ||
        (lead.phone?.includes(term)) ||
        (lead.status?.toLowerCase().includes(term)) ||
        (lead.property_address?.toLowerCase().includes(term)) ||
        (lead.property_city?.toLowerCase().includes(term)) ||
        (lead.property_state?.toLowerCase().includes(term)) ||
        (lead.property_postal_code?.toLowerCase().includes(term))
      );
    }
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'ALL') {
      result = result.filter(lead => lead.status === statusFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      // Default sort by updated_at descending if no sort field
      const field = sortField || 'updated_at';
      const direction = sortDirection || 'desc';
      
      let aValue = field ? a[field as keyof Lead] : a.updated_at;
      let bValue = field ? b[field as keyof Lead] : b.updated_at;
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return direction === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return direction === 'asc' ? 1 : -1;
      
      // Convert to string for comparison if needed
      if (typeof aValue !== 'string') aValue = String(aValue);
      if (typeof bValue !== 'string') bValue = String(bValue);
      
      // Compare values
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    setFilteredLeads(result);
  }, [leads, searchTerm, statusFilter, sortField, sortDirection]);

  // Helper to get displayable value
  const displayValue = (value: any) => value === null || value === undefined ? '-' : String(value);
  
  // Get status badge color
  const getStatusBadgeClass = (status: string | null | undefined): string => {
    if (!status) return 'badge-ghost';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('new') || lowerStatus.includes('open')) return 'badge-info';
    if (lowerStatus.includes('contacted') || lowerStatus.includes('step')) return 'badge-success';
    if (lowerStatus.includes('offer sent') || lowerStatus.includes('pending')) return 'badge-warning';
    if (lowerStatus.includes('not interested') || lowerStatus.includes('closed') || lowerStatus.includes('lost')) return 'badge-error';
    return 'badge-neutral';
  };

  return (
    <div className="p-4 md:p-6 bg-base-200 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-base-content">CRM Leads</h1>
      {/* Debug Panel */}
      <div className="mb-4 p-2 bg-base-300 rounded text-xs">
        <div>Leads fetched: {leads.length}</div>
        <div>Leads after filter: {filteredLeads.length}</div>
        {isLoading && <div>Loading leads...</div>}
      </div>
      
      {/* Search and Filters */}
      <div className="mb-6 p-4 bg-base-100 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                className="input input-bordered w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <select 
            className="select select-bordered"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setCurrentLead(null);
              setFormData({
                first_name: '',
                last_name: '',
                email: '',
                phone: '',
                status: 'NEW',
                address: '',
                city: '',
                state: '',
                zip_code: ''
              });
              setIsFormOpen(true);
            }}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-base-100 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
          <table className="table table-zebra table-sm w-full">
            <thead>
              <tr className="text-base-content">
                {columnConfigurations.map(col => (
                  <th 
                    key={col.key} 
                    onClick={() => col.sortable !== false && handleSort(col.key as keyof Lead)}
                    className={col.sortable !== false ? 'cursor-pointer hover:bg-base-300' : ''}
                  >
                    {col.label} {col.sortable !== false && <SortIndicator field={col.key as keyof Lead} />}
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
                filteredLeads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-base-200 cursor-pointer transition-colors"
                    onClick={() => handleEdit(lead)}
                  >
                    <td className="py-4">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-medium">
                            {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'No Name'}
                          </div>
                          {lead.email && (
                            <div className="text-sm opacity-70 flex items-center mt-1">
                              <Mail className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span className="truncate max-w-xs" title={lead.email}>
                                {lead.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(lead.status)}`}>
                        {statusOptions.find(s => s.value === lead.status)?.label || lead.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-start">
                        <MapPin size={16} className="mr-1.5 mt-0.5 flex-shrink-0 text-red-500" />
                        <div>
                          {lead.property_address || lead.address || '-'}
                          <br />
                          {lead.property_city || lead.city || lead.state || lead.zip_code 
                            ? `${lead.property_city || lead.city || ''}${(lead.property_city || lead.city) && (lead.property_state || lead.state) ? ', ' : ''}${lead.property_state || lead.state || ''} ${lead.property_postal_code || lead.zip_code || ''}` 
                            : null}
                        </div>
                      </div>
                    </td>
                    <td>{lead.phone || '-'}</td>
                    <td>{displayValue(lead.market_region)}</td>
                    <td>{lead.assessed_total ? `$${Number(lead.assessed_total).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}</td>
                    <td>{displayValue(lead.mls_curr_status)}</td>
                    <td>{displayValue(lead.mls_curr_days_on_market)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 border-t">
          <div className="text-sm text-gray-500">
            Showing {Math.min((currentPage - 1) * rowsPerPage + 1, filteredLeads.length)} to {Math.min(currentPage * rowsPerPage, filteredLeads.length)} of {filteredLeads.length} entries
          </div>
          <div className="join">
            <button 
              className="join-item btn btn-sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button className="join-item btn btn-sm btn-active">
              {currentPage}
            </button>
            <button 
              className="join-item btn btn-sm"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage * rowsPerPage >= filteredLeads.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Edit/Add Lead Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-base-100 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold mb-4">
                  {currentLead ? `Edit Lead: ${getDisplayName(currentLead)}` : 'Add New Lead'}
                </h2>
                <button 
                  className="btn btn-circle btn-ghost btn-sm"
                  onClick={() => {
                    setIsFormOpen(false);
                    setCurrentLead(null);
                    setFormData({
                      first_name: '',
                      last_name: '',
                      email: '',
                      phone: '',
                      status: 'NEW',
                      address: '',
                      city: '',
                      state: '',
                      zip_code: ''
                    });
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(e).catch(console.error);
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">First Name</span>
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name || ''}
                      onChange={handleInputChange}
                      className="input input-bordered w-full"
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Last Name</span>
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name || ''}
                      onChange={handleInputChange}
                      className="input input-bordered w-full"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Email</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      className="input input-bordered w-full"
                      value={formData.email || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Phone</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      className="input input-bordered w-full"
                      value={formData.phone || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Status</span>
                    </label>
                    <select
                      name="status"
                      className="select select-bordered w-full"
                      value={formData.status || 'NEW'}
                      onChange={handleInputChange}
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Address</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      className="input input-bordered w-full"
                      value={formData.address || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">City</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      className="input input-bordered w-full"
                      value={formData.city || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">State</span>
                    </label>
                    <input
                      type="text"
                      name="state"
                      className="input input-bordered w-full"
                      value={formData.state || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Postal Code</span>
                    </label>
                    <input
                      type="text"
                      name="zip_code"
                      className="input input-bordered w-full"
                      value={formData.zip_code || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setCurrentLead(null);
                      setFormData({});
                    }}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="loading loading-spinner"></span>
                    ) : currentLead ? (
                      'Update Lead'
                    ) : (
                      'Add Lead'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmView;
