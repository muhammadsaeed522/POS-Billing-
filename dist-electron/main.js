"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
const auth_ipc_1 = require("./auth-ipc");
const billing_ipc_1 = require("./billing-ipc");
const dashboard_ipc_1 = require("./dashboard-ipc");
const products_ipc_1 = require("./products-ipc");
const reports_ipc_1 = require("./reports-ipc");
const db_1 = require("./db");
const seed_1 = require("./seed");
// Must run under the Electron binary (`electron .`), not `tsx` / plain Node — `app` is undefined there.
if (!electron_1.app || typeof electron_1.app.isPackaged !== "boolean") {
    console.error("Start the desktop app with: npm run dev (do not run main.ts with tsx/node).");
    process.exit(1);
}
dotenv_1.default.config({ path: node_path_1.default.join(__dirname, "..", ".env") });
const isDev = !electron_1.app.isPackaged;
function getRendererUrl() {
    const envUrl = process.env.ELECTRON_RENDERER_URL;
    if (isDev && envUrl)
        return envUrl;
    return `file://${node_path_1.default.join(electron_1.app.getAppPath(), "renderer", "dist", "index.html")}`;
}
function createMainWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        backgroundColor: "#0a0a0a",
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            // Sandboxed preload + compiled CJS can fail to expose `contextBridge` on some setups; keep hardened renderer, no nodeIntegration.
            sandbox: false,
            preload: node_path_1.default.resolve(__dirname, "preload.js"),
        },
    });
    win.once("ready-to-show", () => win.show());
    if (isDev) {
        win.webContents.openDevTools({ mode: "detach" });
    }
    void win.loadURL(getRendererUrl());
    return win;
}
electron_1.app.whenReady().then(async () => {
    try {
        const databaseUrl = (0, db_1.getDatabaseUrl)(electron_1.app);
        const prisma = (0, db_1.getPrisma)(databaseUrl);
        await prisma.$connect();
        await (0, seed_1.ensureSeed)(prisma);
        (0, auth_ipc_1.registerAuthIpc)(prisma);
        (0, dashboard_ipc_1.registerDashboardIpc)(prisma);
        (0, billing_ipc_1.registerBillingIpc)(prisma);
        (0, products_ipc_1.registerProductsIpc)(prisma);
        (0, reports_ipc_1.registerReportsIpc)(prisma);
        createMainWindow();
        electron_1.app.on("activate", () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0)
                createMainWindow();
        });
    }
    catch (err) {
        console.error("Startup failed:", err);
        const { dialog } = await import("electron");
        dialog.showErrorBox("POS Billing — startup error", err instanceof Error ? err.message : String(err));
        electron_1.app.exit(1);
    }
});
electron_1.app.on("before-quit", () => {
    void (0, db_1.disconnectPrisma)();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
// -------- Secure IPC (starter) --------
electron_1.ipcMain.handle("app:getVersion", () => electron_1.app.getVersion());
electron_1.ipcMain.handle("app:saveTextFile", async (event, input) => {
    const rawName = String(input?.defaultFilename ?? "export.csv").trim() || "export.csv";
    const safeBase = node_path_1.default.basename(rawName.replace(/[/\\]/g, "_")) || "export.csv";
    const content = input?.content ?? "";
    const parent = electron_1.BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const defaultPath = node_path_1.default.join(electron_1.app.getPath("documents"), safeBase);
    const dialogOpts = {
        title: "Save CSV",
        defaultPath,
        filters: [
            { name: "CSV", extensions: ["csv"] },
            { name: "Text", extensions: ["txt"] },
            { name: "All files", extensions: ["*"] },
        ],
    };
    const { canceled, filePath } = parent
        ? await electron_1.dialog.showSaveDialog(parent, dialogOpts)
        : await electron_1.dialog.showSaveDialog(dialogOpts);
    if (canceled || !filePath)
        return { ok: false, canceled: true };
    try {
        await (0, promises_1.writeFile)(filePath, content, "utf8");
        return { ok: true, path: filePath };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
});
// Inactivity signal hook (renderer will implement auto-logout timer)
electron_1.powerMonitor.on("user-did-become-active", () => {
    electron_1.BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("app:user-active"));
});
electron_1.powerMonitor.on("user-did-resign-active", () => {
    electron_1.BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("app:user-idle"));
});
