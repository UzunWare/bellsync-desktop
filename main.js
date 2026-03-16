const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store");
const AutoLaunch = require("auto-launch");
const { autoUpdater } = require("electron-updater");

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

// ─── Auto Launch ─────────────────────────────────────────────────────────────
const bellSyncAutoLauncher = new AutoLaunch({
  name: "BellSync",
  isHidden: true,
});

async function syncAutoLaunch() {
  const shouldAutoLaunch = store.get("autoLaunch", true);
  const isEnabled = await bellSyncAutoLauncher.isEnabled();
  if (shouldAutoLaunch && !isEnabled) {
    await bellSyncAutoLauncher.enable();
  } else if (!shouldAutoLaunch && isEnabled) {
    await bellSyncAutoLauncher.disable();
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
    // Clean frameless look (optional — remove these 2 lines if you want standard title bar)
    // frame: false,
    // titleBarStyle: "hidden",
    show: false,
  });

  // Load the React app
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    // mainWindow.webContents.openDevTools(); // Uncomment for debugging
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
}

// ─── System Tray ─────────────────────────────────────────────────────────────
function createTray() {
  // Create a simple 16x16 icon (replace with actual icon in production)
  const iconPath = path.join(__dirname, "build", "icon.png");

  // Fallback: create a simple icon if file doesn't exist
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    // Create a minimal 16x16 icon as fallback
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
    store.set(key, value);
    // Sync auto-launch when that setting changes
    if (key === "autoLaunch") syncAutoLaunch();
  });
  ipcMain.handle("store-get-all", () => store.store);

  // Silent mode sync from React → tray
  ipcMain.on("silent-mode-update", (_, silent) => {
    store.set("silentMode", silent);
    // Update tray context menu without recreating the tray icon
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

  // Ring notification (optional: flash taskbar when bell rings)
  ipcMain.on("bell-ringing", () => {
    if (mainWindow && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true);
      setTimeout(() => mainWindow.flashFrame(false), 3000);
    }
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
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
    createWindow();
    createTray();
    setupIPC();
    await syncAutoLaunch();

    // ─── Auto-Update (silent, no user prompt) ─────────────────────────────
    if (app.isPackaged) {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on("update-downloaded", () => {
        // Silently install and restart
        isQuitting = true;
        autoUpdater.quitAndInstall(true, true);
      });
      autoUpdater.on("error", (err) => {
        console.error("Auto-update error:", err);
      });
      // Check on launch, then every 4 hours
      autoUpdater.checkForUpdates().catch(() => {});
      setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
    }

    // Keep the app alive even when all windows are closed (tray mode)
    app.on("window-all-closed", (e) => {
      if (!isQuitting) e.preventDefault();
    });
  });

  app.on("before-quit", () => {
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
