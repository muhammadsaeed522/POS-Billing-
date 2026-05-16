import { useState } from "react";
import { AuthLayout } from "../../components/AuthLayout";
import { PasswordField } from "../../components/PasswordField";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-2 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100";

export function SetupInitialAdminScreen({ loading, error, onSubmit }) {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AuthLayout
      title="Store setup"
      subtitle="One-time: create the first administrator for this POS"
    >
      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
        No default password exists. This account will have full access and can add other administrators later.
      </p>
      <form
        className="max-h-[70vh] space-y-3 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        {error ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Full name</label>
          <input required disabled={loading} value={form.fullName} onChange={set("fullName")} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Username</label>
          <input required disabled={loading} value={form.username} onChange={set("username")} className={inputClass} autoComplete="username" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
          <input required type="email" disabled={loading} value={form.email} onChange={set("email")} className={inputClass} autoComplete="email" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Phone (optional)</label>
          <input disabled={loading} value={form.phone} onChange={set("phone")} className={inputClass} autoComplete="tel" />
        </div>
        <PasswordField label="Password" disabled={loading} value={form.password} onChange={set("password")} autoComplete="new-password" />
        <PasswordField label="Confirm password" disabled={loading} value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
          {loading ? "Creating administrator…" : "Create administrator & continue"}
        </button>
      </form>
    </AuthLayout>
  );
}
