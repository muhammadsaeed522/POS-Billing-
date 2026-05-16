import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const BrandingContext = createContext(null);

export function BrandingProvider({ children }) {
  const [logo, setLogo] = useState({ url: "", isCustom: false, fileName: "", customDir: "" });
  const [ready, setReady] = useState(false);

  const applyLogo = useCallback((payload) => {
    if (!payload) return;
    setLogo({
      url: payload.url ?? "",
      isCustom: Boolean(payload.isCustom),
      fileName: payload.fileName ?? "",
      customDir: payload.customDir ?? ""
    });
  }, []);

  const loadLogo = useCallback(async () => {
    if (!window.pos?.getLogo) {
      setReady(true);
      return;
    }
    try {
      const res = await window.pos.getLogo();
      if (res?.ok) applyLogo(res);
    } finally {
      setReady(true);
    }
  }, [applyLogo]);

  useEffect(() => {
    void loadLogo();
    const unsub = window.pos?.onLogoChanged?.((payload) => applyLogo(payload));
    return () => unsub?.();
  }, [loadLogo, applyLogo]);

  useEffect(() => {
    if (!logo.url) return;
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = logo.url;
  }, [logo.url]);

  const value = useMemo(() => ({ logo, ready, reloadLogo: loadLogo }), [logo, ready, loadLogo]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
