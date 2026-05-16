import { useCallback, useEffect, useState } from "react";

const ROLE_OPTIONS = ["admin", "manager", "cashier", "staff"];

const ROLE_HINTS = {
  admin: "Full store access · can manage users & other admins",
  manager: "Products, reports, billing (no user admin)",
  cashier: "Billing & dashboard",
  staff: "Billing, dashboard, view products"
};

export function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    role: "cashier"
  });

  const load = useCallback(async () => {
    if (!window.pos?.listUsers) return;
    setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        window.pos.listUsers({ query, page, pageSize: 15 }),
        window.pos.getAdminStats?.() ?? { ok: true, stats: null }
      ]);
      if (listRes.ok) {
        setUsers(listRes.users);
        setTotal(listRes.total);
      } else setError(listRes.error);
      if (statsRes.ok) setStats(statsRes.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / 15));

  return (
    <div className="space-y-4">
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Users", stats.userCount],
            ["Online sessions", stats.activeSessions],
            ["Logins today", stats.todayLogins],
            ["Sales today", stats.salesToday]
          ].map(([label, val]) => (
            <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase text-zinc-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{val}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search users…"
          className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {formOpen ? "Cancel" : "Add user"}
        </button>
      </div>

      {formOpen ? (
        <form
          className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await window.pos.createUser(form);
            if (res.ok) {
              setFormOpen(false);
              setForm({ displayName: "", username: "", email: "", phone: "", password: "", role: "cashier" });
              void load();
            } else setError(res.error);
          }}
        >
          {["displayName", "username", "email", "phone", "password"].map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium capitalize text-zinc-600">{key.replace(/([A-Z])/g, " $1")}</label>
              <input
                required={key !== "phone"}
                type={key === "password" ? "password" : key === "email" ? "email" : "text"}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {form.role ? <p className="mt-1 text-[10px] text-zinc-500">{ROLE_HINTS[form.role]}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
              Create user
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <p className="p-6 text-sm text-zinc-500">Loading users…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{u.displayName}</div>
                    <p className="text-xs text-zinc-500">
                      @{u.username} · {u.email || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2 capitalize">{u.role}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        u.isActive
                          ? u.isOnline
                            ? "text-emerald-600"
                            : "text-zinc-600"
                          : "text-red-600"
                      }
                    >
                      {!u.isActive ? "Disabled" : u.isOnline ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <select
                      className="mr-1 rounded border border-zinc-300 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      value={u.role}
                      onChange={async (e) => {
                        await window.pos.updateUser({ id: u.id, role: e.target.value });
                        void load();
                      }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="mr-1 text-xs text-amber-700"
                      onClick={async () => {
                        await window.pos.updateUser({ id: u.id, isActive: !u.isActive });
                        void load();
                      }}
                    >
                      {u.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={async () => {
                        if (!confirm(`Delete ${u.username}?`)) return;
                        await window.pos.deleteUser({ id: u.id });
                        void load();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">
          Page {page} of {pageCount} · {total} users
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
