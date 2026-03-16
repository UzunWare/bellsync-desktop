# BellSync — Academy Bell Management System

## What This Is
Desktop bell management app for schools/academies. Electron wraps a React frontend. Runs 24/7 on Windows, sits in system tray, auto-rings bells on schedule.

Bilingual: English + Turkish. Two UI modes: Display (daily use, read-only) and Admin (setup/config).

## Project Structure
```
main.js          — Electron main process: window, tray, auto-launch, IPC handlers
preload.js       — Secure bridge: exposes electronAPI to renderer (store, tray sync)
src/App.js       — ALL UI + logic lives here (single-file React app)
src/index.js     — React entry point (do not modify)
public/index.html — HTML shell (do not modify)
package.json     — Dependencies, scripts, electron-builder config
build/icon.png   — App icon (256x256 PNG, used for taskbar/tray/installer)
```

IMPORTANT: `src/App.js` is the main file. Almost every feature change happens here. It contains: i18n strings, default profiles, audio synthesis, display mode UI, admin mode UI, Electron storage integration, and all state management.

## Commands
```bash
npm install          # Install dependencies (run once)
npm run dev          # Development mode (React dev server + Electron)
npm run dist         # Build Windows .exe installer → output in dist/
npm run react-build  # Build React only (used internally by dist)
npm run start        # Run Electron directly (requires prior react-build)
```

## Tech Stack
- **Frontend**: React 18 (CRA), inline styles (no CSS framework), DM Sans + DM Mono fonts
- **Desktop**: Electron 28, electron-builder (NSIS installer for Windows)
- **Storage**: electron-store (JSON file, persists settings across restarts)
- **Audio**: Web Audio API for built-in sounds, HTML5 Audio for custom uploads
- **Auto-launch**: auto-launch package (Windows startup)
- **No backend/server** — everything is local

## Architecture Decisions

### Two-Mode UI Pattern
- Display Mode: Clock, countdown, ring button, timeline. No editing possible. This is what's on screen 99% of the time.
- Admin Mode: Schedules tab, Sounds tab, Settings tab. Accessed via gear icon. All editing happens here.
- IMPORTANT: Never mix editing controls into Display Mode. The separation prevents accidental changes.

### Electron ↔ React Communication
- `preload.js` exposes `window.electronAPI` with methods: `saveSetting`, `loadSetting`, `loadAllSettings`, `updateSilentMode`, `notifyBellRinging`, `onSilentModeChanged`
- React checks `window.electronAPI` existence before calling — app must also work in browser (for prototyping)
- IPC is one-way for most things (React → Main via invoke), bidirectional for silent mode (tray ↔ React)

### Audio: backgroundThrottling
- `backgroundThrottling: false` in BrowserWindow config is CRITICAL — without it, Chromium throttles timers when minimized and bells won't ring on time
- Do not remove this setting

### i18n Pattern
- All strings in `LL` object at top of App.js, keyed by language code (`en`, `tr`)
- Bell labels use `labelKey` (references LL key) or `customLabel` (user-edited, object with `{en, tr}`)
- Profile names use `nameKey` (references LL key) or `customName` (user-edited, object with `{en, tr}`)
- When adding a new language: add a new key to `LL`, update all `lang === "en" ? ... : ...` ternaries

### Storage Auto-Save
- Each piece of state has a `useEffect` that calls `save(key, value)` when it changes
- The `loaded` flag prevents overwriting saved data with defaults on mount
- Always check `if (loaded)` before saving

## Code Style
- Functional components with hooks only (no class components)
- Inline styles — no CSS files, no Tailwind, no styled-components
- All styles use the existing dark theme: `#0b1120` background, `#fbbf24` amber accent, `#1a2333` borders
- Icons are inline SVG components defined at top of App.js — add new icons there
- Use `DM Sans` for UI text, `DM Mono` for times/numbers
- Keep all UI code in `src/App.js` — do not split into multiple component files unless explicitly asked

## Common Tasks

### Adding a new bell sound
1. Add entry to `builtInSounds` array with `{ id, nameEn, nameTr }`
2. Add synthesis logic as new `else if` branch in `playBuiltinSound()`

### Adding a new default schedule profile
1. Add entry to `defaultProfiles` array following existing pattern
2. Add `nameKey` translation to both `LL.en` and `LL.tr`
3. Add bell `labelKey` translations if using new keys

### Adding a new language
1. Add full translation object to `LL` (copy `en`, translate values)
2. Update language toggle buttons in both Display and Admin mode headers
3. Update `builtInSounds` to include new language name field
4. Search for `lang === "en"` ternaries and extend to handle new language

### Adding a new setting
1. Add state variable with `useState` in App component
2. Add default value in `store` defaults in `main.js`
3. Add `useEffect` auto-save in App.js (with `loaded` guard)
4. Add load logic in the `loadAllSettings` effect
5. Add UI control in Admin → Settings tab

## Gotchas
- Bell auto-ring checks `now.getSeconds() === 0` — it only triggers at the exact :00 second of the matching minute. The 1-second `setInterval` ensures this is caught.
- `lastRung` state prevents double-ringing within the same minute
- Custom sounds are stored as base64 data URLs in state — they persist via electron-store but large files increase JSON size. Consider file-path storage for production scale.
- Single instance lock in `main.js` prevents multiple app instances — if the app won't start, check for zombie processes.


<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>