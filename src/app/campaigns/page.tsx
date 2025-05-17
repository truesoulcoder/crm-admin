'use client';
import dynamic from 'next/dynamic';
import React from 'react';

const CampaignsView = dynamic(() => import('@/components/views/CampaignsView'), { ssr: false });

export default function CampaignsPage() {
  return <CampaignsView />;
}
