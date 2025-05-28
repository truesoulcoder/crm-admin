import { useState } from 'react';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface Toast extends ToastOptions {
  id: string;
  visible: boolean;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (options: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      id,
      visible: true,
      title: options.title,
      description: options.description,
      variant: options.variant || 'default',
      duration: options.duration || 5000,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss
    if (newToast.duration) {
      setTimeout(() => {
        dismissToast(id);
      }, newToast.duration);
    }

    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, visible: false } : toast
      )
    );

    // Remove from DOM after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300);
  };

  return {
    toasts,
    showToast,
    dismissToast,
    toast: showToast, // Alias for convenience
  };
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast toast-end toast-bottom">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`alert ${
            toast.variant === 'success'
              ? 'alert-success'
              : toast.variant === 'error'
              ? 'alert-error'
              : toast.variant === 'warning'
              ? 'alert-warning'
              : toast.variant === 'info'
              ? 'alert-info'
              : ''
          } ${toast.visible ? 'animate-fade-in' : 'animate-fade-out'}`}
        >
          <div>
            {toast.title && <h3 className="font-bold">{toast.title}</h3>}
            {toast.description && <div className="text-xs">{toast.description}</div>}
          </div>
          <button className="btn btn-sm btn-circle" onClick={() => onDismiss(toast.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
