import { useEffect, useRef, useState } from "react";

/**
 * Camera-based 1D/2D scan (barcode + QR) using html5-qrcode.
 * Lazy-loads the library to keep initial bundle smaller.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(text: string) => void} props.onDecoded
 */
export function BarcodeCameraModal({ open, onClose, onDecoded }) {
  const hostRef = useRef(null);
  const scannerRef = useRef(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) {
      setStatus("");
      return undefined;
    }

    const host = hostRef.current;
    if (!host) return undefined;

    let cancelled = false;
    const boxId = `hq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    host.innerHTML = "";
    const mount = document.createElement("div");
    mount.id = boxId;
    mount.className = "rounded-lg overflow-hidden bg-black min-h-[220px]";
    host.appendChild(mount);

    setStatus("Starting camera…");

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const qr = new Html5Qrcode(boxId);
        scannerRef.current = qr;
        await qr.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 280, height: 200 }, aspectRatio: 1.777 },
          (decodedText) => {
            const t = decodedText.trim();
            if (!t) return;
            onDecoded(t);
            void stopScanner();
            onClose();
          },
          () => {}
        );
        if (!cancelled) setStatus("Point at barcode or QR code");
      } catch (err) {
        console.error("BarcodeCameraModal:", err);
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Camera unavailable");
      }
    })();

    async function stopScanner() {
      const qr = scannerRef.current;
      scannerRef.current = null;
      if (!qr) return;
      try {
        await qr.stop();
        await qr.clear();
      } catch {
        /* ignore */
      }
    }

    return () => {
      cancelled = true;
      void stopScanner();
      host.innerHTML = "";
    };
  }, [open, onClose, onDecoded]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scan barcode with camera"
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Camera scan</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Works for QR and many barcode formats. Grant camera permission when prompted. USB scanners do not need this.
        </p>
        <div ref={hostRef} className="w-full" />
        {status ? (
          <p className="mt-2 text-center text-xs text-zinc-600 dark:text-zinc-400">{status}</p>
        ) : null}
      </div>
    </div>
  );
}
