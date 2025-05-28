// src/contexts/EngineContext.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';

import { useEngineControl, EngineStatus } from '@/hooks/useEngineControl';

interface EngineContextType {
  status: EngineStatus;
  startEngine: () => Promise<void>;
  stopEngine: () => Promise<void>;
  error: string | null;
  isStarting: boolean;
  isStopping: boolean;
}

const EngineContext = createContext<EngineContextType | undefined>(undefined);

export function EngineProvider({ children }: { children: ReactNode }) {
  const engine = useEngineControl();
  
  return (
    <EngineContext.Provider value={engine}>
      {children}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const context = useContext(EngineContext);
  if (context === undefined) {
    throw new Error('useEngine must be used within an EngineProvider');
  }
  return context;
}