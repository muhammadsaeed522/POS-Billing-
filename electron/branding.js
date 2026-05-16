"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { nativeImage, ipcMain, BrowserWindow } = require("electron");

const CUSTOM_SUBDIR = path.join("logo", "images");
const DEFAULT_SUBDIR = path.join("logo", "default");
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".ico", ".svg"]);
const PREFERRED_NAMES = [
  "logo.png",
  "logo.jpg",
  "logo.jpeg",
  "logo.webp",
  "logo.ico",
  "logo.svg",
  "Logo.png",
  "Logo.jpg",
  "Logo.jpeg",
  "Logo.webp",
  "Logo.ico",
  "Logo.svg"
];

/** @type {{ path: string, url: string, isCustom: boolean, fileName: string } | null} */
let cachedLogo = null;
/** @type {import('fs').FSWatcher | null} */
let folderWatcher = null;
let watchDebounce = null;

function getProjectRoot(app) {
  return app.isPackaged ? app.getAppPath() : path.join(app.getAppPath());
}

function getWritableLogoRoot(app) {
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "logo");
  }
  return path.join(getProjectRoot(app), "logo");
}

function getCustomDir(app) {
  return path.join(getWritableLogoRoot(app), "images");
}

function getDefaultDir(app) {
  return path.join(getWritableLogoRoot(app), "default");
}

function getBundledDefaultDir() {
  return path.join(process.resourcesPath, "logo", "default");
}

async function pathExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDirContents(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  let entries;
  try {
    entries = await fsp.readdir(src, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      await copyDirContents(from, to);
    } else {
      try {
        await fsp.copyFile(from, to);
      } catch {
        /* skip locked files */
      }
    }
  }
}

async function ensureLogoFolders(app) {
  const customDir = getCustomDir(app);
  const defaultDir = getDefaultDir(app);
  await fsp.mkdir(customDir, { recursive: true });
  await fsp.mkdir(defaultDir, { recursive: true });

  const hintSrc = path.join(getProjectRoot(app), "logo", "images", "PLACE_YOUR_LOGO_HERE.txt");
  const hintDest = path.join(customDir, "PLACE_YOUR_LOGO_HERE.txt");
  if (!(await pathExists(hintDest))) {
    if (await pathExists(hintSrc)) {
      await fsp.copyFile(hintSrc, hintDest).catch(() => {});
    } else {
      await fsp.writeFile(
        hintDest,
        "Drop your logo here as logo.png (or logo.jpg / logo.webp / logo.svg).\nRestart the app after replacing the file.\n",
        "utf8"
      );
    }
  }

  const defaultLogo = path.join(defaultDir, "logo.svg");
  if (!(await pathExists(defaultLogo))) {
    const bundled = [
      path.join(getBundledDefaultDir(), "logo.svg"),
      path.join(getProjectRoot(app), "logo", "default", "logo.svg")
    ];
    for (const src of bundled) {
      if (await pathExists(src)) {
        await fsp.copyFile(src, defaultLogo);
        break;
      }
    }
  }

  if (app.isPackaged) {
    const bundledDefault = getBundledDefaultDir();
    if (await pathExists(bundledDefault)) {
      await copyDirContents(bundledDefault, defaultDir);
    }
  }

  return { customDir, defaultDir };
}

async function findCustomLogo(customDir) {
  for (const name of PREFERRED_NAMES) {
    const candidate = path.join(customDir, name);
    if (await pathExists(candidate)) return candidate;
  }

  let entries;
  try {
    entries = await fsp.readdir(customDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const images = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (ent.name.startsWith(".") || ent.name.endsWith(".txt")) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    const full = path.join(customDir, ent.name);
    const stat = await fsp.stat(full);
    images.push({ full, mtime: stat.mtimeMs });
  }
  if (images.length === 0) return null;
  images.sort((a, b) => b.mtime - a.mtime);
  return images[0].full;
}

async function resolveLogo(app) {
  const { customDir, defaultDir } = await ensureLogoFolders(app);
  const customPath = await findCustomLogo(customDir);
  const fallback = path.join(defaultDir, "logo.svg");
  let logoPath = customPath || fallback;

  if (!(await pathExists(logoPath))) {
    const devFallback = path.join(getProjectRoot(app), "logo", "default", "logo.svg");
    logoPath = (await pathExists(devFallback)) ? devFallback : fallback;
  }

  if (!(await pathExists(logoPath))) {
    return {
      path: "",
      url: "",
      isCustom: false,
      fileName: "",
      customDir,
      defaultDir
    };
  }

  return {
    path: logoPath,
    url: pathToFileURL(logoPath).href,
    isCustom: Boolean(customPath),
    fileName: path.basename(logoPath),
    customDir,
    defaultDir
  };
}

function getWindowIcon(logoPath) {
  if (!logoPath) return undefined;
  try {
    const img = nativeImage.createFromPath(logoPath);
    if (img.isEmpty()) return undefined;
    return img;
  } catch {
    return undefined;
  }
}

function applyWindowIcons(logoPath) {
  const icon = getWindowIcon(logoPath);
  if (!icon) return;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.setIcon(icon);
  }
}

function broadcastLogoChanged() {
  const payload = cachedLogo
    ? { url: cachedLogo.url, isCustom: cachedLogo.isCustom, fileName: cachedLogo.fileName }
    : { url: "", isCustom: false, fileName: "" };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("branding:logo-changed", payload);
    }
  }
}

async function refreshLogo(app) {
  cachedLogo = await resolveLogo(app);
  applyWindowIcons(cachedLogo.path);
  broadcastLogoChanged();
  return cachedLogo;
}

function getCachedLogo() {
  return cachedLogo;
}

function getCachedWindowIcon() {
  return cachedLogo?.path ? getWindowIcon(cachedLogo.path) : undefined;
}

function startLogoWatcher(app) {
  const customDir = getCustomDir(app);
  if (folderWatcher) {
    folderWatcher.close();
    folderWatcher = null;
  }
  if (!fs.existsSync(customDir)) return;

  folderWatcher = fs.watch(customDir, { persistent: false }, () => {
    if (watchDebounce) clearTimeout(watchDebounce);
    watchDebounce = setTimeout(() => {
      void refreshLogo(app);
    }, 400);
  });
}

let ipcRegistered = false;

function registerBrandingIpc(app) {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle("branding:getLogo", async () => {
    if (!cachedLogo) await refreshLogo(app);
    return {
      ok: true,
      url: cachedLogo?.url ?? "",
      isCustom: cachedLogo?.isCustom ?? false,
      fileName: cachedLogo?.fileName ?? "",
      customDir: cachedLogo?.customDir ?? getCustomDir(app),
      defaultDir: cachedLogo?.defaultDir ?? getDefaultDir(app)
    };
  });

  ipcMain.handle("branding:getFolders", () => ({
    ok: true,
    customDir: getCustomDir(app),
    imagesFolder: getCustomDir(app),
    defaultDir: getDefaultDir(app)
  }));
}

async function initBranding(app) {
  await ensureLogoFolders(app);
  await refreshLogo(app);
  startLogoWatcher(app);
  registerBrandingIpc(app);
  return cachedLogo;
}

function stopBrandingWatcher() {
  if (watchDebounce) clearTimeout(watchDebounce);
  if (folderWatcher) {
    folderWatcher.close();
    folderWatcher = null;
  }
}

/** Resolve logo image for electron-builder (project root, not userData). */
async function resolveBuildLogoSource() {
  const root = path.join(__dirname, "..");
  const customDir = path.join(root, "logo", "images");
  const defaultDir = path.join(root, "logo", "default");

  for (const name of PREFERRED_NAMES) {
    const candidate = path.join(customDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }

  let entries = [];
  try {
    entries = await fsp.readdir(customDir, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const images = [];
  for (const ent of entries) {
    if (!ent.isFile() || ent.name.endsWith(".txt")) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    const full = path.join(customDir, ent.name);
    const stat = await fsp.stat(full);
    images.push({ full, mtime: stat.mtimeMs });
  }
  if (images.length > 0) {
    images.sort((a, b) => b.mtime - a.mtime);
    return images[0].full;
  }

  for (const name of ["logo.png", "logo.svg"]) {
    const candidate = path.join(defaultDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(defaultDir, "logo.svg");
}

module.exports = {
  initBranding,
  refreshLogo,
  getCachedLogo,
  getCachedWindowIcon,
  getCustomDir,
  getDefaultDir,
  ensureLogoFolders,
  resolveBuildLogoSource,
  stopBrandingWatcher,
  registerBrandingIpc
};
