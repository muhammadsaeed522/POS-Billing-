"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const api = {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  getLogo: () => ipcRenderer.invoke("branding:getLogo"),
  getBrandingFolders: () => ipcRenderer.invoke("branding:getFolders"),
  onLogoChanged: (cb) => {
    const handler = (_evt, payload) => cb(payload);
    ipcRenderer.on("branding:logo-changed", handler);
    return () => ipcRenderer.removeListener("branding:logo-changed", handler);
  },

  needsSetup: () => ipcRenderer.invoke("auth:needsSetup"),
  setupInitialAdmin: (payload) => ipcRenderer.invoke("auth:setupInitialAdmin", payload),
  login: (payload) => ipcRenderer.invoke("auth:login", payload),
  signup: (payload) => ipcRenderer.invoke("auth:signup", payload),
  forgotPassword: (payload) => ipcRenderer.invoke("auth:forgotPassword", payload),
  resetPassword: (payload) => ipcRenderer.invoke("auth:resetPassword", payload),
  changePassword: (payload) => ipcRenderer.invoke("auth:changePassword", payload),
  logout: () => ipcRenderer.invoke("auth:logout"),
  getSession: (payload) => ipcRenderer.invoke("auth:getSession", payload),
  getProfile: () => ipcRenderer.invoke("auth:getProfile"),
  updateProfile: (payload) => ipcRenderer.invoke("auth:updateProfile", payload),
  uploadProfileImage: (payload) => ipcRenderer.invoke("auth:uploadProfileImage", payload),

  listRoles: () => ipcRenderer.invoke("users:listRoles"),
  listUsers: (params) => ipcRenderer.invoke("users:list", params),
  createUser: (payload) => ipcRenderer.invoke("users:create", payload),
  updateUser: (payload) => ipcRenderer.invoke("users:update", payload),
  deleteUser: (payload) => ipcRenderer.invoke("users:delete", payload),
  adminResetPassword: (payload) => ipcRenderer.invoke("users:adminResetPassword", payload),
  listActivity: (params) => ipcRenderer.invoke("users:listActivity", params),
  getAdminStats: () => ipcRenderer.invoke("users:stats"),
  getDashboardResetInfo: () => ipcRenderer.invoke("admin:getDashboardResetInfo"),
  resetDashboardStats: () => ipcRenderer.invoke("admin:resetDashboardStats"),
  undoDashboardStatsReset: () => ipcRenderer.invoke("admin:undoDashboardStatsReset"),
  deleteReportsInRange: (payload) => ipcRenderer.invoke("admin:deleteReportsInRange", payload),
  deleteAllActivityLogs: () => ipcRenderer.invoke("admin:deleteAllActivityLogs"),
  getActivityLogsDeleteInfo: () => ipcRenderer.invoke("admin:getActivityLogsDeleteInfo"),

  getDashboardSnapshot: () => ipcRenderer.invoke("dashboard:getSnapshot"),
  searchProducts: (query) => ipcRenderer.invoke("billing:searchProducts", query),
  resolveBarcode: (code) => ipcRenderer.invoke("billing:resolveBarcode", code),
  checkout: (input) => ipcRenderer.invoke("billing:checkout", input),
  listCategories: () => ipcRenderer.invoke("products:listCategories"),
  saveCategory: (input) => ipcRenderer.invoke("products:saveCategory", input),
  deleteCategory: (payload) => ipcRenderer.invoke("products:deleteCategory", payload),
  listProducts: (params) => ipcRenderer.invoke("products:list", params),
  saveProduct: (input) => ipcRenderer.invoke("products:save", input),
  checkProductBarcode: (payload) => ipcRenderer.invoke("products:checkBarcode", payload),
  setProductActive: (payload) => ipcRenderer.invoke("products:setActive", payload),
  getReportRange: (params) => ipcRenderer.invoke("reports:getRange", params),
  saveTextFile: (input) => ipcRenderer.invoke("app:saveTextFile", input),
  saveReportPdf: (snapshot) => ipcRenderer.invoke("reports:savePdf", snapshot),
  onUserActive: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("app:user-active", handler);
    return () => ipcRenderer.removeListener("app:user-active", handler);
  },
  onUserIdle: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("app:user-idle", handler);
    return () => ipcRenderer.removeListener("app:user-idle", handler);
  }
};

contextBridge.exposeInMainWorld("pos", api);

contextBridge.exposeInMainWorld("posReports", {
  getRange: (params) => ipcRenderer.invoke("reports:getRange", params)
});
