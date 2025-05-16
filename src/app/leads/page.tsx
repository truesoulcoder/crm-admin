'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageSizeSelector from '@/components/ui/PageSizeSelector'; 
import LeadUploader from '@/components/leads/LeadUploader'; 
import { type Tables } from '@/types/supabase'; 

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.warn('Invalid date string:', dateString);
    return 'Invalid Date';
  }
};

const LeadsPage = () => {
  const [leads, setLeads] = useState<Tables<'normalized_leads'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedMarketRegion, setSelectedMarketRegion] = useState<string>('all'); 
  const [marketRegions, setMarketRegions] = useState<string[]>([]); 
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); 

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/normalized-leads?page=${currentPage}&pageSize=${pageSize}`;
      if (selectedMarketRegion && selectedMarketRegion.toLowerCase() !== 'all') {
        url += `&market_region=${encodeURIComponent(selectedMarketRegion)}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch leads: ${response.statusText}`);
      }
      const data = await response.json();
      setLeads(data.leads || []);
      setTotalLeads(data.totalCount || 0);
      setTotalPages(data.totalPages || 0);
      setCurrentPage(data.currentPage || 1); 
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      setError(err.message || 'An unexpected error occurred.');
      setLeads([]);
      setTotalLeads(0);
      setTotalPages(0);
    }
    setIsLoading(false);
  }, [currentPage, pageSize, selectedMarketRegion]);

  useEffect(() => {
    setMarketRegions(['all', 'Houston', 'Dallas', 'San Antonio', 'Austin']); 
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); 
  };

  const handleMarketRegionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMarketRegion(event.target.value);
    setCurrentPage(1); 
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxPagesToShow = 5; 
    let startPage, endPage;

    if (totalPages <= maxPagesToShow) {
      startPage = 1;
      endPage = totalPages;
    } else {
      const maxPagesBeforeCurrentPage = Math.floor(maxPagesToShow / 2);
      const maxPagesAfterCurrentPage = Math.ceil(maxPagesToShow / 2) - 1;
      if (currentPage <= maxPagesBeforeCurrentPage) {
        startPage = 1;
        endPage = maxPagesToShow;
      } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
        startPage = totalPages - maxPagesToShow + 1;
        endPage = totalPages;
      } else {
        startPage = currentPage - maxPagesBeforeCurrentPage;
        endPage = currentPage + maxPagesAfterCurrentPage;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`join-item btn btn-sm ${currentPage === i ? 'btn-active' : ''}`}
          disabled={isLoading}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="join mt-6">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          className="join-item btn btn-sm"
          disabled={currentPage === 1 || isLoading}
        >
          « Prev
        </button>
        {startPage > 1 && (
          <button onClick={() => handlePageChange(1)} className="join-item btn btn-sm" disabled={isLoading}>1</button>
        )}
        {startPage > 2 && (
          <button className="join-item btn btn-sm btn-disabled">...</button>
        )}
        {pageNumbers}
        {endPage < totalPages -1 && (
           <button className="join-item btn btn-sm btn-disabled">...</button>
        )}
        {endPage < totalPages && (
          <button onClick={() => handlePageChange(totalPages)} className="join-item btn btn-sm" disabled={isLoading}>{totalPages}</button>
        )}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          className="join-item btn btn-sm"
          disabled={currentPage === totalPages || isLoading}
        >
          Next »
        </button>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Unqualified Leads Verification</h1>

      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <PageSizeSelector
          selectedPageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          disabled={isLoading}
        />
        <div className="form-control">
            <label className="label">
                <span className="label-text">Filter by Market Region:</span>
            </label>
            <select 
                className="select select-bordered select-sm w-full md:w-auto"
                value={selectedMarketRegion}
                onChange={handleMarketRegionChange}
                disabled={isLoading || marketRegions.length === 0}
            >
                {marketRegions.map(region => (
                    <option key={region} value={region.toLowerCase()}>
                        {region === 'all' ? 'All Regions' : region}
                    </option>
                ))}
            </select>
        </div>
        <button 
          className="btn btn-primary btn-sm md:ml-auto" 
          onClick={() => setIsUploadModalOpen(true)}
          disabled={isLoading} 
        >
          Upload CSV
        </button>
      </div>

      {/* Upload Modal using LeadUploader */}
      {isUploadModalOpen && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box relative"> {/* Added relative for positioning close button */}
            <button 
              onClick={() => setIsUploadModalOpen(false)} 
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              disabled={isLoading} // Optionally disable if LeadUploader is busy (via a shared state if needed)
            >
              ✕
            </button>
            {/* The LeadUploader component itself is not a modal, so we wrap it */}
            <LeadUploader 
              onUploadSuccess={(filename, count) => {
                console.log(`Upload successful: ${filename}, Count: ${count}`);
                setIsUploadModalOpen(false); // Close the modal
                fetchLeads(); // Refresh leads list
              }}
              // Optional: Pass addMessage if you want to display messages from LeadUploader in the modal or page
              // addMessage={(type, message) => console.log(`${type}: ${message}`)} 
              isProcessing={isLoading} // Pass page's loading state, or a more specific one if LeadUploader has its own busy state
            />
          </div>
          {/* Optional: Click outside to close modal */} 
          {/* <label className="modal-backdrop" htmlFor="upload-modal-control" onClick={() => setIsUploadModalOpen(false)}>Close</label> */}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-lg loading-spinner text-primary"></span>
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Error! {error}</span>
        </div>
      )}

      {!isLoading && !error && leads.length === 0 && (
        <p className="text-center text-gray-500 py-8">No leads found matching your criteria.</p>
      )}

      {!isLoading && !error && leads.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm w-full">
            <thead>
              <tr>
                <th>Property Address</th>
                <th>City</th>
                <th>State</th>
                <th>Zip</th>
                <th>Contact 1 Name</th>
                <th>Contact 1 Email</th>
                <th>Contact 2 Name</th>
                <th>Contact 2 Email</th>
                <th>Contact 3 Name</th>
                <th>Contact 3 Email</th>
                <th>Agent Name</th>
                <th>Agent Email</th>
                <th>Market Region</th>
                <th>Wholesale Value</th>
                <th>MLS Status</th>
                <th>MLS Days on Market</th>
                <th>Property Type</th>
                <th>Beds</th>
                <th>Baths</th>
                <th>Sq Foot</th>
                <th>Year Built</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.property_address || 'N/A'}</td>
                  <td>{lead.property_city || 'N/A'}</td>
                  <td>{lead.property_state || 'N/A'}</td>
                  <td>{lead.property_postal_code || 'N/A'}</td>
                  <td>{lead.contact1_name || 'N/A'}</td>
                  <td>{lead.contact1_email_1 || 'N/A'}</td>
                  <td>{lead.contact2_name || 'N/A'}</td>
                  <td>{lead.contact2_email_1 || 'N/A'}</td>
                  <td>{lead.contact3_name || 'N/A'}</td>
                  <td>{lead.contact3_email_1 || 'N/A'}</td>
                  <td>{lead.mls_curr_list_agent_name || 'N/A'}</td>
                  <td>{lead.mls_curr_list_agent_email || 'N/A'}</td>
                  <td>{lead.market_region || 'N/A'}</td>
                  <td>{lead.wholesale_value ? `$${Number(lead.wholesale_value).toLocaleString()}` : 'N/A'}</td>
                  <td>{lead.mls_curr_status || 'N/A'}</td>
                  <td>{lead.mls_curr_days_on_market || 'N/A'}</td>
                  <td>{lead.property_type || 'N/A'}</td>
                  <td>{lead.beds || 'N/A'}</td>
                  <td>{lead.baths || 'N/A'}</td>
                  <td>{lead.square_footage || 'N/A'}</td>
                  <td>{lead.year_built || 'N/A'}</td>
                  <td>{formatDate(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && leads.length > 0 && renderPagination()}

    </div>
  );
};

export default LeadsPage;
