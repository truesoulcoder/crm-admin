'use client';
import dynamic from 'next/dynamic';
import React from 'react';

import RequireAuth from '@/components/RequireAuth';

const SettingsView = dynamic(() => import('@/components/views/SettingsView'), { ssr: false });

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsView />
    </RequireAuth>
  );
}