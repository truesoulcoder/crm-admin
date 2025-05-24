import React from 'react';

import CrmTable from '@/components/crm/CrmTable';
import { createClient } from '@/lib/supabase/server';
import { handleLeadUpdateAction } from './actions';

import type { Lead } from '@/components/crm/CrmTable';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seller Management',
  description: 'Manage seller leads and interactions',
};

export default async function CrmPage() {
  const supabase = await createClient(); // Added await here

  const { data: leads, error } = await supabase
    .from('normalized_leads')
    .select('*')
    .order('created_at', { ascending: false });

if (error) {
  return (
    <div className="alert alert-error mt-4">
      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <h3 className="font-bold">Error loading leads!</h3>
        <div className="text-xs">
          {(error as Error)?.message || JSON.stringify(error)}
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Seller Management</h1>
      <CrmTable 
        data={leads || []}
        isLoading={false}
        onRowUpdate={handleLeadUpdateAction}
      />
    </div>
  );
}
