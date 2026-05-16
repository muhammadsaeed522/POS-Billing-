"use strict";

const RESET_KEY = "dashboard_stats_reset_at";

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function getDashboardResetAt(prisma) {
  const row = await prisma.setting.findUnique({ where: { key: RESET_KEY } });
  if (!row?.value) return null;
  const d = new Date(row.value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {Date | null} at — null clears the baseline (show all history on dashboard)
 */
async function setDashboardResetAt(prisma, at) {
  if (!at) {
    await prisma.setting.deleteMany({ where: { key: RESET_KEY } });
    return;
  }
  await prisma.setting.upsert({
    where: { key: RESET_KEY },
    create: { key: RESET_KEY, value: at.toISOString() },
    update: { value: at.toISOString() }
  });
}

/** @param {Date} periodStart @param {Date | null} resetAt */
function effectiveRangeStart(periodStart, resetAt) {
  if (!resetAt) return periodStart;
  return resetAt > periodStart ? resetAt : periodStart;
}

module.exports = {
  RESET_KEY,
  getDashboardResetAt,
  setDashboardResetAt,
  effectiveRangeStart
};
