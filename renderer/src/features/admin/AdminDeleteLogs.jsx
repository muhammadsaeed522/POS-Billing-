import { useState } from "react";
import { AdminDangerModal } from "../../components/admin/AdminDangerModal";
import { TransientToast } from "../../components/admin/TransientToast";
import { useAuth } from "../../context/AuthContext";
import { isAdminRole } from "../../lib/permissions";

export function AdminDeleteLogs({ onDeleted }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [toast, setToast] = useState(null);

  if (!isAdminRole(session?.role)) return null;

  const canConfirm = confirmText.trim().toUpperCase() === "DELETE";

  const runDelete = async () => {
    setBusy(true);
    try {
      const res = await window.pos.deleteAllActivityLogs();
      if (res.ok) {
        setModalOpen(false);
        setConfirmText("");
        setToast({ type: "ok", text: "Activity logs deleted." });
        onDeleted?.();
      } else setToast({ type: "err", text: res.error || "Delete failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setModalOpen(true)}
        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300"
      >
        Delete logs
      </button>

      <TransientToast toast={toast} onDismiss={() => setToast(null)} />

      <AdminDangerModal open={modalOpen} title="Delete all activity logs?" busy={busy} onClose={() => !busy && setModalOpen(false)}>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Are you sure you want to delete all activity logs? This cannot be undone.</p>
        <p className="mt-3 text-sm font-medium text-red-800 dark:text-red-200">
          Type <span className="font-mono">DELETE</span> to confirm:
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={busy}
          className="mt-2 w-full rounded-lg border border-red-300 px-3 py-2 font-mono text-sm dark:border-red-800 dark:bg-zinc-950"
          placeholder="DELETE"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setModalOpen(false)} className="rounded-lg border px-3 py-2 text-sm dark:border-zinc-600">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !canConfirm}
            onClick={() => void runDelete()}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
            {busy ? "Deleting…" : "Yes, delete all"}
          </button>
        </div>
      </AdminDangerModal>
    </>
  );
}
