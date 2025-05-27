'use client';

// In the parent component that renders Eli5EngineControlView
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Eli5EngineControlView from '@/components/views/Eli5EngineControlView';

// Inside your component's render:
<ErrorBoundary fallback={<div>Failed to load engine control. Please try again.</div>}>
  <Eli5EngineControlView />
</ErrorBoundary>