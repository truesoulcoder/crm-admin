'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import Eli5EngineControlView from '@/components/views/Eli5EngineControlView';

export default function ErrorBoundaryPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Engine Control</h1>
      <ErrorBoundary fallback={
        <div className="alert alert-error">
          Failed to load engine control. Please try again.
        </div>
      }>
        <Eli5EngineControlView />
      </ErrorBoundary>
    </div>
  );
}