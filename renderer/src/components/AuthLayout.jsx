import { BrandingLogo } from "./BrandingLogo";
import { useBranding } from "../context/BrandingContext";

export function AuthLayout({ title, subtitle, children, footer }) {
  const { logo } = useBranding();

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-zinc-100 via-emerald-50/30 to-zinc-100 p-4 dark:from-zinc-950 dark:via-emerald-950/20 dark:to-zinc-950 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <BrandingLogo url={logo.url} size="md" className="mx-auto mb-3" alt={`${title} logo`} />
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          {children}
        </div>
        {footer ? <div className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{footer}</div> : null}
      </div>
    </div>
  );
}
