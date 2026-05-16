"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var dashboard_ipc_exports = {};
__export(dashboard_ipc_exports, {
  registerDashboardIpc: () => registerDashboardIpc
});
module.exports = __toCommonJS(dashboard_ipc_exports);
var import_electron = require("electron");
var import_role_guard = require("./role-guard");
var import_dashboard_reset = require("./dashboard-reset");
function localDayRange(d = /* @__PURE__ */ new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}
function formatDateLabel(d) {
  return d.toLocaleDateString(void 0, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
function registerDashboardIpc(prisma) {
  import_electron.ipcMain.handle("dashboard:getSnapshot", async () => {
    (0, import_role_guard.requireSession)();
    const now = /* @__PURE__ */ new Date();
    const resetAt = await (0, import_dashboard_reset.getDashboardResetAt)(prisma);
    const { start: dayStart, end: dayEnd } = localDayRange(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);
    const salesFrom = (0, import_dashboard_reset.effectiveRangeStart)(dayStart, resetAt);
    const weekFrom = (0, import_dashboard_reset.effectiveRangeStart)(weekStart, resetAt);
    const monthFrom = (0, import_dashboard_reset.effectiveRangeStart)(monthStart, resetAt);
    const [
      todaySalesAgg,
      todayBillsCount,
      todayExpenseAgg,
      last7ExpenseAgg,
      activeProducts,
      saleItemsToday,
      topItemsRaw
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { saleAt: { gte: salesFrom, lt: dayEnd } },
        _sum: { totalCents: true }
      }),
      prisma.sale.count({
        where: { saleAt: { gte: salesFrom, lt: dayEnd } }
      }),
      prisma.expense.aggregate({
        where: { spentAt: { gte: salesFrom, lt: dayEnd } },
        _sum: { amountCents: true },
        _count: { _all: true }
      }),
      prisma.expense.aggregate({
        where: { spentAt: { gte: weekFrom, lt: dayEnd } },
        _sum: { amountCents: true }
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          unit: true,
          stockQtyMilli: true,
          lowStockQtyMilli: true,
          purchasePriceCents: true
        }
      }),
      prisma.saleItem.findMany({
        where: { sale: { saleAt: { gte: salesFrom, lt: dayEnd } } },
        select: { productId: true, qtyMilli: true, lineTotalCents: true }
      }),
      prisma.saleItem.findMany({
        where: { sale: { saleAt: { gte: monthFrom, lt: dayEnd } } },
        select: { productId: true, qtyMilli: true, lineTotalCents: true }
      })
    ]);
    const todayExpenseCents = todayExpenseAgg._sum.amountCents ?? 0;
    const todayExpenseCount = todayExpenseAgg._count._all;
    const last7DaysExpenseCents = last7ExpenseAgg._sum.amountCents ?? 0;
    const purchaseByProduct = new Map(activeProducts.map((p) => [p.id, p.purchasePriceCents]));
    const missingPurchaseIds = [
      ...new Set(saleItemsToday.map((r) => r.productId).filter((id) => !purchaseByProduct.has(id)))
    ];
    if (missingPurchaseIds.length > 0) {
      const extra = await prisma.product.findMany({
        where: { id: { in: missingPurchaseIds } },
        select: { id: true, purchasePriceCents: true }
      });
      for (const p of extra) purchaseByProduct.set(p.id, p.purchasePriceCents);
    }
    let costCents = 0;
    for (const row of saleItemsToday) {
      const pp = purchaseByProduct.get(row.productId) ?? 0;
      costCents += Math.round(pp * row.qtyMilli / 1e3);
    }
    const todayRevenueFromLines = saleItemsToday.reduce((s, r) => s + r.lineTotalCents, 0);
    const todayProfitCents = todayRevenueFromLines - costCents;
    const lowStock = activeProducts.filter((p) => {
      if (p.lowStockQtyMilli != null) return p.stockQtyMilli <= p.lowStockQtyMilli;
      return p.stockQtyMilli <= 0;
    }).sort((a, b) => a.stockQtyMilli - b.stockQtyMilli).slice(0, 25).map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      stockQtyMilli: p.stockQtyMilli,
      lowStockQtyMilli: p.lowStockQtyMilli
    }));
    const topAgg = /* @__PURE__ */ new Map();
    for (const row of topItemsRaw) {
      const cur = topAgg.get(row.productId) ?? { qtyMilli: 0, revenueCents: 0 };
      cur.qtyMilli += row.qtyMilli;
      cur.revenueCents += row.lineTotalCents;
      topAgg.set(row.productId, cur);
    }
    const topSorted = [...topAgg.entries()].sort((a, b) => b[1].qtyMilli - a[1].qtyMilli).slice(0, 8);
    const topIds = topSorted.map(([id]) => id);
    const topProductRows = topIds.length === 0 ? [] : await prisma.product.findMany({
      where: { id: { in: topIds } },
      select: { id: true, name: true, unit: true }
    });
    const nameById = new Map(topProductRows.map((p) => [p.id, { name: p.name, unit: p.unit }]));
    const topProducts = topSorted.map(([productId, v]) => {
      const meta = nameById.get(productId);
      return {
        productId,
        name: meta?.name ?? "Unknown",
        unit: meta?.unit ?? "piece",
        qtyMilliSold: v.qtyMilli,
        lineRevenueCents: v.revenueCents
      };
    });
    return {
      dateLabel: formatDateLabel(now),
      dashboardResetAt: resetAt?.toISOString() ?? null,
      todaySalesCents: todaySalesAgg._sum.totalCents ?? 0,
      todayBillsCount,
      todayProfitCents,
      todayExpenseCents,
      todayExpenseCount,
      last7DaysExpenseCents,
      lowStock,
      topProducts
    };
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerDashboardIpc
});
