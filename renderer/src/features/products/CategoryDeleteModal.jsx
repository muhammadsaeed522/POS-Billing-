import { useEffect, useState } from "react";
import { AdminDangerModal } from "../../components/admin/AdminDangerModal";

/**
 * Two-step category delete: confirm name, then cascade warning + delete mode.
 * @param {{ open: boolean, category: { id: string, name: string, productCount?: number } | null, busy: boolean, onClose: () => void, onConfirm: (mode: 'cascade' | 'unlink') => void }} props
 */
export function CategoryDeleteModal({ open, category, busy, onClose, onConfirm }) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("cascade");

  useEffect(() => {
    if (open) {
      setStep(1);
      setMode("cascade");
    }
  }, [open, category?.id]);

  if (!category) return null;

  const count = category.productCount ?? 0;

  if (step === 1) {
    return (
      <AdminDangerModal open={open} title="Delete category?" busy={busy} onClose={onClose}>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Are you sure you want to delete the category <strong>{category.name}</strong>?
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This category contains <strong>{count}</strong> product{count === 1 ? "" : "s"}.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border px-3 py-2 text-sm dark:border-zinc-600">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep(2)}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            Continue
          </button>
        </div>
      </AdminDangerModal>
    );
  }

  return (
    <AdminDangerModal open={open} title="Confirm category deletion" busy={busy} onClose={onClose}>
      <p className="text-sm font-medium text-red-800 dark:text-red-200">
        {mode === "cascade"
          ? "This will also delete all products inside this category. This action cannot be undone."
          : "The category will be removed. Products will remain in inventory without a category."}
      </p>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        Category: <strong>{category.name}</strong> · {count} product{count === 1 ? "" : "s"} will be affected.
      </p>
      <fieldset className="mt-4 space-y-2 text-sm">
        <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Deletion mode</legend>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
          <input
            type="radio"
            name="cat-delete-mode"
            value="cascade"
            checked={mode === "cascade"}
            disabled={busy}
            onChange={() => setMode("cascade")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Delete category + all products</span>
            <span className="mt-0.5 block text-xs text-zinc-500">Default — permanently removes every product in this category.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
          <input
            type="radio"
            name="cat-delete-mode"
            value="unlink"
            checked={mode === "unlink"}
            disabled={busy}
            onChange={() => setMode("unlink")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Delete category only (keep products)</span>
            <span className="mt-0.5 block text-xs text-zinc-500">Products stay in inventory without a category.</span>
          </span>
        </label>
      </fieldset>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={() => setStep(1)} className="rounded-lg border px-3 py-2 text-sm dark:border-zinc-600">
          Back
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(mode)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
          {busy ? "Deleting…" : "Confirm delete"}
        </button>
      </div>
    </AdminDangerModal>
  );
}
