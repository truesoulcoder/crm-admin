'use client';
import dynamic from 'next/dynamic';
import React from 'react';

const CampaignsView = dynamic(() => import('@/components/views/CampaignsView'), { ssr: false });
import RequireAuth from '@/components/RequireAuth';

export default function CampaignsPage() {
  return (
    <RequireAuth>
      <CampaignsView />
    </RequireAuth>
  );
}
