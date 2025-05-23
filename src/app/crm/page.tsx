import React from 'react';

import CrmView from '@/components/crm/CrmTable';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seller Management',
  description: 'Manage CRM leads including adding, editing, and viewing details.',
};

const CrmPage: React.FC = () => {
  return (
    <>
      <CrmTable />
    </>
  );
};

export default CrmPage;
