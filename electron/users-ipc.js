"use strict";

const { ipcMain, app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const {
  sanitizeText,
  normalizeEmail,
  normalizeUsername,
  normalizePhone,
  validatePassword,
  hashPassword,
  toPublicUser
} = require("./auth-utils");
const { getSession } = require("./auth-ipc");
const { requireAdmin } = require("./role-guard");
const { createActivityLogger } = require("./activity-log");

function registerUsersIpc(prisma) {
  const { logActivity } = createActivityLogger(prisma);

  ipcMain.handle("users:listRoles", async () => {
    requireAdmin();
    const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
    return { ok: true, roles: roles.map((r) => ({ id: r.id, name: r.name })) };
  });

  ipcMain.handle("users:list", async (_evt, params) => {
    requireAdmin();
    const q = sanitizeText(params?.query, 80).toLowerCase();
    const page = Math.max(1, Math.floor(Number(params?.page) || 1));
    const pageSize = Math.min(50, Math.max(5, Math.floor(Number(params?.pageSize) || 20)));
    const skip = (page - 1) * pageSize;

    const where = q
      ? {
          OR: [
            { username: { contains: q } },
            { displayName: { contains: q } },
            { email: { contains: q } }
          ]
        }
      : {};

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { role: true }
      })
    ]);

    const activeSessions = await prisma.authSession.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { userId: true }
    });
    const online = new Set(activeSessions.map((s) => s.userId));

    return {
      ok: true,
      total,
      page,
      pageSize,
      users: rows.map((u) => ({
        ...toPublicUser(u),
        isOnline: online.has(u.id)
      }))
    };
  });

  ipcMain.handle("users:create", async (_evt, payload) => {
    const admin = requireAdmin();
    const displayName = sanitizeText(payload?.displayName ?? payload?.fullName, 120);
    const username = normalizeUsername(payload?.username);
    const email = normalizeEmail(payload?.email);
    const phone = normalizePhone(payload?.phone);
    const password = String(payload?.password ?? "");
    const roleName = sanitizeText(payload?.role, 32).toLowerCase() || "cashier";

    if (!displayName || !username) return { ok: false, error: "Name and username required." };
    const passErr = validatePassword(password);
    if (passErr) return { ok: false, error: passErr };

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return { ok: false, error: "Invalid role." };

    const clash = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (clash) return { ok: false, error: "Username or email already exists." };

    const user = await prisma.user.create({
      data: {
        username,
        email: email || null,
        phone: phone || null,
        displayName,
        passwordHash: hashPassword(password),
        roleId: role.id
      },
      include: { role: true }
    });

    await logActivity({
      userId: admin.userId,
      action: "user_create",
      details: `Created user ${username} (${roleName})`
    });

    return { ok: true, user: toPublicUser(user) };
  });

  ipcMain.handle("users:update", async (_evt, payload) => {
    const admin = requireAdmin();
    const id = String(payload?.id ?? "");
    if (!id) return { ok: false, error: "User id required." };

    const displayName = payload?.displayName != null ? sanitizeText(payload.displayName, 120) : undefined;
    const phone = payload?.phone != null ? normalizePhone(payload.phone) : undefined;
    const email = payload?.email != null ? normalizeEmail(payload.email) : undefined;
    const roleName = payload?.role != null ? sanitizeText(payload.role, 32).toLowerCase() : undefined;
    const isActive = payload?.isActive;

    const data = {};
    if (displayName !== undefined) data.displayName = displayName;
    if (phone !== undefined) data.phone = phone || null;
    if (email !== undefined) data.email = email || null;
    if (typeof isActive === "boolean") data.isActive = isActive;

    if (roleName) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) return { ok: false, error: "Invalid role." };
      data.roleId = role.id;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: { role: true }
    });

    await logActivity({
      userId: admin.userId,
      action: "user_update",
      details: `Updated user ${user.username}`
    });

    return { ok: true, user: toPublicUser(user) };
  });

  ipcMain.handle("users:delete", async (_evt, payload) => {
    const admin = requireAdmin();
    const id = String(payload?.id ?? "");
    if (!id) return { ok: false, error: "User id required." };
    if (id === admin.userId) return { ok: false, error: "You cannot delete your own account." };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { ok: false, error: "User not found." };

    await prisma.$transaction([
      prisma.authSession.deleteMany({ where: { userId: id } }),
      prisma.activityLog.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.user.delete({ where: { id } })
    ]);

    await logActivity({
      userId: admin.userId,
      action: "user_delete",
      details: `Deleted user ${user.username}`
    });

    return { ok: true };
  });

  ipcMain.handle("users:adminResetPassword", async (_evt, payload) => {
    const admin = requireAdmin();
    const id = String(payload?.id ?? "");
    const password = String(payload?.password ?? "");
    const passErr = validatePassword(password);
    if (passErr) return { ok: false, error: passErr };

    await prisma.user.update({
      where: { id },
      data: { passwordHash: hashPassword(password), failedLoginAttempts: 0, lockedUntil: null }
    });
    await prisma.authSession.deleteMany({ where: { userId: id } });

    await logActivity({
      userId: admin.userId,
      action: "user_password_reset",
      details: `Admin reset password for user ${id}`
    });

    return { ok: true };
  });

  ipcMain.handle("users:listActivity", async (_evt, params) => {
    requireAdmin();
    const page = Math.max(1, Math.floor(Number(params?.page) || 1));
    const pageSize = Math.min(100, Math.max(10, Math.floor(Number(params?.pageSize) || 30)));
    const skip = (page - 1) * pageSize;
    const userId = params?.userId ? String(params.userId) : undefined;
    const action = params?.action ? sanitizeText(params.action, 80) : undefined;

    const where = {};
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action };

    const [total, rows] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { username: true, displayName: true } } }
      })
    ]);

    return {
      ok: true,
      total,
      page,
      pageSize,
      logs: rows.map((l) => ({
        id: l.id,
        userId: l.userId,
        username: l.user?.username ?? null,
        displayName: l.user?.displayName ?? null,
        action: l.action,
        details: l.details,
        ipAddress: l.ipAddress,
        deviceInfo: l.deviceInfo,
        createdAt: l.createdAt.toISOString()
      }))
    };
  });

  ipcMain.handle("users:stats", async () => {
    requireAdmin();
    const [userCount, activeSessions, todayLogins, salesToday] = await Promise.all([
      prisma.user.count(),
      prisma.authSession.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.activityLog.count({
        where: {
          action: "login",
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      }),
      prisma.sale.count({
        where: { saleAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
      })
    ]);
    return { ok: true, stats: { userCount, activeSessions, todayLogins, salesToday } };
  });

  ipcMain.handle("auth:uploadProfileImage", async (_evt, payload) => {
    const s = getSession();
    if (!s) return { ok: false, error: "Not signed in." };
    const dataUrl = String(payload?.dataUrl ?? "");
    const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
    if (!match) return { ok: false, error: "Invalid image data." };

    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const buf = Buffer.from(match[2], "base64");
    if (buf.length > 2 * 1024 * 1024) return { ok: false, error: "Image must be under 2 MB." };

    const dir = path.join(app.getPath("userData"), "profiles");
    await fs.mkdir(dir, { recursive: true });
    const filename = `${s.userId}.${ext}`;
    const full = path.join(dir, filename);
    await fs.writeFile(full, buf);

    const rel = `profiles/${filename}`;
    const user = await prisma.user.update({
      where: { id: s.userId },
      data: { profileImage: rel },
      include: { role: true }
    });

    return { ok: true, profileImage: rel, user: toPublicUser(user) };
  });

  ipcMain.handle("auth:getProfileImagePath", async (_evt, payload) => {
    const rel = String(payload?.profileImage ?? "");
    if (!rel || rel.includes("..")) return { ok: false };
    const full = path.join(app.getPath("userData"), rel);
    try {
      await fs.access(full);
      return { ok: true, path: full };
    } catch {
      return { ok: false };
    }
  });
}

module.exports = { registerUsersIpc };
