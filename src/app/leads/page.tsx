'use client';

import React from 'react';

import LeadsView from '@/components/views/LeadsView';
import RequireAuth from '@/components/RequireAuth';

const LeadsPage = () => {
  return (
    <RequireAuth>
      <LeadsView />
    </RequireAuth>
  );
};

export default LeadsPage;
