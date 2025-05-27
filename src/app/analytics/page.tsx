'use client';

import dynamic from 'next/dynamic';

// Dynamically import the CampaignsView component with SSR disabled
const CampaignAnalytics = dynamic(
  () => import('@/components/analytics/CampaignAnalytics'),
  { ssr: false }
);

export default function CampaignAnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <CampaignAnalytics />
    </div>
  );
}
