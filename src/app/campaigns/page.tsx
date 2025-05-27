'use client';

import dynamic from 'next/dynamic';

// Dynamically import the CampaignsView component with SSR disabled
const CampaignsView = dynamic(
  () => import('@/components/views/CampaignsView'),
  { ssr: false }
);

export default function CampaignsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <CampaignsView />
    </div>
  );
}
