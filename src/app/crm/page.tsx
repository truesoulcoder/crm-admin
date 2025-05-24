import CrmLeadsView from '@/components/views/CrmView';

export const dynamic = 'force-dynamic';

export default function CrmPage() {
  return (
    <div className="w-full h-full">
      <CrmLeadsView />
    </div>
  );
}
import CrmLeadsView from '@/components/views/CrmView';
import GoogleMapsLoader from '@/components/maps/GoogleMapsLoader'; // Import the loader

export const dynamic = 'force-dynamic';

export default function CrmPage() {
  return (
    <GoogleMapsLoader> {/* Wrap CrmLeadsView with GoogleMapsLoader */}
      <div className="w-full h-full">
        <CrmLeadsView />
      </div>
    </GoogleMapsLoader>
  );
}
