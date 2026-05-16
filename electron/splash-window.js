"use strict";

const path = require("node:path");
const { BrowserWindow } = require("electron");

/** @type {import('electron').BrowserWindow | null} */
let splashWindow = null;

function createSplashWindow(logoUrl, windowIcon) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }

  splashWindow = new BrowserWindow({
    width: 360,
    height: 320,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    backgroundColor: "#0a0a0a",
    icon: windowIcon,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const loadOpts = logoUrl ? { search: `src=${encodeURIComponent(logoUrl)}` } : undefined;
  void splashWindow.loadFile(path.join(__dirname, "splash.html"), loadOpts);
  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
  });

  return splashWindow;
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  splashWindow = null;
}

module.exports = { createSplashWindow, closeSplashWindow };
