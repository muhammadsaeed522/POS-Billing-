"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { resolveBuildLogoSource } = require("../electron/branding");

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function rasterizeToPng(sourcePath, outPath) {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.warn("[branding] sharp not installed; copy PNG/JPG only for installer icon.");
    if (/\.png$/i.test(sourcePath)) {
      await fsp.copyFile(sourcePath, outPath);
      return outPath;
    }
    throw new Error("Install sharp (npm i -D sharp) or place logo.png in logo/images/");
  }

  await sharp(sourcePath)
    .resize(256, 256, {
      fit: "contain",
      background: { r: 10, g: 10, b: 10, alpha: 0 }
    })
    .png()
    .toFile(outPath);
  return outPath;
}

async function buildIco(pngPath, icoPath) {
  const pngToIco = require("png-to-ico");
  const buf = await fsp.readFile(pngPath);
  const ico = await pngToIco(buf);
  await fsp.writeFile(icoPath, ico);
}

async function main() {
  const root = path.join(__dirname, "..");
  const buildDir = path.join(root, "build");
  const customDir = path.join(root, "logo", "images");
  const defaultDir = path.join(root, "logo", "default");

  await ensureDir(customDir);
  await ensureDir(defaultDir);
  await ensureDir(buildDir);

  const source = await resolveBuildLogoSource();
  const pngPath = path.join(buildDir, "branding-256.png");
  const icoPath = path.join(buildDir, "icon.ico");

  console.log(`[branding] Installer icon source: ${path.relative(root, source)}`);

  await rasterizeToPng(source, pngPath);
  await buildIco(pngPath, icoPath);

  console.log(`[branding] Wrote ${path.relative(root, icoPath)}`);
}

main().catch((err) => {
  console.error("[branding] prepare failed:", err.message || err);
  process.exit(1);
});
