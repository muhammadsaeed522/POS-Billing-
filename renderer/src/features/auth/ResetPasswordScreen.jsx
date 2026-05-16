import { useState } from "react";
import { AuthLayout } from "../../components/AuthLayout";
import { PasswordField } from "../../components/PasswordField";

export function ResetPasswordScreen({ loading, error, initialToken, onSubmit, onLogin }) {
  const [token, setToken] = useState(initialToken ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Enter the token from forgot-password step"
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
          onSubmit({ token: token.trim(), password, confirmPassword });
        }}
      >
        {error ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Reset token</label>
          <input
            required
            disabled={loading}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <PasswordField label="New password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} autoComplete="new-password" />
        <PasswordField label="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} autoComplete="new-password" />
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
}
