'use client';
import dynamic from 'next/dynamic';
import React from 'react';

import RequireAuth from '@/components/RequireAuth';

const TemplatesView = dynamic(() => import('@/components/views/TemplatesView'), { ssr: false });

export default function TemplatesPage() {
  return (
    <RequireAuth>
      <TemplatesView />
    </RequireAuth>
  );
}