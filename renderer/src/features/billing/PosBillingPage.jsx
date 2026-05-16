import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutocompleteInput } from "../../components/AutocompleteInput";
import { BarcodeCameraModal } from "../../components/BarcodeCameraModal";
import { formatMoney, formatQtyFromMilli } from "../../lib/format";
import { printBillReceipt } from "../../lib/receiptPrint";
import { playScanError, playScanSuccess } from "../../lib/barcodeSounds";
const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "mobile_wallet", label: "Mobile wallet" }
];
const DEFAULT_QTY_MILLI = 1e3;
function lineTotalCents(line) {
  return Math.round(line.salePriceCents * line.qtyMilli / 1e3);
}
function PosBillingPage() {
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [discountPct, setDiscountPct] = useState(0);
  const [discountFixed, setDiscountFixed] = useState(0);
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState("cash");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [toast, setToast] = useState(null);
  const [flashProductId, setFlashProductId] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const subtotalCents = useMemo(() => cart.reduce((s, l) => s + lineTotalCents(l), 0), [cart]);
  const discountFromPct = Math.floor(subtotalCents * Math.min(100, Math.max(0, discountPct)) / 100);
  const discountCents = Math.min(subtotalCents, discountFromPct + Math.max(0, discountFixed));
  const totalCents = subtotalCents - discountCents;
  const addProduct = useCallback((p) => {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        const line = { ...next[idx] };
        const nextQty = line.qtyMilli + DEFAULT_QTY_MILLI;
        if (nextQty > line.stockQtyMilli) {
          setBanner({ type: "err", text: `Max stock for \u201C${p.name}\u201D is ${formatQtyFromMilli(p.stockQtyMilli, p.unit)}.` });
          return prev;
        }
        line.qtyMilli = nextQty;
        next[idx] = line;
        setSelectedIdx(idx);
        return next;
      }
      if (p.stockQtyMilli < DEFAULT_QTY_MILLI) {
        setBanner({ type: "err", text: `\u201C${p.name}\u201D is out of stock.` });
        return prev;
      }
      setBanner(null);
      setSelectedIdx(prev.length);
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          unit: p.unit,
          salePriceCents: p.salePriceCents,
          stockQtyMilli: p.stockQtyMilli,
          qtyMilli: DEFAULT_QTY_MILLI
        }
      ];
    });
  }, []);
  const bumpQty = useCallback((deltaMilli) => {
    if (selectedIdx == null || selectedIdx < 0 || selectedIdx >= cart.length) return;
    setCart((prev) => {
      const next = [...prev];
      const line = { ...next[selectedIdx] };
      const q = line.qtyMilli + deltaMilli;
      if (q <= 0) {
        next.splice(selectedIdx, 1);
        setSelectedIdx((i) => i == null ? i : Math.min(i, next.length - 1));
        return next;
      }
      if (q > line.stockQtyMilli) {
        setBanner({ type: "err", text: `Max stock for \u201C${line.name}\u201D is ${formatQtyFromMilli(line.stockQtyMilli, line.unit)}.` });
        return prev;
      }
      line.qtyMilli = q;
      next[selectedIdx] = line;
      return next;
    });
  }, [cart.length, selectedIdx]);
  const removeSelected = useCallback(() => {
    if (selectedIdx == null) return;
    setCart((prev) => {
      const next = prev.filter((_, i) => i !== selectedIdx);
      setSelectedIdx(next.length ? Math.min(selectedIdx, next.length - 1) : null);
      return next;
    });
  }, [selectedIdx]);
  const newBill = useCallback((opts) => {
    setCart([]);
    setSelectedIdx(null);
    setDiscountPct(0);
    setDiscountFixed(0);
    setNotes("");
    setPayment("cash");
    if (!opts?.preserveBanner) setBanner(null);
    setToast(null);
    setScanHistory([]);
    setFlashProductId(null);
    searchRef.current?.focus();
  }, []);
  const refocusSearch = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        searchRef.current?.focus();
      });
    });
  }, []);
  const pushScanHistory = useCallback((code, ok, name) => {
    setScanHistory((h) => [{ code, ok, name, t: Date.now() }, ...h].slice(0, 25));
  }, []);
  const resolveCodeAndAdd = useCallback(
    async (raw) => {
      const code = raw.trim();
      if (!code) {
        playScanError();
        setToast({ type: "err", text: "Empty code" });
        refocusSearch();
        window.setTimeout(() => setToast(null), 2200);
        return;
      }
      try {
        if (!window.pos?.resolveBarcode) {
          playScanError();
          setToast({ type: "err", text: "Scanner API unavailable" });
          refocusSearch();
          window.setTimeout(() => setToast(null), 2800);
          return;
        }
        const res = await window.pos.resolveBarcode(code);
        if (!res.ok || !res.product) {
          playScanError();
          pushScanHistory(code, false, null);
          setToast({ type: "err", text: "Barcode not found" });
          refocusSearch();
          window.setTimeout(() => setToast(null), 2200);
          return;
        }
        const p = res.product;
        addProduct(p);
        playScanSuccess();
        pushScanHistory(code, true, p.name);
        setToast({ type: "ok", text: `Product added: ${p.name}` });
        setFlashProductId(p.id);
        setQuery("");
        window.setTimeout(() => setFlashProductId(null), 700);
        refocusSearch();
        window.setTimeout(() => setToast(null), 2000);
      } catch {
        playScanError();
        setToast({ type: "err", text: "Scan failed" });
        refocusSearch();
        window.setTimeout(() => setToast(null), 2200);
      }
    },
    [addProduct, pushScanHistory, refocusSearch]
  );
  const doCheckout = useCallback(async () => {
    if (!window.pos?.checkout) return;
    if (cart.length === 0) {
      setBanner({ type: "err", text: "Cart is empty." });
      return;
    }
    const input = {
      lines: cart.map((l) => ({ productId: l.productId, qtyMilli: l.qtyMilli })),
      discountPercent: discountPct,
      discountFixedCents: discountFixed,
      notes: notes.trim() || null,
      paymentMethod: payment
    };
    setCheckoutBusy(true);
    setBanner(null);
    try {
      const res = await window.pos.checkout(input);
      if (res.ok) {
        const paymentLabel = PAYMENT_OPTIONS.find((o) => o.value === payment)?.label ?? payment;
        printBillReceipt({
          storeName: "POS Billing",
          invoiceNo: res.invoiceNo,
          saleAt: new Date().toLocaleString(),
          lines: cart.map((l) => ({
            name: l.name,
            unit: l.unit,
            qtyMilli: l.qtyMilli,
            unitPriceCents: l.salePriceCents,
            lineTotalCents: lineTotalCents(l)
          })),
          subtotalCents,
          discountCents,
          totalCents: res.totalCents,
          paymentLabel,
          notes: notes.trim() || null
        });
        newBill({ preserveBanner: true });
        setBanner({ type: "ok", text: `Saved ${res.invoiceNo} \xB7 Total ${formatMoney(res.totalCents)}` });
      } else {
        setBanner({ type: "err", text: res.error });
      }
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCheckoutBusy(false);
    }
  }, [cart, discountCents, discountFixed, discountPct, newBill, notes, payment, subtotalCents]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F2") {
        e.preventDefault();
        void doCheckout();
      }
      if (e.key === "F3") {
        e.preventDefault();
        newBill();
      }
      if (e.key === "F4") {
        e.preventDefault();
        refocusSearch();
      }
      if (e.key === "Delete") {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doCheckout, newBill, refocusSearch, removeSelected]);
  useEffect(() => {
    refocusSearch();
  }, [refocusSearch]);
  return /* @__PURE__ */ jsxs("div", { className: "relative mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4", children: [
    toast ? /* @__PURE__ */ jsx(
      "div",
      {
        role: "status",
        className: toast.type === "ok" ? "fixed right-4 top-4 z-[60] max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 shadow-lg dark:border-emerald-900/50 dark:bg-emerald-950/90 dark:text-emerald-100" : "fixed right-4 top-4 z-[60] max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 shadow-lg dark:border-red-900/50 dark:bg-red-950/90 dark:text-red-100",
        children: toast.text
      }
    ) : null,
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-lg font-semibold text-zinc-900 dark:text-zinc-50", children: "Billing (POS)" }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-zinc-500 dark:text-zinc-400", children: "F1 / F4 focus search \xB7 F2 checkout \xB7 F3 new bill \xB7 Del remove line" })
      ] }),
      banner ? /* @__PURE__ */ jsx(
        "div",
        {
          className: banner.type === "ok" ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100" : "rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100",
          children: banner.text
        }
      ) : null
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-5", children: [
      /* @__PURE__ */ jsxs("section", { className: "flex min-h-0 flex-col gap-3 lg:col-span-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", htmlFor: "pos-search", children: "Search or scan (same field)" }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-stretch gap-2", children: [
              /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsx(AutocompleteInput, {
                ref: searchRef,
                id: "pos-search",
                disabled: checkoutBusy,
                value: query,
                onChange: setQuery,
                debounceMs: 200,
                maxSuggestions: 80,
                placeholder: "Name, category, SKU, or barcode \u2014 USB scanner + Enter",
                className: "w-full rounded-lg border-2 border-emerald-500/40 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-2 dark:border-emerald-800 dark:bg-zinc-950 dark:text-zinc-100",
                searchFn: async (q) => {
                  if (!window.pos?.searchProducts) return [];
                  return await window.pos.searchProducts(q);
                },
                getLabel: (p) => p.name,
                getKey: (p) => p.id,
                onSelect: (p) => {
                  addProduct(p);
                  setQuery("");
                },
                onEnterFallback: (q) => {
                  void resolveCodeAndAdd(q);
                },
                renderSuggestion: (p) =>
                  /* @__PURE__ */ jsxs("div", {
                    className: "flex w-full items-start gap-3 text-left",
                    children: [
                      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                        /* @__PURE__ */ jsx("div", { className: "font-medium text-zinc-900 dark:text-zinc-50", children: p.name }),
                        /* @__PURE__ */ jsx("div", { className: "truncate text-xs text-zinc-500 dark:text-zinc-400", children: [p.categoryName, p.sku, p.barcode].filter(Boolean).join(" \xB7 ") || "\u2014" })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "shrink-0 text-right", children: [
                        /* @__PURE__ */ jsx("div", { className: "font-mono text-xs text-zinc-600 dark:text-zinc-300", children: formatMoney(p.salePriceCents) }),
                        /* @__PURE__ */ jsxs("div", { className: "text-xs text-zinc-400", children: [
                          "Stock ",
                          formatQtyFromMilli(p.stockQtyMilli, p.unit)
                        ] })
                      ] })
                    ]
                  })
              }) }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  disabled: checkoutBusy,
                  onClick: () => setCameraOpen(true),
                  className: "shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                  children: "Camera"
                }
              )
            ] }),
            scanHistory.length > 0 ? /* @__PURE__ */ jsxs("div", { className: "mt-2 max-h-16 overflow-hidden rounded border border-zinc-100 bg-zinc-50/80 px-2 py-1 font-mono text-[10px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400", children: [
              /* @__PURE__ */ jsx("div", { className: "mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-400", children: "Recent scans" }),
              scanHistory.slice(0, 6).map((h) => /* @__PURE__ */ jsx("div", { className: "truncate", children: [h.ok ? "\u2713 " : "\u2717 ", h.code, h.name ? ` \u2192 ${h.name}` : ""] }, h.t))
            ] }) : null
          ] }),
          /* @__PURE__ */ jsx("div", { className: "rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400", children: "Suggestions while typing \xB7 \u2191 \u2193 + Enter picks a row \xB7 If nothing matches yet, Enter runs barcode/SKU lookup \xB7 Camera uses the same lookup." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "flex min-h-0 flex-col gap-3 lg:col-span-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900", children: [
          /* @__PURE__ */ jsx("div", { className: "border-b border-zinc-200 px-3 py-2 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400", children: "Cart" }),
          /* @__PURE__ */ jsx("div", { className: "min-h-0 flex-1 overflow-auto", children: cart.length === 0 ? /* @__PURE__ */ jsx("p", { className: "p-4 text-sm text-zinc-500 dark:text-zinc-400", children: "Use search / scan (or Camera), then add items. Click a cart row to select it." }) : /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-sm", children: [
            /* @__PURE__ */ jsx("thead", { className: "sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400", children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { className: "px-2 py-2", children: "Item" }),
              /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-right", children: "Qty" }),
              /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-right", children: "Line" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-zinc-100 dark:divide-zinc-800", children: cart.map((line, i) => /* @__PURE__ */ jsxs(
              "tr",
              {
                onClick: () => setSelectedIdx(i),
                className: [
                  selectedIdx === i ? "cursor-pointer bg-emerald-50/80 dark:bg-emerald-950/40" : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                  flashProductId === line.productId ? "animate-scan-line-flash" : ""
                ].filter(Boolean).join(" "),
                children: [
                  /* @__PURE__ */ jsxs("td", { className: "px-2 py-2", children: [
                    /* @__PURE__ */ jsx("div", { className: "font-medium text-zinc-900 dark:text-zinc-50", children: line.name }),
                    /* @__PURE__ */ jsx("div", { className: "text-xs text-zinc-500", children: line.unit })
                  ] }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-2 text-right tabular-nums", children: formatQtyFromMilli(line.qtyMilli, line.unit) }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200", children: formatMoney(lineTotalCents(line)) })
                ]
              },
              line.productId
            )) })
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2 border-t border-zinc-200 p-2 dark:border-zinc-800", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "rounded-md bg-zinc-200 px-2 py-1 text-xs font-medium dark:bg-zinc-700", onClick: () => bumpQty(1e3), children: "+1" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "rounded-md bg-zinc-200 px-2 py-1 text-xs font-medium dark:bg-zinc-700", onClick: () => bumpQty(5e3), children: "+5" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "rounded-md bg-zinc-200 px-2 py-1 text-xs font-medium dark:bg-zinc-700", onClick: () => bumpQty(1e4), children: "+10" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "rounded-md bg-zinc-200 px-2 py-1 text-xs font-medium dark:bg-zinc-700", onClick: () => bumpQty(-1e3), children: "\u22121" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Discount %" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  min: 0,
                  max: 100,
                  value: discountPct,
                  onChange: (e) => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0))),
                  className: "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Fixed discount (cents)" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  min: 0,
                  value: discountFixed,
                  onChange: (e) => setDiscountFixed(Math.max(0, Math.floor(Number(e.target.value) || 0))),
                  className: "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Payment" }),
            /* @__PURE__ */ jsx(
              "select",
              {
                value: payment,
                onChange: (e) => setPayment(e.target.value),
                className: "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100",
                children: PAYMENT_OPTIONS.map((o) => /* @__PURE__ */ jsx("option", { value: o.value, children: o.label }, o.value))
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Notes" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: notes,
                onChange: (e) => setNotes(e.target.value),
                rows: 2,
                className: "w-full resize-none rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950",
                placeholder: "Optional note on bill\u2026"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-1 border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-zinc-600 dark:text-zinc-400", children: [
              /* @__PURE__ */ jsx("span", { children: "Subtotal" }),
              /* @__PURE__ */ jsx("span", { className: "tabular-nums", children: formatMoney(subtotalCents) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-zinc-600 dark:text-zinc-400", children: [
              /* @__PURE__ */ jsx("span", { children: "Discount" }),
              /* @__PURE__ */ jsxs("span", { className: "tabular-nums", children: [
                "\u2212",
                formatMoney(discountCents)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-base font-semibold text-zinc-900 dark:text-zinc-50", children: [
              /* @__PURE__ */ jsx("span", { children: "Total" }),
              /* @__PURE__ */ jsx("span", { className: "tabular-nums", children: formatMoney(totalCents) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => void doCheckout(),
                disabled: checkoutBusy,
                className: "flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400",
                children: checkoutBusy ? "Saving\u2026" : "Checkout (F2)"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: newBill,
                className: "rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-600",
                children: "New (F3)"
              }
            )
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(BarcodeCameraModal, {
      open: cameraOpen,
      onClose: () => setCameraOpen(false),
      onDecoded: (t) => {
        void resolveCodeAndAdd(t);
      }
    })
  ] });
}
export {
  PosBillingPage
};
