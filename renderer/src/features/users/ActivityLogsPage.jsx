import { useCallback, useEffect, useState } from "react";
import { AdminDeleteLogs } from "../admin/AdminDeleteLogs";

export function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!window.pos?.listActivity) return;
    setLoading(true);
    const res = await window.pos.listActivity({
      page,
      pageSize: 30,
      action: actionFilter || undefined
    });
    if (res.ok) {
      setLogs(res.logs);
      setTotal(res.total);
    }
    setLoading(false);
  }, [page, actionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Activity logs</h1>
        <AdminDeleteLogs onDeleted={() => void load()} />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by action (login, sale_checkout, …)"
          className="min-w-[220px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
        <button type="button" onClick={() => void load()} className="rounded-lg border px-3 py-2 text-sm dark:border-zinc-600">
          Refresh
        </button>
      </div>
      <div className="overflow-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-4 text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{l.displayName || l.username || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
                  <td className="max-w-md truncate px-3 py-2 text-zinc-600 dark:text-zinc-400">{l.details || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm text-zinc-500">
        <span>
          {total} events · page {page}/{pageCount}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">
            Prev
          </button>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
