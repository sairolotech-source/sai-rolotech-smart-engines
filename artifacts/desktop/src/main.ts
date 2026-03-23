/**
 * SAI Rolotech Smart Engines  -  Electron Main Process
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
  shell, nativeTheme, nativeImage, globalShortcut, net,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import { spawn, ChildProcess, execSync } from "child_process";
import { autoUpdater } from "electron-updater";

// --- GPU Acceleration Flags --------------------------------------------------

app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-webgpu");
app.commandLine.appendSwitch("use-angle", "d3d11");
app.commandLine.appendSwitch("enable-features", "VaapiVideoDecoder,VaapiVideoEncoder");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-accelerated-video-decode");

// --- Constants ---------------------------------------------------------------

const APP_NAME    = "SAI Rolotech Smart Engines";
const APP_VERSION = app.getVersion();
const API_PORT    = 3001;
const IS_DEV      = process.env.NODE_ENV === "development" || !app.isPackaged;
const IS_WIN      = process.platform === "win32";

// --- Valid License Keys (offline fallback) -----------------------------------
const VALID_LICENSE_KEYS = new Set([
  "SAIR-2026-ROLL-FORM",
  "SAIR-2026-ENGI-NEER",
  "SAIR-2026-PREM-IUMS",
  "SAIR-PRO-2026-MSTR",
  "SAIR-DEMO-2026-TRIAL",
]);

// --- Admin Server URL --------------------------------------------------------
const ADMIN_SERVER_URL = "https://sairolotech.com";
const OFFLINE_GRACE_DAYS = 7;

// --- State -------------------------------------------------------------------

let mainWindow:     BrowserWindow | null = null;
let tray:           Tray         | null = null;
let apiProcess:     ChildProcess | null = null;
let isQuitting       = false;
let apiReady         = false;
let appIsReady       = false;   // guards globalShortcut usage
let updateDownloadProgress = 0;

// --- Resource paths ----------------------------------------------------------

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

// --- API Server --------------------------------------------------------------

function startApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (IS_DEV) {
      const serverScript = path.join(__dirname, "..", "..", "api-server", "src", "index.ts");
      const cmd = "tsx";
      const args = [serverScript];
      const env = { ...process.env, NODE_ENV: "production", PORT: String(API_PORT), ELECTRON: "1" };

      console.log(`[API] Starting dev server: ${cmd} ${serverScript}`);
      apiProcess = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"], detached: false, windowsHide: true });

      const timeout = setTimeout(() => { if (!apiReady) { console.error("[API] Timeout"); resolve(); } }, 8000);
      apiProcess.stdout?.on("data", (data: Buffer) => {
        const msg = data.toString();
        console.log(`[API] ${msg.trim()}`);
        if (msg.includes("listening") || msg.includes(String(API_PORT))) { clearTimeout(timeout); apiReady = true; resolve(); }
      });
      apiProcess.stderr?.on("data", (data: Buffer) => {
        const msg = data.toString();
        if (!msg.includes("DeprecationWarning") && !msg.includes("ExperimentalWarning")) console.error(`[API ERR] ${msg.trim()}`);
      });
      apiProcess.on("error", (err) => { console.error("[API] Spawn error:", err); clearTimeout(timeout); resolve(); });
      apiProcess.on("exit", (code) => { console.log(`[API] Exited with code ${code}`); });
    } else {
      const serverScript = path.join(process.resourcesPath, "api-server", "index.cjs");
      console.log(`[API] Loading server in-process: ${serverScript}`);

      process.env.NODE_ENV = "production";
      process.env.PORT = String(API_PORT);
      process.env.ELECTRON = "1";
      process.env.FRONTEND_DIST = path.join(process.resourcesPath, "frontend");

      try {
        require(serverScript);
        console.log("[API] Server module loaded  -  waiting for port...");
        const checkReady = (attempt: number) => {
          const http = require("http");
          const req = http.get(`http://localhost:${API_PORT}`, (res: any) => {
            res.resume();
            if (res.statusCode === 200) {
              apiReady = true;
              console.log(`[API] Server ready on port ${API_PORT}`);
              resolve();
            } else if (attempt < 20) {
              setTimeout(() => checkReady(attempt + 1), 500);
            } else {
              console.error("[API] Server responded but not 200");
              resolve();
            }
          });
          req.on("error", () => {
            if (attempt < 20) setTimeout(() => checkReady(attempt + 1), 500);
            else { console.error("[API] Server never became ready"); resolve(); }
          });
          req.setTimeout(1000, () => { req.destroy(); });
        };
        setTimeout(() => checkReady(0), 300);
      } catch (err) {
        console.error("[API] Failed to load server module:", err);
        resolve();
      }
    }
  });
}

function stopApiServer(): void {
  if (apiProcess) {
    apiProcess.kill("SIGTERM");
    apiProcess = null;
  }
}

// --- Crash Logger -------------------------------------------------------------

function _logCrash(detail: string): void {
  try {
    const logDir  = appIsReady ? app.getPath("logs") : os.tmpdir();
    const logFile = path.join(logDir, "sai-rolotech-crash.log");
    const entry   = `[${new Date().toISOString()}] ${detail}\n`;
    fs.appendFileSync(logFile, entry, "utf8");
  } catch { /* never throw from crash handler */ }
}

// --- Browser Window ----------------------------------------------------------

async function createMainWindow(): Promise<void> {
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

  // -- Load content --
  if (IS_DEV) {
    mainWindow.loadURL("http://localhost:5000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const serverUrl = `http://localhost:${API_PORT}`;
    const maxRetries = 10;
    let loaded = false;

    for (let i = 0; i < maxRetries && !loaded; i++) {
      try {
        const ok = await new Promise<boolean>((resolve) => {
          const http = require("http");
          const req = http.get(serverUrl, (res: any) => {
            resolve(res.statusCode === 200);
            res.resume();
          });
          req.on("error", () => resolve(false));
          req.setTimeout(2000, () => { req.destroy(); resolve(false); });
        });
        if (ok) {
          await mainWindow.loadURL(serverUrl);
          loaded = true;
          console.log(`[App] Frontend loaded from API server (attempt ${i + 1})`);
        } else {
          console.log(`[App] Waiting for API server... attempt ${i + 1}/${maxRetries}`);
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch {
        console.log(`[App] API server not ready, retrying... ${i + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!loaded) {
      console.log("[App] API server unavailable  -  loading frontend from local files");
      const indexPath = path.join(process.resourcesPath, "frontend", "index.html");
      if (fs.existsSync(indexPath)) {
        await mainWindow.loadFile(indexPath);
      } else {
        const errorHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          body{margin:0;padding:40px;background:#070710;color:#e4e4e7;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;}
          h1{color:#f97316;font-size:24px;margin-bottom:12px;}
          p{color:#a1a1aa;font-size:14px;line-height:1.6;max-width:500px;}
          code{background:#1a1a2e;padding:4px 8px;border-radius:4px;color:#f59e0b;font-size:12px;}
          button{margin-top:20px;padding:12px 24px;background:#f97316;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;}
          </style></head><body>
          <h1>SAI Rolotech Smart Engines</h1>
          <p>The application server could not start.<br>This may happen on first run  -  please try again.</p>
          <p>If the problem persists, reinstall the application or contact:<br><code>support@sairolotech.com</code></p>
          <button onclick="window.location.reload()">Retry</button>
          </body></html>`;
        await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
      }
    }
  }

  // -- Window events --
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (IS_WIN && mainWindow) {
      // Windows Mica/Acrylic effect (Windows 11)
      try {
        const { setMica } = require("electron-acrylic-window");
        setMica(mainWindow);
      } catch { /* Not available  -  no issue */ }
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

  // -- Renderer crash protection ----------------------------------------------

  // Renderer gone (crash / OOM / killed)
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    const { reason, exitCode } = details;
    console.error(`[Renderer] Gone  -  reason=${reason} exitCode=${exitCode}`);
    _logCrash(`render-process-gone: reason=${reason} exitCode=${exitCode}`);

    if (isQuitting || reason === "clean-exit") return;

    dialog.showMessageBox({
      type:      "error",
      title:     "SAI Rolotech  -  Recovering",
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
      title:     "SAI Rolotech  -  Not Responding",
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

// --- System Tray -------------------------------------------------------------

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
      label: "Smart Diagnose",
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
      label: `Quit ${APP_NAME}`,
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

// --- Application Menu ---------------------------------------------------------

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "&File",
      submenu: [
        {
          label: "Open DXF Profile...",
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
          label: "Save G-Code...",
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
          label: "Export Project...",
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
          label: "Import Project...",
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
          label: "Smart Engine Status",
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
              detail:  `SAI Rolotech Smart Engines  -  Roll Forming Engineering Suite\n\nFeatures:\n* FormAxis-grade Power Pattern Generation\n* Roll Tooling Design & CAM Plan\n* AutoCAD DXF 2D Export\n* G-Code Output (RAW + FINAL split)\n* Smart Defect Diagnosis (offline)\n* Digital Twin Simulation\n* Factory Smart Engine  -  8 Production Modules\n* Arc Calculator & SimCam Profile Builder\n* Auto-Update from GitHub Releases\n\nBuilt for Windows 10/11 x 64-bit\n(c) 2026 SAI Rolotech Smart Engines`,
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

// --- IPC Handlers (renderer -> main communication) -----------------------------

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

// --- Auto Updater -------------------------------------------------------------

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
      detail:  `SAI Rolotech Smart Engines ka naya version available hai!\n\n${releaseNotes ? "Release Notes:\n" + releaseNotes.slice(0, 500) : "Download karna chahte hain?"}`,
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
      message: `Version ${info.version} download ho gaya! Restart karein to install ho jaayega.`,
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

// --- App Lifecycle ------------------------------------------------------------

// --- License Key Verification ------------------------------------------------

const DEMO_KEY = "SAIR-DEMO-2026-TRIAL";
const DEMO_TRIAL_HOURS = 24;
const ENCRYPTION_SECRET = "S41-R0L0T3CH-SM4RT-3NG1N3S-2026-X9K";
const RUNTIME_CHECK_INTERVAL = 15 * 60 * 1000;
let runtimeCheckTimer: ReturnType<typeof setInterval> | null = null;

function getLicenseKeyPath(): string {
  return path.join(app.getPath("userData"), "license-key.dat");
}

function getTrialTimestampPath(): string {
  return path.join(app.getPath("userData"), ".trial-ts");
}

function getHardwareIdPath(): string {
  return path.join(app.getPath("userData"), ".hw-bind");
}

function getIntegrityPath(): string {
  return path.join(app.getPath("userData"), ".integrity");
}

function encryptData(data: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_SECRET, "sai-salt-2026", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptData(encrypted: string): string | null {
  try {
    const [ivHex, data] = encrypted.split(":");
    if (!ivHex || !data) return null;
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(ENCRYPTION_SECRET, "sai-salt-2026", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

function getHardwareId(): string {
  const parts: string[] = [];
  parts.push(os.hostname());
  parts.push(os.platform());
  parts.push(os.arch());
  parts.push(String(os.cpus().length));
  parts.push(os.cpus()[0]?.model ?? "unknown");
  parts.push(String(os.totalmem()));
  if (IS_WIN) {
    try {
      const serial = execSync('wmic baseboard get serialnumber', { encoding: "utf8", windowsHide: true });
      parts.push(serial.replace(/\s+/g, "").replace("SerialNumber", ""));
    } catch { /* ignore */ }
    try {
      const diskId = execSync('wmic diskdrive get serialnumber', { encoding: "utf8", windowsHide: true });
      parts.push(diskId.replace(/\s+/g, "").replace("SerialNumber", ""));
    } catch { /* ignore */ }
    try {
      const biosSerial = execSync('wmic bios get serialnumber', { encoding: "utf8", windowsHide: true });
      parts.push(biosSerial.replace(/\s+/g, "").replace("SerialNumber", ""));
    } catch { /* ignore */ }
  }
  const raw = parts.join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").substring(0, 32);
}

function verifyHardwareBinding(): boolean {
  try {
    const hwPath = getHardwareIdPath();
    if (!fs.existsSync(hwPath)) return true;
    const savedEncrypted = fs.readFileSync(hwPath, "utf8").trim();
    const savedHwId = decryptData(savedEncrypted);
    if (!savedHwId) return false;
    const currentHwId = getHardwareId();
    return savedHwId === currentHwId;
  } catch {
    return false;
  }
}

function saveHardwareBinding(): void {
  try {
    const hwId = getHardwareId();
    fs.writeFileSync(getHardwareIdPath(), encryptData(hwId), "utf8");
  } catch { /* ignore */ }
}

function generateIntegrityHash(): string {
  const exePath = app.getPath("exe");
  const mainJsPath = IS_DEV ? __filename : path.join(app.getAppPath(), "dist", "main.js");
  const parts: string[] = [];
  parts.push(exePath);
  parts.push(APP_VERSION);
  try {
    if (fs.existsSync(mainJsPath)) {
      const stat = fs.statSync(mainJsPath);
      parts.push(String(stat.size));
      parts.push(String(stat.mtimeMs));
    }
  } catch { /* ignore */ }
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

function saveIntegrity(): void {
  try {
    const hash = generateIntegrityHash();
    fs.writeFileSync(getIntegrityPath(), encryptData(hash), "utf8");
  } catch { /* ignore */ }
}

function verifyIntegrity(): boolean {
  try {
    const intPath = getIntegrityPath();
    if (!fs.existsSync(intPath)) return true;
    const savedEncrypted = fs.readFileSync(intPath, "utf8").trim();
    const savedHash = decryptData(savedEncrypted);
    if (!savedHash) return false;
    const currentHash = generateIntegrityHash();
    return savedHash === currentHash;
  } catch {
    return false;
  }
}

function saveLicenseEncrypted(key: string): void {
  try {
    const payload = JSON.stringify({
      key: key,
      hw: getHardwareId(),
      ts: Date.now(),
      v: APP_VERSION,
    });
    fs.writeFileSync(getLicenseKeyPath(), encryptData(payload), "utf8");
  } catch { /* ignore */ }
}

function loadLicenseEncrypted(): { key: string; hw: string; ts: number } | null {
  try {
    const raw = fs.readFileSync(getLicenseKeyPath(), "utf8").trim();
    if (raw.includes(":")) {
      const decrypted = decryptData(raw);
      if (!decrypted) return null;
      return JSON.parse(decrypted);
    }
    return { key: raw, hw: getHardwareId(), ts: Date.now() };
  } catch {
    return null;
  }
}

function startRuntimeLicenseCheck(): void {
  if (runtimeCheckTimer) return;
  runtimeCheckTimer = setInterval(async () => {
    console.log("[Security] Runtime license check...");
    const hwId = getHardwareId();

    // Check new token-based activation first
    const activation = loadActivation();
    if (activation && activation.token && activation.hwId === hwId) {
      if (!activation.token.startsWith("OFFLINE-")) {
        const result = await verifyTokenOnline(activation.token, hwId);
        if (result && result.blocked) {
          dialog.showMessageBoxSync({
            type: "error",
            title: "Access Blocked",
            message: `Aapka access admin ne band kar diya hai.\n\n${result.reason || ""}\n\nContact: support@sairolotech.com`,
            buttons: ["Exit"],
          });
          app.quit();
          return;
        }
        if (result && result.active) {
          activation.lastVerifiedAt = new Date().toISOString();
          saveActivation(activation);
        }
      }
      return; // Token-based check done
    }

    // Legacy key check
    const licData = loadLicenseEncrypted();
    if (!licData || !isValidLicenseKey(licData.key)) {
      console.error("[Security] License tampered  -  shutting down");
      dialog.showMessageBoxSync({
        type: "error",
        title: "License Error",
        message: "License verification failed.\n\nThe application will now close.",
        buttons: ["Exit"],
      });
      app.quit();
      return;
    }
    if (licData.key === DEMO_KEY && isTrialExpired()) {
      nukeTrialData();
      dialog.showMessageBoxSync({
        type: "error",
        title: "Demo Trial Expired",
        message: "Your 24-hour demo trial has expired.\n\nContact: support@sairolotech.com",
        buttons: ["Exit"],
      });
      app.quit();
    }
  }, RUNTIME_CHECK_INTERVAL);
}

function saveTrialTimestamp(): void {
  try {
    const ts = Date.now().toString(36) + "x" + Math.random().toString(36).slice(2, 6);
    fs.writeFileSync(getTrialTimestampPath(), encryptData(ts), "utf8");
  } catch { /* ignore */ }
}

function getTrialStartTime(): number | null {
  try {
    const raw = fs.readFileSync(getTrialTimestampPath(), "utf8").trim();
    const decoded = decryptData(raw);
    if (!decoded) return null;
    const tsStr = decoded.split("x")[0];
    return parseInt(tsStr, 36);
  } catch {
    return null;
  }
}

function isTrialExpired(): boolean {
  const startTime = getTrialStartTime();
  if (!startTime) return false;
  const elapsed = Date.now() - startTime;
  return elapsed > DEMO_TRIAL_HOURS * 60 * 60 * 1000;
}

function nukeTrialData(): void {
  try {
    const userDataPath = app.getPath("userData");
    const filesToDelete = [
      getLicenseKeyPath(),
      getTrialTimestampPath(),
      getHardwareIdPath(),
      getIntegrityPath(),
      path.join(userDataPath, "window-bounds.json"),
    ];
    for (const f of filesToDelete) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    const dirsToNuke = ["Local Storage", "Cache", "GPUCache", "Session Storage", "IndexedDB", "Code Cache"];
    for (const dir of dirsToNuke) {
      const fullPath = path.join(userDataPath, dir);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
  } catch { /* ignore */ }
}

function getSavedLicenseKey(): string | null {
  try {
    const licData = loadLicenseEncrypted();
    if (licData && licData.key) return licData.key;
  } catch { /* ignore */ }

  try {
    const keyPath = getLicenseKeyPath();
    if (fs.existsSync(keyPath)) {
      const raw = fs.readFileSync(keyPath, "utf8").trim();
      if (!raw.includes(":")) {
        return raw || null;
      }
    }
  } catch { /* ignore */ }

  if (IS_WIN) {
    try {
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
  saveLicenseEncrypted(key);
  saveHardwareBinding();
  saveIntegrity();
}

function isValidLicenseKey(key: string): boolean {
  return VALID_LICENSE_KEYS.has(key.trim().toUpperCase());
}

// --- Activation Token System (new  -  replaces repeated key prompts) ------------

interface ActivationData {
  token: string;
  hwId: string;
  name: string;
  registeredAt: string;
  lastVerifiedAt: string;
}

function getActivationPath(): string {
  return path.join(app.getPath("userData"), "activation.dat");
}

function saveActivation(data: ActivationData): void {
  const payload = encryptData(JSON.stringify(data));
  fs.writeFileSync(getActivationPath(), payload, "utf8");
}

function loadActivation(): ActivationData | null {
  try {
    const actPath = getActivationPath();
    if (!fs.existsSync(actPath)) return null;
    const raw = fs.readFileSync(actPath, "utf8").trim();
    const decrypted = decryptData(raw);
    if (!decrypted) return null;
    return JSON.parse(decrypted) as ActivationData;
  } catch {
    return null;
  }
}

async function verifyTokenOnline(token: string, hwId: string): Promise<{ active: boolean; blocked?: boolean; reason?: string; name?: string } | null> {
  try {
    const http = require("http") as typeof import("http");
    const https = require("https") as typeof import("https");
    const url = new URL(`${ADMIN_SERVER_URL}/api/license/verify?token=${encodeURIComponent(token)}&hwId=${encodeURIComponent(hwId)}`);
    const mod = url.protocol === "https:" ? https : http;

    return await new Promise((resolve) => {
      const req = mod.get(url.toString(), { timeout: 8000 }, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          try { resolve(JSON.parse(data) as { active: boolean; blocked?: boolean; reason?: string; name?: string }); }
          catch { resolve(null); }
        });
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
    });
  } catch {
    return null;
  }
}

async function registerOnline(payload: {
  key: string; name: string; mobile: string; hwId: string;
  systemInfo: Record<string, string>;
}): Promise<{ ok: boolean; token?: string; message?: string; error?: string; blocked?: boolean } | null> {
  try {
    const https = require("https") as typeof import("https");
    const http = require("http") as typeof import("http");
    const body = JSON.stringify(payload);
    const url = new URL(`${ADMIN_SERVER_URL}/api/license/register`);
    const mod = url.protocol === "https:" ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 12000,
    };

    return await new Promise((resolve) => {
      const req = mod.request(options, (res: import("http").IncomingMessage) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          try { resolve(JSON.parse(data) as { ok: boolean; token?: string; message?: string; error?: string; blocked?: boolean }); }
          catch { resolve(null); }
        });
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    });
  } catch {
    return null;
  }
}

function getSystemInfoForRegistration(): Record<string, string> {
  const cpus = os.cpus();
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    os: os.release(),
    cpu: cpus[0]?.model ?? "Unknown",
    cores: String(cpus.length),
    ram: `${Math.round(os.totalmem() / (1024 ** 3))}GB`,
    appVersion: APP_VERSION,
  };
}

async function showRegistrationForm(prefilledKey?: string): Promise<{ name: string; mobile: string; key: string } | null> {
  const win = new BrowserWindow({
    width: 480, height: 520,
    resizable: false, minimizable: false, maximizable: false, closable: true,
    frame: true, title: "SAI Rolotech  -  Software Registration",
    backgroundColor: "#0a0a1a", icon: getAssetPath("icon.ico"),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  win.setMenu(null);

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  *{box-sizing:border-box;}
  body{margin:0;padding:28px 32px;background:#0a0a1a;color:#e4e4e7;font-family:'Segoe UI',sans-serif;}
  h2{color:#f97316;margin:0 0 4px;font-size:18px;font-weight:700;}
  .sub{color:#71717a;font-size:12px;margin:0 0 22px;}
  label{display:block;color:#d4d4d8;font-size:12px;font-weight:600;margin:0 0 5px;}
  input{width:100%;padding:11px 13px;font-size:14px;background:#1a1a2e;border:2px solid #27272a;
    border-radius:8px;color:#e4e4e7;outline:none;margin-bottom:14px;transition:border .2s;}
  input:focus{border-color:#f97316;}
  #key{letter-spacing:2px;text-transform:uppercase;color:#f59e0b;font-size:15px;text-align:center;}
  #msg{min-height:22px;font-size:12px;text-align:center;margin-bottom:10px;color:#ef4444;}
  #msg.ok{color:#4ade80;}
  button{width:100%;padding:12px;font-size:15px;font-weight:700;
    background:linear-gradient(135deg,#f97316,#d97706);color:#fff;border:none;
    border-radius:8px;cursor:pointer;transition:opacity .2s;}
  button:disabled{opacity:.5;cursor:wait;}
  .foot{color:#52525b;font-size:11px;text-align:center;margin-top:14px;}
  .req{color:#ef4444;}
</style></head><body>
  <h2>* Software Registration</h2>
  <p class="sub">SAI Rolotech Smart Engines  -  Pehli baar apni details daalo</p>
  <label>Aapka Naam <span class="req">*</span></label>
  <input type="text" id="name" placeholder="Poora naam" autocomplete="off">
  <label>Mobile Number <span class="req">*</span></label>
  <input type="tel" id="mobile" placeholder="+92 300 0000000" autocomplete="off">
  <label>License Key <span class="req">*</span></label>
  <input type="text" id="key" placeholder="SAIR-XXXX-XXXX-XXXX" value="${prefilledKey || ""}" autocomplete="off">
  <div id="msg"></div>
  <button id="btn" onclick="submit()">Register &amp; Activate</button>
  <div class="foot">support@sairolotech.com | www.sairolotech.com</div>
  <script>
    function msg(txt, ok) {
      var el = document.getElementById('msg');
      el.textContent = txt; el.className = ok ? 'ok' : '';
    }
    function submit() {
      var n=document.getElementById('name').value.trim();
      var m=document.getElementById('mobile').value.trim();
      var k=document.getElementById('key').value.trim().toUpperCase();
      if(!n){msg('Naam zarori hai');return;}
      if(!m||m.length<7){msg('Sahi mobile number daalo');return;}
      if(!k){msg('License key zarori hai');return;}
      document.getElementById('btn').disabled=true;
      msg('Registering...', true);
      document.title = 'REG:' + JSON.stringify({name:n,mobile:m,key:k});
    }
    document.addEventListener('keydown',function(e){if(e.key==='Enter')submit();});
    document.getElementById('name').focus();
  </script>
</body></html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  return new Promise((resolve) => {
    let resolved = false;
    win.on("page-title-updated", (_e, title) => {
      if (title.startsWith("REG:")) {
        try {
          const data = JSON.parse(title.slice(4)) as { name: string; mobile: string; key: string };
          resolved = true;
          win.close();
          resolve(data);
        } catch { /* ignore */ }
      }
    });
    win.on("closed", () => { if (!resolved) resolve(null); });
  });
}

async function verifyLicense(): Promise<boolean> {
  if (IS_DEV) return true;

  const hwId = getHardwareId();

  // -- Step 1: Check new token-based activation ------------------------------
  const activation = loadActivation();
  if (activation && activation.token && activation.hwId === hwId) {
    console.log("[License] Activation token found  -  verifying online...");

    const result = await verifyTokenOnline(activation.token, hwId);

    if (result === null) {
      // Server unreachable  -  check grace period
      const lastVerified = new Date(activation.lastVerifiedAt).getTime();
      const daysSince = (Date.now() - lastVerified) / (1000 * 60 * 60 * 24);
      if (daysSince <= OFFLINE_GRACE_DAYS) {
        console.log(`[License] Offline  -  grace period active (${daysSince.toFixed(1)} days since last verify)`);
        startRuntimeLicenseCheck();
        return true;
      } else {
        dialog.showMessageBoxSync({
          type: "error",
          title: "License Verification Failed",
          message: `${OFFLINE_GRACE_DAYS} din se server se connect nahi ho raha.\n\nInternet check karein aur dobara try karein.\n\nSupport: support@sairolotech.com`,
          buttons: ["Exit"],
        });
        return false;
      }
    }

    if (result.blocked) {
      dialog.showMessageBoxSync({
        type: "error",
        title: "Access Blocked",
        message: `Aapka software access admin ne band kar diya hai.\n\n${result.reason || ""}\n\nContact: support@sairolotech.com`,
        buttons: ["Exit"],
      });
      return false;
    }

    if (!result.active) {
      console.log("[License] Token invalid  -  need re-registration");
      // Fall through to registration
    } else {
      // Update lastVerifiedAt
      activation.lastVerifiedAt = new Date().toISOString();
      saveActivation(activation);
      console.log(`[License] Verified OK  -  Welcome ${activation.name}`);
      startRuntimeLicenseCheck();
      return true;
    }
  }

  // -- Step 2: Check old license key for migration ----------------------------
  const oldKey = getSavedLicenseKey();
  if (oldKey && isValidLicenseKey(oldKey) && verifyHardwareBinding()) {
    console.log("[License] Old license key found  -  auto-migrating to token system");
    // Silently use the old key for now (will get token on next registration attempt)
    startRuntimeLicenseCheck();
    return true;
  }

  // -- Step 3: Show Registration Form ----------------------------------------
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const formData = await showRegistrationForm();

    if (!formData) {
      // User closed the window
      return false;
    }

    const { name, mobile, key } = formData;
    const systemInfo = getSystemInfoForRegistration();

    // Show "Registering..." message
    const loadingWin = new BrowserWindow({
      width: 360, height: 160, resizable: false, frame: false,
      backgroundColor: "#0a0a1a", alwaysOnTop: true, icon: getAssetPath("icon.ico"),
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    loadingWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
      `<html><body style="margin:0;background:#0a0a1a;display:flex;align-items:center;justify-content:center;height:100vh;font-family:'Segoe UI',sans-serif;color:#f97316;font-size:16px;font-weight:600;">
        ... Server se verify ho raha hai...
      </body></html>`
    )});
    loadingWin.setMenu(null);

    // Call server
    const result = await registerOnline({ key, name, mobile, hwId, systemInfo });
    try { loadingWin.close(); } catch {}

    if (result === null) {
      // Server unreachable  -  check key locally
      if (isValidLicenseKey(key)) {
        const upperKey = key.trim().toUpperCase();
        saveLicenseKey(upperKey);
        // Save partial activation (offline)
        const partialActivation: ActivationData = {
          token: `OFFLINE-${hwId.slice(0, 8)}`,
          hwId,
          name,
          registeredAt: new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString(),
        };
        saveActivation(partialActivation);
        dialog.showMessageBoxSync({
          type: "info",
          title: "Activation (Offline)",
          message: `Welcome ${name}!\n\nSoftware activate ho gaya (offline mode).\nInternet hone par server se automatically register hoga.`,
          buttons: ["Start"],
        });
        startRuntimeLicenseCheck();
        return true;
      } else {
        dialog.showMessageBoxSync({
          type: "error",
          title: "Invalid License Key",
          message: "License key galat hai aur server se bhi connect nahi ho saka.\n\nSahi key daalo ya internet check karo.",
          buttons: ["Try Again"],
        });
        attempts++;
        continue;
      }
    }

    if (result.blocked) {
      dialog.showMessageBoxSync({
        type: "error",
        title: "Access Blocked",
        message: `Aapka access admin ne band kar diya hai.\n\n${result.error || ""}\n\nContact: support@sairolotech.com`,
        buttons: ["Exit"],
      });
      return false;
    }

    if (!result.ok || !result.token) {
      dialog.showMessageBoxSync({
        type: "warning",
        title: "Registration Failed",
        message: `${result.error || result.message || "Registration nahi ho saka."}\n\nAttempts remaining: ${maxAttempts - attempts - 1}`,
        buttons: ["Try Again"],
      });
      attempts++;
      continue;
    }

    // Success! Save activation data
    const newActivation: ActivationData = {
      token: result.token,
      hwId,
      name,
      registeredAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    };
    saveActivation(newActivation);
    saveLicenseKey(key.trim().toUpperCase());
    saveHardwareBinding();

    dialog.showMessageBoxSync({
      type: "info",
      title: "Registration Successful!",
      message: `Welcome ${name}!\n\n${result.message || "Software successfully activate ho gaya!"}\n\nAb update ke baad dobara key nahi maanga jaayega.`,
      buttons: ["Start SAI Rolotech"],
    });

    console.log(`[License] Registered & activated: ${name} | ${mobile}`);
    startRuntimeLicenseCheck();
    return true;
  }

  dialog.showMessageBoxSync({
    type: "error",
    title: "Activation Failed",
    message: "Maximum attempts exceeded.\n\nContact: support@sairolotech.com",
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
  await createMainWindow();
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
  // Another instance is running  -  just bring it to front and exit quietly
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

// --- Global Process-Level Crash Shield ---------------------------------------
// This is the final safety net  -  like AutoCAD/SolidWorks crash recovery.
// It catches ANY uncaught error in the main process and prevents silent death.

process.on("uncaughtException", (error: Error) => {
  console.error("[FATAL] Uncaught Exception:", error.stack ?? error.message);
  _logCrash(`uncaughtException: ${error.stack ?? error.message}`);

  // Never crash if it's the globalShortcut-before-ready error
  if (error.message?.includes("globalShortcut") || error.message?.includes("before the app is ready")) {
    console.warn("[Recovery] Ignored early globalShortcut error  -  app continues.");
    return; // swallow, continue running
  }

  // For other fatal errors, show recovery dialog if app is ready
  if (appIsReady && mainWindow) {
    try {
      dialog.showErrorBox(
        "SAI Rolotech  -  Error Recovered",
        `An unexpected error occurred but was caught safely.\n\nError: ${error.message}\n\nThe application will continue. If problems persist, use File -> Restart.`
      );
    } catch { /* dialog may fail too  -  ignore */ }
  }
  // DO NOT call process.exit()  -  let Electron try to recover
});

process.on("unhandledRejection", (reason: unknown) => {
  const msg = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
  console.error("[FATAL] Unhandled Promise Rejection:", msg);
  _logCrash(`unhandledRejection: ${msg}`);
  // Don't exit  -  log and continue
});
