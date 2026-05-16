"use strict";

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const releaseDir = path.join(__dirname, "..", "release");

function killLockingProcesses() {
  if (process.platform !== "win32") return;
  const names = ["POS Billing.exe", "electron.exe"];
  for (const name of names) {
    try {
      execSync(`taskkill /F /IM "${name}" /T`, { stdio: "ignore" });
    } catch {
      /* not running */
    }
  }
}

function removeRelease(retries = 5) {
  if (!fs.existsSync(releaseDir)) return true;
  for (let i = 0; i < retries; i++) {
    try {
      fs.rmSync(releaseDir, { recursive: true, force: true });
      return !fs.existsSync(releaseDir);
    } catch {
      /* file locked */
    }
    try {
      execSync("powershell -NoProfile -Command Start-Sleep -Milliseconds 800", { stdio: "ignore" });
    } catch {
      /* ignore */
    }
  }
  return !fs.existsSync(releaseDir);
}

killLockingProcesses();
const ok = removeRelease();
if (!ok) {
  console.warn(
    "[clean-release] Could not delete release/ — close POS Billing, close File Explorer on that folder, then retry.\n" +
      "  Or delete manually: " +
      releaseDir
  );
  process.exit(1);
} else {
  console.log("[clean-release] Removed release/");
}
