'use client';

import dynamic from 'next/dynamic';
import React from 'react';
const EmailSendersView = dynamic(() => import('@/components/views/EmailSendersView'), { ssr: false });

export default function EmailSendersPage() {
  return <EmailSendersView />;
}