import { useEffect, useMemo, useState } from "react";
import { BrandingLogo } from "../../components/BrandingLogo";
import { useBranding } from "../../context/BrandingContext";
import { canAccessView, canManageUsers, isAdminRole } from "../../lib/permissions";
import { DashboardScreen } from "../dashboard/DashboardScreen";
import { PosBillingPage } from "../billing/PosBillingPage";
import { ProductsPage } from "../products/ProductsPage";
import { ReportsPage } from "../reports/ReportsPage";
import { AdminUsersPage } from "../users/AdminUsersPage";
import { ActivityLogsPage } from "../users/ActivityLogsPage";
import { ProfilePage } from "../profile/ProfilePage";
const NAV_BASE = [
  { id: "dash", label: "Dashboard" },
  { id: "pos", label: "Billing (POS)" },
  { id: "products", label: "Products" },
  { id: "reports", label: "Reports" },
  { id: "users", label: "Users", adminOnly: true },
  { id: "activity", label: "Activity logs", adminOnly: true },
  { id: "profile", label: "My profile" }
];

const TITLES = {
  dash: "Dashboard",
  pos: "Billing (POS)",
  products: "Products",
  reports: "Reports",
  users: "User management",
  activity: "Activity logs",
  profile: "My profile"
};

export function AppShell({ session, onLogout }) {
  const [view, setView] = useState("dash");
  const { logo } = useBranding();
  const roleLabel = session.role.charAt(0).toUpperCase() + session.role.slice(1);
  const admin = isAdminRole(session.role);

  const navItems = useMemo(
    () =>
      NAV_BASE.filter((item) => !item.adminOnly || canManageUsers(session.role)).map((item) => ({
        ...item,
        enabled: canAccessView(session.role, item.id)
      })),
    [session.role]
  );

  useEffect(() => {
    if (!canAccessView(session.role, view)) setView("dash");
  }, [session.role, view]);

  return (
    <div className="flex h-full min-h-0 bg-zinc-100 dark:bg-zinc-950">
      <aside className="no-print flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <BrandingLogo url={logo.url} size="sm" alt="POS Billing" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">POS Billing</div>
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Offline · Secure</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!item.enabled}
              onClick={() => item.enabled && setView(item.id)}
              className={
                view === item.id
                  ? "w-full rounded-lg bg-emerald-50 px-3 py-2 text-left text-sm font-medium text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
                  : item.enabled
                    ? "w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    : "w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm text-zinc-400 line-through dark:text-zinc-600"
              }
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{session.displayName}</div>
          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{roleLabel}</div>
          {admin ? <div className="mt-1 text-[10px] font-medium uppercase text-emerald-600">Admin panel</div> : null}
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex min-w-0 items-center gap-3">
            <BrandingLogo url={logo.url} size="xs" alt="" rounded="rounded-lg" />
            <h2 className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{TITLES[view]}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => document.documentElement.classList.toggle("dark")}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Theme
            </button>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
          <div className="min-h-0 flex-1 overflow-auto">
            {view === "dash" ? <DashboardScreen /> : null}
            {view === "pos" ? <PosBillingPage /> : null}
            {view === "products" ? <ProductsPage /> : null}
            {view === "reports" ? <ReportsPage /> : null}
            {view === "users" ? <AdminUsersPage /> : null}
            {view === "activity" ? <ActivityLogsPage /> : null}
            {view === "profile" ? <ProfilePage /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
