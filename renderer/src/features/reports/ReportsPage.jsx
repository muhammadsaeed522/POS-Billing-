import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "../../lib/format";
import { AdminDeleteReports } from "../admin/AdminDeleteReports";
function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function defaultRange() {
  const today = startOfLocalDay(/* @__PURE__ */ new Date());
  const start = addDays(today, -6);
  return { start: toYMD(start), end: toYMD(today) };
}
function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(void 0, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}
function handlePrintReport() {
  window.print();
}
function invokeReportRange(params) {
  if (typeof window.posReports?.getRange === "function") {
    return window.posReports.getRange(params);
  }
  if (typeof window.pos?.getReportRange === "function") {
    return window.pos.getReportRange(params);
  }
  return null;
}
function describePosBridge() {
  const posReportsType = typeof window.posReports;
  const posReportsGetRange = window.posReports && typeof window.posReports === "object" ? typeof window.posReports.getRange : "n/a";
  const p = window.pos;
  const posKeys = p != null && typeof p === "object" ? Object.keys(p).sort().join(", ") : "(no pos)";
  return `pos.getReportRange=${typeof window.pos?.getReportRange}; posReports=${posReportsType}; posReports.getRange=${posReportsGetRange}; pos keys: ${posKeys}`;
}
function ReportsPage() {
  const initial = useMemo(() => defaultRange(), []);
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadRange = useCallback(async (start, end) => {
    const pending = invokeReportRange({ startDate: start, endDate: end });
    if (!pending) {
      setError(
        `Reports API unavailable. ${describePosBridge()} Quit every Electron window, then run npm run dev again from the project root so preload.js is refreshed.`
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await pending;
      if (!res.ok) {
        setSnapshot(null);
        setError(res.error);
        return;
      }
      setSnapshot(res.snapshot);
    } catch (e) {
      setSnapshot(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadRange(initial.start, initial.end);
  }, [loadRange, initial.start, initial.end]);

  const onDownloadPdf = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!snapshot) return;
      if (typeof window.pos?.saveReportPdf !== "function") {
        setError("PDF export is unavailable. Quit every Electron window, then run npm run dev again from the project root.");
        return;
      }
      try {
        const res = await window.pos.saveReportPdf(snapshot);
        if (res.ok) return;
        if ("canceled" in res && res.canceled) return;
        setError("error" in res ? res.error : "Could not save PDF.");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [snapshot]
  );
  const onPrint = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    handlePrintReport();
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "report-print-area mx-auto max-w-6xl space-y-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "no-print rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900", children: [
      /* @__PURE__ */ jsxs(
        "form",
        {
          className: "flex flex-wrap items-end gap-3",
          onSubmit: (e) => {
            e.preventDefault();
            void loadRange(startDate, endDate);
          },
          children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { htmlFor: "rep-start", className: "block text-xs font-medium text-zinc-500 dark:text-zinc-400", children: "From" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  id: "rep-start",
                  type: "date",
                  value: startDate,
                  onChange: (e) => setStartDate(e.target.value),
                  className: "mt-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { htmlFor: "rep-end", className: "block text-xs font-medium text-zinc-500 dark:text-zinc-400", children: "To" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  id: "rep-end",
                  type: "date",
                  value: endDate,
                  onChange: (e) => setEndDate(e.target.value),
                  className: "mt-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                }
              )
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "submit",
                className: "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700",
                children: "Apply range"
              }
            ),
            /* @__PURE__ */ jsx("span", { className: "mx-1 hidden h-8 w-px bg-zinc-200 sm:inline dark:bg-zinc-700", "aria-hidden": true }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onPrint,
                className: "rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800",
                children: "Print report"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                disabled: !snapshot,
                onClick: onDownloadPdf,
                className: "rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800",
                children: "Download PDF"
              }
            ),
            /* @__PURE__ */ jsx(AdminDeleteReports, {
              rangeStart: startDate,
              rangeEnd: endDate,
              onDeleted: () => {
                void loadRange(startDate, endDate);
              }
            })
          ]
        }
      ),
      /* @__PURE__ */ jsx("p", { className: "mt-3 text-xs text-zinc-500 dark:text-zinc-400", children: "Print opens the system print dialog for this window. Download PDF opens a save dialog and writes the current report (summary, sales, expenses)." })
    ] }),
    error ? /* @__PURE__ */ jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200", children: error }) : null,
    loading && !snapshot ? /* @__PURE__ */ jsx("div", { className: "text-sm text-zinc-500 dark:text-zinc-400", children: "Loading report\u2026" }) : null,
    snapshot ? /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-lg font-semibold text-zinc-900 dark:text-zinc-50", children: "Sales & expenses" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-zinc-600 dark:text-zinc-400", children: [
          "Period: ",
          /* @__PURE__ */ jsx("span", { className: "font-medium text-zinc-800 dark:text-zinc-200", children: snapshot.startDate }),
          " to",
          " ",
          /* @__PURE__ */ jsx("span", { className: "font-medium text-zinc-800 dark:text-zinc-200", children: snapshot.endDate }),
          /* @__PURE__ */ jsxs("span", { className: "no-print text-zinc-500", children: [
            " \xB7 Generated ",
            formatWhen(snapshot.generatedAt)
          ] })
        ] }),
        /* @__PURE__ */ jsxs("dl", { className: "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50", children: [
            /* @__PURE__ */ jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400", children: "Sales total" }),
            /* @__PURE__ */ jsx("dd", { className: "mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50", children: formatMoney(snapshot.salesTotalCents) }),
            /* @__PURE__ */ jsxs("dd", { className: "mt-0.5 text-xs text-zinc-500", children: [
              snapshot.billsCount,
              " bills"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50", children: [
            /* @__PURE__ */ jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400", children: "Discounts" }),
            /* @__PURE__ */ jsx("dd", { className: "mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50", children: formatMoney(snapshot.discountTotalCents) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50", children: [
            /* @__PURE__ */ jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400", children: "Expenses" }),
            /* @__PURE__ */ jsx("dd", { className: "mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50", children: formatMoney(snapshot.expensesTotalCents) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-emerald-100 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30 sm:col-span-2 lg:col-span-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200", children: "Profit estimate (revenue lines \u2212 cost at purchase price)" }),
            /* @__PURE__ */ jsx("dd", { className: "mt-1 text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100", children: formatMoney(snapshot.profitEstimateCents) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold text-zinc-900 dark:text-zinc-50", children: "Sales" }),
        /* @__PURE__ */ jsx("div", { className: "mt-3 overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[640px] border-collapse text-left text-sm", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400", children: [
            /* @__PURE__ */ jsx("th", { className: "py-2 pr-3", children: "Invoice" }),
            /* @__PURE__ */ jsx("th", { className: "py-2 pr-3", children: "When" }),
            /* @__PURE__ */ jsx("th", { className: "py-2 pr-3", children: "Payment" }),
            /* @__PURE__ */ jsx("th", { className: "py-2 pr-3 text-right", children: "Items" }),
            /* @__PURE__ */ jsx("th", { className: "py-2 pr-3 text-right", children: "Subtotal" }),
            /* @__PURE__ */ jsx("th", { className: "py-2 pr-3 text-right", children: "Discount" }),
            /* @__PURE__ */ jsx("th", { className: "py-2 text-right", children: "Total" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: snapshot.sales.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 7, className: "py-8 text-center text-zinc-500 dark:text-zinc-400", children: "No sales in this range." }) }) : snapshot.sales.map((s) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-zinc-100 dark:border-zinc-800/80", children: [
            /* @__PURE__ */ jsx("td", { className: "py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100", children: s.invoiceNo }),
            /* @__PURE__ */ jsx("td", { className: "py-2 pr-3 tabular-nums text-zinc-600 dark:text-zinc-300", children: formatWhen(s.saleAt) }),
            /* @__PURE__ */ jsx("td", { className: "py-2 pr-3 text-zinc-700 dark:text-zinc-300", children: s.paymentMethod }),
            /* @__PURE__ */ jsx("td", { className: "py-2 pr-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300", children: s.itemCount }),
            /* @__PURE__ */ jsx("td", { className: "py-2 pr-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300", children: formatMoney(s.subtotalCents) }),
            /* @__PURE__ */ jsx("td", { className: "py-2 pr-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300", children: formatMoney(s.discountCents) }),
            /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50", children: formatMoney(s.totalCents) })
          ] }, s.id)) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold text-zinc-900 dark:text-zinc-50", children: "Expenses" }),
        /* @__PURE__ */ jsx("div", { className: "mt-3 overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[520px] border-collapse text-left text-sm", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400", children: [
            /* @__PURE__ */ jsx("th", { className: "py-2 pr-3", children: "Title" }),
            /* @__PURE__ */ jsx("th", { className: "py-2 pr-3", children: "Category" }),
            /* @__PURE__ */ jsx("th", { className: "py-2 pr-3", children: "When" }),
            /* @__PURE__ */ jsx("th", { className: "py-2 text-right", children: "Amount" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: snapshot.expenses.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 4, className: "py-8 text-center text-zinc-500 dark:text-zinc-400", children: "No expenses in this range." }) }) : snapshot.expenses.map((e) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-zinc-100 dark:border-zinc-800/80", children: [
            /* @__PURE__ */ jsx("td", { className: "py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100", children: e.title }),
            /* @__PURE__ */ jsx("td", { className: "py-2 pr-3 text-zinc-700 dark:text-zinc-300", children: e.category }),
            /* @__PURE__ */ jsx("td", { className: "py-2 pr-3 tabular-nums text-zinc-600 dark:text-zinc-300", children: formatWhen(e.spentAt) }),
            /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50", children: formatMoney(e.amountCents) })
          ] }, e.id)) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "no-print flex flex-wrap items-center justify-end gap-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onPrint,
            className: "rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800",
            children: "Print report"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onDownloadPdf,
            className: "rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800",
            children: "Download PDF"
          }
        )
      ] })
    ] }) : null
  ] });
}
export {
  ReportsPage
};
