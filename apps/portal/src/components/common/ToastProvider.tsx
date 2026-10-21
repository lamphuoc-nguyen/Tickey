import { useEffect, useState } from 'react';

type ToastTone = 'success' | 'info' | 'warning' | 'danger';

interface ToastEventDetail {
  message: string;
  tone: ToastTone;
}

const TOAST_EVENT = 'tickey-portal-toast';

export function useToast() {
  const showToast = (message: string, tone: ToastTone = 'info') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<ToastEventDetail>(TOAST_EVENT, {
          detail: { message, tone },
        }),
      );
    }
  };

  return { showToast };
}

export function ToastViewport() {
  const [toast, setToast] = useState<ToastEventDetail | null>(null);

  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<ToastEventDetail>;
      setToast(custom.detail);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1200,
        background: '#172A35',
        color: '#FFFFFF',
        padding: '10px 16px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}
    >
      {toast.message}
    </div>
  );
}
