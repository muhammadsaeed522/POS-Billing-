"use strict";

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
function createActivityLogger(prisma) {
  /**
   * @param {{ userId?: string | null, action: string, details?: string | null, ipAddress?: string | null, deviceInfo?: string | null }} entry
   */
  async function logActivity(entry) {
    try {
      await prisma.activityLog.create({
        data: {
          userId: entry.userId ?? null,
          action: String(entry.action).slice(0, 120),
          details: entry.details ? String(entry.details).slice(0, 2000) : null,
          ipAddress: entry.ipAddress ? String(entry.ipAddress).slice(0, 64) : null,
          deviceInfo: entry.deviceInfo ? String(entry.deviceInfo).slice(0, 256) : null
        }
      });
    } catch (err) {
      console.error("activity log failed:", err);
    }
  }

  return { logActivity };
}

module.exports = { createActivityLogger };
