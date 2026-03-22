/**
 * SAI Sai Rolotech Smart Engines AI — Electron Main Process
 * Windows 10/11 Native Desktop App
 *
 * Features:
 * - Spawns local Express API server (no internet needed)
 * - Serves React frontend from bundled files
 * - Native Windows menus (File, Tools, Help)
 * - System tray with quick-access menu
 * - Native file dialogs for DXF/G-code open/save
 * - Auto-updater support
 * - Windows NSIS installer + Portable exe
 */

import {
  app, BrowserWindow, Menu, Tray, dialog, ipcMain,
  shell, nativeTheme, nativeImage, globalShortcut,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { spawn, ChildProcess } from "child_process";
import { autoUpdater } from "electron-updater";

// ─── GPU Acceleration Flags ──────────────────────────────────────────────────

app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-webgpu");
app.commandLine.appendSwitch("use-angle", "d3d11");
app.commandLine.appendSwitch("enable-features", "VaapiVideoDecoder,VaapiVideoEncoder");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-accelerated-video-decode");

// ─── Constants ───────────────────────────────────────────────────────────────

const APP_NAME    = "SAI Sai Rolotech Smart Engines AI";
const APP_VERSION = app.getVersion();
const API_PORT    = 3001;
const IS_DEV      = process.env.NODE_ENV === "development" || !app.isPackaged;
const IS_WIN      = process.platform === "win32";

// ─── Valid License Keys ──────────────────────────────────────────────────────
const VALID_LICENSE_KEYS = new Set([
  "SAIR-2026-ROLL-FORM",
  "SAIR-2026-ENGI-NEER",
  "SAIR-2026-PREM-IUMS",
  "SAIR-PRO-2026-MSTR",
  "SAIR-DEMO-2026-TRIAL",
]);

// ─── State ───────────────────────────────────────────────────────────────────

let mainWindow:     BrowserWindow | null = null;
let tray:           Tray         | null = null;
let apiProcess:     ChildProcess | null = null;
let isQuitting       = false;
let apiReady         = false;
let appIsReady       = false;   // guards globalShortcut usage
let updateDownloadProgress = 0;

// ─── Resource paths ──────────────────────────────────────────────────────────

function getResourcePath(rel: string): string {
  return IS_DEV
    ? path.join(__dirname, "..", "..", "..", rel)
    : path.join(process.resourcesPath, rel);
}

function getAssetPath(filename: string): string {
  return IS_DEV
    ? path.join(__dirname, "..", "assets", filename)
    : path.join(process.resourcesPath, "assets", filename);
}

// ─── API Server ──────────────────────────────────────────────────────────────

function startApiServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverScript = IS_DEV
      ? path.join(__dirname, "..", "..", "api-server", "src", "index.ts")
      : path.join(process.resourcesPath, "api-server", "index.cjs");

    const cmd  = IS_DEV ? "tsx" : process.execPath;
    const args = IS_DEV ? [serverScript] : [serverScript];
    const env  = {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(API_PORT),
      ELECTRON: "1",
      ...(IS_DEV ? {} : {
        ELECTRON_RUN_AS_NODE: "1",
        FRONTEND_DIST: path.join(process.resourcesPath, "frontend"),
      }),
    };

    console.log(`[API] Starting server: ${cmd} ${serverScript}`);

    apiProcess = spawn(cmd, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      if (!apiReady) {
        console.error("[API] Timeout starting server");
        resolve(); // Continue anyway — app still works offline
      }
    }, 8000);

    apiProcess.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString();
      console.log(`[API] ${msg.trim()}`);
      if (msg.includes("listening") || msg.includes("Server") || msg.includes(String(API_PORT))) {
        clearTimeout(timeout);
        apiReady = true;
        resolve();
      }
    });

    apiProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (!msg.includes("DeprecationWarning") && !msg.includes("ExperimentalWarning")) {
        console.error(`[API ERR] ${msg.trim()}`);
      }
    });

    apiProcess.on("error", (err) => {
      console.error("[API] Spawn error:", err);
      clearTimeout(timeout);
      resolve(); // Graceful fallback
    });

    apiProcess.on("exit", (code) => {
      console.log(`[API] Process exited with code ${code}`);
      if (!isQuitting && mainWindow) {
        // Restart API if it crashes
        setTimeout(() => startApiServer(), 2000);
      }
    });
  });
}

function stopApiServer(): void {
  if (apiProcess) {
    apiProcess.kill("SIGTERM");
    apiProcess = null;
  }
}

// ─── Crash Logger ─────────────────────────────────────────────────────────────

function _logCrash(detail: string): void {
  try {
    const logDir  = appIsReady ? app.getPath("logs") : os.tmpdir();
    const logFile = path.join(logDir, "sai-rolotech-crash.log");
    const entry   = `[${new Date().toISOString()}] ${detail}\n`;
    fs.appendFileSync(logFile, entry, "utf8");
  } catch { /* never throw from crash handler */ }
}

// ─── Browser Window ──────────────────────────────────────────────────────────

function createMainWindow(): void {
  const preloadPath = path.join(__dirname, "preload.js");

  // Restore window bounds from userData
  const userDataPath = app.getPath("userData");
  const boundsFile   = path.join(userDataPath, "window-bounds.json");
  let bounds = { width: 1440, height: 900, x: undefined as number | undefined, y: undefined as number | undefined };
  try {
    const saved = JSON.parse(fs.readFileSync(boundsFile, "utf8"));
    bounds = { ...bounds, ...saved };
  } catch { /* use defaults */ }

  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width:  bounds.width,
    height: bounds.height,
    x:      bounds.x,
    y:      bounds.y,
    minWidth:  1024,
    minHeight: 600,
    show: false, // Show after ready-to-show

    // Windows 10/11 native look
    frame:           IS_WIN, // Use native Win32 frame on Windows
    titleBarStyle:   IS_WIN ? "default" : "hiddenInset",
    backgroundColor: "#070710",

    webPreferences: {
      preload:           preloadPath,
      nodeIntegration:   false,
      contextIsolation:  true,
      webSecurity:       true,
      allowRunningInsecureContent: false,
    },

    icon: getAssetPath("icon.ico"),
  });

  // ── Load content ──
  if (IS_DEV) {
    mainWindow.loadURL("http://localhost:5000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadURL(`http://localhost:${API_PORT}`);
  }

  // ── Window events ──
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (IS_WIN && mainWindow) {
      // Windows Mica/Acrylic effect (Windows 11)
      try {
        const { setMica } = require("electron-acrylic-window");
        setMica(mainWindow);
      } catch { /* Not available — no issue */ }
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      tray?.displayBalloon?.({
        iconType:    "info",
        title:       APP_NAME,
        content:     `${APP_NAME} is still running in the system tray. Click the tray icon to reopen.`,
      });
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  // Save window bounds on resize/move
  mainWindow.on("resize", saveBounds);
  mainWindow.on("move",   saveBounds);

  function saveBounds() {
    if (!mainWindow) return;
    try {
      const b = mainWindow.getBounds();
      fs.writeFileSync(boundsFile, JSON.stringify(b));
    } catch { /* ignore */ }
  }

  // ── Renderer crash protection ──────────────────────────────────────────────

  // Renderer gone (crash / OOM / killed)
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    const { reason, exitCode } = details;
    console.error(`[Renderer] Gone — reason=${reason} exitCode=${exitCode}`);
    _logCrash(`render-process-gone: reason=${reason} exitCode=${exitCode}`);

    if (isQuitting || reason === "clean-exit") return;

    dialog.showMessageBox({
      type:      "error",
      title:     "SAI Rolotech — Recovering",
      message:   "The application encountered an error and is recovering.",
      detail:    `Reason: ${reason}\n\nClick Reload to continue working. Your last saved data is safe.`,
      buttons:   ["Reload App", "Close Application"],
      defaultId: 0,
      icon:      getAssetPath("icon.ico"),
    }).then(({ response }) => {
      if (response === 0) {
        if (mainWindow) {
          mainWindow.webContents.reload();
        } else {
          createMainWindow();
        }
      } else {
        isQuitting = true;
        app.quit();
      }
    }).catch(() => {
      // If dialog itself fails, just reload silently
      mainWindow?.webContents.reload();
    });
  });

  // Window frozen / unresponsive
  mainWindow.on("unresponsive", () => {
    console.warn("[Window] Unresponsive");
    _logCrash("window-unresponsive");
    if (isQuitting) return;

    dialog.showMessageBox({
      type:      "warning",
      title:     "SAI Rolotech — Not Responding",
      message:   "The application is not responding.",
      detail:    "Would you like to wait or force-reload?",
      buttons:   ["Wait", "Reload App", "Force Close"],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 1) mainWindow?.webContents.reload();
      else if (response === 2) {
        isQuitting = true;
        mainWindow?.destroy();
        app.quit();
      }
    }).catch(() => {});
  });

  mainWindow.on("responsive", () => {
    console.log("[Window] Responsive again");
  });
}

// ─── System Tray ─────────────────────────────────────────────────────────────

function createTray(): void {
  const iconPath = getAssetPath(IS_WIN ? "tray.ico" : "tray.png");
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip(`${APP_NAME} v${APP_VERSION}`);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: APP_NAME,
      icon:  icon.isEmpty() ? undefined : icon.resize({ width: 16 }),
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Open / Show",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: "Roll Tooling",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.executeJavaScript(
          `window.__saisai-rolotech-smart-engines_navigate?.("roll")`
        );
      },
    },
    {
      label: "Diagnose AI",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.executeJavaScript(
          `window.__saisai-rolotech-smart-engines_navigate?.("troubleshoot")`
        );
      },
    },
    { type: "separator" },
    {
      label: "API Status",
      click: () => shell.openExternal(`http://localhost:${API_PORT}/api/health`),
    },
    { type: "separator" },
    {
      label: "Quit SAI Sai Rolotech Smart Engines AI",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// ─── Application Menu ─────────────────────────────────────────────────────────

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "&File",
      submenu: [
        {
          label: "Open DXF Profile…",
          accelerator: "Ctrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              title: "Open DXF Profile",
              filters: [
                { name: "DXF Files", extensions: ["dxf"] },
                { name: "All Files", extensions: ["*"] },
              ],
              properties: ["openFile"],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              const content  = fs.readFileSync(filePath, "utf8");
              mainWindow?.webContents.executeJavaScript(
                `window.__saisai-rolotech-smart-engines_loadDxf?.(${JSON.stringify(content)}, ${JSON.stringify(path.basename(filePath))})`
              );
            }
          },
        },
        {
          label: "Save G-Code…",
          accelerator: "Ctrl+S",
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow!, {
              title: "Save G-Code",
              defaultPath: "SAI_Sai Rolotech Smart Engines_GCode.nc",
              filters: [
                { name: "NC Files", extensions: ["nc"] },
                { name: "Text Files", extensions: ["txt"] },
                { name: "All Files", extensions: ["*"] },
              ],
            });
            if (!result.canceled && result.filePath) {
              mainWindow?.webContents.executeJavaScript(
                `window.__saisai-rolotech-smart-engines_getGcode?.()`
              ).then((gcode: string) => {
                if (gcode) fs.writeFileSync(result.filePath!, gcode, "utf8");
              });
            }
          },
        },
        {
          label: "Export Project…",
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow!, {
              title: "Export Project",
              defaultPath: `SAI_Sai Rolotech Smart Engines_Project_${new Date().toISOString().split("T")[0]}.json`,
              filters: [{ name: "JSON", extensions: ["json"] }],
            });
            if (!result.canceled && result.filePath) {
              mainWindow?.webContents.executeJavaScript(
                `JSON.stringify(JSON.parse(localStorage.getItem("sai-rolotech-smart-enginesai-cnc-v2") || "{}"), null, 2)`
              ).then((data: string) => {
                if (data) fs.writeFileSync(result.filePath!, data, "utf8");
              });
            }
          },
        },
        {
          label: "Import Project…",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              title: "Import Project",
              filters: [{ name: "JSON Project", extensions: ["json"] }],
              properties: ["openFile"],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const data = fs.readFileSync(result.filePaths[0], "utf8");
              mainWindow?.webContents.executeJavaScript(
                `localStorage.setItem("sai-rolotech-smart-enginesai-cnc-v2", ${JSON.stringify(data)}); window.location.reload();`
              );
            }
          },
        },
        { type: "separator" },
        { role: "quit", label: "Exit" },
      ],
    },
    {
      label: "&Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "&View",
      submenu: [
        { role: "reload", label: "Reload App" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { type: "separator" },
        {
          label: "Toggle Developer Tools",
          accelerator: IS_WIN ? "Ctrl+Shift+I" : "Cmd+Option+I",
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: "&Tools",
      submenu: [
        {
          label: "AI Engine Status",
          click: () => shell.openExternal(`http://localhost:${API_PORT}/api/ai/status`),
        },
        {
          label: "API Health Check",
          click: () => shell.openExternal(`http://localhost:${API_PORT}/api/health`),
        },
        { type: "separator" },
        {
          label: "Open App Data Folder",
          click: () => shell.openPath(app.getPath("userData")),
        },
        {
          label: "Open Log Folder",
          click: () => shell.openPath(app.getPath("logs")),
        },
        { type: "separator" },
        {
          label: "Dark Mode",
          type: "checkbox",
          checked: nativeTheme.shouldUseDarkColors,
          click: (item) => {
            nativeTheme.themeSource = item.checked ? "dark" : "light";
          },
        },
      ],
    },
    {
      label: "&Help",
      submenu: [
        {
          label: `About ${APP_NAME}`,
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type:    "info",
              title:   `About ${APP_NAME}`,
              message: `${APP_NAME}\nVersion: ${APP_VERSION}`,
              detail:  `SAI Sai Rolotech Smart Engines AI — Roll Forming Engineering Suite\n\nFeatures:\n• FormAxis-grade Power Pattern Generation\n• Roll Tooling Design & CAM Plan\n• AutoCAD DXF 2D Export\n• G-Code Output (RAW + FINAL split)\n• AI Defect Diagnosis (offline)\n• Digital Twin Simulation\n• Factory AI — 8 Production Modules\n\nBuilt for Windows 10/11 × 64-bit\n© 2025 SAI Sai Rolotech Smart Engines`,
              buttons: ["OK"],
            });
          },
        },
        { type: "separator" },
        {
          label: "Documentation",
          click: () => shell.openExternal("https://saisai-rolotech-smart-engines.com/docs"),
        },
        {
          label: "Check for Updates",
          click: () => autoUpdater.checkForUpdatesAndNotify(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC Handlers (renderer → main communication) ─────────────────────────────

function setupIPC(): void {
  // Save file natively (G-code, DXF, etc.)
  ipcMain.handle("save-file", async (_event, { content, defaultName, filters }) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, "utf8");
      return { success: true, filePath: result.filePath };
    }
    return { success: false };
  });

  // Open file natively
  ipcMain.handle("open-file", async (_event, { filters }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
      properties: ["openFile"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const content = fs.readFileSync(result.filePaths[0], "utf8");
      return { success: true, content, filePath: result.filePaths[0] };
    }
    return { success: false, content: null };
  });

  ipcMain.handle("get-app-info", () => ({
    name:    APP_NAME,
    version: APP_VERSION,
    apiPort: API_PORT,
    isDev:   IS_DEV,
    platform: process.platform,
    arch:     process.arch,
  }));

  ipcMain.handle("get-gpu-info", async () => {
    try {
      const gpuInfo = await app.getGPUInfo("complete");
      return gpuInfo;
    } catch {
      return null;
    }
  });

  ipcMain.handle("get-system-info", () => {
    const cpus = os.cpus();
    const memInfo = process.getSystemMemoryInfo();
    const cpuUsage = process.getCPUUsage();
    return {
      cpu: {
        model: cpus[0]?.model ?? "Unknown",
        cores: cpus.length,
        speed: cpus[0]?.speed ?? 0,
        usage: cpuUsage.percentCPUUsage,
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
      },
      app: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        pid: process.pid,
      },
      os: {
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname(),
        arch: os.arch(),
        uptime: os.uptime(),
      },
    };
  });

  ipcMain.handle("check-for-updates", () => {
    autoUpdater.checkForUpdatesAndNotify();
  });

  ipcMain.handle("get-update-settings", () => {
    const settingsPath = path.join(app.getPath("userData"), "update-settings.json");
    try {
      return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      return { checkFrequency: "startup", autoDownload: false };
    }
  });

  ipcMain.handle("set-update-settings", (_event, settings: { checkFrequency?: string; autoDownload?: boolean }) => {
    const settingsPath = path.join(app.getPath("userData"), "update-settings.json");
    const current = (() => {
      try { return JSON.parse(fs.readFileSync(settingsPath, "utf8")); } catch { return {}; }
    })();
    const merged = { ...current, ...settings };
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
    return merged;
  });

  ipcMain.handle("get-update-history", () => {
    const historyPath = path.join(app.getPath("userData"), "update-history.json");
    try {
      return JSON.parse(fs.readFileSync(historyPath, "utf8"));
    } catch {
      return [];
    }
  });

  // Show notification via tray balloon (Windows 10/11)
  ipcMain.on("show-notification", (_event, { title, message }) => {
    tray?.displayBalloon?.({ iconType: "info", title, content: message });
  });
}

// ─── Auto Updater ─────────────────────────────────────────────────────────────

let updateRetryCount = 0;
const MAX_UPDATE_RETRIES = 3;
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

function logUpdateHistory(entry: { version: string; action: string; timestamp: string; success: boolean }) {
  const historyPath = path.join(app.getPath("userData"), "update-history.json");
  let history: unknown[] = [];
  try { history = JSON.parse(fs.readFileSync(historyPath, "utf8")); } catch { /* empty */ }
  history.unshift(entry);
  if (history.length > 50) history.length = 50;
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

function getUpdateSettings(): { checkFrequency: string; autoDownload: boolean } {
  const settingsPath = path.join(app.getPath("userData"), "update-settings.json");
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return { checkFrequency: "startup", autoDownload: false };
  }
}

function setupUpdateSchedule() {
  if (updateCheckInterval) clearInterval(updateCheckInterval);
  const settings = getUpdateSettings();
  const intervals: Record<string, number> = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
  };
  const ms = intervals[settings.checkFrequency];
  if (ms) {
    updateCheckInterval = setInterval(() => {
      console.log(`[Updater] Scheduled check (${settings.checkFrequency})`);
      autoUpdater.checkForUpdatesAndNotify();
    }, ms);
  }
}

function setupAutoUpdater(): void {
  const settings = getUpdateSettings();
  autoUpdater.autoDownload = settings.autoDownload;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    const releaseNotes = typeof info.releaseNotes === "string"
      ? info.releaseNotes
      : Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map((n: { note?: string | null }) => n.note || "").join("\n")
        : "";

    mainWindow?.webContents.send("update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes,
    });

    dialog.showMessageBox(mainWindow!, {
      type:    "info",
      title:   "Update Available",
      message: `Version ${info.version} available`,
      detail:  `A new version of SAI Sai Rolotech Smart Engines AI is available.\n\n${releaseNotes ? "Release Notes:\n" + releaseNotes.slice(0, 500) : "Would you like to download it?"}`,
      buttons: ["Download", "Later"],
    }).then(({ response }) => {
      if (response === 0) {
        updateRetryCount = 0;
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    updateDownloadProgress = Math.round(progress.percent);
    mainWindow?.webContents.send("update-download-progress", {
      percent: updateDownloadProgress,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
    mainWindow?.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.setProgressBar(-1);
    mainWindow?.webContents.send("update-downloaded", { version: info.version });

    logUpdateHistory({
      version: info.version,
      action: "downloaded",
      timestamp: new Date().toISOString(),
      success: true,
    });

    dialog.showMessageBox(mainWindow!, {
      type:    "info",
      title:   "Update Ready",
      message: `Version ${info.version} downloaded. Restart to install.`,
      buttons: ["Restart Now", "Later"],
    }).then(({ response }) => {
      if (response === 0) {
        logUpdateHistory({
          version: info.version,
          action: "installed",
          timestamp: new Date().toISOString(),
          success: true,
        });
        isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("[Updater] Error:", err.message);
    mainWindow?.setProgressBar(-1);
    mainWindow?.webContents.send("update-error", { message: err.message });

    if (updateRetryCount < MAX_UPDATE_RETRIES) {
      updateRetryCount++;
      const delay = updateRetryCount * 5000;
      console.log(`[Updater] Retry ${updateRetryCount}/${MAX_UPDATE_RETRIES} in ${delay / 1000}s`);
      setTimeout(() => {
        autoUpdater.downloadUpdate();
      }, delay);
    } else {
      logUpdateHistory({
        version: "unknown",
        action: "download-failed",
        timestamp: new Date().toISOString(),
        success: false,
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    mainWindow?.webContents.send("update-not-available");
  });

  setupUpdateSchedule();
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

// ─── License Key Verification ────────────────────────────────────────────────

function getLicenseKeyPath(): string {
  return path.join(app.getPath("userData"), "license-key.dat");
}

function getSavedLicenseKey(): string | null {
  try {
    const keyPath = getLicenseKeyPath();
    if (fs.existsSync(keyPath)) {
      const key = fs.readFileSync(keyPath, "utf8").trim();
      return key || null;
    }
  } catch { /* ignore */ }

  if (IS_WIN) {
    try {
      const { execSync } = require("child_process");
      const result = execSync(
        'reg query "HKCU\\Software\\SAI Rolotech Smart Engines" /v ProductKey',
        { encoding: "utf8", windowsHide: true }
      );
      const match = result.match(/ProductKey\s+REG_SZ\s+(.+)/);
      if (match) {
        const key = match[1].trim();
        saveLicenseKey(key);
        return key;
      }
    } catch { /* no registry key */ }
  }

  return null;
}

function saveLicenseKey(key: string): void {
  try {
    fs.writeFileSync(getLicenseKeyPath(), key, "utf8");
  } catch { /* ignore */ }
}

function isValidLicenseKey(key: string): boolean {
  return VALID_LICENSE_KEYS.has(key.trim().toUpperCase());
}

async function verifyLicense(): Promise<boolean> {
  if (IS_DEV) return true;

  const savedKey = getSavedLicenseKey();
  if (savedKey && isValidLicenseKey(savedKey)) {
    console.log("[License] Valid license key found");
    return true;
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const promptWindow = new BrowserWindow({
      width: 500,
      height: 380,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      frame: true,
      title: "SAI Rolotech — Product Activation",
      backgroundColor: "#0a0a1a",
      icon: getAssetPath("icon.ico"),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const remaining = maxAttempts - attempts;
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { margin:0; padding:30px; background:#0a0a1a; color:#e4e4e7; font-family:'Segoe UI',sans-serif; }
  h2 { color:#f97316; margin:0 0 8px; font-size:18px; }
  p { color:#a1a1aa; font-size:13px; margin:0 0 20px; line-height:1.5; }
  label { display:block; color:#d4d4d8; font-size:13px; font-weight:600; margin-bottom:6px; }
  input { width:100%; padding:12px; font-size:16px; letter-spacing:2px; text-align:center; text-transform:uppercase;
    background:#1a1a2e; border:2px solid #27272a; border-radius:8px; color:#f97316; outline:none; box-sizing:border-box; }
  input:focus { border-color:#f97316; box-shadow:0 0 12px rgba(249,115,22,0.2); }
  button { width:100%; padding:12px; font-size:15px; font-weight:700; background:linear-gradient(135deg,#f97316,#d97706);
    color:#fff; border:none; border-radius:8px; cursor:pointer; margin-top:16px; }
  button:hover { opacity:0.9; }
  .info { color:#71717a; font-size:11px; text-align:center; margin-top:16px; }
  .error { color:#ef4444; font-size:12px; text-align:center; margin-top:8px; display:none; }
  .attempts { color:#f59e0b; font-size:11px; text-align:center; margin-top:4px; }
</style></head><body>
  <h2>Product Activation Required</h2>
  <p>Enter your Product Key to activate SAI Rolotech Smart Engines.<br>Contact SAI Rolotech if you don't have a key.</p>
  <label>Product Key</label>
  <input type="text" id="key" placeholder="XXXX-XXXX-XXXX-XXXX" autofocus>
  <div class="error" id="err">Invalid Product Key. Please try again.</div>
  <div class="attempts">Attempts remaining: ${remaining}</div>
  <button onclick="activate()">Activate</button>
  <div class="info">Email: support@sairolotech.com</div>
  <script>
    function activate() {
      const key = document.getElementById('key').value.trim();
      if (!key) { document.getElementById('err').style.display='block'; document.getElementById('err').textContent='Please enter a product key.'; return; }
      document.title = 'KEY:' + key;
    }
    document.getElementById('key').addEventListener('keydown', function(e) { if (e.key === 'Enter') activate(); });
  </script>
</body></html>`;

    promptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    promptWindow.setMenu(null);

    const enteredKey = await new Promise<string | null>((resolve) => {
      let resolved = false;

      promptWindow.on("page-title-updated", (_e, title) => {
        if (title.startsWith("KEY:")) {
          const key = title.substring(4);
          resolved = true;
          promptWindow.close();
          resolve(key);
        }
      });

      promptWindow.on("closed", () => {
        if (!resolved) resolve(null);
      });
    });

    if (!enteredKey) {
      return false;
    }

    if (isValidLicenseKey(enteredKey)) {
      saveLicenseKey(enteredKey.trim().toUpperCase());
      console.log("[License] Product activated successfully");
      return true;
    }

    attempts++;
    if (attempts < maxAttempts) {
      dialog.showMessageBoxSync({
        type: "warning",
        title: "Invalid Product Key",
        message: `The product key you entered is not valid.\n\nAttempts remaining: ${maxAttempts - attempts}\n\nPlease check your key and try again.`,
        buttons: ["Try Again"],
      });
    }
  }

  dialog.showMessageBoxSync({
    type: "error",
    title: "Activation Failed",
    message: "Maximum activation attempts exceeded.\n\nPlease contact SAI Rolotech for a valid product key.\n\nEmail: support@sairolotech.com",
    buttons: ["Exit"],
  });

  return false;
}

app.whenReady().then(async () => {
  appIsReady = true;

  // Force dark mode
  nativeTheme.themeSource = "dark";

  console.log(`[App] Starting ${APP_NAME} v${APP_VERSION}`);
  console.log(`[App] isDev=${IS_DEV}, platform=${process.platform}`);

  // Verify license key before anything else
  const licensed = await verifyLicense();
  if (!licensed) {
    app.quit();
    return;
  }

  // Start API server
  await startApiServer();

  // Create window
  buildAppMenu();
  createMainWindow();
  createTray();
  setupIPC();

  if (!IS_DEV) {
    setupAutoUpdater();
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 10000);
  }

  // Global shortcut: Ctrl+Shift+R = quick reload
  try {
    globalShortcut.register("Ctrl+Shift+R", () => mainWindow?.webContents.reload());
  } catch (e) {
    console.warn("[Shortcut] Could not register Ctrl+Shift+R:", e);
  }

  app.on("activate", () => {
    if (!mainWindow) createMainWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  stopApiServer();
  if (appIsReady) {
    try { globalShortcut.unregisterAll(); } catch { /* ignore */ }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    isQuitting = true;
    stopApiServer();
    app.quit();
  }
});

app.on("will-quit", () => {
  stopApiServer();
});

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  // Another instance is running — just bring it to front and exit quietly
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── Global Process-Level Crash Shield ───────────────────────────────────────
// This is the final safety net — like AutoCAD/SolidWorks crash recovery.
// It catches ANY uncaught error in the main process and prevents silent death.

process.on("uncaughtException", (error: Error) => {
  console.error("[FATAL] Uncaught Exception:", error.stack ?? error.message);
  _logCrash(`uncaughtException: ${error.stack ?? error.message}`);

  // Never crash if it's the globalShortcut-before-ready error
  if (error.message?.includes("globalShortcut") || error.message?.includes("before the app is ready")) {
    console.warn("[Recovery] Ignored early globalShortcut error — app continues.");
    return; // swallow, continue running
  }

  // For other fatal errors, show recovery dialog if app is ready
  if (appIsReady && mainWindow) {
    try {
      dialog.showErrorBox(
        "SAI Rolotech — Error Recovered",
        `An unexpected error occurred but was caught safely.\n\nError: ${error.message}\n\nThe application will continue. If problems persist, use File → Restart.`
      );
    } catch { /* dialog may fail too — ignore */ }
  }
  // DO NOT call process.exit() — let Electron try to recover
});

process.on("unhandledRejection", (reason: unknown) => {
  const msg = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
  console.error("[FATAL] Unhandled Promise Rejection:", msg);
  _logCrash(`unhandledRejection: ${msg}`);
  // Don't exit — log and continue
});
