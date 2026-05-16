import { useEffect, useState } from "react";
import { AdminDangerModal } from "../../components/admin/AdminDangerModal";
import { TransientToast } from "../../components/admin/TransientToast";
import { useAuth } from "../../context/AuthContext";
import { isAdminRole } from "../../lib/permissions";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** @param {{ onDeleted?: () => void, rangeStart?: string, rangeEnd?: string }} props */
export function AdminDeleteReports({ onDeleted, rangeStart, rangeEnd }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [dateModal, setDateModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [fromDate, setFromDate] = useState(() => rangeStart || todayYmd());
  const [toDate, setToDate] = useState(() => rangeEnd || todayYmd());
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (rangeStart) setFromDate(rangeStart);
    if (rangeEnd) setToDate(rangeEnd);
  }, [rangeStart, rangeEnd]);

  if (!isAdminRole(session?.role)) return null;

  const openDateModal = () => {
    setFromDate(rangeStart || fromDate || todayYmd());
    setToDate(rangeEnd || toDate || todayYmd());
    setDateModal(true);
  };

  const openConfirm = () => {
    if (!fromDate || !toDate) return;
    setDateModal(false);
    setConfirmModal(true);
  };

  const runDelete = async () => {
    if (!window.pos?.deleteReportsInRange) {
      setToast({ type: "err", text: "Delete API unavailable. Restart the app (npm run dev)." });
      return;
    }
    setBusy(true);
    try {
      const res = await window.pos.deleteReportsInRange({ startDate: fromDate, endDate: toDate });
      if (res?.ok) {
        setConfirmModal(false);
        setToast({
          type: "ok",
          text: `Deleted ${res.salesDeleted ?? 0} sales and ${res.expensesDeleted ?? 0} expenses.`
        });
        onDeleted?.();
      } else {
        setToast({ type: "err", text: res?.error || "Delete failed" });
      }
    } catch (e) {
      setToast({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={openDateModal}
        className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40"
      >
        Delete reports
      </button>

      <TransientToast toast={toast} onDismiss={() => setToast(null)} />

      <AdminDangerModal open={dateModal} title="Delete reports — date range" busy={busy} onClose={() => !busy && setDateModal(false)}>
        <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
          Permanently removes sales and expenses in this range. Stock is restored when possible.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">To date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setDateModal(false)} className="rounded-lg border px-3 py-2 text-sm dark:border-zinc-600">
            Cancel
          </button>
          <button type="button" onClick={openConfirm} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">
            Continue
          </button>
        </div>
      </AdminDangerModal>

      <AdminDangerModal open={confirmModal} title="Confirm delete reports" busy={busy} onClose={() => !busy && setConfirmModal(false)}>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Delete all sales and expenses from <strong>{fromDate}</strong> to <strong>{toDate}</strong>? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setConfirmModal(false)} className="rounded-lg border px-3 py-2 text-sm dark:border-zinc-600">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runDelete()}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
            {busy ? "Deleting…" : "Confirm delete"}
          </button>
        </div>
      </AdminDangerModal>
    </>
  );
}
