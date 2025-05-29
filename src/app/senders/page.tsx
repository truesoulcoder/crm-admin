// src/app/senders/page.tsx
'use client';
import dynamic from 'next/dynamic';

const EmailSendersView = dynamic(
  () => import('@/components/views/EmailSendersView'),
  { ssr: false }
);

export default function SendersPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Email Senders</h1>
      </div>
      <div className="space-y-4">
        <EmailSendersView />
      </div>
    </div>
  );
}