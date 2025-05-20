'use client';

import dynamic from 'next/dynamic';
import React from 'react';

import RequireAuth from '@/components/RequireAuth';

const EmailSendersView = dynamic(() => import('@/components/views/EmailSendersView'), { ssr: false });

export default function EmailSendersPage() {
  return (
    <RequireAuth>
      <EmailSendersView />
    </RequireAuth>
  );
}