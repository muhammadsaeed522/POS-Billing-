import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const SESSION_TOKEN_KEY = "pos_session_token";
const INACTIVITY_MS = 15 * 60 * 1000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [hydrating, setHydrating] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authScreen, setAuthScreen] = useState("login");
  const [resetToken, setResetToken] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  const persistToken = useCallback((token) => {
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
    else localStorage.removeItem(SESSION_TOKEN_KEY);
  }, []);

  const hydrate = useCallback(async () => {
    if (!window.pos?.getSession) {
      setHydrating(false);
      return;
    }
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    const [setupRes, sessionRes] = await Promise.all([
      window.pos.needsSetup?.() ?? { ok: true, needsSetup: false },
      window.pos.getSession(token ? { token } : {})
    ]);
    if (setupRes?.ok) setNeedsSetup(Boolean(setupRes.needsSetup));
    if (sessionRes.session && !setupRes?.needsSetup) {
      setSession(sessionRes.session);
      if (sessionRes.token) persistToken(sessionRes.token);
    } else if (setupRes?.needsSetup) {
      setSession(null);
      persistToken(null);
    }
    setHydrating(false);
  }, [persistToken]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const login = useCallback(
    async (identifier, password, rememberMe = false) => {
      setAuthError(null);
      if (!window.pos?.login) {
        setAuthError("Desktop API unavailable.");
        return false;
      }
      setLoggingIn(true);
      try {
        const res = await window.pos.login({
          identifier,
          password,
          rememberMe,
          deviceInfo: navigator.userAgent.slice(0, 200)
        });
        if (res.ok) {
          setSession(res.session);
          if (rememberMe && res.token) persistToken(res.token);
          else persistToken(null);
          return true;
        }
        setAuthError(res.error);
        return false;
      } finally {
        setLoggingIn(false);
      }
    },
    [persistToken]
  );

  const logout = useCallback(async () => {
    if (window.pos) await window.pos.logout();
    setSession(null);
    persistToken(null);
    setAuthScreen("login");
  }, [persistToken]);

  const setupInitialAdmin = useCallback(
    async (payload) => {
      if (!window.pos?.setupInitialAdmin) return { ok: false, error: "Setup unavailable." };
      setSetupLoading(true);
      setAuthError(null);
      try {
        const res = await window.pos.setupInitialAdmin({
          ...payload,
          rememberMe: true,
          deviceInfo: navigator.userAgent.slice(0, 200)
        });
        if (res.ok) {
          setNeedsSetup(false);
          setSession(res.session);
          if (res.token) persistToken(res.token);
        } else setAuthError(res.error);
        return res;
      } finally {
        setSetupLoading(false);
      }
    },
    [persistToken]
  );

  const signup = useCallback(async (payload) => {
    if (!window.pos?.signup) return { ok: false, error: "Signup unavailable." };
    return await window.pos.signup(payload);
  }, []);

  const forgotPassword = useCallback(async (email) => {
    if (!window.pos?.forgotPassword) return { ok: false, error: "Unavailable." };
    return await window.pos.forgotPassword({ email });
  }, []);

  const resetPassword = useCallback(async (payload) => {
    if (!window.pos?.resetPassword) return { ok: false, error: "Unavailable." };
    return await window.pos.resetPassword(payload);
  }, []);

  useEffect(() => {
    if (!session || !window.pos) return;
    let timer;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void logout(), INACTIVITY_MS);
    };
    const events = ["mousedown", "keydown", "wheel", "touchstart"];
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    reset();
    const offIdle = window.pos.onUserIdle?.(() => reset()) ?? (() => {});
    return () => {
      if (timer) clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, reset);
      offIdle();
    };
  }, [session, logout]);

  const value = useMemo(
    () => ({
      session,
      hydrating,
      authError,
      setAuthError,
      loggingIn,
      login,
      logout,
      signup,
      forgotPassword,
      resetPassword,
      authScreen,
      setAuthScreen,
      resetToken,
      setResetToken,
      needsSetup,
      setupLoading,
      setupInitialAdmin,
      refreshSession: hydrate
    }),
    [
      session,
      hydrating,
      authError,
      loggingIn,
      login,
      logout,
      signup,
      forgotPassword,
      resetPassword,
      authScreen,
      resetToken,
      needsSetup,
      setupLoading,
      setupInitialAdmin,
      hydrate
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
