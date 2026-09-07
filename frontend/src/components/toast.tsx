"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastCtx = createContext<(kind: ToastKind, message: string) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastCtx);
}

const icons: Record<ToastKind, string> = {
  success: "M20 6 9 17l-5-5",
  error:
    "M18 6 6 18M6 6l12 12",
  info: "M12 16v-4M12 8h.01",
};

const styles: Record<ToastKind, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 [&_svg]:text-emerald-500",
  error: "border-rose-200 bg-rose-50 text-rose-800 [&_svg]:text-rose-500",
  info: "border-brand-200 bg-brand-50 text-brand-800 [&_svg]:text-brand-500",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-up pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg shadow-ink-900/5 ${styles[t.kind]}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 h-4 w-4 shrink-0"
            >
              <path d={icons[t.kind]} />
            </svg>
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
