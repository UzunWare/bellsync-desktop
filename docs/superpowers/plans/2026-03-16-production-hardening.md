# BellSync Production Hardening Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BellSync production-ready with crash recovery, logging, settings backup, and SmartScreen guidance.

**Architecture:** Four independent features implemented in dependency order: logging first (needed by crash recovery), then crash recovery, then backup/export, then SmartScreen docs. Each feature touches main.js (Electron), preload.js (IPC bridge), and src/App.js (React UI).

**Tech Stack:** electron-log (logging), Electron built-in APIs (dialog, shell, crash events), Node.js fs/path (backup files)

---

## Implementation Order Rationale

1. **Logging** — First because crash recovery and all other features need to log events
2. **Crash Recovery** — Second because it depends on logging for diagnostics
3. **Settings Backup/Export/Import** — Independent, but benefits from logging
4. **SmartScreen Guide** — Documentation only, no code dependencies

---

## File Map

| File | Changes |
|------|---------|
| `main.js` | Add electron-log, crash handlers, backup IPC handlers, log folder IPC |
| `preload.js` | Add exportSettings, importSettings, applyImportedSettings, openLogFolder |
| `src/App.js` | Add backup UI in Settings tab, log folder button, i18n strings, import confirmation modal |
| `package.json` | Add electron-log dependency |

---

## Task 1: Logging System (electron-log)

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `main.js` (add logging throughout)
- Modify: `preload.js` (expose openLogFolder)
- Modify: `src/App.js` (add log calls in renderer, add "Open Log Folder" button)

### Step 1.1: Install electron-log

- [ ] Run: `npm install electron-log`

### Step 1.2: Initialize logging in main.js

- [ ] Add at the very top of `main.js`, after requires:

```javascript
const log = require('electron-log/main');
log.initialize();
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB
log.errorHandler.startCatching({ showDialog: false });
```

### Step 1.3: Add log statements to main.js lifecycle

- [ ] Log app startup inside `app.whenReady()`:

```javascript
log.info('BellSync started', { version: app.getVersion(), electron: process.versions.electron });
```

- [ ] Log auto-update events (replace console.error and add info logs):

```javascript
autoUpdater.on("checking-for-update", () => log.info("Checking for updates..."));
autoUpdater.on("update-available", (info) => log.info("Update available:", info.version));
autoUpdater.on("update-not-available", () => log.info("No updates available"));
autoUpdater.on("update-downloaded", () => { log.info("Update downloaded, will install on restart"); ... });
autoUpdater.on("error", (err) => log.error("Auto-update error:", err));
```

- [ ] Log IPC store operations (just errors, not every save):

```javascript
// In store-set handler, wrap with try/catch:
ipcMain.handle("store-set", (_, key, value) => {
  try {
    store.set(key, value);
    if (key === "autoLaunch") syncAutoLaunch();
  } catch (err) {
    log.error("Failed to save setting:", key, err);
  }
});
```

- [ ] Log app quit:

```javascript
app.on("before-quit", () => {
  log.info("BellSync shutting down");
  isQuitting = true;
});
```

### Step 1.4: Add openLogFolder IPC handler in main.js

- [ ] Add inside `setupIPC()`:

```javascript
const { shell } = require("electron"); // add to top imports

ipcMain.handle("open-log-folder", () => {
  const logPath = log.transports.file.getFile().path;
  shell.openPath(path.dirname(logPath));
});
```

### Step 1.5: Expose openLogFolder in preload.js

- [ ] Add to the electronAPI object:

```javascript
openLogFolder: () => ipcRenderer.invoke("open-log-folder"),
```

### Step 1.6: Add renderer-side logging in App.js

- [ ] Add import at top of App.js (after React import):

```javascript
const log = window.electronAPI ? require('electron-log/renderer') : { info: console.log, warn: console.warn, error: console.error, scope: () => ({ info: console.log, warn: console.warn, error: console.error }) };
```

NOTE: Since App.js runs through CRA bundler, we need a fallback for browser mode. Use a conditional wrapper.

- [ ] Add log calls in the `ring` function:

```javascript
log.info('Bell ring', { soundId, volume, time: new Date().toLocaleTimeString() });
```

- [ ] Add log call when bell is skipped (silent mode, skip date, no schedule):

```javascript
// In the auto-ring useEffect, when conditions prevent ring:
// Already handled by not calling ring(), but we should log skips
```

### Step 1.7: Add "Open Log Folder" button in Admin Settings tab

- [ ] Add i18n strings to LL:

```javascript
// In LL.en:
openLogs: "Open Log Folder",
openLogsDesc: "View application logs for troubleshooting",

// In LL.tr:
openLogs: "Kayit Klasorunu Ac",
openLogsDesc: "Sorun giderme icin uygulama kayitlarini goruntule",
```

- [ ] Add button in Settings tab (after the existing settings sections):

```jsx
{electron && (
  <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>{t.openLogs}</div>
    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{t.openLogsDesc}</div>
    <button onClick={() => electron.openLogFolder()} style={btn("rgba(148,163,184,0.06)", "#1e293b", "#94a3b8", { padding: "8px 18px", fontSize: 13 })}>
      {t.openLogs}
    </button>
  </div>
)}
```

### Step 1.8: Test logging

- [ ] Run `npm run dev`, verify log file is created at `%APPDATA%/bellsync/logs/main.log`
- [ ] Click "Open Log Folder" button in Settings, verify it opens Explorer to the correct folder
- [ ] Ring a bell, verify the event appears in the log file
- [ ] Verify startup and shutdown messages in log

### Step 1.9: Commit

```bash
git add package.json package-lock.json main.js preload.js src/App.js
git commit -m "feat: add electron-log logging system with file rotation and log folder access"
```

---

## Task 2: Crash Recovery

**Files:**
- Modify: `main.js` (add crash handlers, renderer recovery, unresponsive handler)

### Step 2.1: Add uncaughtException handler at top of main.js

- [ ] Add immediately after `log.errorHandler.startCatching()`:

```javascript
process.on('uncaughtException', (error) => {
  log.error('FATAL uncaught exception in main process:', error);
  app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection in main process:', reason);
});
```

### Step 2.2: Add renderer crash recovery in createWindow()

- [ ] Add after the `mainWindow.on("closed")` handler:

```javascript
mainWindow.webContents.on('render-process-gone', (event, details) => {
  log.error('Renderer process gone:', details.reason, 'exitCode:', details.exitCode);
  if (details.reason !== 'clean-exit') {
    setImmediate(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        log.info('Reloading renderer after crash...');
        mainWindow.reload();
      } else {
        log.info('Recreating window after renderer crash...');
        createWindow();
      }
    });
  }
});

mainWindow.webContents.on('unresponsive', () => {
  log.warn('Renderer became unresponsive, waiting 5s before recovery...');
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      log.info('Renderer still unresponsive, reloading...');
      mainWindow.reload();
    }
  }, 5000);
});

mainWindow.webContents.on('responsive', () => {
  log.info('Renderer became responsive again');
});
```

### Step 2.3: Handle relaunch flag with single-instance lock

- [ ] Modify the single-instance lock section:

```javascript
const isRelaunch = process.argv.includes('--relaunch');
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock && !isRelaunch) {
  app.quit();
} else {
  // ... existing code
}
```

### Step 2.4: Test crash recovery

- [ ] Run `npm run dev`
- [ ] Open DevTools, run `process.crash()` in console to simulate renderer crash
- [ ] Verify the app reloads automatically and logs the crash event
- [ ] Check the log file for "Renderer process gone" and "Reloading renderer" messages
- [ ] Verify all settings/schedules are intact after recovery (loaded from electron-store)

### Step 2.5: Commit

```bash
git add main.js
git commit -m "feat: add crash recovery with renderer auto-reload and main process relaunch"
```

---

## Task 3: Settings Backup / Export / Import

**Files:**
- Modify: `main.js` (add dialog import, fs import, backup IPC handlers, validation)
- Modify: `preload.js` (expose export/import/apply methods)
- Modify: `src/App.js` (add backup UI in Settings, import confirmation, i18n strings)

### Step 3.1: Add backup IPC handlers in main.js

- [ ] Add imports at top of main.js:

```javascript
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
```

- [ ] Add backup version constant after store initialization:

```javascript
const BACKUP_VERSION = 1;
```

- [ ] Add validation function after the store setup:

```javascript
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
```

- [ ] Add three IPC handlers inside `setupIPC()`:

```javascript
// ─── Export settings ──────────────────────────────────────────────────
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

// ─── Import settings (read + validate, don't apply yet) ──────────────
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

// ─── Apply imported settings (after user confirms) ────────────────────
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
```

### Step 3.2: Expose backup methods in preload.js

- [ ] Add to the electronAPI object:

```javascript
exportSettings: () => ipcRenderer.invoke("export-settings"),
importSettings: () => ipcRenderer.invoke("import-settings"),
applyImportedSettings: (settings) => ipcRenderer.invoke("apply-imported-settings", settings),
```

### Step 3.3: Add i18n strings for backup UI

- [ ] Add to LL.en:

```javascript
backupRestore: "Backup & Restore",
backupDesc: "Export your schedules, sounds, and settings to a file",
exportSettings: "Export Settings",
importSettings: "Import Settings",
exportSuccess: "Settings exported successfully!",
importConfirm: "This will replace all your current settings. Continue?",
importProfiles: "profiles",
importSounds: "custom sounds",
importSuccess: "Settings imported! The app will reload.",
importError: "Import failed",
```

- [ ] Add to LL.tr:

```javascript
backupRestore: "Yedekleme ve Geri Yukleme",
backupDesc: "Programlarinizi, seslerinizi ve ayarlarinizi bir dosyaya aktarin",
exportSettings: "Ayarlari Disari Aktar",
importSettings: "Ayarlari Iceri Aktar",
exportSuccess: "Ayarlar basariyla disari aktarildi!",
importConfirm: "Bu, mevcut tum ayarlarinizi degistirecektir. Devam edilsin mi?",
importProfiles: "program",
importSounds: "ozel ses",
importSuccess: "Ayarlar iceri aktarildi! Uygulama yeniden yuklenecek.",
importError: "Iceri aktarma basarisiz",
```

### Step 3.4: Add backup UI in Settings tab

- [ ] Add a new section in the Settings tab (after existing settings, before the log folder button):

```jsx
{electron && (
  <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>{t.backupRestore}</div>
    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{t.backupDesc}</div>
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={async () => {
        const r = await electron.exportSettings();
        if (r.success) alert(t.exportSuccess);
        else if (!r.canceled) alert(r.error);
      }} style={btn("rgba(251,191,36,0.08)", "rgba(251,191,36,0.2)", "#fbbf24", { padding: "8px 18px", fontSize: 13 })}>
        {t.exportSettings}
      </button>
      <button onClick={async () => {
        const r = await electron.importSettings();
        if (!r.success) { if (!r.canceled) alert(`${t.importError}: ${r.error}`); return; }
        const msg = `${t.importConfirm}\n\n${r.profileCount} ${t.importProfiles}, ${r.customSoundCount} ${t.importSounds}`;
        if (!window.confirm(msg)) return;
        const apply = await electron.applyImportedSettings(r.data);
        if (apply.success) { alert(t.importSuccess); window.location.reload(); }
        else alert(`${t.importError}: ${apply.error}`);
      }} style={btn("rgba(148,163,184,0.06)", "#1e293b", "#94a3b8", { padding: "8px 18px", fontSize: 13 })}>
        {t.importSettings}
      </button>
    </div>
  </div>
)}
```

### Step 3.5: Test backup/export/import

- [ ] Run `npm run dev`
- [ ] Go to Admin > Settings, click "Export Settings"
- [ ] Verify a `.bellsync` file is saved to Documents with correct JSON structure
- [ ] Open the exported file in a text editor, verify it contains profiles, sounds, settings, and meta
- [ ] Modify a schedule (add a test bell), then import the previously exported file
- [ ] Verify the confirmation dialog shows correct profile/sound counts
- [ ] Confirm import, verify app reloads with the imported settings (test bell is gone)
- [ ] Check `%APPDATA%/bellsync/backups/` for the pre-import auto-backup file
- [ ] Test importing a corrupted/invalid file — should show error message
- [ ] Check log file for export/import events

### Step 3.6: Commit

```bash
git add main.js preload.js src/App.js
git commit -m "feat: add settings backup/export/import with validation and auto-backup"
```

---

## Task 4: SmartScreen Installation Guide

**Files:**
- Create: `docs/INSTALLATION.md`

### Step 4.1: Create installation guide

- [ ] Create `docs/INSTALLATION.md` with clear bypass instructions for school IT admins:
  - What the SmartScreen warning looks like (with description)
  - Step-by-step to click "More info" → "Run anyway"
  - Explanation that this appears because the app is not commercially signed
  - Note that it only appears on first install, not on updates
  - Optional: How IT admin can whitelist via Group Policy or Defender exclusion

### Step 4.2: Add version display in Settings tab

- [ ] Add app version display in Settings tab so users/IT admins can report their version:

```javascript
// i18n:
// en: appVersion: "App Version",
// tr: appVersion: "Uygulama Surumu",
```

```jsx
<div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>{t.appVersion}</div>
  <div style={{ fontFamily: "'DM Mono'", fontSize: 13, color: "#fbbf24" }}>v1.0.0</div>
</div>
```

### Step 4.3: Commit

```bash
git add docs/INSTALLATION.md src/App.js
git commit -m "docs: add SmartScreen installation guide and version display"
```

---

## Task 5: Final Integration Test & Build

### Step 5.1: Full test pass

- [ ] Run `npm run dev`
- [ ] **Logging:** Verify startup log, ring a bell → check log file, open log folder button works
- [ ] **Crash recovery:** Open DevTools → Console → `process.crash()` → verify auto-reload
- [ ] **Backup:** Export → modify schedule → Import → verify rollback + auto-backup created
- [ ] **Settings persistence:** Close and reopen app → all settings intact
- [ ] **AM/PM visibility:** Check time inputs are wide with highlighted AM/PM
- [ ] **Bell sounds:** Preview all 10 sounds (4 synthesized + 6 MP3)

### Step 5.2: Production build

- [ ] Run `npm run dist`
- [ ] Verify installer is created in `dist/`
- [ ] Install the app from the installer
- [ ] Run through the same test checklist in production mode

### Step 5.3: Commit and push

```bash
git add -A
git commit -m "build: production build with logging, crash recovery, and backup features"
git push origin master
```
