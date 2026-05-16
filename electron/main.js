"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_dotenv = __toESM(require("dotenv"));
var import_promises = require("node:fs/promises");
var import_node_path = __toESM(require("node:path"));
var import_electron = require("electron");
var import_auth_ipc = require("./auth-ipc");
var import_billing_ipc = require("./billing-ipc");
var import_dashboard_ipc = require("./dashboard-ipc");
var import_products_ipc = require("./products-ipc");
var import_reports_ipc = require("./reports-ipc");
var import_users_ipc = require("./users-ipc");
var import_admin_reset_ipc = require("./admin-reset-ipc");
var import_db = require("./db");
var import_seed = require("./seed");
var import_branding = require("./branding");
var import_splash_window = require("./splash-window");
if (!import_electron.app || typeof import_electron.app.isPackaged !== "boolean") {
  console.error("Start the desktop app with: npm run dev (do not run main.ts with tsx/node).");
  process.exit(1);
}
import_dotenv.default.config({ path: import_node_path.default.join(__dirname, "..", ".env") });
const isDev = !import_electron.app.isPackaged;
function getRendererUrl() {
  const envUrl = process.env.ELECTRON_RENDERER_URL;
  if (isDev && envUrl) return envUrl;
  return `file://${import_node_path.default.join(import_electron.app.getAppPath(), "renderer", "dist", "index.html")}`;
}
function createMainWindow() {
  const win = new import_electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0a0a0a",
    show: false,
    icon: import_branding.getCachedWindowIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Sandboxed preload + compiled CJS can fail to expose `contextBridge` on some setups; keep hardened renderer, no nodeIntegration.
      sandbox: false,
      preload: import_node_path.default.resolve(__dirname, "preload.js")
    }
  });
  win.once("ready-to-show", () => win.show());
  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }
  void win.loadURL(getRendererUrl());
  return win;
}
import_electron.app.whenReady().then(async () => {
  try {
    const logoInfo = await (0, import_branding.initBranding)(import_electron.app);
    import_splash_window.createSplashWindow(logoInfo?.url ?? "", import_branding.getCachedWindowIcon());
    (0, import_db.initPackagedDatabase)(import_electron.app);
    const databaseUrl = (0, import_db.getDatabaseUrl)(import_electron.app);
    const prisma = (0, import_db.getPrisma)(databaseUrl);
    await prisma.$connect();
    await (0, import_seed.ensureSeed)(prisma);
    (0, import_auth_ipc.registerAuthIpc)(prisma);
    (0, import_users_ipc.registerUsersIpc)(prisma);
    (0, import_admin_reset_ipc.registerAdminResetIpc)(prisma);
    (0, import_dashboard_ipc.registerDashboardIpc)(prisma);
    (0, import_billing_ipc.registerBillingIpc)(prisma);
    (0, import_products_ipc.registerProductsIpc)(prisma);
    (0, import_reports_ipc.registerReportsIpc)(prisma);
    const mainWin = createMainWindow();
    mainWin.once("ready-to-show", () => import_splash_window.closeSplashWindow());
    import_electron.app.on("activate", () => {
      if (import_electron.BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  } catch (err) {
    import_splash_window.closeSplashWindow();
    console.error("Startup failed:", err);
    const { dialog: dialog2 } = await import("electron");
    dialog2.showErrorBox(
      "POS Billing \u2014 startup error",
      err instanceof Error ? err.message : String(err)
    );
    import_electron.app.exit(1);
  }
});
import_electron.app.on("before-quit", () => {
  import_branding.stopBrandingWatcher();
  void (0, import_db.disconnectPrisma)();
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.ipcMain.handle("app:getVersion", () => import_electron.app.getVersion());
import_electron.ipcMain.handle("app:saveTextFile", async (event, input) => {
  const rawName = String(input?.defaultFilename ?? "export.csv").trim() || "export.csv";
  const safeBase = import_node_path.default.basename(rawName.replace(/[/\\]/g, "_")) || "export.csv";
  const content = input?.content ?? "";
  const parent = import_electron.BrowserWindow.fromWebContents(event.sender) ?? void 0;
  const defaultPath = import_node_path.default.join(import_electron.app.getPath("documents"), safeBase);
  const dialogOpts = {
    title: "Save CSV",
    defaultPath,
    filters: [
      { name: "CSV", extensions: ["csv"] },
      { name: "Text", extensions: ["txt"] },
      { name: "All files", extensions: ["*"] }
    ]
  };
  const { canceled, filePath } = parent ? await import_electron.dialog.showSaveDialog(parent, dialogOpts) : await import_electron.dialog.showSaveDialog(dialogOpts);
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    await (0, import_promises.writeFile)(filePath, content, "utf8");
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});
import_electron.powerMonitor.on("user-did-become-active", () => {
  import_electron.BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("app:user-active"));
});
import_electron.powerMonitor.on("user-did-resign-active", () => {
  import_electron.BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("app:user-idle"));
});
