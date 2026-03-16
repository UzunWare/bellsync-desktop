const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const Store = require("electron-store");
const AutoLaunch = require("auto-launch");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log/main");

// ─── Logging ────────────────────────────────────────────────────────────────
log.initialize();
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB rotation
log.errorHandler.startCatching({ showDialog: false });

// ─── Crash Recovery: Main Process ────────────────────────────────────────────
process.on("uncaughtException", (error) => {
  log.error("FATAL uncaught exception:", error);
  app.relaunch({ args: process.argv.slice(1).concat(["--relaunch"]) });
  app.exit(1);
});

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled promise rejection:", reason);
});

// ─── Persistent Storage ──────────────────────────────────────────────────────
const store = new Store({
  defaults: {
    windowBounds: { width: 1100, height: 750 },
    profiles: null,
    activeProfileId: "regular",
    selectedSound: "classic",
    volume: 80,
    ringDuration: 3,
    silentMode: false,
    language: "en",
    autoLaunch: true,
    minimizeToTray: true,
    skipDates: [],
    customSounds: [],
  },
});

// ─── Backup Validation ──────────────────────────────────────────────────────
const BACKUP_VERSION = 1;

function validateBackup(data) {
  if (!data || typeof data !== "object") return { valid: false, error: "Invalid file format" };
  if (!data.meta || !data.settings) return { valid: false, error: "Missing meta or settings" };
  if (typeof data.meta.version !== "number") return { valid: false, error: "Missing backup version" };
  if (data.meta.version > BACKUP_VERSION) return { valid: false, error: "Backup from newer app version" };
  const s = data.settings;
  if (s.profiles !== undefined && !Array.isArray(s.profiles)) return { valid: false, error: "Invalid profiles" };
  if (s.customSounds !== undefined && !Array.isArray(s.customSounds)) return { valid: false, error: "Invalid custom sounds" };
  if (s.skipDates !== undefined && !Array.isArray(s.skipDates)) return { valid: false, error: "Invalid skip dates" };
  return { valid: true };
}

// ─── Auto Launch ─────────────────────────────────────────────────────────────
const bellSyncAutoLauncher = new AutoLaunch({
  name: "BellSync",
  isHidden: true,
});

async function syncAutoLaunch() {
  try {
    const shouldAutoLaunch = store.get("autoLaunch", true);
    const isEnabled = await bellSyncAutoLauncher.isEnabled();
    if (shouldAutoLaunch && !isEnabled) {
      await bellSyncAutoLauncher.enable();
    } else if (!shouldAutoLaunch && isEnabled) {
      await bellSyncAutoLauncher.disable();
    }
  } catch (err) {
    log.error("Auto-launch sync failed:", err);
  }
}

// ─── App Variables ───────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;

// ─── Create Window ───────────────────────────────────────────────────────────
function createWindow() {
  const { width, height } = store.get("windowBounds");

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    title: "BellSync",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // CRITICAL: Prevent background throttling so bells ring on time
      backgroundThrottling: false,
    },
    show: false,
  });

  // Load the React app
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "build", "index.html"));
  }

  // Show when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Save window size on resize
  mainWindow.on("resize", () => {
    const bounds = mainWindow.getBounds();
    store.set("windowBounds", { width: bounds.width, height: bounds.height });
  });

  // Minimize to tray instead of closing
  mainWindow.on("close", (event) => {
    if (!isQuitting && store.get("minimizeToTray")) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // ─── Crash Recovery: Renderer Process ──────────────────────────────────
  mainWindow.webContents.on("render-process-gone", (event, details) => {
    log.error("Renderer process gone:", details.reason, "exitCode:", details.exitCode);
    if (details.reason !== "clean-exit") {
      setImmediate(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          log.info("Reloading renderer after crash...");
          mainWindow.reload();
        } else {
          log.info("Recreating window after renderer crash...");
          createWindow();
        }
      });
    }
  });

  mainWindow.webContents.on("unresponsive", () => {
    log.warn("Renderer became unresponsive, waiting 5s before recovery...");
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        log.info("Renderer still unresponsive, reloading...");
        mainWindow.reload();
      }
    }, 5000);
  });

  mainWindow.webContents.on("responsive", () => {
    log.info("Renderer became responsive again");
  });
}

// ─── System Tray ─────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, "build", "icon.png");

  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("BellSync — Academy Bell Manager");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open BellSync",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Silent Mode",
      type: "checkbox",
      checked: store.get("silentMode", false),
      click: (menuItem) => {
        store.set("silentMode", menuItem.checked);
        if (mainWindow) {
          mainWindow.webContents.send("silent-mode-changed", menuItem.checked);
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit BellSync",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── IPC Handlers (React ↔ Electron communication) ──────────────────────────
function setupIPC() {
  // Save/load settings
  ipcMain.handle("store-get", (_, key) => store.get(key));
  ipcMain.handle("store-set", (_, key, value) => {
    try {
      store.set(key, value);
      if (key === "autoLaunch") syncAutoLaunch();
    } catch (err) {
      log.error("Failed to save setting:", key, err);
    }
  });
  ipcMain.handle("store-get-all", () => store.store);

  // Silent mode sync from React → tray
  ipcMain.on("silent-mode-update", (_, silent) => {
    store.set("silentMode", silent);
    if (tray) {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: "Open BellSync",
          click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } },
        },
        { type: "separator" },
        {
          label: "Silent Mode",
          type: "checkbox",
          checked: silent,
          click: (menuItem) => {
            store.set("silentMode", menuItem.checked);
            if (mainWindow) mainWindow.webContents.send("silent-mode-changed", menuItem.checked);
          },
        },
        { type: "separator" },
        {
          label: "Quit BellSync",
          click: () => { isQuitting = true; app.quit(); },
        },
      ]);
      tray.setContextMenu(contextMenu);
    }
  });

  // Ring notification
  ipcMain.on("bell-ringing", () => {
    if (mainWindow && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true);
      setTimeout(() => mainWindow.flashFrame(false), 3000);
    }
  });

  // ─── App Version ────────────────────────────────────────────────────────
  ipcMain.handle("get-app-version", () => app.getVersion());

  // ─── Updates ───────────────────────────────────────────────────────────
  ipcMain.handle("check-for-updates", async () => {
    if (!app.isPackaged) return { success: false, error: "Updates disabled in dev mode" };
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("install-update", () => {
    log.info("User triggered update install");
    isQuitting = true;
    autoUpdater.quitAndInstall(true, true);
  });

  // ─── Log Folder ─────────────────────────────────────────────────────────
  ipcMain.handle("open-log-folder", () => {
    const logPath = log.transports.file.getFile().path;
    shell.openPath(path.dirname(logPath));
  });

  // ─── Export Settings ────────────────────────────────────────────────────
  ipcMain.handle("export-settings", async () => {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: "Export BellSync Settings",
      defaultPath: path.join(app.getPath("documents"), `bellsync-backup-${new Date().toISOString().slice(0, 10)}.bellsync`),
      filters: [{ name: "BellSync Backup", extensions: ["bellsync"] }],
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    try {
      const allSettings = { ...store.store };
      delete allSettings.windowBounds;
      const backup = {
        meta: { version: BACKUP_VERSION, appVersion: app.getVersion(), exportDate: new Date().toISOString() },
        settings: allSettings,
      };
      await fs.promises.writeFile(filePath, JSON.stringify(backup, null, 2), "utf-8");
      log.info("Settings exported to:", filePath);
      return { success: true, filePath };
    } catch (err) {
      log.error("Export failed:", err);
      return { success: false, error: err.message };
    }
  });

  // ─── Import Settings (read + validate, don't apply yet) ────────────────
  ipcMain.handle("import-settings", async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: "Import BellSync Settings",
      filters: [{ name: "BellSync Backup", extensions: ["bellsync"] }],
      properties: ["openFile"],
    });
    if (canceled || filePaths.length === 0) return { success: false, canceled: true };
    try {
      const raw = await fs.promises.readFile(filePaths[0], "utf-8");
      let data;
      try { data = JSON.parse(raw); } catch { return { success: false, error: "File is not valid JSON" }; }
      const v = validateBackup(data);
      if (!v.valid) return { success: false, error: v.error };
      log.info("Settings file validated:", filePaths[0]);
      return {
        success: true,
        data: data.settings,
        meta: data.meta,
        profileCount: (data.settings.profiles || []).length,
        customSoundCount: (data.settings.customSounds || []).length,
      };
    } catch (err) {
      log.error("Import read failed:", err);
      return { success: false, error: err.message };
    }
  });

  // ─── Apply Imported Settings (after user confirms) ──────────────────────
  ipcMain.handle("apply-imported-settings", async (_, settings) => {
    try {
      // Auto-backup current settings before overwriting
      const backupDir = path.join(app.getPath("userData"), "backups");
      await fs.promises.mkdir(backupDir, { recursive: true });
      const autoBackup = {
        meta: { version: BACKUP_VERSION, appVersion: app.getVersion(), exportDate: new Date().toISOString(), type: "pre-import" },
        settings: { ...store.store },
      };
      await fs.promises.writeFile(
        path.join(backupDir, `pre-import-${Date.now()}.bellsync`),
        JSON.stringify(autoBackup, null, 2), "utf-8"
      );
      log.info("Pre-import backup created");

      // Apply imported settings (preserve machine-specific)
      const windowBounds = store.get("windowBounds");
      for (const [key, value] of Object.entries(settings)) {
        if (key !== "windowBounds") store.set(key, value);
      }
      store.set("windowBounds", windowBounds);
      if (settings.autoLaunch !== undefined) syncAutoLaunch();
      log.info("Imported settings applied successfully");
      return { success: true };
    } catch (err) {
      log.error("Apply imported settings failed:", err);
      return { success: false, error: err.message };
    }
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
const isRelaunch = process.argv.includes("--relaunch");
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock && !isRelaunch) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    log.info("BellSync started", { version: app.getVersion(), electron: process.versions.electron });

    createWindow();
    createTray();
    setupIPC();
    await syncAutoLaunch();

    // ─── Auto-Update ──────────────────────────────────────────────────────
    if (app.isPackaged) {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      const sendUpdateStatus = (status, extra = {}) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("update-status", { status, ...extra });
        }
      };

      autoUpdater.on("checking-for-update", () => {
        log.info("Checking for updates...");
        sendUpdateStatus("checking");
      });
      autoUpdater.on("update-available", (info) => {
        log.info("Update available:", info.version);
        sendUpdateStatus("available", { version: info.version });
      });
      autoUpdater.on("update-not-available", () => {
        log.info("No updates available");
        sendUpdateStatus("up-to-date");
      });
      autoUpdater.on("update-downloaded", (info) => {
        log.info("Update downloaded:", info.version);
        sendUpdateStatus("ready", { version: info.version });
      });
      autoUpdater.on("error", (err) => {
        log.error("Auto-update error:", err);
        sendUpdateStatus("error", { error: err.message });
      });

      autoUpdater.checkForUpdates().catch(() => {});
      setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
    }

    // Keep the app alive even when all windows are closed (tray mode)
    app.on("window-all-closed", (e) => {
      if (!isQuitting) e.preventDefault();
    });
  });

  app.on("before-quit", () => {
    log.info("BellSync shutting down");
    isQuitting = true;
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
}
