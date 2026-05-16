"use strict";

const { ipcMain } = require("electron");
const { requireAdmin } = require("./role-guard");
const { createActivityLogger } = require("./activity-log");
const { getDashboardResetAt, setDashboardResetAt } = require("./dashboard-reset");

const UNDO_MS = 30_000;
const ACTIVITY_LOGS_LAST_DELETED_KEY = "activity_logs_last_deleted_at";
/** @type {{ previousAt: Date | null, expiresAt: number } | null} */
let dashboardUndo = null;

function parseLocalDay(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
function registerAdminResetIpc(prisma) {
  const { logActivity } = createActivityLogger(prisma);

  ipcMain.handle("admin:getDashboardResetInfo", async () => {
    requireAdmin();
    const resetAt = await getDashboardResetAt(prisma);
    const undoAvailable = dashboardUndo != null && Date.now() < dashboardUndo.expiresAt;
    const resetIso = resetAt?.toISOString() ?? null;
    return {
      ok: true,
      resetAt: resetIso,
      lastDeletedAt: resetIso,
      undoAvailable,
      undoExpiresAt: undoAvailable ? new Date(dashboardUndo.expiresAt).toISOString() : null
    };
  });

  ipcMain.handle("admin:resetDashboardStats", async () => {
    const admin = requireAdmin();
    const previousAt = await getDashboardResetAt(prisma);
    const now = new Date();
    await setDashboardResetAt(prisma, now);
    dashboardUndo = { previousAt, expiresAt: Date.now() + UNDO_MS };

    await logActivity({
      userId: admin.userId,
      action: "admin_dashboard_stats_reset",
      details: `Dashboard stats baseline set to ${now.toISOString()} (sales data kept for reports)`
    });

    return { ok: true, resetAt: now.toISOString(), undoAvailable: true };
  });

  ipcMain.handle("admin:undoDashboardStatsReset", async () => {
    const admin = requireAdmin();
    if (!dashboardUndo || Date.now() > dashboardUndo.expiresAt) {
      return { ok: false, error: "Undo window expired." };
    }
    await setDashboardResetAt(prisma, dashboardUndo.previousAt);
    const restored = dashboardUndo.previousAt?.toISOString() ?? null;
    dashboardUndo = null;

    await logActivity({
      userId: admin.userId,
      action: "admin_dashboard_stats_undo",
      details: restored ? `Restored baseline ${restored}` : "Cleared dashboard reset baseline"
    });

    return { ok: true, resetAt: restored };
  });

  ipcMain.handle("admin:deleteReportsInRange", async (_evt, payload) => {
    try {
      const admin = requireAdmin();
      const startDate = String(payload?.startDate ?? "").trim();
      const endDate = String(payload?.endDate ?? "").trim();
      const start = parseLocalDay(startDate);
      const endDay = parseLocalDay(endDate);
      if (!start || !endDay) return { ok: false, error: "Invalid date. Use YYYY-MM-DD." };
      if (endDay < start) return { ok: false, error: "End date must be on or after start date." };

      const rangeEnd = new Date(endDay);
      rangeEnd.setDate(rangeEnd.getDate() + 1);

      const result = await prisma.$transaction(async (tx) => {
        const sales = await tx.sale.findMany({
          where: { saleAt: { gte: start, lt: rangeEnd } },
          include: { items: true }
        });

        /** @type {Map<string, number>} */
        const stockRestore = new Map();
        for (const sale of sales) {
          for (const item of sale.items) {
            const pid = String(item.productId ?? "").trim();
            if (!pid) continue;
            stockRestore.set(pid, (stockRestore.get(pid) ?? 0) + item.qtyMilli);
          }
        }
        if (stockRestore.size > 0) {
          const existing = await tx.product.findMany({
            where: { id: { in: [...stockRestore.keys()] } },
            select: { id: true }
          });
          for (const p of existing) {
            const qty = stockRestore.get(p.id);
            if (!qty) continue;
            await tx.product.update({
              where: { id: p.id },
              data: { stockQtyMilli: { increment: qty } }
            });
          }
        }

        const saleIds = sales.map((s) => s.id);
        if (saleIds.length > 0) {
          await tx.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
          await tx.sale.deleteMany({ where: { id: { in: saleIds } } });
        }

        const expenseResult = await tx.expense.deleteMany({
          where: { spentAt: { gte: start, lt: rangeEnd } }
        });

        return {
          salesDeleted: sales.length,
          expensesDeleted: expenseResult.count
        };
      });

      await logActivity({
        userId: admin.userId,
        action: "admin_reports_deleted",
        details: `Deleted ${result.salesDeleted} sales, ${result.expensesDeleted} expenses (${startDate} – ${endDate})`
      });

      return { ok: true, ...result, startDate, endDate };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle("admin:deleteAllActivityLogs", async () => {
    const admin = requireAdmin();
    try {
      const result = await prisma.activityLog.deleteMany();
      const deletedAt = new Date();
      await prisma.setting.upsert({
        where: { key: ACTIVITY_LOGS_LAST_DELETED_KEY },
        create: { key: ACTIVITY_LOGS_LAST_DELETED_KEY, value: deletedAt.toISOString() },
        update: { value: deletedAt.toISOString() }
      });

      await logActivity({
        userId: admin.userId,
        action: "admin_activity_logs_cleared",
        details: `Deleted ${result.count} activity log entries`
      });

      return { ok: true, deletedCount: result.count, deletedAt: deletedAt.toISOString() };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle("admin:getActivityLogsDeleteInfo", async () => {
    requireAdmin();
    const row = await prisma.setting.findUnique({ where: { key: ACTIVITY_LOGS_LAST_DELETED_KEY } });
    return { ok: true, lastDeletedAt: row?.value ?? null };
  });
}

module.exports = { registerAdminResetIpc };
