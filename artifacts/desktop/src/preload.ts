import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {

  saveFile: (content: string, defaultName: string, filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke("save-file", { content, defaultName, filters }),

  openFile: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke("open-file", { filters }),

  getAppInfo: () => ipcRenderer.invoke("get-app-info"),

  getGpuInfo: () => ipcRenderer.invoke("get-gpu-info"),

  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),

  getUpdateSettings: () => ipcRenderer.invoke("get-update-settings"),

  setUpdateSettings: (settings: { checkFrequency?: string; autoDownload?: boolean }) =>
    ipcRenderer.invoke("set-update-settings", settings),

  getUpdateHistory: () => ipcRenderer.invoke("get-update-history"),

  onUpdateAvailable: (callback: (data: { version: string; releaseDate: string; releaseNotes: string }) => void) => {
    ipcRenderer.on("update-available", (_event, data) => callback(data));
  },

  onUpdateDownloadProgress: (callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => {
    ipcRenderer.on("update-download-progress", (_event, data) => callback(data));
  },

  onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
    ipcRenderer.on("update-downloaded", (_event, data) => callback(data));
  },

  onUpdateError: (callback: (data: { message: string }) => void) => {
    ipcRenderer.on("update-error", (_event, data) => callback(data));
  },

  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on("update-not-available", () => callback());
  },

  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),

  onUpdateCountdown: (callback: (data: { seconds: number; version: string }) => void) => {
    ipcRenderer.on("update-countdown", (_event, data) => callback(data));
  },

  showNotification: (title: string, message: string) =>
    ipcRenderer.send("show-notification", { title, message }),

  isElectron: true,

  apiBaseUrl: `http://localhost:3001`,
});

declare global {
  interface Window {
    electronAPI?: {
      saveFile:          (content: string, defaultName: string, filters?: { name: string; extensions: string[] }[]) => Promise<{ success: boolean; filePath?: string }>;
      openFile:          (filters?: { name: string; extensions: string[] }[]) => Promise<{ success: boolean; content: string | null; filePath?: string }>;
      getAppInfo:        () => Promise<{ name: string; version: string; apiPort: number; isDev: boolean; platform: string; arch: string }>;
      getGpuInfo:        () => Promise<unknown>;
      getSystemInfo:     () => Promise<{
        cpu: { model: string; cores: number; speed: number; usage: number };
        memory: { total: number; free: number; used: number; percent: number };
        app: { memoryUsage: NodeJS.MemoryUsage; uptime: number; pid: number };
        os: { platform: string; release: string; hostname: string; arch: string; uptime: number };
      }>;
      checkForUpdates:   () => Promise<void>;
      getUpdateSettings: () => Promise<{ checkFrequency: string; autoDownload: boolean }>;
      setUpdateSettings: (settings: { checkFrequency?: string; autoDownload?: boolean }) => Promise<{ checkFrequency: string; autoDownload: boolean }>;
      getUpdateHistory:  () => Promise<{ version: string; action: string; timestamp: string; success: boolean }[]>;
      onUpdateAvailable: (callback: (data: { version: string; releaseDate: string; releaseNotes: string }) => void) => void;
      onUpdateDownloadProgress: (callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => void;
      onUpdateDownloaded: (callback: (data: { version: string }) => void) => void;
      onUpdateError:     (callback: (data: { message: string }) => void) => void;
      onUpdateNotAvailable: (callback: () => void) => void;
      quitAndInstall:    () => Promise<void>;
      showNotification:  (title: string, message: string) => void;
      isElectron:        true;
      apiBaseUrl:        string;
    };
  }
}
