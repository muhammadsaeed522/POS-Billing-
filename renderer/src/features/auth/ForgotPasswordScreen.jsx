import { useState } from "react";
import { AuthLayout } from "../../components/AuthLayout";

export function ForgotPasswordScreen({ loading, error, message, resetToken, onSubmit, onLogin, onReset }) {
  const [email, setEmail] = useState("");

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll generate a reset token (offline POS)"
      footer={
        <p>
          <button type="button" onClick={onLogin} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            Back to sign in
          </button>
        </p>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(email.trim());
        }}
      >
        {error ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            {message}
            {resetToken ? (
              <p className="mt-2 break-all font-mono text-xs">
                Token: <span className="select-all">{resetToken}</span>
              </p>
            ) : null}
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
          <input
            type="email"
            required
            disabled={loading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Sending…" : "Get reset token"}
        </button>
        {resetToken ? (
          <button type="button" onClick={() => onReset(resetToken)} className="w-full rounded-lg border border-zinc-300 py-2 text-sm font-medium dark:border-zinc-600">
            Continue to reset password
          </button>
        ) : null}
      </form>
    </AuthLayout>
  );
}
