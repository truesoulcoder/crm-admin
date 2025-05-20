'use client';

import React from 'react';

import RequireAuth from '@/components/RequireAuth';
import LeadsView from '@/components/views/LeadsView';

const LeadsPage = () => {
  return (
    <RequireAuth>
      <LeadsView />
    </RequireAuth>
  );
};

export default LeadsPage;
