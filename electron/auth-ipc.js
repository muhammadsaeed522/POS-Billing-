"use strict";

const bcrypt = require("bcryptjs");
const { ipcMain } = require("electron");
const {
  normalizeEmail,
  normalizeUsername,
  normalizePhone,
  sanitizeText,
  validatePassword,
  hashPassword,
  verifyPassword,
  createToken,
  sessionExpiry,
  resetTokenExpiry,
  checkRateLimit,
  isLocked,
  lockoutUntil,
  toPublicUser,
  toSessionPayload
} = require("./auth-utils");
const { createActivityLogger } = require("./activity-log");
const { needsInitialAdminSetup } = require("./auth-setup");

/** @type {import('./auth-utils').toSessionPayload extends (u: infer U) => unknown ? ReturnType<typeof toSessionPayload> : { userId: string, username: string, displayName: string, role: string }} */
let session = null;
/** @type {string | null} */
let sessionToken = null;

function getSession() {
  return session;
}

function clearSession() {
  session = null;
  sessionToken = null;
}

function setSession(next, token = null) {
  session = next;
  sessionToken = token;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
function registerAuthIpc(prisma) {
  const { logActivity } = createActivityLogger(prisma);

  async function loadSessionFromToken(token) {
    if (!token) return null;
    const row = await prisma.authSession.findUnique({
      where: { token },
      include: { user: { include: { role: true } } }
    });
    if (!row || row.expiresAt.getTime() < Date.now()) {
      if (row) await prisma.authSession.delete({ where: { id: row.id } }).catch(() => {});
      return null;
    }
    if (!row.user.isActive) return null;
    return { session: toSessionPayload(row.user), token: row.token };
  }

  async function establishSession(user, rememberMe, meta = {}) {
    const token = createToken();
    const expiresAt = sessionExpiry(rememberMe);
    await prisma.authSession.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
        deviceInfo: meta.deviceInfo ?? null,
        ipAddress: meta.ipAddress ?? null
      }
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });
    const payload = toSessionPayload(user);
    setSession(payload, token);
    await logActivity({
      userId: user.id,
      action: "login",
      details: `User ${user.username} signed in`,
      deviceInfo: meta.deviceInfo,
      ipAddress: meta.ipAddress
    });
    return { session: payload, token };
  }

  ipcMain.handle("auth:needsSetup", async () => {
    const needsSetup = await needsInitialAdminSetup(prisma);
    return { ok: true, needsSetup };
  });

  ipcMain.handle("auth:setupInitialAdmin", async (_evt, payload) => {
    if (!(await needsInitialAdminSetup(prisma))) {
      return { ok: false, error: "Store administrator already exists. Sign in instead." };
    }

    const rateErr = checkRateLimit("setup-admin", 5, 60_000);
    if (rateErr) return { ok: false, error: rateErr };

    const displayName = sanitizeText(payload?.fullName ?? payload?.displayName, 120);
    const username = normalizeUsername(payload?.username);
    const email = normalizeEmail(payload?.email);
    const phone = normalizePhone(payload?.phone);
    const password = String(payload?.password ?? "");
    const confirm = String(payload?.confirmPassword ?? "");
    const rememberMe = Boolean(payload?.rememberMe ?? true);
    const deviceInfo = sanitizeText(payload?.deviceInfo ?? "Electron POS setup", 256);

    if (!displayName) return { ok: false, error: "Full name is required." };
    if (!username || username.length < 3) return { ok: false, error: "Username must be at least 3 characters." };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    const passErr = validatePassword(password);
    if (passErr) return { ok: false, error: passErr };
    if (password !== confirm) return { ok: false, error: "Passwords do not match." };

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] }
    });
    if (existingUser) {
      return { ok: false, error: "Username or email already in use." };
    }

    const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
    if (!adminRole) return { ok: false, error: "Admin role missing. Restart the application." };

    const user = await prisma.user.create({
      data: {
        username,
        email,
        phone: phone || null,
        displayName,
        passwordHash: hashPassword(password),
        roleId: adminRole.id
      },
      include: { role: true }
    });

    await logActivity({
      userId: user.id,
      action: "initial_admin_setup",
      details: `First store administrator: ${username}`
    });

    const out = await establishSession(user, rememberMe, { deviceInfo });
    return { ok: true, session: out.session, token: out.token, user: toPublicUser(user) };
  });

  ipcMain.handle("auth:login", async (_evt, payload) => {
    if (await needsInitialAdminSetup(prisma)) {
      return { ok: false, error: "Create the store administrator account first (one-time setup)." };
    }

    const identifier = sanitizeText(payload?.identifier ?? payload?.username ?? "", 254);
    const password = String(payload?.password ?? "");
    const rememberMe = Boolean(payload?.rememberMe);
    const deviceInfo = sanitizeText(payload?.deviceInfo ?? "Electron POS", 256);

    const rateKey = `login:${identifier.toLowerCase()}`;
    const rateErr = checkRateLimit(rateKey, 15, 60_000);
    if (rateErr) return { ok: false, error: rateErr };

    if (!identifier || !password) {
      return { ok: false, error: "Enter email/username and password." };
    }

    const idLower = identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ username: idLower }, { email: idLower }]
      },
      include: { role: true }
    });

    if (!user) {
      await logActivity({
        userId: null,
        action: "login_failed",
        details: `Unknown account: ${idLower}`,
        deviceInfo
      });
      return { ok: false, error: "Invalid email/username or password." };
    }

    if (isLocked(user)) {
      return { ok: false, error: "Account temporarily locked. Try again later." };
    }

    if (!verifyPassword(password, user.passwordHash)) {
      const attempts = user.failedLoginAttempts + 1;
      const locked = lockoutUntil(attempts);
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lockedUntil: locked }
      });
      await logActivity({
        userId: user.id,
        action: "login_failed",
        details: `Failed attempt ${attempts}`,
        deviceInfo
      });
      return { ok: false, error: "Invalid email/username or password." };
    }

    const out = await establishSession(user, rememberMe, { deviceInfo });
    return { ok: true, session: out.session, token: out.token };
  });

  ipcMain.handle("auth:signup", async (_evt, payload) => {
    if (await needsInitialAdminSetup(prisma)) {
      return { ok: false, error: "Complete one-time administrator setup before other signups." };
    }

    const rateErr = checkRateLimit("signup", 10, 60_000);
    if (rateErr) return { ok: false, error: rateErr };

    const displayName = sanitizeText(payload?.fullName ?? payload?.displayName, 120);
    const username = normalizeUsername(payload?.username);
    const email = normalizeEmail(payload?.email);
    const phone = normalizePhone(payload?.phone);
    const password = String(payload?.password ?? "");
    const confirm = String(payload?.confirmPassword ?? "");

    if (!displayName) return { ok: false, error: "Full name is required." };
    if (!username || username.length < 3) return { ok: false, error: "Username must be at least 3 characters." };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    if (phone && phone.length < 7) return { ok: false, error: "Enter a valid phone number." };
    const passErr = validatePassword(password);
    if (passErr) return { ok: false, error: passErr };
    if (password !== confirm) return { ok: false, error: "Passwords do not match." };

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] }
    });
    if (existingUser) {
      if (existingUser.username === username) return { ok: false, error: "Username already taken." };
      return { ok: false, error: "Email already registered." };
    }

    let role = await prisma.role.findUnique({ where: { name: "cashier" } });
    if (!role) {
      role = await prisma.role.findFirst({ orderBy: { name: "asc" } });
    }
    if (!role) return { ok: false, error: "No roles configured. Contact administrator." };

    const user = await prisma.user.create({
      data: {
        username,
        email,
        phone: phone || null,
        displayName,
        passwordHash: hashPassword(password),
        roleId: role.id
      },
      include: { role: true }
    });

    await logActivity({
      userId: user.id,
      action: "signup",
      details: `New account: ${username}`
    });

    return { ok: true, user: toPublicUser(user) };
  });

  ipcMain.handle("auth:forgotPassword", async (_evt, payload) => {
    const rateErr = checkRateLimit("forgot", 8, 60_000);
    if (rateErr) return { ok: false, error: rateErr };

    const email = normalizeEmail(payload?.email);
    if (!email) return { ok: false, error: "Enter your email address." };

    const user = await prisma.user.findFirst({ where: { email, isActive: true } });
    if (!user) {
      return { ok: true, message: "If that email exists, reset instructions were sent." };
    }

    const token = createToken(24);
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt: resetTokenExpiry() }
    });

    await logActivity({
      userId: user.id,
      action: "password_reset_requested",
      details: "Reset token issued (offline app — copy token from admin or logs in dev)"
    });

    return {
      ok: true,
      message: "Reset link created. In this offline app, use the token below on the reset screen.",
      resetToken: token
    };
  });

  ipcMain.handle("auth:resetPassword", async (_evt, payload) => {
    const rateErr = checkRateLimit("reset", 8, 60_000);
    if (rateErr) return { ok: false, error: rateErr };

    const token = sanitizeText(payload?.token, 128);
    const password = String(payload?.password ?? "");
    const confirm = String(payload?.confirmPassword ?? "");

    const passErr = validatePassword(password);
    if (passErr) return { ok: false, error: passErr };
    if (password !== confirm) return { ok: false, error: "Passwords do not match." };
    if (!token) return { ok: false, error: "Reset token is required." };

    const row = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return { ok: false, error: "Invalid or expired reset token." };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: {
          passwordHash: hashPassword(password),
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      }),
      prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() }
      }),
      prisma.authSession.deleteMany({ where: { userId: row.userId } })
    ]);

    await logActivity({
      userId: row.userId,
      action: "password_reset",
      details: "Password changed via reset token"
    });

    return { ok: true };
  });

  ipcMain.handle("auth:changePassword", async (_evt, payload) => {
    if (!session) return { ok: false, error: "Not signed in." };
    const current = String(payload?.currentPassword ?? "");
    const password = String(payload?.newPassword ?? "");
    const confirm = String(payload?.confirmPassword ?? "");

    const passErr = validatePassword(password);
    if (passErr) return { ok: false, error: passErr };
    if (password !== confirm) return { ok: false, error: "Passwords do not match." };

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !verifyPassword(current, user.passwordHash)) {
      return { ok: false, error: "Current password is incorrect." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(password) }
    });

    await logActivity({
      userId: user.id,
      action: "password_change",
      details: "User changed password"
    });

    return { ok: true };
  });

  ipcMain.handle("auth:logout", async () => {
    const uid = session?.userId;
    if (sessionToken) {
      await prisma.authSession.deleteMany({ where: { token: sessionToken } }).catch(() => {});
    }
    if (uid) {
      await logActivity({ userId: uid, action: "logout", details: "User signed out" });
    }
    clearSession();
    return { ok: true };
  });

  ipcMain.handle("auth:getSession", async (_evt, payload) => {
    const token = payload?.token ?? sessionToken;
    if (session) return { session, token: sessionToken };
    const restored = await loadSessionFromToken(token);
    if (restored) {
      setSession(restored.session, restored.token);
      return { session: restored.session, token: restored.token };
    }
    return { session: null, token: null };
  });

  ipcMain.handle("auth:getProfile", async () => {
    if (!session) return { ok: false, error: "Not signed in." };
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { role: true }
    });
    if (!user) return { ok: false, error: "User not found." };
    return { ok: true, user: toPublicUser(user) };
  });

  ipcMain.handle("auth:updateProfile", async (_evt, payload) => {
    if (!session) return { ok: false, error: "Not signed in." };
    const displayName = sanitizeText(payload?.displayName ?? payload?.fullName, 120);
    const phone = normalizePhone(payload?.phone);
    const email = payload?.email != null ? normalizeEmail(payload.email) : undefined;

    if (!displayName) return { ok: false, error: "Name is required." };
    if (email !== undefined && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Invalid email." };
    }
    if (email) {
      const clash = await prisma.user.findFirst({
        where: { email, NOT: { id: session.userId } }
      });
      if (clash) return { ok: false, error: "Email already in use." };
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        displayName,
        phone: phone || null,
        ...(email !== undefined ? { email: email || null } : {})
      },
      include: { role: true }
    });

    const next = toSessionPayload(user);
    setSession(next, sessionToken);

    await logActivity({
      userId: user.id,
      action: "profile_update",
      details: "Profile updated"
    });

    return { ok: true, user: toPublicUser(user), session: next };
  });

  return { logActivity, getSession, clearSession, setSession, loadSessionFromToken };
}

module.exports = {
  getSession,
  clearSession,
  setSession,
  registerAuthIpc
};
