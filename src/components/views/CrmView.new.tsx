import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Lead, LeadFormData, statusOptions } from '@/types/crm';
import { PlusCircle, Search, Edit3, Trash2, Filter, X, Save, User, Tag, Calendar, Building, FileText, MapPin, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, Mail } from 'lucide-react';

// SortIndicator component
const SortIndicator = ({ field }: { field: string }) => (
  <span className="ml-1">
    <ChevronUp className="inline-block w-3 h-3 -mb-px" />
    <ChevronDown className="inline-block w-3 h-3 -mt-px" />
  </span>
);

interface StatusDisplayInfo {
  value: string;
  label: string;
  color: string;
}

const CrmView: React.FC = () => {
  // Sorting & pagination state
  const [sortField, setSortField] = useState<keyof Lead | ''>('');
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
  const [formData, setFormData] = useState<Partial<Lead>>({});

  // Initialize Supabase client
  const supabase = createClient();

  // Fetch leads on component mount
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        setLeads(data || []);
        setFilteredLeads(data || []);
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeads();
  }, []);

  // Filter and sort leads
  useEffect(() => {
    let result = [...leads];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(lead => 
        (lead.first_name?.toLowerCase().includes(term)) ||
        (lead.last_name?.toLowerCase().includes(term)) ||
        (lead.email?.toLowerCase().includes(term)) ||
        (lead.company?.toLowerCase().includes(term)) ||
        (lead.address?.toLowerCase().includes(term))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(lead => lead.status === statusFilter);
    }
    
    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        const aValue = a[sortField as keyof Lead];
        const bValue = b[sortField as keyof Lead];
        
        if (aValue === null) return sortDirection === 'asc' ? -1 : 1;
        if (bValue === null) return sortDirection === 'asc' ? 1 : -1;
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    setFilteredLeads(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [leads, searchTerm, statusFilter, sortField, sortDirection]);

  // Get paginated leads
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredLeads.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredLeads, currentPage, rowsPerPage]);

  // Handle sorting
  const handleSort = (field: keyof Lead | '') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle lead edit
  const handleEdit = (lead: Lead) => {
    setCurrentLead(lead);
    setFormData(lead);
    setIsFormOpen(true);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    try {
      setIsLoading(true);
      
      if (currentLead) {
        // Update existing lead
        const { error } = await supabase
          .from('leads')
          .update(formData)
          .eq('id', currentLead.id);
          
        if (error) throw error;
      } else {
        // Create new lead
        const { error } = await supabase
          .from('leads')
          .insert([formData]);
          
        if (error) throw error;
      }
      
      // Refresh leads
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setLeads(data || []);
      setIsFormOpen(false);
      setCurrentLead(null);
      setFormData({});
      
    } catch (error) {
      console.error('Error saving lead:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get status badge class
  const getStatusBadge = (status: string) => {
    const statusInfo = statusOptions.find(s => s.value === status) || 
      { value: status, label: status, color: 'bg-gray-100 text-gray-800' };
    return `badge ${statusInfo.color} badge-sm`;
  };

  // Show loading state
  if (isLoading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-base-200 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-base-content">CRM Leads</h1>
      
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
              setFormData({});
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
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="bg-base-200">
                <th className="cursor-pointer hover:bg-base-300" onClick={() => handleSort('first_name')}>
                  <div className="flex items-center">
                    Contact
                    <SortIndicator field="first_name" />
                  </div>
                </th>
                <th className="cursor-pointer hover:bg-base-300" onClick={() => handleSort('company')}>
                  <div className="flex items-center">
                    Company
                    <SortIndicator field="company" />
                  </div>
                </th>
                <th className="cursor-pointer hover:bg-base-300" onClick={() => handleSort('status')}>
                  <div className="flex items-center">
                    Status
                    <SortIndicator field="status" />
                  </div>
                </th>
                <th className="cursor-pointer hover:bg-base-300" onClick={() => handleSort('created_at')}>
                  <div className="flex items-center">
                    Created
                    <SortIndicator field="created_at" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-10">
                    <span className="loading loading-spinner loading-lg"></span>
                    <p className="mt-2">Loading leads...</p>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10">
                    No leads found. Try adjusting your search or filters.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => (
                  <tr 
                    key={lead.id}
                    className="hover:bg-base-200 cursor-pointer"
                    onClick={() => handleEdit(lead)}
                  >
                    <td>
                      <div className="flex items-center space-x-3">
                        <div className="avatar placeholder">
                          <div className="bg-neutral-focus text-neutral-content rounded-full w-10">
                            <span>{lead.first_name?.[0]?.toUpperCase() || '?'}</span>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">
                            {lead.first_name} {lead.last_name}
                          </div>
                          <div className="text-sm opacity-50">
                            {lead.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{lead.company || '-'}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(lead.status || 'NEW')}`}>
                        {lead.status || 'NEW'}
                      </span>
                    </td>
                    <td>
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredLeads.length > 0 && (
          <div className="flex justify-between items-center p-4 border-t border-base-200">
            <div className="text-sm text-base-content/70">
              Showing {Math.min(rowsPerPage * (currentPage - 1) + 1, filteredLeads.length)}-{
                Math.min(rowsPerPage * currentPage, filteredLeads.length)
              } of {filteredLeads.length} leads
            </div>
            <div className="join">
              <button 
                className="join-item btn btn-sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                «
              </button>
              <button className="join-item btn btn-sm">
                Page {currentPage}
              </button>
              <button 
                className="join-item btn btn-sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage * rowsPerPage >= filteredLeads.length}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lead Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {currentLead ? 'Edit Lead' : 'Add New Lead'}
                </h2>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="btn btn-sm btn-circle btn-ghost"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">First Name</span>
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      className="input input-bordered w-full"
                      value={formData.first_name || ''}
                      onChange={handleInputChange}
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
                      className="input input-bordered w-full"
                      value={formData.last_name || ''}
                      onChange={handleInputChange}
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
                      required
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
                  
                  <div className="form-control md:col-span-2">
                    <label className="label">
                      <span className="label-text">Company</span>
                    </label>
                    <input
                      type="text"
                      name="company"
                      className="input input-bordered w-full"
                      value={formData.company || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-control md:col-span-2">
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
                      <span className="label-text">State/Province</span>
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
                  
                  <div className="form-control md:col-span-2">
                    <label className="label">
                      <span className="label-text">Notes</span>
                    </label>
                    <textarea
                      name="notes"
                      className="textarea textarea-bordered w-full h-24"
                      value={formData.notes || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
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
