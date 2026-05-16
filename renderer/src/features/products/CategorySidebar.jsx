import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { isAdminRole } from "../../lib/permissions";
import { CategoryDeleteModal } from "./CategoryDeleteModal";

export function CategorySidebar({ categories, catName, setCatName, onAddCategory, onDeleted }) {
  const { session } = useAuth();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const admin = isAdminRole(session?.role);

  const runDelete = async (mode) => {
    if (!pending || !window.pos?.deleteCategory) return;
    setBusy(true);
    try {
      const res = await window.pos.deleteCategory({ id: pending.id, mode });
      if (res.ok) {
        setPending(null);
        const msg =
          mode === "cascade"
            ? "Category and all related products deleted successfully"
            : `Category deleted. ${res.productsUnassigned ?? 0} product(s) are now uncategorized.`;
        onDeleted?.({ type: "ok", text: msg });
      } else {
        onDeleted?.({ type: "err", text: res.error || "Delete failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <aside className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-1">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Categories</h2>
        <div className="flex gap-2">
          <input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="New category"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={() => void onAddCategory()}
            className="shrink-0 rounded-md bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add
          </button>
        </div>
        <ul className="max-h-48 space-y-1 overflow-auto text-sm">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
            >
              <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                {c.name}
                <span className="ml-1 text-xs font-normal text-zinc-500">({c.productCount ?? 0})</span>
              </span>
              {admin ? (
                <button
                  type="button"
                  disabled={busy}
                  className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  onClick={() => setPending(c)}
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {!admin ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Only admins can delete categories.</p>
        ) : null}
      </aside>

      <CategoryDeleteModal
        open={Boolean(pending)}
        category={pending}
        busy={busy}
        onClose={() => !busy && setPending(null)}
        onConfirm={(mode) => void runDelete(mode)}
      />
    </>
  );
}
