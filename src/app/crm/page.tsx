// app/crm-leads/page.tsx
import React from 'react';

import type { Metadata } from 'next';

import CrmLeads from '@/components/views/CrmLeads'; // Adjust path if necessary


export const metadata: Metadata = {
  title: 'CRM Leads Management',
  description: 'Manage CRM leads including adding, editing, and viewing details.',
};

const CrmLeadsPage: React.FC = () => {
  return (
    <>
      <CrmLeads />
    </>
  );
};

export default CrmLeadsPage;
