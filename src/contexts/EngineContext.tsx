// src/contexts/EngineContext.tsx
import { createContext, useContext, ReactNode } from 'react';

import { useEngineControl, EngineStatus } from '@/hooks/useEngineControl';

interface EngineContextType {
  status: EngineStatus;
  error: string | null;
  startEngine: (params: any) => Promise<void>;
  stopEngine: () => Promise<void>;
}

const EngineContext = createContext<EngineContextType | undefined>(undefined);

export function EngineProvider({ children }: { children: ReactNode }) {
  const { engineStatus, error, startEngine, stopEngine } = useEngineControl();

  return (
    <EngineContext.Provider
      value={{
        status: engineStatus,
        error,
        startEngine,
        stopEngine,
      }}
    >
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