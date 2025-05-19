'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const EmailSendersView = dynamic(() => import('@/components/views/EmailSendersView'), { ssr: false });
import RequireAuth from '@/components/RequireAuth';

export default function EmailSendersPage() {
  return (
    <RequireAuth>
      <EmailSendersView />
    </RequireAuth>
  );
}