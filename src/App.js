import React, { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   BellSync — Academy Bell Manager (Electron Desktop Edition)
   Two modes: DISPLAY (daily use) and ADMIN (setup/config)
   Persists settings via Electron Store, syncs with system tray
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Electron API helper ─────────────────────────────────────────────────────
const electron = window.electronAPI || null;
const log = (() => { try { return window.electronAPI ? require("electron-log/renderer") : null; } catch { return null; } })();
const appLog = { info: (...a) => log ? log.info(...a) : console.log(...a), warn: (...a) => log ? log.warn(...a) : console.warn(...a), error: (...a) => log ? log.error(...a) : console.error(...a) };

async function save(key, value) {
  if (electron) await electron.saveSetting(key, value);
}

// ─── i18n ────────────────────────────────────────────────────────────────────
const LL = {
  en: {
    appName: "BellSync", displayMode: "Display", adminMode: "Admin",
    silentMode: "Silent", silentOn: "SILENT — All bells muted",
    nextBell: "Next Bell", noBells: "No bells scheduled",
    allDone: "All bells completed for today",
    ringNow: "RING", ringing: "RINGING",
    schedules: "Schedules", sounds: "Sounds", settings: "Settings",
    activeProfile: "Active", setActive: "Set Active",
    addProfile: "Add Schedule", addBell: "Add Bell",
    delete: "Delete", duplicate: "Copy",
    uploadSound: "Upload Sound", dragDrop: "Drag & drop audio files here", formats: "MP3, WAV, OGG",
    volume: "Volume", duration: "Ring Duration", language: "Language",
    bellSound: "Bell Sound", selected: "Selected", select: "Select",
    autoLaunch: "Start with Windows", minimizeToTray: "Minimize to tray on close",
    h: "h", m: "m", s: "s",
    days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    noBellsToday: "No schedule assigned for today",
    skipDates: "Skip Dates", skipDatesDesc: "Bells won't ring on these dates",
    addSkipDate: "Add Date", noSkipDates: "No skip dates set",
    skippedToday: "Today is a skip date — bells paused",
    p1s: "Period 1 Start", p1e: "Period 1 End",
    p2s: "Period 2 Start", p2e: "Period 2 End",
    p3s: "Period 3 Start", p3e: "Period 3 End",
    p4s: "Period 4 Start", p4e: "Period 4 End",
    p5s: "Period 5 Start", p5e: "Period 5 End",
    p6s: "Period 6 Start", p6e: "Period 6 End",
    p7s: "Period 7 Start",
    lunch: "Lunch Break", dismiss: "Dismissal", jumuah: "Jumu'ah Break",
    regular: "Regular Day", halfDay: "Half Day", friday: "Friday",
    backupRestore: "Backup & Restore",
    backupDesc: "Export your schedules, sounds, and settings to a file",
    exportSettings: "Export Settings", importSettings: "Import Settings",
    exportSuccess: "Settings exported successfully!",
    importConfirm: "This will replace all your current settings. Continue?",
    importProfiles: "profiles", importSounds: "custom sounds",
    importSuccess: "Settings imported! The app will reload.",
    importError: "Import failed",
    openLogs: "Open Log Folder",
    openLogsDesc: "View application logs for troubleshooting",
    appVersion: "App Version",
    checkUpdates: "Check for Updates",
    updateChecking: "Checking…",
    updateAvailable: "Downloading update v{v}…",
    updateReady: "Update v{v} ready — restart to install",
    updateUpToDate: "You're up to date!",
    updateError: "Update check failed",
    installUpdate: "Restart & Update",
  },
  tr: {
    appName: "BellSync", displayMode: "Ekran", adminMode: "Yönetim",
    silentMode: "Sessiz", silentOn: "SESSİZ — Tüm ziller kapalı",
    nextBell: "Sonraki Zil", noBells: "Bugün zil programlanmadı",
    allDone: "Bugünkü tüm ziller tamamlandı",
    ringNow: "ÇAL", ringing: "ÇALIYOR",
    schedules: "Programlar", sounds: "Sesler", settings: "Ayarlar",
    activeProfile: "Aktif", setActive: "Aktif Yap",
    addProfile: "Program Ekle", addBell: "Zil Ekle",
    delete: "Sil", duplicate: "Kopyala",
    uploadSound: "Ses Yükle", dragDrop: "Ses dosyalarını buraya sürükle", formats: "MP3, WAV, OGG",
    volume: "Ses", duration: "Çalma Süresi", language: "Dil",
    bellSound: "Zil Sesi", selected: "Seçili", select: "Seç",
    autoLaunch: "Windows ile başlat", minimizeToTray: "Kapatınca tepsiye küçült",
    h: "s", m: "d", s: "sn",
    days: ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"],
    noBellsToday: "Bugün için program atanmadı",
    skipDates: "Tatil Günleri", skipDatesDesc: "Bu tarihlerde ziller çalmaz",
    addSkipDate: "Tarih Ekle", noSkipDates: "Tatil günü eklenmedi",
    skippedToday: "Bugün tatil — ziller duraklatıldı",
    p1s: "1. Ders Başlangıcı", p1e: "1. Ders Sonu",
    p2s: "2. Ders Başlangıcı", p2e: "2. Ders Sonu",
    p3s: "3. Ders Başlangıcı", p3e: "3. Ders Sonu",
    p4s: "4. Ders Başlangıcı", p4e: "4. Ders Sonu",
    p5s: "5. Ders Başlangıcı", p5e: "5. Ders Sonu",
    p6s: "6. Ders Başlangıcı", p6e: "6. Ders Sonu",
    p7s: "7. Ders Başlangıcı",
    lunch: "Öğle Arası", dismiss: "Çıkış", jumuah: "Cuma Arası",
    regular: "Normal Gün", halfDay: "Yarım Gün", friday: "Cuma",
    backupRestore: "Yedekleme ve Geri Yükleme",
    backupDesc: "Programlarınızı, seslerinizi ve ayarlarınızı bir dosyaya aktarın",
    exportSettings: "Ayarları Dışa Aktar", importSettings: "Ayarları İçe Aktar",
    exportSuccess: "Ayarlar başarıyla dışa aktarıldı!",
    importConfirm: "Bu, mevcut tüm ayarlarınızı değiştirecektir. Devam edilsin mi?",
    importProfiles: "program", importSounds: "özel ses",
    importSuccess: "Ayarlar içe aktarıldı! Uygulama yeniden yüklenecek.",
    importError: "İçe aktarma başarısız",
    openLogs: "Kayıt Klasörünü Aç",
    openLogsDesc: "Sorun giderme için uygulama kayıtlarını görüntüle",
    appVersion: "Uygulama Sürümü",
    checkUpdates: "Güncelleme Kontrol Et",
    updateChecking: "Kontrol ediliyor…",
    updateAvailable: "v{v} güncelleme indiriliyor…",
    updateReady: "v{v} güncelleme hazır — yüklemek için yeniden başlat",
    updateUpToDate: "Güncelsiniz!",
    updateError: "Güncelleme kontrolü başarısız",
    installUpdate: "Yeniden Başlat ve Güncelle",
  },
};

// ─── Default Profiles ────────────────────────────────────────────────────────
const mkBell = (id, time, key) => ({ id, time, labelKey: key });
const defaultProfiles = [
  {
    id: "regular", nameKey: "regular", customName: null,
    days: [1,2,3,4],
    bells: [
      mkBell(1,"08:30","p1s"), mkBell(2,"09:15","p1e"),
      mkBell(3,"09:25","p2s"), mkBell(4,"10:10","p2e"),
      mkBell(5,"10:25","p3s"), mkBell(6,"11:10","p3e"),
      mkBell(7,"11:20","p4s"), mkBell(8,"12:05","lunch"),
      mkBell(9,"12:45","p5s"), mkBell(10,"13:30","p5e"),
      mkBell(11,"13:40","p6s"), mkBell(12,"14:25","p6e"),
      mkBell(13,"14:35","p7s"), mkBell(14,"15:20","dismiss"),
    ],
  },
  {
    id: "halfday", nameKey: "halfDay", customName: null,
    days: [],
    bells: [
      mkBell(1,"08:30","p1s"), mkBell(2,"09:05","p1e"),
      mkBell(3,"09:10","p2s"), mkBell(4,"09:45","p2e"),
      mkBell(5,"09:55","p3s"), mkBell(6,"10:30","p3e"),
      mkBell(7,"10:40","p4s"), mkBell(8,"11:15","dismiss"),
    ],
  },
  {
    id: "friday", nameKey: "friday", customName: null,
    days: [5],
    bells: [
      mkBell(1,"08:30","p1s"), mkBell(2,"09:10","p1e"),
      mkBell(3,"09:20","p2s"), mkBell(4,"10:00","p2e"),
      mkBell(5,"10:15","p3s"), mkBell(6,"10:55","p3e"),
      mkBell(7,"11:05","p4s"), mkBell(8,"11:45","jumuah"),
      mkBell(9,"13:30","p5s"), mkBell(10,"14:10","dismiss"),
    ],
  },
];

const builtInSounds = [
  { id: "classic", nameEn: "Classic Bell", nameTr: "Klasik Zil" },
  { id: "chime", nameEn: "Gentle Chime", nameTr: "Yumuşak Çan" },
  { id: "digital", nameEn: "Digital Tone", nameTr: "Dijital Ton" },
  { id: "melody", nameEn: "Melody", nameTr: "Melodi" },
  { id: "bell-1", nameEn: "School Bell 1", nameTr: "Okul Zili 1", file: "sounds/bell-1.mp3" },
  { id: "bell-2", nameEn: "School Bell 2", nameTr: "Okul Zili 2", file: "sounds/bell-2.mp3" },
  { id: "bell-3", nameEn: "School Bell 3", nameTr: "Okul Zili 3", file: "sounds/bell-3.mp3" },
  { id: "bell-4", nameEn: "School Bell 4", nameTr: "Okul Zili 4", file: "sounds/bell-4.mp3" },
  { id: "bell-5", nameEn: "School Bell 5", nameTr: "Okul Zili 5", file: "sounds/bell-5.mp3" },
  { id: "bell-6", nameEn: "School Bell 6", nameTr: "Okul Zili 6", file: "sounds/bell-6.mp3" },
];

// ─── Audio ───────────────────────────────────────────────────────────────────
function playBuiltinSound(type, vol = 0.8, dur = 3) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const g = ctx.createGain(); g.gain.value = vol; g.connect(ctx.destination);
  const osc = (freq, t, wave, atk, dec, gn = 0.3) => {
    const o = ctx.createOscillator(); const gNode = ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    gNode.gain.setValueAtTime(0, ctx.currentTime + t);
    gNode.gain.linearRampToValueAtTime(gn, ctx.currentTime + t + atk);
    gNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dec);
    o.connect(gNode); gNode.connect(g);
    o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + dec + 0.1);
  };
  if (type === "classic") {
    [880,1108,1318].forEach((f,i) => osc(f, i*0.02, "square", 0.01, dur, 0.25));
    [2200,2600,3000].forEach(f => osc(f, 0, "sine", 0.01, dur*0.5, 0.06));
  } else if (type === "chime") {
    [523,659,784,1047].forEach((f,i) => osc(f, i*0.3, "sine", 0.05, dur*0.7, 0.25));
  } else if (type === "digital") {
    for (let i = 0; i < 4; i++) osc(1000, i*0.4, "sine", 0.01, 0.2, 0.3);
  } else if (type === "melody") {
    [523,587,659,784,1047].forEach((f,i) => osc(f, i*0.25, "triangle", 0.03, 0.8, 0.3));
  }
  setTimeout(() => { if (ctx.state !== "closed") ctx.close().catch(() => {}); }, (dur + 1) * 1000);
  return ctx;
}

let _uid = 0;
const uid = () => `${Date.now()}-${++_uid}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toMin = t => { if (!t || !t.includes(":")) return -1; const [h,m] = t.split(":").map(Number); return (isNaN(h)||isNaN(m)) ? -1 : h*60+m; };
const toSec = t => { if (!t || !t.includes(":")) return -1; const [h,m] = t.split(":").map(Number); return (isNaN(h)||isNaN(m)) ? -1 : h*3600+m*60; };
const fmtCD = s => ({ h: Math.floor(s/3600), m: Math.floor((s%3600)/60), s: s%60 });
const pad = n => String(n).padStart(2,"0");

// ─── Icons ───────────────────────────────────────────────────────────────────
const Ico = ({d, size=20, sw=2}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const BellIco = ({size=20, cls=""}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
);
const ic = {
  gear: <Ico d={<><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>}/>,
  mute: <Ico d={<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>}/>,
  speaker: <Ico d={<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>}/>,
  plus: <Ico d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>} sw={2.5} size={16}/>,
  trash: <Ico d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>} size={15}/>,
  play: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  check: <Ico d={<polyline points="20 6 9 17 4 12"/>} size={14} sw={3}/>,
  copy: <Ico d={<><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></>} size={15}/>,
  upload: <Ico d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>}/>,
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
const fontBase = (typeof process !== 'undefined' && process.env?.PUBLIC_URL) || '.';
const CSS = `
@font-face{font-family:'DM Sans';font-style:normal;font-weight:400 700;font-display:swap;src:url('${fontBase}/fonts/dm-sans-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'DM Sans';font-style:normal;font-weight:400 700;font-display:swap;src:url('${fontBase}/fonts/dm-sans-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'DM Mono';font-style:normal;font-weight:400;font-display:swap;src:url('${fontBase}/fonts/dm-mono-400-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'DM Mono';font-style:normal;font-weight:400;font-display:swap;src:url('${fontBase}/fonts/dm-mono-400-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'DM Mono';font-style:normal;font-weight:500;font-display:swap;src:url('${fontBase}/fonts/dm-mono-500-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'DM Mono';font-style:normal;font-weight:500;font-display:swap;src:url('${fontBase}/fonts/dm-mono-500-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#2a3444;border-radius:3px}
@keyframes bellSwing{0%,100%{transform:rotate(0)}15%,45%,75%{transform:rotate(14deg)}30%,60%,90%{transform:rotate(-14deg)}}
@keyframes pulseGlow{0%,100%{box-shadow:0 0 30px rgba(251,191,36,0.3)}50%{box-shadow:0 0 60px rgba(251,191,36,0.6),0 0 100px rgba(251,191,36,0.2)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes highlightNew{0%{box-shadow:0 0 0 2px rgba(251,191,36,0.6)}70%{box-shadow:0 0 0 2px rgba(251,191,36,0.6)}100%{box-shadow:0 0 0 2px transparent}}
@keyframes countTick{0%{transform:scale(1)}50%{transform:scale(1.03)}100%{transform:scale(1)}}
.swing{animation:bellSwing .6s ease-in-out infinite}
.glow-pulse{animation:pulseGlow 1.5s ease-in-out infinite}
.fade-up{animation:fadeUp .4s ease-out both}
.tick{animation:countTick 1s ease-in-out infinite}
input[type="time"],input[type="text"],input[type="date"]{background:#141c28;border:1px solid #2a3444;color:#e2e8f0;padding:8px 12px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border .2s}
input[type="time"]::-webkit-datetime-edit-ampm-field{color:#fbbf24;font-weight:700;font-size:14px;padding:2px 4px;background:rgba(251,191,36,0.1);border-radius:4px}
input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(0.7)}
input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.7)}
input:focus{border-color:#fbbf24}
input[type="range"]{-webkit-appearance:none;width:100%;height:5px;background:#2a3444;border-radius:3px;outline:none}
input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;background:#fbbf24;border-radius:50%;cursor:pointer}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [lang, setLang] = useState("en");
  const [mode, setMode] = useState("display");
  const [adminTab, setAdminTab] = useState("schedules");
  const [profiles, setProfiles] = useState(defaultProfiles);
  const [activeId, setActiveId] = useState("regular");
  const [silent, setSilent] = useState(false);
  const [volume, setVolume] = useState(80);
  const [ringDur, setRingDur] = useState(3);
  const [soundId, setSoundId] = useState("classic");
  const [customSounds, setCustomSounds] = useState([]);
  const [now, setNow] = useState(new Date());
  const [ringing, setRinging] = useState(false);
  const [lastRung, setLastRung] = useState(null);
  const [autoLaunch, setAutoLaunch] = useState(true);
  const [minToTray, setMinToTray] = useState(true);
  const [skipDates, setSkipDates] = useState([]);
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [updateStatus, setUpdateStatus] = useState({ status: "idle" });
  const fileRef = useRef(null);
  const previewRef = useRef(null);
  const ringAudioRef = useRef(null);
  const stopPreview = () => { if (previewRef.current) { try { if (previewRef.current.close) previewRef.current.close(); else previewRef.current.pause(); } catch {} previewRef.current = null; } };
  const stopRingAudio = () => { if (ringAudioRef.current) { try { if (ringAudioRef.current.close) { if (ringAudioRef.current.state !== "closed") ringAudioRef.current.close(); } else { ringAudioRef.current.pause(); ringAudioRef.current.currentTime = 0; } } catch {} ringAudioRef.current = null; } };
  const t = LL[lang];

  // ─── Load saved settings on mount ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (electron) {
        try {
          const all = await electron.loadAllSettings();
          if (all.language) setLang(all.language);
          if (all.profiles) setProfiles(all.profiles);
          if (all.activeProfileId) setActiveId(all.activeProfileId);
          if (all.selectedSound) setSoundId(all.selectedSound);
          if (typeof all.volume === "number") setVolume(all.volume);
          if (typeof all.ringDuration === "number") setRingDur(all.ringDuration);
          if (typeof all.silentMode === "boolean") setSilent(all.silentMode);
          if (typeof all.autoLaunch === "boolean") setAutoLaunch(all.autoLaunch);
          if (typeof all.minimizeToTray === "boolean") setMinToTray(all.minimizeToTray);
          if (Array.isArray(all.skipDates)) setSkipDates(all.skipDates);
          if (Array.isArray(all.customSounds)) setCustomSounds(all.customSounds);
          if (electron.getAppVersion) {
            const ver = await electron.getAppVersion();
            if (ver) setAppVersion(ver);
          }
        } catch (e) { console.error("Failed to load settings:", e); }
      }
      setLoaded(true);
    })();

    // Listen for silent mode changes from system tray
    let removeSilentListener;
    let removeUpdateListener;
    if (electron) {
      removeSilentListener = electron.onSilentModeChanged((val) => setSilent(val));
      if (electron.onUpdateStatus) {
        removeUpdateListener = electron.onUpdateStatus((data) => setUpdateStatus(data));
      }
    }
    return () => { if (removeSilentListener) removeSilentListener(); if (removeUpdateListener) removeUpdateListener(); };
  }, []);

  // ─── Auto-save settings when they change ─────────────────────────────────
  useEffect(() => { if (loaded) save("language", lang); }, [lang, loaded]);
  useEffect(() => { if (loaded) save("profiles", profiles); }, [profiles, loaded]);
  useEffect(() => { if (loaded) save("activeProfileId", activeId); }, [activeId, loaded]);
  useEffect(() => { if (loaded) save("selectedSound", soundId); }, [soundId, loaded]);
  useEffect(() => { if (loaded) save("volume", volume); }, [volume, loaded]);
  useEffect(() => { if (loaded) save("ringDuration", ringDur); }, [ringDur, loaded]);
  useEffect(() => {
    if (loaded) {
      save("silentMode", silent);
      if (electron) electron.updateSilentMode(silent);
    }
  }, [silent, loaded]);
  useEffect(() => { if (loaded) save("autoLaunch", autoLaunch); }, [autoLaunch, loaded]);
  useEffect(() => { if (loaded) save("minimizeToTray", minToTray); }, [minToTray, loaded]);
  useEffect(() => { if (loaded) save("skipDates", skipDates); }, [skipDates, loaded]);
  useEffect(() => { if (loaded) save("customSounds", customSounds); }, [customSounds, loaded]);

  // ─── Clock tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayDay = now.getDay(); // 0=Sun,1=Mon,...6=Sat
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  // Auto-prune skip dates older than yesterday
  useEffect(() => {
    if (loaded && skipDates.some(d => d < todayStr)) {
      setSkipDates(s => s.filter(d => d >= todayStr));
    }
  }, [todayStr, loaded]);
  const isSkippedToday = skipDates.includes(todayStr);
  const todayProfile = profiles.find(p => (p.days || []).includes(todayDay));
  const profile = todayProfile || profiles.find(p => p.id === activeId) || profiles[0];
  const noScheduleToday = !todayProfile;
  const bells = [...profile.bells].sort((a,b) => toMin(a.time) - toMin(b.time));
  const nowM = now.getHours()*60 + now.getMinutes();
  const nowS = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  const nextIdx = bells.findIndex(b => toMin(b.time) > nowM);
  const nextBell = nextIdx >= 0 ? bells[nextIdx] : null;
  const secLeft = nextBell ? toSec(nextBell.time) - nowS : null;
  const cd = secLeft !== null ? fmtCD(secLeft) : null;
  const bellLabel = b => b.customLabel?.[lang] || t[b.labelKey] || b.labelKey;
  const profileName = p => p.customName?.[lang] || t[p.nameKey] || p.nameKey;

  // ─── Auto-ring ───────────────────────────────────────────────────────────
  // Reset lastRung at midnight so bells work every day
  const todayDateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const lastDateRef = useRef(todayDateKey);
  useEffect(() => {
    if (todayDateKey !== lastDateRef.current) {
      lastDateRef.current = todayDateKey;
      setLastRung(null);
    }
  }, [todayDateKey]);

  const ring = useCallback(() => {
    if (silent) return;
    stopRingAudio();
    setRinging(true);
    appLog.info("Bell ring", { soundId, volume, time: new Date().toLocaleTimeString() });
    if (electron) electron.notifyBellRinging();
    const custom = customSounds.find(s => s.id === soundId);
    const builtin = builtInSounds.find(s => s.id === soundId);
    if (custom) {
      const a = new Audio(custom.url); a.volume = volume/100; a.play().catch(()=>{});
      ringAudioRef.current = a;
    } else if (builtin?.file) {
      const base = (typeof process !== 'undefined' && process.env?.PUBLIC_URL) || '.';
      const a = new Audio(`${base}/${builtin.file}`); a.volume = volume/100; a.play().catch(()=>{});
      ringAudioRef.current = a;
    } else {
      ringAudioRef.current = playBuiltinSound(soundId, volume/100, ringDur);
    }
    setTimeout(() => setRinging(false), ringDur * 1000);
  }, [silent, soundId, volume, ringDur, customSounds]);

  useEffect(() => {
    if (silent || noScheduleToday || isSkippedToday) return;
    const cTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const match = bells.find(b => b.time === cTime && now.getSeconds() === 0);
    if (match && lastRung !== `${match.id}-${cTime}`) {
      ring();
      setLastRung(`${match.id}-${cTime}`);
    }
  }, [now, silent, noScheduleToday, isSkippedToday, bells, lastRung, ring]);

  const handleFiles = files => {
    Array.from(files).forEach(f => {
      if (!f.type.startsWith("audio/")) return;
      const r = new FileReader();
      r.onload = e => setCustomSounds(p => [...p, { id: `c-${uid()}`, name: f.name.replace(/\.[^.]+$/,""), url: e.target.result }]);
      r.readAsDataURL(f);
    });
  };

  // ─── Profile CRUD ────────────────────────────────────────────────────────
  const [newProfileId, setNewProfileId] = useState(null);
  const addProfile = () => {
    const id = `p-${uid()}`;
    setProfiles(p => [...p, { id, nameKey: null, customName: { en: "New Schedule", tr: "Yeni Program" }, days: [], bells: [] }]);
    setNewProfileId(id);
  };
  useEffect(() => {
    if (newProfileId) {
      const el = document.getElementById(`profile-${newProfileId}`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
      const timer = setTimeout(() => setNewProfileId(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [newProfileId, profiles]);
  const dupProfile = pid => {
    const src = profiles.find(p => p.id === pid); if (!src) return;
    setProfiles(p => [...p, { ...src, id: `p-${uid()}`, days: [], customName: { en: (src.customName?.en || t[src.nameKey])+" (Copy)", tr: (src.customName?.tr || LL.tr[src.nameKey])+" (Kopya)" }, bells: src.bells.map(b => ({...b, id: uid()})) }]);
  };
  const delProfile = pid => {
    if (profiles.length <= 1) return;
    setProfiles(p => p.filter(x => x.id !== pid));
    if (activeId === pid) setActiveId(profiles.find(x => x.id !== pid).id);
  };
  const toggleDay = (pid, day) => {
    setProfiles(p => {
      const target = p.find(x => x.id === pid);
      const isRemoving = (target?.days || []).includes(day);
      return p.map(x => {
        if (x.id === pid) {
          const days = x.days || [];
          return { ...x, days: isRemoving ? days.filter(d => d !== day) : [...days, day] };
        }
        // Remove this day from any other profile to prevent conflicts
        if (!isRemoving && (x.days || []).includes(day)) {
          return { ...x, days: (x.days || []).filter(d => d !== day) };
        }
        return x;
      });
    });
  };
  const updProfileName = (pid, val) => {
    setProfiles(p => p.map(x => x.id === pid ? {...x, customName: {...(x.customName||{}), [lang]: val}} : x));
  };
  const addBell = pid => {
    setProfiles(p => p.map(x => x.id === pid ? {...x, bells: [...x.bells, {id: uid(), time: "12:00", labelKey: null, customLabel: {en:"New Bell",tr:"Yeni Zil"}}]} : x));
  };
  const delBell = (pid, bid) => {
    setProfiles(p => p.map(x => x.id === pid ? {...x, bells: x.bells.filter(b => b.id !== bid)} : x));
  };
  const updBell = (pid, bid, field, val) => {
    setProfiles(p => p.map(x => x.id === pid ? {...x, bells: x.bells.map(b => b.id === bid ? (field === "time" ? {...b, time: val} : {...b, customLabel: {...(b.customLabel||{}), [lang]: val}, labelKey: null}) : b)} : x));
  };

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = now.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", { weekday: "long", month: "long", day: "numeric" });

  if (!loaded) return <div style={{ background: "#0b1120", minHeight: "100vh" }} />;

  // ─── BUTTON STYLE HELPER ─────────────────────────────────────────────────
  const btn = (bg, border, color, extra = {}) => ({
    padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
    fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
    background: bg, border: `1px solid ${border}`, color, ...extra,
  });

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#0b1120", minHeight: "100vh", color: "#cbd5e1" }}>
      <style>{CSS}</style>

      {/* ═══ DISPLAY MODE ═══ */}
      {mode === "display" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          {/* Top bar */}
          <div style={{ padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(11,17,32,0.9)", borderBottom: "1px solid #1a2333" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={process.env.PUBLIC_URL + "/icon.png"} alt="BellSync" style={{ width: 32, height: 32, borderRadius: 8 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{t.appName}</span>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "rgba(251,191,36,0.1)", color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {profileName(profile)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setSilent(!silent)} style={btn(silent ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.08)", silent ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.15)", silent ? "#f87171" : "#4ade80")}>
                {silent ? ic.mute : ic.speaker} {t.silentMode}
              </button>
              <button onClick={() => setMode("admin")} style={btn("rgba(148,163,184,0.08)", "#1e293b", "#64748b")}>
                {ic.gear} {t.adminMode}
              </button>
              <button onClick={() => setLang(lang === "en" ? "tr" : "en")} style={btn("rgba(99,102,241,0.08)", "rgba(99,102,241,0.15)", "#818cf8", { fontWeight: 700 })}>
                {lang === "en" ? "TR" : "EN"}
              </button>
            </div>
          </div>

          {silent && (
            <div style={{ padding: "10px 24px", background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.15)", color: "#f87171", fontSize: 13, fontWeight: 600, textAlign: "center", letterSpacing: "0.04em" }}>
              {t.silentOn}
            </div>
          )}
          {!silent && isSkippedToday && (
            <div style={{ padding: "10px 24px", background: "rgba(251,146,60,0.08)", borderBottom: "1px solid rgba(251,146,60,0.15)", color: "#fb923c", fontSize: 13, fontWeight: 600, textAlign: "center", letterSpacing: "0.04em" }}>
              {t.skippedToday}
            </div>
          )}

          {/* Main display */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", gap: 32 }}>
            {/* Clock */}
            <div className="fade-up" style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "min(12vw,96px)", fontWeight: 500, color: "#f8fafc", letterSpacing: "-0.02em", lineHeight: 1 }}>{timeStr}</div>
              <div style={{ fontSize: 16, color: "#64748b", marginTop: 8 }}>{dateStr}</div>
            </div>

            {/* Countdown */}
            {isSkippedToday ? (
              <div className="fade-up" style={{ color: "#fb923c", fontSize: 16 }}>{t.skippedToday}</div>
            ) : noScheduleToday ? (
              <div className="fade-up" style={{ color: "#475569", fontSize: 16 }}>{t.noBellsToday}</div>
            ) : nextBell && cd ? (
              <div className="fade-up" style={{ textAlign: "center", padding: "28px 48px", borderRadius: 20, background: "linear-gradient(135deg,rgba(251,191,36,0.04),rgba(11,17,32,0.8))", border: "1px solid rgba(251,191,36,0.1)", animationDelay: "0.1s" }}>
                <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                  {t.nextBell} — {bellLabel(nextBell)} ({nextBell.time})
                </div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
                  {cd.h > 0 && <><span className="tick" style={{ fontFamily: "'DM Mono'", fontSize: 64, fontWeight: 500, color: "#f8fafc" }}>{cd.h}</span><span style={{ fontSize: 20, color: "#475569", marginRight: 16 }}>{t.h}</span></>}
                  <span className="tick" style={{ fontFamily: "'DM Mono'", fontSize: 64, fontWeight: 500, color: "#f8fafc" }}>{pad(cd.m)}</span>
                  <span style={{ fontSize: 20, color: "#475569", marginRight: 16 }}>{t.m}</span>
                  <span className="tick" style={{ fontFamily: "'DM Mono'", fontSize: 64, fontWeight: 500, color: "#fbbf24" }}>{pad(cd.s)}</span>
                  <span style={{ fontSize: 20, color: "#475569" }}>{t.s}</span>
                </div>
              </div>
            ) : bells.length > 0 ? (
              <div className="fade-up" style={{ color: "#475569", fontSize: 16 }}>{t.allDone}</div>
            ) : (
              <div className="fade-up" style={{ color: "#475569", fontSize: 16 }}>{t.noBells}</div>
            )}

            {/* Ring button */}
            <div className="fade-up" style={{ animationDelay: "0.2s" }}>
              <button onClick={ring} disabled={silent} className={ringing ? "glow-pulse" : ""} style={{
                width: 120, height: 120, borderRadius: "50%",
                background: ringing ? "linear-gradient(135deg,#fbbf24,#d97706)" : silent ? "linear-gradient(135deg,#1e293b,#0f172a)" : "linear-gradient(135deg,#fbbf24,#b45309)",
                border: ringing ? "3px solid #fde68a" : "3px solid transparent",
                cursor: silent ? "not-allowed" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                color: ringing || !silent ? "#0b1120" : "#475569", transition: "all .3s",
                boxShadow: ringing ? "0 0 40px rgba(251,191,36,0.4)" : "0 8px 32px rgba(0,0,0,0.4)",
              }}>
                <BellIco size={36} cls={ringing ? "swing" : ""} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em" }}>{ringing ? t.ringing : t.ringNow}</span>
              </button>
            </div>

            {/* Timeline */}
            {bells.length > 0 && !isSkippedToday && !noScheduleToday && (
              <div className="fade-up" style={{ width: "100%", maxWidth: 600, padding: "16px 20px", borderRadius: 14, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333", animationDelay: "0.3s" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 0" }}>
                  {bells.map((b,i) => {
                    const past = nowM > toMin(b.time);
                    const isNext = nextIdx === i;
                    return (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 6, width: "50%", minWidth: 200, background: isNext ? "rgba(251,191,36,0.06)" : "transparent", opacity: past && !isNext ? 0.35 : 1, borderLeft: isNext ? "2px solid #fbbf24" : "2px solid transparent" }}>
                        <span style={{ fontFamily: "'DM Mono'", fontSize: 12, fontWeight: 500, minWidth: 42, color: isNext ? "#fbbf24" : "#475569" }}>{b.time}</span>
                        <span style={{ fontSize: 12, color: isNext ? "#fde68a" : "#94a3b8", fontWeight: isNext ? 600 : 400 }}>{bellLabel(b)}</span>
                        {past && !isNext && <span style={{ color: "#334155", marginLeft: "auto" }}>{ic.check}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ADMIN MODE ═══ */}
      {mode === "admin" && (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(11,17,32,0.95)", borderBottom: "1px solid #1a2333", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={process.env.PUBLIC_URL + "/icon.png"} alt="BellSync" style={{ width: 32, height: 32, borderRadius: 8 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{t.appName}</span>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "rgba(148,163,184,0.08)", color: "#64748b", textTransform: "uppercase" }}>{t.adminMode}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setLang(lang === "en" ? "tr" : "en")} style={btn("rgba(99,102,241,0.08)", "rgba(99,102,241,0.15)", "#818cf8", { fontWeight: 700 })}>{lang === "en" ? "TR" : "EN"}</button>
              <button onClick={() => setMode("display")} style={{ ...btn("linear-gradient(135deg,#fbbf24,#d97706)", "transparent", "#0b1120", { fontWeight: 700 }) }}>← {t.displayMode}</button>
            </div>
          </div>

          <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div style={{ width: 180, padding: "16px 10px", borderRight: "1px solid #1a2333", display: "flex", flexDirection: "column", gap: 4 }}>
              {["schedules","sounds","settings"].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab)} style={{
                  padding: "10px 14px", borderRadius: 8, textAlign: "left", width: "100%",
                  background: adminTab === tab ? "rgba(251,191,36,0.08)" : "transparent",
                  border: adminTab === tab ? "1px solid rgba(251,191,36,0.15)" : "1px solid transparent",
                  color: adminTab === tab ? "#fbbf24" : "#64748b",
                  cursor: "pointer", fontSize: 13, fontWeight: adminTab === tab ? 600 : 400, fontFamily: "inherit",
                }}>{t[tab]}</button>
              ))}
            </div>

            <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>

              {/* Schedules */}
              {adminTab === "schedules" && (
                <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{t.schedules}</h2>
                    <button onClick={addProfile} style={{ ...btn("linear-gradient(135deg,#fbbf24,#d97706)", "transparent", "#0b1120", { fontWeight: 700, padding: "8px 16px", fontSize: 13 }) }}>{ic.plus} {t.addProfile}</button>
                  </div>
                  {profiles.map(p => {
                    const isToday = (p.days || []).includes(todayDay);
                    const isAct = isToday || (!todayProfile && activeId === p.id);
                    const pBells = [...p.bells].sort((a,b) => toMin(a.time)-toMin(b.time));
                    const dayIndices = [1,2,3,4,5,6,0]; // Mon-Sun
                    return (
                      <div key={p.id} id={`profile-${p.id}`} style={{ borderRadius: 14, overflow: "hidden", background: "rgba(20,28,40,0.6)", border: isAct ? "1px solid rgba(251,191,36,0.2)" : "1px solid #1a2333", animation: newProfileId === p.id ? "highlightNew 1.5s ease-out" : undefined }}>
                        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isAct ? "rgba(251,191,36,0.04)" : "transparent", borderBottom: "1px solid #1a2333" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <input type="text" value={p.customName?.[lang] ?? t[p.nameKey] ?? ""} onChange={e => updProfileName(p.id, e.target.value)} style={{ fontSize: 15, fontWeight: 600, background: "transparent", border: "1px solid transparent", color: "#f8fafc", padding: "4px 8px", borderRadius: 6 }} onFocus={e => e.target.style.borderColor = "#2a3444"} onBlur={e => e.target.style.borderColor = "transparent"} />
                            {isAct && <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(251,191,36,0.12)", color: "#fbbf24", textTransform: "uppercase" }}>{t.activeProfile}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            {!isAct && <button onClick={() => setActiveId(p.id)} style={btn("rgba(251,191,36,0.08)", "rgba(251,191,36,0.15)", "#fbbf24", { padding: "5px 12px" })}>{t.setActive}</button>}
                            <button onClick={() => dupProfile(p.id)} style={btn("rgba(148,163,184,0.06)", "#1e293b", "#64748b", { padding: "5px 10px" })}>{ic.copy} {t.duplicate}</button>
                            {profiles.length > 1 && <button onClick={() => delProfile(p.id)} style={btn("rgba(239,68,68,0.06)", "rgba(239,68,68,0.12)", "#ef4444", { padding: "5px 10px" })}>{ic.trash} {t.delete}</button>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, padding: "10px 18px", borderBottom: "1px solid #1a2333" }}>
                          {dayIndices.map((di, idx) => {
                            const active = (p.days || []).includes(di);
                            return (
                              <button key={di} onClick={() => toggleDay(p.id, di)} style={{
                                padding: "4px 0", width: 42, borderRadius: 6, fontSize: 11, fontWeight: 700,
                                fontFamily: "inherit", cursor: "pointer", textAlign: "center",
                                background: active ? "rgba(251,191,36,0.15)" : "transparent",
                                border: active ? "1px solid rgba(251,191,36,0.3)" : "1px solid #1e293b",
                                color: active ? "#fbbf24" : "#475569",
                                transition: "all .15s",
                              }}>{t.days[idx]}</button>
                            );
                          })}
                        </div>
                        <div style={{ padding: "10px 18px" }}>
                          {pBells.map(b => {
                            const isDupe = pBells.filter(x => x.time === b.time).length > 1;
                            return (
                            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(26,35,51,0.8)" }}>
                              <input type="time" value={b.time} onChange={e => updBell(p.id, b.id, "time", e.target.value)} style={{ width: 140, fontFamily: "'DM Mono'", fontSize: 15, borderColor: isDupe ? "#ef4444" : undefined }} />
                              <input type="text" value={b.customLabel?.[lang] ?? t[b.labelKey] ?? ""} onChange={e => updBell(p.id, b.id, "label", e.target.value)} style={{ flex: 1 }} />
                              <button onClick={() => delBell(p.id, b.id)} style={{ padding: "5px 7px", borderRadius: 5, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }}>{ic.trash}</button>
                            </div>
                            );
                          })}
                          <button onClick={() => addBell(p.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 10, marginTop: 10, borderRadius: 8, width: "100%", background: "transparent", border: "1px dashed rgba(251,191,36,0.2)", color: "#fbbf24", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>{ic.plus} {t.addBell}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sounds */}
              {adminTab === "sounds" && (
                <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{t.sounds}</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
                    {builtInSounds.map(s => {
                      const act = soundId === s.id;
                      return (
                        <div key={s.id} style={{ padding: 14, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", background: act ? "rgba(251,191,36,0.06)" : "rgba(20,28,40,0.6)", border: act ? "1px solid rgba(251,191,36,0.2)" : "1px solid #1a2333" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button onClick={() => { stopPreview(); if (s.file) { const base = (typeof process !== 'undefined' && process.env?.PUBLIC_URL) || '.'; const a = new Audio(`${base}/${s.file}`); a.volume = volume/100; a.play().catch(()=>{}); previewRef.current = a; } else { previewRef.current = playBuiltinSound(s.id, volume/100, 2); } }} style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(148,163,184,0.06)", border: "1px solid #1e293b", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{ic.play}</button>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{lang === "en" ? s.nameEn : s.nameTr}</span>
                          </div>
                          <button onClick={() => setSoundId(s.id)} style={btn(act ? "rgba(251,191,36,0.15)" : "rgba(148,163,184,0.06)", act ? "rgba(251,191,36,0.25)" : "#1e293b", act ? "#fbbf24" : "#64748b", { padding: "4px 12px", fontSize: 11 })}>{act ? t.selected : t.select}</button>
                        </div>
                      );
                    })}
                  </div>
                  {customSounds.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
                      {customSounds.map(s => {
                        const act = soundId === s.id;
                        return (
                          <div key={s.id} style={{ padding: 14, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", background: act ? "rgba(251,191,36,0.06)" : "rgba(20,28,40,0.6)", border: act ? "1px solid rgba(251,191,36,0.2)" : "1px solid #1a2333" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <button onClick={() => { stopPreview(); const a = new Audio(s.url); a.volume = volume/100; a.play(); previewRef.current = a; }} style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(148,163,184,0.06)", border: "1px solid #1e293b", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{ic.play}</button>
                              <span style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{s.name}</span>
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => setSoundId(s.id)} style={btn(act ? "rgba(251,191,36,0.15)" : "rgba(148,163,184,0.06)", act ? "rgba(251,191,36,0.25)" : "#1e293b", act ? "#fbbf24" : "#64748b", { padding: "4px 12px", fontSize: 11 })}>{act ? t.selected : t.select}</button>
                              <button onClick={() => { if (soundId === s.id) setSoundId("classic"); setCustomSounds(p => p.filter(x => x.id !== s.id)); }} style={{ padding: "4px 6px", borderRadius: 5, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer" }}>{ic.trash}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }} onClick={() => fileRef.current?.click()} style={{ padding: 36, borderRadius: 14, border: "2px dashed #1e293b", background: "rgba(20,28,40,0.3)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    {ic.upload}
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>{t.uploadSound}</span>
                    <span style={{ fontSize: 12, color: "#475569" }}>{t.dragDrop}</span>
                    <span style={{ fontSize: 11, color: "#334155" }}>{t.formats}</span>
                    <input ref={fileRef} type="file" accept="audio/*" multiple onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
                  </div>
                </div>
              )}

              {/* Settings */}
              {adminTab === "settings" && (
                <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 440 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{t.settings}</h2>

                  <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 10 }}>{t.language}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{c:"en",l:"English"},{c:"tr",l:"Türkçe"}].map(x => (
                        <button key={x.c} onClick={() => setLang(x.c)} style={btn(lang === x.c ? "rgba(251,191,36,0.1)" : "rgba(148,163,184,0.06)", lang === x.c ? "rgba(251,191,36,0.2)" : "#1e293b", lang === x.c ? "#fbbf24" : "#64748b", { padding: "8px 18px", fontSize: 13 })}>{x.l}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{t.volume}</span>
                      <span style={{ fontFamily: "'DM Mono'", fontSize: 13, color: "#fbbf24", fontWeight: 600 }}>{volume}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={volume} onChange={e => setVolume(+e.target.value)} />
                  </div>

                  <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{t.duration}</span>
                      <span style={{ fontFamily: "'DM Mono'", fontSize: 13, color: "#fbbf24", fontWeight: 600 }}>{ringDur}s</span>
                    </div>
                    <input type="range" min="1" max="15" value={ringDur} onChange={e => setRingDur(+e.target.value)} />
                  </div>

                  <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 10 }}>{t.bellSound}</div>
                    <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.12)", color: "#fbbf24", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                      {ic.speaker}
                      {builtInSounds.find(s => s.id === soundId)?.[lang === "en" ? "nameEn" : "nameTr"] || customSounds.find(s => s.id === soundId)?.name || soundId}
                    </div>
                  </div>

                  <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>{t.skipDates}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>{t.skipDatesDesc}</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <input type="date" id="skip-date-input" style={{ flex: 1, fontFamily: "'DM Sans',sans-serif" }} />
                      <button onClick={() => {
                        const inp = document.getElementById("skip-date-input");
                        if (inp.value && !skipDates.includes(inp.value)) {
                          setSkipDates(d => [...d, inp.value].sort());
                          inp.value = "";
                        }
                      }} style={btn("rgba(251,191,36,0.1)", "rgba(251,191,36,0.2)", "#fbbf24", { padding: "8px 14px", fontSize: 12 })}>{ic.plus} {t.addSkipDate}</button>
                    </div>
                    {skipDates.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#475569", fontStyle: "italic" }}>{t.noSkipDates}</div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {skipDates.map(d => (
                          <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: d === todayStr ? "rgba(251,146,60,0.12)" : "rgba(148,163,184,0.06)", border: d === todayStr ? "1px solid rgba(251,146,60,0.25)" : "1px solid #1e293b", fontSize: 12, fontFamily: "'DM Mono'", color: d === todayStr ? "#fb923c" : "#94a3b8" }}>
                            {d}
                            <button onClick={() => setSkipDates(s => s.filter(x => x !== d))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>&times;</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Electron-specific settings */}
                  {electron && (
                    <>
                      <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                          <input type="checkbox" checked={autoLaunch} onChange={e => setAutoLaunch(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#fbbf24" }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{t.autoLaunch}</span>
                        </label>
                      </div>

                      <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                          <input type="checkbox" checked={minToTray} onChange={e => setMinToTray(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#fbbf24" }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{t.minimizeToTray}</span>
                        </label>
                      </div>

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

                      <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>{t.openLogs}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{t.openLogsDesc}</div>
                        <button onClick={() => electron.openLogFolder()} style={btn("rgba(148,163,184,0.06)", "#1e293b", "#94a3b8", { padding: "8px 18px", fontSize: 13 })}>
                          {t.openLogs}
                        </button>
                      </div>

                      <div style={{ padding: 18, borderRadius: 12, background: "rgba(20,28,40,0.6)", border: "1px solid #1a2333" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>{t.appVersion}</div>
                        <div style={{ fontFamily: "'DM Mono'", fontSize: 13, color: "#fbbf24", marginBottom: 10 }}>v{appVersion}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button
                            disabled={updateStatus.status === "checking" || updateStatus.status === "available"}
                            onClick={async () => {
                              setUpdateStatus({ status: "checking" });
                              const r = await electron.checkForUpdates();
                              if (!r.success && r.error) setUpdateStatus({ status: "error", error: r.error });
                            }}
                            style={btn("rgba(251,191,36,0.08)", "rgba(251,191,36,0.2)", "#fbbf24", { padding: "8px 18px", fontSize: 13, opacity: (updateStatus.status === "checking" || updateStatus.status === "available") ? 0.5 : 1 })}
                          >
                            {updateStatus.status === "checking" ? t.updateChecking : t.checkUpdates}
                          </button>
                          {updateStatus.status === "ready" && (
                            <button
                              onClick={() => electron.installUpdate()}
                              style={btn("rgba(34,197,94,0.1)", "rgba(34,197,94,0.25)", "#22c55e", { padding: "8px 18px", fontSize: 13 })}
                            >
                              {t.installUpdate}
                            </button>
                          )}
                        </div>
                        {updateStatus.status === "up-to-date" && (
                          <div style={{ fontSize: 12, color: "#22c55e", marginTop: 8 }}>{t.updateUpToDate}</div>
                        )}
                        {updateStatus.status === "available" && (
                          <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 8 }}>{t.updateAvailable.replace("{v}", updateStatus.version || "")}</div>
                        )}
                        {updateStatus.status === "ready" && (
                          <div style={{ fontSize: 12, color: "#22c55e", marginTop: 8 }}>{t.updateReady.replace("{v}", updateStatus.version || "")}</div>
                        )}
                        {updateStatus.status === "error" && (
                          <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{t.updateError}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
