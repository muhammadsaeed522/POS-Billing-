import { BrandingLogo } from "./components/BrandingLogo";
import { useAuth } from "./context/AuthContext";
import { useBranding } from "./context/BrandingContext";
import { AuthGateway } from "./features/auth/AuthGateway";
import { AppShell } from "./features/shell/AppShell";

function isElectronShell() {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("Electron");
}

function hasPosBridge() {
  if (typeof window === "undefined") return false;
  const p = window.pos;
  return p != null && typeof p === "object" && typeof p.getSession === "function";
}

export default function App() {
  const { session, hydrating, logout } = useAuth();
  const { logo, ready: brandingReady } = useBranding();

  if (!isElectronShell()) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-zinc-100 p-8 text-center text-sm text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
        <p className="max-w-md">
          This page is open in a <strong>normal browser</strong>. Run <span className="font-mono">npm run dev</span> and use the{" "}
          <strong>Electron</strong> window.
        </p>
      </div>
    );
  }

  if (!hasPosBridge()) {
    return (
      <div className="flex min-h-full items-center justify-center bg-amber-50 p-8 text-center text-sm text-amber-950">
        <p className="max-w-md font-medium">Electron is running, but the preload bridge did not load. Restart with npm run dev.</p>
      </div>
    );
  }

  if (hydrating || !brandingReady) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-zinc-100 dark:bg-zinc-950">
        <BrandingLogo url={logo.url} size="lg" alt="POS Billing" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  if (!session) return <AuthGateway />;

  return <AppShell session={session} onLogout={() => void logout()} />;
}
