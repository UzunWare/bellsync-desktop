const { contextBridge, ipcRenderer } = require("electron");

/**
 * Preload script — exposes a safe API to the React app.
 * The React app accesses these via `window.electronAPI`
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // ─── Persistent Storage ──────────────────────────────────────────────────
  // Save any setting (profiles, active schedule, volume, etc.)
  saveSetting: (key, value) => ipcRenderer.invoke("store-set", key, value),

  // Load a single setting
  loadSetting: (key) => ipcRenderer.invoke("store-get", key),

  // Load all settings at once (for initial app load)
  loadAllSettings: () => ipcRenderer.invoke("store-get-all"),

  // ─── System Integration ──────────────────────────────────────────────────
  // Notify main process when silent mode changes (updates tray menu)
  updateSilentMode: (silent) => ipcRenderer.send("silent-mode-update", silent),

  // Notify main process when a bell rings (flashes taskbar)
  notifyBellRinging: () => ipcRenderer.send("bell-ringing"),

  // Listen for silent mode changes from tray menu
  onSilentModeChanged: (callback) => {
    const handler = (_, silent) => callback(silent);
    ipcRenderer.on("silent-mode-changed", handler);
    return () => ipcRenderer.removeListener("silent-mode-changed", handler);
  },

  // ─── Backup / Restore ────────────────────────────────────────────────────
  exportSettings: () => ipcRenderer.invoke("export-settings"),
  importSettings: () => ipcRenderer.invoke("import-settings"),
  applyImportedSettings: (settings) => ipcRenderer.invoke("apply-imported-settings", settings),

  // ─── Logs ──────────────────────────────────────────────────────────────
  openLogFolder: () => ipcRenderer.invoke("open-log-folder"),

  // ─── Version ──────────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // ─── Updates ──────────────────────────────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  },

  // ─── Platform Info ───────────────────────────────────────────────────────
  isElectron: true,
});
