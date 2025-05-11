'use client';

import React from 'react';
import dynamic from 'next/dynamic';
const EmailSendersView = dynamic(() => import('@/components/views/EmailSendersView'), { ssr: false });

export default function EmailSendersPage() {
  return <EmailSendersView />;
}