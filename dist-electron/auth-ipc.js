"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSession = getSession;
exports.clearSession = clearSession;
exports.registerAuthIpc = registerAuthIpc;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const electron_1 = require("electron");
let session = null;
function getSession() {
    return session;
}
function clearSession() {
    session = null;
}
function registerAuthIpc(prisma) {
    electron_1.ipcMain.handle("auth:login", async (_evt, payload) => {
        const username = String(payload?.username ?? "").trim().toLowerCase();
        const password = String(payload?.password ?? "");
        if (!username || !password) {
            return { ok: false, error: "Enter username and password." };
        }
        const user = await prisma.user.findFirst({
            where: { username, isActive: true },
            include: { role: true },
        });
        if (!user || !bcryptjs_1.default.compareSync(password, user.passwordHash)) {
            return { ok: false, error: "Invalid username or password." };
        }
        session = {
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role.name,
        };
        return { ok: true, session };
    });
    electron_1.ipcMain.handle("auth:logout", async () => {
        clearSession();
        return { ok: true };
    });
    electron_1.ipcMain.handle("auth:getSession", async () => {
        return { session };
    });
}
