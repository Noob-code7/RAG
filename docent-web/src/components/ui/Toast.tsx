import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface Toast {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  push: (message: string, opts?: { action?: Toast['action'] }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastContextValue['push']>(
    (message, opts) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, action: opts?.action }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-sm px-md">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-pop pointer-events-auto flex max-w-md items-center gap-md rounded-lg border border-outline-variant bg-inverse-surface px-md py-sm font-body-ui text-body-ui text-inverse-on-surface shadow-lg"
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 cursor-pointer border-none bg-transparent p-0 font-label-caps text-label-caps text-inverse-primary hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 cursor-pointer rounded p-1 text-inverse-on-surface/70 transition-colors hover:bg-inverse-on-surface/10"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue['push'] {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.push;
}