import { useId, useState } from "react";
import { AuthLayout } from "../../components/AuthLayout";
import { PasswordField } from "../../components/PasswordField";

export function LoginScreen({ loading, error, onSubmit, onSignup, onForgot }) {
  const idField = useId();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <AuthLayout
      title="POS Billing"
      subtitle="Sign in to your store account"
      footer={
        <p>
          New here?{" "}
          <button type="button" onClick={onSignup} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            Create account
          </button>
        </p>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(identifier.trim(), password, rememberMe);
        }}
      >
        {error ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <div>
          <label htmlFor={idField} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email or username
          </label>
          <input
            id={idField}
            autoFocus
            disabled={loading}
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-2 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder="you@store.com or username"
          />
        </div>
        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="current-password"
        />
        <div className="flex items-center justify-between gap-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            Remember me
          </label>
          <button type="button" onClick={onForgot} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            Forgot password?
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-emerald-500 disabled:opacity-60 dark:bg-emerald-500"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Signing in…
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
