'use client';

import CrmView from '@/components/views/CrmView';
import RequireAuth from '@/components/RequireAuth';

export default function CrmPage() {
  return (
    <RequireAuth>
      <CrmView />
    </RequireAuth>
  );
}
