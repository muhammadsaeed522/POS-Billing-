"use strict";

const { getSession } = require("./auth-ipc");

const ROLE_ADMIN = "admin";
const ROLE_MANAGER = "manager";
const ROLE_CASHIER = "cashier";
const ROLE_STAFF = "staff";

/** Legacy seed role */
const ROLE_WORKER = "worker";

function roleName() {
  return (getSession()?.role ?? "").toLowerCase();
}

function isAdmin() {
  const r = roleName();
  return r === ROLE_ADMIN || r === ROLE_MANAGER;
}

function isStaffLike() {
  const r = roleName();
  return r === ROLE_STAFF || r === ROLE_WORKER;
}

function isCashierOnly() {
  return roleName() === ROLE_CASHIER;
}

function requireSession() {
  const s = getSession();
  if (!s) throw new Error("Please sign in to continue.");
  return s;
}

function requireRole(allowed) {
  const s = requireSession();
  const r = roleName();
  const normalized = allowed.map((x) => x.toLowerCase());
  if (!normalized.includes(r)) {
    throw new Error("You do not have permission for this action.");
  }
  return s;
}

/** Store administrator — can manage users and create other admins. */
function requireAdmin() {
  return requireRole([ROLE_ADMIN]);
}

function canAccessView(role, viewId) {
  const r = (role ?? "").toLowerCase();
  if (r === ROLE_ADMIN) return true;
  if (r === ROLE_MANAGER) {
    return viewId === "dash" || viewId === "pos" || viewId === "products" || viewId === "reports" || viewId === "profile";
  }
  if (r === ROLE_CASHIER) return viewId === "dash" || viewId === "pos" || viewId === "profile";
  if (r === ROLE_STAFF || r === ROLE_WORKER) {
    return viewId === "dash" || viewId === "pos" || viewId === "products" || viewId === "profile";
  }
  return viewId === "dash" || viewId === "pos" || viewId === "profile";
}

function assertBillingAccess() {
  requireSession();
  const r = roleName();
  if (r === ROLE_ADMIN || r === ROLE_MANAGER || r === ROLE_CASHIER || r === ROLE_STAFF || r === ROLE_WORKER) {
    return;
  }
  throw new Error("Your account cannot access billing.");
}

function assertProductsWrite() {
  requireRole([ROLE_ADMIN, ROLE_MANAGER]);
}

function assertProductsRead() {
  requireSession();
  const r = roleName();
  if (r === ROLE_ADMIN || r === ROLE_MANAGER || r === ROLE_STAFF || r === ROLE_WORKER) return;
  throw new Error("Your account cannot access products.");
}

function assertReportsAccess() {
  requireRole([ROLE_ADMIN, ROLE_MANAGER]);
}

/** @deprecated use assertProductsWrite */
function assertNotWorkerOrThrow() {
  assertProductsWrite();
}

function isWorkerRole() {
  return isStaffLike();
}

module.exports = {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_CASHIER,
  ROLE_STAFF,
  ROLE_WORKER,
  roleName,
  isAdmin,
  isStaffLike,
  isCashierOnly,
  requireSession,
  requireRole,
  requireAdmin,
  canAccessView,
  assertBillingAccess,
  assertProductsWrite,
  assertProductsRead,
  assertReportsAccess,
  assertNotWorkerOrThrow,
  isWorkerRole
};
