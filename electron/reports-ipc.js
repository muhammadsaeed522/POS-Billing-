"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var reports_ipc_exports = {};
__export(reports_ipc_exports, {
  registerReportsIpc: () => registerReportsIpc
});
module.exports = __toCommonJS(reports_ipc_exports);
var import_electron = require("electron");
var import_promises = require("node:fs/promises");
var import_node_path = __toESM(require("node:path"));
var import_report_pdf = require("./report-pdf");
var import_role_guard = require("./role-guard");
function parseLocalDay(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}
const MAX_RANGE_DAYS = 400;
const MAX_PDF_ROWS = 5e3;
function validateSnapshotForPdf(raw) {
  if (!raw || typeof raw !== "object") return null;
  const s = raw;
  if (typeof s.startDate !== "string" || typeof s.endDate !== "string" || typeof s.generatedAt !== "string") {
    return null;
  }
  if (typeof s.billsCount !== "number" || typeof s.salesTotalCents !== "number") return null;
  if (typeof s.discountTotalCents !== "number" || typeof s.expensesTotalCents !== "number") return null;
  if (typeof s.profitEstimateCents !== "number") return null;
  if (!Array.isArray(s.sales) || !Array.isArray(s.expenses)) return null;
  if (s.sales.length > MAX_PDF_ROWS || s.expenses.length > MAX_PDF_ROWS) return null;
  return s;
}
function registerReportsIpc(prisma) {
  import_electron.ipcMain.handle("reports:getRange", async (_evt, input) => {
    (0, import_role_guard.assertReportsAccess)();
    const startDate = String(input?.startDate ?? "").trim();
    const endDate = String(input?.endDate ?? "").trim();
    const start = parseLocalDay(startDate);
    const endDayStart = parseLocalDay(endDate);
    if (!start || !endDayStart) return { ok: false, error: "Invalid date. Use YYYY-MM-DD." };
    if (endDayStart < start) return { ok: false, error: "End date must be on or after start date." };
    const inclusiveDays = Math.floor((endDayStart.getTime() - start.getTime()) / 864e5) + 1;
    if (inclusiveDays > MAX_RANGE_DAYS) {
      return { ok: false, error: `Date range too large (max ${MAX_RANGE_DAYS} days).` };
    }
    const rangeEnd = new Date(endDayStart);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    const [sales, saleItems, expenses] = await Promise.all([
      prisma.sale.findMany({
        where: { saleAt: { gte: start, lt: rangeEnd } },
        orderBy: { saleAt: "desc" },
        include: { _count: { select: { items: true } } }
      }),
      prisma.saleItem.findMany({
        where: { sale: { saleAt: { gte: start, lt: rangeEnd } } },
        select: { productId: true, qtyMilli: true, lineTotalCents: true }
      }),
      prisma.expense.findMany({
        where: { spentAt: { gte: start, lt: rangeEnd } },
        orderBy: { spentAt: "desc" }
      })
    ]);
    const productIds = [...new Set(saleItems.map((r) => r.productId))];
    const products = productIds.length === 0 ? [] : await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, purchasePriceCents: true }
    });
    const purchaseById = new Map(products.map((p) => [p.id, p.purchasePriceCents]));
    let costCents = 0;
    let revenueFromLines = 0;
    for (const row of saleItems) {
      revenueFromLines += row.lineTotalCents;
      const pp = purchaseById.get(row.productId) ?? 0;
      costCents += Math.round(pp * row.qtyMilli / 1e3);
    }
    const profitEstimateCents = revenueFromLines - costCents;
    const salesTotalCents = sales.reduce((s, r) => s + r.totalCents, 0);
    const discountTotalCents = sales.reduce((s, r) => s + r.discountCents, 0);
    const expensesTotalCents = expenses.reduce((s, e) => s + e.amountCents, 0);
    const snapshot = {
      startDate,
      endDate,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      salesTotalCents,
      billsCount: sales.length,
      discountTotalCents,
      expensesTotalCents,
      profitEstimateCents,
      sales: sales.map((s) => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        saleAt: s.saleAt.toISOString(),
        paymentMethod: s.paymentMethod,
        subtotalCents: s.subtotalCents,
        discountCents: s.discountCents,
        totalCents: s.totalCents,
        itemCount: s._count.items
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amountCents: e.amountCents,
        spentAt: e.spentAt.toISOString()
      }))
    };
    return { ok: true, snapshot };
  });
  import_electron.ipcMain.handle("reports:savePdf", async (event, raw) => {
    (0, import_role_guard.assertReportsAccess)();
    const snapshot = validateSnapshotForPdf(raw);
    if (!snapshot) return { ok: false, error: "Invalid report data." };
    let buf;
    try {
      buf = await (0, import_report_pdf.buildReportPdf)(snapshot);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    const safeBase = `sales-report_${snapshot.startDate}_${snapshot.endDate}.pdf`;
    const defaultPath = import_node_path.default.join(import_electron.app.getPath("documents"), safeBase);
    const parent = import_electron.BrowserWindow.fromWebContents(event.sender) ?? void 0;
    const dialogOpts = {
      title: "Save PDF report",
      defaultPath,
      filters: [
        { name: "PDF", extensions: ["pdf"] },
        { name: "All files", extensions: ["*"] }
      ]
    };
    const { canceled, filePath } = parent ? await import_electron.dialog.showSaveDialog(parent, dialogOpts) : await import_electron.dialog.showSaveDialog(dialogOpts);
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
      await (0, import_promises.writeFile)(filePath, buf);
      return { ok: true, path: filePath };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerReportsIpc
});
