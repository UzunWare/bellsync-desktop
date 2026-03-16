# BellSync — Academy Bell Management System

A desktop bell management app for schools and academies. Runs on Windows, sits in the system tray, and rings bells automatically on schedule.

## Features

- **Display Mode** — Clean daily view with clock, countdown, and manual ring button
- **Admin Mode** — Full schedule editor, sound manager, and settings
- **Multiple Profiles** — Regular Day, Half Day, Friday (with Jumu'ah break), + custom
- **Custom Sounds** — Upload your own MP3/WAV/OGG bell sounds
- **Silent Mode** — Mute all bells instantly (accessible from system tray)
- **System Tray** — Minimizes to tray, runs in background, auto-starts with Windows
- **Bilingual** — Full English and Turkish UI
- **Persistent Settings** — All schedules and preferences saved locally

---

## Quick Start (Build the .exe Installer)

### Prerequisites

- **Node.js** v18+ — Download from https://nodejs.org
- **Git** (optional) — for version control

### Step-by-step

```bash
# 1. Navigate to the project folder
cd bellsync-desktop

# 2. Install dependencies
npm install

# 3. (Optional) Test in development mode
npm run dev

# 4. Build the Windows installer
npm run dist
```

The installer will be created in the `dist/` folder:
```
dist/
  BellSync Setup 1.0.0.exe    ← Give this to your client
```

### That's it!

Your client double-clicks the installer, it installs BellSync, and it auto-starts with Windows.

---

## Project Structure

```
bellsync-desktop/
├── main.js          # Electron main process (window, tray, auto-launch)
├── preload.js       # Secure bridge between React and Electron
├── package.json     # Dependencies and build configuration
├── public/
│   └── index.html   # HTML entry point
├── src/
│   ├── index.js     # React entry point
│   └── App.js       # Main BellSync React component
└── build/
    └── icon.png     # App icon (add a 256x256 PNG here)
```

---

## Adding an App Icon

Place a `256x256` PNG file at `build/icon.png` before building. This will be used for:
- The Windows taskbar
- The system tray
- The installer
- The desktop shortcut

If you don't have an icon yet, the app will still build and work fine with a default icon.

---

## How It Works

### Display Mode (Daily Use)
- Shows current time, active schedule, and countdown to next bell
- Big yellow RING button for manual bell
- Silent mode toggle in the header
- Compact timeline of today's bells

### Admin Mode (Setup)
- Edit bell schedules (times, labels, profiles)
- Add/duplicate/delete schedule profiles
- Upload custom bell sounds
- Adjust volume and ring duration
- Toggle auto-launch and minimize-to-tray

### Background Behavior
- `backgroundThrottling: false` — Chromium won't throttle timers when minimized
- System tray — app stays alive even when window is closed
- Single instance lock — prevents multiple copies running
- Taskbar flash — window flashes when a bell rings and app is minimized

---

## Customization

### Adding more default schedules
Edit the `defaultProfiles` array in `src/App.js`.

### Changing the design
All styling is inline in `src/App.js` — modify colors, fonts, spacing directly.

### Changing bell sounds
Edit the `playBuiltinSound()` function in `src/App.js` to modify the Web Audio API synthesis, or simply upload custom audio files through the app.

---

## Troubleshooting

**"npm run dev" shows a blank window**
→ Wait a few seconds for the React dev server to start. The Electron window loads once `localhost:3000` is ready.

**Bells don't ring when minimized**
→ This should work out of the box thanks to `backgroundThrottling: false`. If issues persist, ensure the app is minimized to tray (not closed).

**Build fails on Windows**
→ Make sure you have Node.js v18+ and that `npm install` completed without errors. Try deleting `node_modules` and running `npm install` again.

---

## License

Built for private/commercial use. Modify freely for your client.
