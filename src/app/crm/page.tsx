'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Import CrmView component
import CrmView from '@/components/views/CrmView';

// Dynamically import the GoogleMapsLoader with SSR disabled
const GoogleMapsLoader = dynamic(
  () => import('@/components/maps/GoogleMapsLoader'),
  { ssr: false }
);

export default function CrmPage() {
  return (
    <GoogleMapsLoader>
      <CrmView />
    </GoogleMapsLoader>
  );
}
