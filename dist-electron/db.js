"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseUrl = getDatabaseUrl;
exports.getPrisma = getPrisma;
exports.disconnectPrisma = disconnectPrisma;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const client_1 = require("@prisma/client");
let prisma = null;
/**
 * Prisma's SQLite driver on Windows can fail with `pathToFileURL` (%20 for spaces) or with
 * `file:./prisma/dev.db` (resolved relative to the schema dir → nested `prisma/prisma/`).
 * Use an absolute path with forward slashes: `file:C:/path/to/prisma/dev.db`.
 */
function prismaSqliteFileUrl(absoluteFsPath) {
    const posix = node_path_1.default.normalize(absoluteFsPath).replace(/\\/g, "/");
    if (/^[A-Za-z]:\//.test(posix)) {
        return `file:${posix}`;
    }
    return `file:${posix.startsWith("/") ? posix : `/${posix}`}`;
}
/**
 * Default DB file: `prisma/dev.db` next to `schema.prisma` (same as `DATABASE_URL=file:./dev.db` for CLI).
 */
function getDatabaseUrl(app) {
    const appRoot = app.getAppPath();
    const prismaDir = node_path_1.default.join(appRoot, "prisma");
    const fromEnv = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
    let absolute;
    if (!fromEnv || fromEnv === "file:./dev.db" || fromEnv === "file:./prisma/dev.db") {
        // Legacy env used ./prisma/dev.db → wrong nesting; normalize to prisma/dev.db
        absolute = node_path_1.default.join(prismaDir, "dev.db");
    }
    else if (fromEnv.startsWith("file:./") || fromEnv.startsWith("file:../")) {
        const tail = fromEnv.slice("file:".length).replace(/^\.\/+/, "");
        absolute = node_path_1.default.isAbsolute(tail) ? tail : node_path_1.default.resolve(prismaDir, tail);
    }
    else if (fromEnv.startsWith("file:")) {
        return fromEnv;
    }
    else {
        absolute = node_path_1.default.join(app.getPath("userData"), "pos.db");
    }
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(absolute), { recursive: true });
    return prismaSqliteFileUrl(absolute);
}
function getPrisma(databaseUrl) {
    if (!prisma) {
        prisma = new client_1.PrismaClient({
            datasources: { db: { url: databaseUrl } },
        });
    }
    return prisma;
}
async function disconnectPrisma() {
    if (prisma) {
        await prisma.$disconnect();
        prisma = null;
    }
}
