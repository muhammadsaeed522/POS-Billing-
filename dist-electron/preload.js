"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    getVersion: () => electron_1.ipcRenderer.invoke("app:getVersion"),
    login: (username, password) => electron_1.ipcRenderer.invoke("auth:login", { username, password }),
    logout: () => electron_1.ipcRenderer.invoke("auth:logout"),
    getSession: () => electron_1.ipcRenderer.invoke("auth:getSession"),
    getDashboardSnapshot: () => electron_1.ipcRenderer.invoke("dashboard:getSnapshot"),
    searchProducts: (query) => electron_1.ipcRenderer.invoke("billing:searchProducts", query),
    checkout: (input) => electron_1.ipcRenderer.invoke("billing:checkout", input),
    listCategories: () => electron_1.ipcRenderer.invoke("products:listCategories"),
    saveCategory: (input) => electron_1.ipcRenderer.invoke("products:saveCategory", input),
    deleteCategory: (id) => electron_1.ipcRenderer.invoke("products:deleteCategory", id),
    listProducts: (params) => electron_1.ipcRenderer.invoke("products:list", params),
    saveProduct: (input) => electron_1.ipcRenderer.invoke("products:save", input),
    setProductActive: (payload) => electron_1.ipcRenderer.invoke("products:setActive", payload),
    getReportRange: (params) => electron_1.ipcRenderer.invoke("reports:getRange", params),
    saveTextFile: (input) => electron_1.ipcRenderer.invoke("app:saveTextFile", input),
    saveReportPdf: (snapshot) => electron_1.ipcRenderer.invoke("reports:savePdf", snapshot),
    onUserActive: (cb) => {
        const handler = () => cb();
        electron_1.ipcRenderer.on("app:user-active", handler);
        return () => electron_1.ipcRenderer.removeListener("app:user-active", handler);
    },
    onUserIdle: (cb) => {
        const handler = () => cb();
        electron_1.ipcRenderer.on("app:user-idle", handler);
        return () => electron_1.ipcRenderer.removeListener("app:user-idle", handler);
    },
};
electron_1.contextBridge.exposeInMainWorld("pos", api);
/** Separate tiny bridge so reports still work if an older `pos` object is cached without newer fields. */
const reportsApi = {
    getRange: (params) => electron_1.ipcRenderer.invoke("reports:getRange", params),
};
electron_1.contextBridge.exposeInMainWorld("posReports", reportsApi);
