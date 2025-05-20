'use client'

import dynamic from 'next/dynamic';
import React from 'react';

import RequireAuth from '@/components/RequireAuth';

const CampaignsView = dynamic(() => import('@/components/views/CampaignsView'), { ssr: false });

export default function CampaignsPage() {
  return (
    <RequireAuth>
      <CampaignsView />
    </RequireAuth>
  );
}
