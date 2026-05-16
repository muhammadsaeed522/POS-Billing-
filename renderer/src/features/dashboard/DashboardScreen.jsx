import { useCallback, useEffect, useState } from "react";
import { AdminDeleteDashboard } from "../admin/AdminDeleteDashboard";
import { formatMoney, formatQtyFromMilli } from "../../lib/format";

function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div> : null}
    </div>
  );
}

export function DashboardScreen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!window.pos?.getDashboardSnapshot) {
      setError("Dashboard API unavailable.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snap = await window.pos.getDashboardSnapshot();
      setData(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-label="Loading dashboard" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
        {error}
        <button type="button" className="mt-3 rounded-lg bg-red-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const netToday = data.todayProfitCents - data.todayExpenseCents;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{data.dateLabel}</p>
        </div>
        <AdminDeleteDashboard onDeleted={() => void load()} />
      </div>

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 ${loading ? "opacity-70" : ""}`}>
        <StatCard title="Today sales" value={formatMoney(data.todaySalesCents)} hint={`${data.todayBillsCount} bills`} />
        <StatCard title="Today profit (est.)" value={formatMoney(data.todayProfitCents)} hint="From line totals − cost at purchase price" />
        <StatCard title="Today expenses" value={formatMoney(data.todayExpenseCents)} hint={`${data.todayExpenseCount} entries`} />
        <StatCard title="Net (profit − expenses)" value={formatMoney(netToday)} hint="Quick daily pulse" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StatCard title="7-day expenses" value={formatMoney(data.last7DaysExpenseCents)} hint="Rolling window" />
        <StatCard title="Top products window" value="30 days" hint="By quantity sold" />
        <StatCard title="Low stock alerts" value={String(data.lowStock.length)} hint="Active products at or below threshold" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Low stock</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Uses per-product low-stock level, or ≤ 0 if unset.</p>
          </div>
          <div className="max-h-80 overflow-auto">
            {data.lowStock.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No low-stock items. Great.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 font-medium">Stock</th>
                    <th className="px-4 py-2 font-medium">Threshold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.lowStock.map((row) => (
                    <tr key={row.id} className="text-zinc-800 dark:text-zinc-200">
                      <td className="px-4 py-2">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-zinc-500">{row.unit}</div>
                      </td>
                      <td className="px-4 py-2 tabular-nums text-amber-700 dark:text-amber-300">
                        {formatQtyFromMilli(row.stockQtyMilli, row.unit)}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-zinc-500">
                        {row.lowStockQtyMilli != null ? formatQtyFromMilli(row.lowStockQtyMilli, row.unit) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Top selling products</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Last 30 days by quantity.</p>
          </div>
          <div className="max-h-80 overflow-auto">
            {data.topProducts.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No sales yet. POS billing will populate this.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 font-medium">Qty</th>
                    <th className="px-4 py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.topProducts.map((row) => (
                    <tr key={row.productId} className="text-zinc-800 dark:text-zinc-200">
                      <td className="px-4 py-2 font-medium">{row.name}</td>
                      <td className="px-4 py-2 tabular-nums">{formatQtyFromMilli(row.qtyMilliSold, row.unit)}</td>
                      <td className="px-4 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">{formatMoney(row.lineRevenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
