import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ToastState {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

type ShowToast = (message: string, action?: { label: string; run: () => void }) => void;

const ToastContext = createContext<ShowToast>(() => {});

export const useToast = () => useContext(ToastContext);

/** Undo-style toasts. Rendered inside the app frame, above the tab bar. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<ShowToast>((message, action) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, action });
    timer.current = setTimeout(() => setToast(t => (t?.id === id ? null : t)), action ? 5000 : 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="absolute left-1/2 bottom-[92px] z-[60] max-w-[calc(100%-32px)] flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-2xl bg-[#1C1C1E] dark:bg-white text-white dark:text-black text-[14px] shadow-xl animate-toastIn"
        >
          <span className="min-w-0">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
              className="font-bold text-[#06C755] dark:text-[#008A3D] shrink-0"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
};
