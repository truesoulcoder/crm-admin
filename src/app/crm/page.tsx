"use client";

import GoogleMapsLoader from '@/components/maps/GoogleMapsLoader'; // Import the loader
import CrmView from '@/components/views/CrmView';

export const dynamic = 'force-dynamic';

export default function CrmPage() {
  return (
    <GoogleMapsLoader> {/* Wrap CRMView with GoogleMapsLoader */}
      <div className="w-full h-full">
        <CrmView />
      </div>
    </GoogleMapsLoader>
  );
}
