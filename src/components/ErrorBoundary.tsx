'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: any[];
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && 
        JSON.stringify(prevProps.resetKeys) !== JSON.stringify(this.props.resetKeys)) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
          <div className="card bg-base-200 shadow-xl max-w-2xl w-full">
            <div className="card-body">
              <h2 className="card-title text-error text-2xl mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Something went wrong
              </h2>
              
              <div className="bg-base-300 rounded-lg p-4 mb-4">
                <p className="font-semibold mb-2">{this.state.error?.message || 'An unknown error occurred'}</p>
                <details className="collapse collapse-arrow">
                  <summary className="collapse-title text-sm font-medium cursor-pointer">Show error details</summary>
                  <div className="collapse-content">
                    <pre className="text-xs bg-base-100 p-2 rounded overflow-auto max-h-60">
                      {this.state.error?.stack}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </div>
                </details>
              </div>

              <div className="card-actions justify-end">
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null });
                  }}
                >
                  Try again
                </button>
                <button 
                  className="btn btn-ghost"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}