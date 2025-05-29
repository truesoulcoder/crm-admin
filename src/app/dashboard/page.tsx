// src/app/dashboard/page.tsx
'use client';
import Eli5EngineControlView from '@/components/views/Eli5EngineControlView';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>
      <div className="space-y-4">
        <Eli5EngineControlView />
      </div>
    </div>
  );
}