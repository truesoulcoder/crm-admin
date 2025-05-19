'use client';
import dynamic from 'next/dynamic';
import React from 'react';

const SettingsView = dynamic(() => import('@/components/views/SettingsView'), { ssr: false });
import RequireAuth from '@/components/RequireAuth';

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsView />
    </RequireAuth>
  );
}