"use strict";

const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");

const BCRYPT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_DAYS_REMEMBER = 30;
const SESSION_HOURS_DEFAULT = 12;
const RESET_TOKEN_HOURS = 1;

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateLimit = new Map();

function sanitizeText(value, maxLen = 200) {
  return String(value ?? "")
    .replace(/[\0-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim()
    .slice(0, maxLen);
}

function normalizeEmail(email) {
  return sanitizeText(email, 254).toLowerCase();
}

function normalizeUsername(username) {
  return sanitizeText(username, 64).toLowerCase();
}

function normalizePhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.slice(0, 20);
}

function validatePassword(password) {
  const p = String(password ?? "");
  if (p.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(p)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(p)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(p)) return "Password must include a number.";
  return null;
}

function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function sessionExpiry(rememberMe) {
  const ms = rememberMe
    ? SESSION_DAYS_REMEMBER * 24 * 60 * 60 * 1000
    : SESSION_HOURS_DEFAULT * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

function resetTokenExpiry() {
  return new Date(Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000);
}

function checkRateLimit(key, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const row = rateLimit.get(key);
  if (!row || now > row.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  row.count += 1;
  if (row.count > max) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return null;
}

function isLocked(user) {
  if (!user.lockedUntil) return false;
  return user.lockedUntil.getTime() > Date.now();
}

function lockoutUntil(attempts) {
  if (attempts < MAX_LOGIN_ATTEMPTS) return null;
  return new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    profileImage: user.profileImage,
    isActive: user.isActive,
    role: user.role?.name ?? user.role,
    createdAt: user.createdAt?.toISOString?.() ?? user.createdAt,
    lastLoginAt: user.lastLoginAt?.toISOString?.() ?? user.lastLoginAt ?? null
  };
}

function toSessionPayload(user) {
  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage,
    role: user.role?.name ?? user.role
  };
}

module.exports = {
  BCRYPT_ROUNDS,
  MAX_LOGIN_ATTEMPTS,
  sanitizeText,
  normalizeEmail,
  normalizeUsername,
  normalizePhone,
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
};
