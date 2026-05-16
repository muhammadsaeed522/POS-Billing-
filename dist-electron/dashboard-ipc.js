"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDashboardIpc = registerDashboardIpc;
const electron_1 = require("electron");
function localDayRange(d = new Date()) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    return { start, end };
}
function formatDateLabel(d) {
    return d.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}
function registerDashboardIpc(prisma) {
    electron_1.ipcMain.handle("dashboard:getSnapshot", async () => {
        const now = new Date();
        const { start: dayStart, end: dayEnd } = localDayRange(now);
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now);
        monthStart.setDate(monthStart.getDate() - 30);
        monthStart.setHours(0, 0, 0, 0);
        const [todaySalesAgg, todayBillsCount, todayExpenseAgg, last7ExpenseAgg, activeProducts, saleItemsToday, topItemsRaw,] = await Promise.all([
            prisma.sale.aggregate({
                where: { saleAt: { gte: dayStart, lt: dayEnd } },
                _sum: { totalCents: true },
            }),
            prisma.sale.count({
                where: { saleAt: { gte: dayStart, lt: dayEnd } },
            }),
            prisma.expense.aggregate({
                where: { spentAt: { gte: dayStart, lt: dayEnd } },
                _sum: { amountCents: true },
                _count: { _all: true },
            }),
            prisma.expense.aggregate({
                where: { spentAt: { gte: weekStart, lt: dayEnd } },
                _sum: { amountCents: true },
            }),
            prisma.product.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    name: true,
                    unit: true,
                    stockQtyMilli: true,
                    lowStockQtyMilli: true,
                    purchasePriceCents: true,
                },
            }),
            prisma.saleItem.findMany({
                where: { sale: { saleAt: { gte: dayStart, lt: dayEnd } } },
                select: { productId: true, qtyMilli: true, lineTotalCents: true },
            }),
            prisma.saleItem.findMany({
                where: { sale: { saleAt: { gte: monthStart, lt: dayEnd } } },
                select: { productId: true, qtyMilli: true, lineTotalCents: true },
            }),
        ]);
        const todayExpenseCents = todayExpenseAgg._sum.amountCents ?? 0;
        const todayExpenseCount = todayExpenseAgg._count._all;
        const last7DaysExpenseCents = last7ExpenseAgg._sum.amountCents ?? 0;
        const purchaseByProduct = new Map(activeProducts.map((p) => [p.id, p.purchasePriceCents]));
        const missingPurchaseIds = [
            ...new Set(saleItemsToday.map((r) => r.productId).filter((id) => !purchaseByProduct.has(id))),
        ];
        if (missingPurchaseIds.length > 0) {
            const extra = await prisma.product.findMany({
                where: { id: { in: missingPurchaseIds } },
                select: { id: true, purchasePriceCents: true },
            });
            for (const p of extra)
                purchaseByProduct.set(p.id, p.purchasePriceCents);
        }
        let costCents = 0;
        for (const row of saleItemsToday) {
            const pp = purchaseByProduct.get(row.productId) ?? 0;
            costCents += Math.round((pp * row.qtyMilli) / 1000);
        }
        const todayRevenueFromLines = saleItemsToday.reduce((s, r) => s + r.lineTotalCents, 0);
        const todayProfitCents = todayRevenueFromLines - costCents;
        const lowStock = activeProducts
            .filter((p) => {
            if (p.lowStockQtyMilli != null)
                return p.stockQtyMilli <= p.lowStockQtyMilli;
            return p.stockQtyMilli <= 0;
        })
            .sort((a, b) => a.stockQtyMilli - b.stockQtyMilli)
            .slice(0, 25)
            .map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            stockQtyMilli: p.stockQtyMilli,
            lowStockQtyMilli: p.lowStockQtyMilli,
        }));
        const topAgg = new Map();
        for (const row of topItemsRaw) {
            const cur = topAgg.get(row.productId) ?? { qtyMilli: 0, revenueCents: 0 };
            cur.qtyMilli += row.qtyMilli;
            cur.revenueCents += row.lineTotalCents;
            topAgg.set(row.productId, cur);
        }
        const topSorted = [...topAgg.entries()].sort((a, b) => b[1].qtyMilli - a[1].qtyMilli).slice(0, 8);
        const topIds = topSorted.map(([id]) => id);
        const topProductRows = topIds.length === 0
            ? []
            : await prisma.product.findMany({
                where: { id: { in: topIds } },
                select: { id: true, name: true, unit: true },
            });
        const nameById = new Map(topProductRows.map((p) => [p.id, { name: p.name, unit: p.unit }]));
        const topProducts = topSorted.map(([productId, v]) => {
            const meta = nameById.get(productId);
            return {
                productId,
                name: meta?.name ?? "Unknown",
                unit: meta?.unit ?? "piece",
                qtyMilliSold: v.qtyMilli,
                lineRevenueCents: v.revenueCents,
            };
        });
        return {
            dateLabel: formatDateLabel(now),
            todaySalesCents: todaySalesAgg._sum.totalCents ?? 0,
            todayBillsCount,
            todayProfitCents,
            todayExpenseCents,
            todayExpenseCount,
            last7DaysExpenseCents,
            lowStock,
            topProducts,
        };
    });
}
