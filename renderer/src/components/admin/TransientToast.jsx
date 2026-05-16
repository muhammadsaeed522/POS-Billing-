import { useEffect } from "react";

const TOAST_MS = 3000;

/**
 * Fixed-position toast that auto-dismisses.
 * @param {{ toast: { type: 'ok' | 'err', text: string, action?: { label: string, onClick: () => void } } | null, onDismiss: () => void, durationMs?: number }} props
 */
export function TransientToast({ toast, onDismiss, durationMs = TOAST_MS }) {
  useEffect(() => {
    if (!toast) return undefined;
    const ms = toast.action ? Math.max(durationMs, 8000) : durationMs;
    const t = window.setTimeout(onDismiss, ms);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;

  const ok = toast.type === "ok";

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-[85] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
      }`}
    >
      <p>{toast.text}</p>
      {toast.action ? (
        <button type="button" onClick={toast.action.onClick} className="mt-2 text-xs font-semibold underline">
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}
