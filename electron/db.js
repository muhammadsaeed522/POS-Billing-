"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var db_exports = {};
__export(db_exports, {
  disconnectPrisma: () => disconnectPrisma,
  getDatabaseUrl: () => getDatabaseUrl,
  getPrisma: () => getPrisma,
  initPackagedDatabase: () => initPackagedDatabase
});
module.exports = __toCommonJS(db_exports);
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var import_client = require("../generated/prisma-client");
let prisma = null;
function prismaSqliteFileUrl(absoluteFsPath) {
  const posix = import_node_path.default.normalize(absoluteFsPath).replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(posix)) {
    return `file:${posix}`;
  }
  return `file:${posix.startsWith("/") ? posix : `/${posix}`}`;
}
function initPackagedDatabase(app) {
  if (!app.isPackaged) return;
  const absolute = import_node_path.default.join(app.getPath("userData"), "pos.db");
  if (import_node_fs.default.existsSync(absolute)) return;
  import_node_fs.default.mkdirSync(import_node_path.default.dirname(absolute), { recursive: true });
  const template = import_node_path.default.join(process.resourcesPath, "pos-template.db");
  if (!import_node_fs.default.existsSync(template)) {
    throw new Error("Database template missing. Reinstall POS Billing.");
  }
  import_node_fs.default.copyFileSync(template, absolute);
}
function getDatabaseUrl(app) {
  const appRoot = app.getAppPath();
  const prismaDir = import_node_path.default.join(appRoot, "prisma");
  const fromEnv = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
  let absolute;
  if (app.isPackaged) {
    absolute = import_node_path.default.join(app.getPath("userData"), "pos.db");
  } else if (!fromEnv || fromEnv === "file:./dev.db" || fromEnv === "file:./prisma/dev.db") {
    absolute = import_node_path.default.join(prismaDir, "dev.db");
  } else if (fromEnv.startsWith("file:./") || fromEnv.startsWith("file:../")) {
    const tail = fromEnv.slice("file:".length).replace(/^\.\/+/, "");
    absolute = import_node_path.default.isAbsolute(tail) ? tail : import_node_path.default.resolve(prismaDir, tail);
  } else if (fromEnv.startsWith("file:")) {
    return fromEnv;
  } else {
    absolute = import_node_path.default.join(app.getPath("userData"), "pos.db");
  }
  import_node_fs.default.mkdirSync(import_node_path.default.dirname(absolute), { recursive: true });
  return prismaSqliteFileUrl(absolute);
}
function getPrisma(databaseUrl) {
  if (!prisma) {
    prisma = new import_client.PrismaClient({
      datasources: { db: { url: databaseUrl } }
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  disconnectPrisma,
  getDatabaseUrl,
  getPrisma,
  initPackagedDatabase
});
