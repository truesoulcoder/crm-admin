'use client';

import RequireAuth from '@/components/RequireAuth';
import Eli5EngineControlView from '@/components/views/Eli5EngineControlView';

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Eli5EngineControlView />
    </RequireAuth>
  );
}

