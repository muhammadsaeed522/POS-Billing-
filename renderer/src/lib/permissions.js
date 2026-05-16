export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  CASHIER: "cashier",
  STAFF: "staff",
  WORKER: "worker"
};

export function normalizeRole(role) {
  return String(role ?? "").toLowerCase();
}

export function isAdminRole(role) {
  return normalizeRole(role) === ROLES.ADMIN;
}

export function canAccessView(role, viewId) {
  const r = normalizeRole(role);
  if (r === ROLES.ADMIN) return true;
  if (r === ROLES.MANAGER) {
    return ["dash", "pos", "products", "reports", "profile"].includes(viewId);
  }
  if (r === ROLES.CASHIER) {
    return ["dash", "pos", "profile"].includes(viewId);
  }
  if (r === ROLES.STAFF || r === ROLES.WORKER) {
    return ["dash", "pos", "products", "profile"].includes(viewId);
  }
  return ["dash", "pos", "profile"].includes(viewId);
}

export function canManageUsers(role) {
  return isAdminRole(role);
}
