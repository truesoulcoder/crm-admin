'use client';
import dynamic from 'next/dynamic';
import React from 'react';

const TemplatesView = dynamic(() => import('@/components/views/TemplatesView'), { ssr: false });
import RequireAuth from '@/components/RequireAuth';

export default function TemplatesPage() {
  return (
    <RequireAuth>
      <TemplatesView />
    </RequireAuth>
  );
}