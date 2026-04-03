import { useState, useEffect, useRef } from "react";
import { Download, RefreshCw, CheckCircle, X, Zap, AlertCircle } from "lucide-react";
import { useAppVersion } from "@/lib/appVersion";

type UpdateState = "idle" | "checking" | "available" | "downloading" | "ready" | "countdown" | "error" | "latest";

interface UpdateInfo {
  version?: string;
  percent?: number;
  error?: string;
  countdown?: number;
}

const isElectron = () => !!(window as any).electronAPI?.checkForUpdates;

export function ElectronAutoUpdate() {
  const currentVersion = useAppVersion();
  const [state, setState] = useState<UpdateState>("idle");
  const [info, setInfo] = useState<UpdateInfo>({});
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!isElectron()) return;

    const api = (window as any).electronAPI;

    const onAvailable = (data: { version: string; releaseDate: string }) => {
      setInfo({ version: data.version });
      setState("available");
      setVisible(true);
      setMinimized(false);
    };

    const onProgress = (data: { percent: number; bytesPerSecond: number }) => {
      setInfo(prev => ({ ...prev, percent: Math.round(data.percent) }));
      setState("downloading");
      setVisible(true);
    };

    const onDownloaded = (data: { version: string }) => {
      setInfo(prev => ({ ...prev, version: data.version }));
      setState("ready");
      setVisible(true);
      setMinimized(false);
    };

    const onError = (data: { message: string }) => {
      setInfo({ error: data.message });
      setState("error");
      setVisible(true);
    };

    const onNotAvailable = () => {
      setState("latest");
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    };

    const onCountdown = (data: { seconds: number; version: string }) => {
      setInfo(prev => ({ ...prev, version: data.version, countdown: data.seconds }));
      setState("countdown");
      setVisible(true);
      setMinimized(false);
    };

    api.onUpdateAvailable?.(onAvailable);
    api.onUpdateDownloadProgress?.(onProgress);
    api.onUpdateDownloaded?.(onDownloaded);
    api.onUpdateError?.(onError);
    api.onUpdateNotAvailable?.(onNotAvailable);
    api.onUpdateCountdown?.(onCountdown);

    const { ipcRenderer } = (window as any).require?.("electron") ?? {};
    if (ipcRenderer) {
      cleanupRef.current = [
        () => ipcRenderer.removeListener("update-available", onAvailable),
        () => ipcRenderer.removeListener("update-download-progress", onProgress),
        () => ipcRenderer.removeListener("update-downloaded", onDownloaded),
        () => ipcRenderer.removeListener("update-error", onError),
        () => ipcRenderer.removeListener("update-not-available", onNotAvailable),
        () => ipcRenderer.removeListener("update-countdown", onCountdown),
      ];
    }

    return () => {
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current = [];
    };
  }, []);

  const checkForUpdates = async () => {
    if (!isElectron()) return;
    setState("checking");
    setVisible(true);
    setMinimized(false);
    try {
      await (window as any).electronAPI.checkForUpdates();
    } catch {
      setState("error");
      setInfo({ error: "Update check fail hua. Internet check karein." });
      setVisible(true);
    }
  };

  const startDownload = async () => {
    if (!isElectron()) return;
    setState("downloading");
    setInfo(prev => ({ ...prev, percent: 0 }));
    try {
      await (window as any).electronAPI.downloadUpdate?.();
    } catch {
      setState("error");
      setInfo({ error: "Download start nahi ho saka." });
    }
  };

  const installNow = () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    api.showNotification?.("SAI Rolotech Update", "App restart ho rahi hai — update install ho raha hai...");
    setTimeout(() => {
      api.quitAndInstall?.();
    }, 800);
  };

  if (!isElectron()) return null;

  if (!visible && state === "idle") return (
    <button
      onClick={checkForUpdates}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:scale-105 active:scale-95"
      style={{ background: "rgba(15,15,25,0.85)", border: "1px solid rgba(249,115,22,0.3)", color: "#f97316", backdropFilter: "blur(8px)" }}
      title="Check for Updates"
    >
      <RefreshCw size={11} />
      {currentVersion}
    </button>
  );

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 rounded-xl shadow-2xl transition-all"
      style={{
        width: minimized ? "auto" : 320,
        background: "rgba(8,8,16,0.95)",
        border: "1px solid rgba(249,115,22,0.4)",
        backdropFilter: "blur(16px)",
      }}
    >
      {minimized ? (
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 px-3 py-2 text-[11px] font-medium"
          style={{ color: "#f97316" }}
        >
          <Download size={11} className="animate-bounce" />
          Update available — click to see
        </button>
      ) : (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f97316,#d97706)" }}>
                <Zap size={12} color="white" />
              </div>
              <span className="text-[12px] font-semibold" style={{ color: "#f1f5f9" }}>
                SAI Rolotech Update
              </span>
            </div>
            <div className="flex gap-1">
              {(state === "available" || state === "downloading") && (
                <button onClick={() => setMinimized(true)} className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: "#71717a" }}>
                  <X size={12} />
                </button>
              )}
              {(state === "idle" || state === "latest" || state === "error") && (
                <button onClick={() => setVisible(false)} className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: "#71717a" }}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {state === "checking" && (
            <div className="flex items-center gap-2">
              <RefreshCw size={13} className="animate-spin" style={{ color: "#f97316" }} />
              <span className="text-[11px]" style={{ color: "#a1a1aa" }}>GitHub se latest version check ho raha hai...</span>
            </div>
          )}

          {state === "latest" && (
            <div className="flex items-center gap-2">
              <CheckCircle size={13} style={{ color: "#34d399" }} />
              <span className="text-[11px]" style={{ color: "#a1a1aa" }}>
                {currentVersion} — Aap latest version pe hain ✓
              </span>
            </div>
          )}

          {state === "available" && (
            <>
              <div className="mb-3">
                <div className="text-[11px] mb-1" style={{ color: "#a1a1aa" }}>
                  Naya version available hai
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px]" style={{ color: "#52525b" }}>{currentVersion}</span>
                  <span style={{ color: "#52525b", fontSize: 9 }}>→</span>
                  <span className="text-[13px] font-bold" style={{ color: "#f97316" }}>v{info.version}</span>
                </div>
              </div>
              <button
                onClick={startDownload}
                className="w-full py-2 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg,#f97316,#d97706)", color: "white" }}
              >
                <Download size={13} />
                Download & Auto Install
              </button>
            </>
          )}

          {state === "downloading" && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px]" style={{ color: "#a1a1aa" }}>
                  v{info.version} download ho raha hai...
                </span>
                <span className="text-[12px] font-bold" style={{ color: "#f97316" }}>{info.percent ?? 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(249,115,22,0.15)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${info.percent ?? 0}%`,
                    background: "linear-gradient(90deg,#f97316,#fbbf24)"
                  }}
                />
              </div>
              <p className="text-[10px]" style={{ color: "#52525b" }}>
                Download complete hone ke baad auto install ho jayega
              </p>
            </>
          )}

          {state === "countdown" && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative w-9 h-9 flex-shrink-0">
                  <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(249,115,22,0.15)" strokeWidth="3"/>
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#f97316" strokeWidth="3"
                      strokeDasharray={`${((info.countdown ?? 30) / 30) * 94} 94`}
                      style={{ transition: "stroke-dasharray 1s linear" }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color: "#f97316" }}>
                    {info.countdown}
                  </span>
                </div>
                <div>
                  <div className="text-[12px] font-semibold" style={{ color: "#f1f5f9" }}>
                    Auto Install {info.countdown}s mein!
                  </div>
                  <div className="text-[10px]" style={{ color: "#71717a" }}>v{info.version} install ho raha hai</div>
                </div>
              </div>
              <button
                onClick={installNow}
                className="w-full py-2 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "white" }}
              >
                <Zap size={13} />
                Abhi Install Karo (Skip Countdown)
              </button>
            </>
          )}

          {state === "ready" && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={14} style={{ color: "#34d399" }} />
                <div>
                  <div className="text-[12px] font-semibold" style={{ color: "#f1f5f9" }}>
                    v{info.version} ready hai!
                  </div>
                  <div className="text-[10px]" style={{ color: "#71717a" }}>App restart hogi — 2 second lagenge</div>
                </div>
              </div>
              <button
                onClick={installNow}
                className="w-full py-2 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 animate-pulse"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "white" }}
              >
                <Zap size={13} />
                Abhi Install Karo & Restart
              </button>
              <button
                onClick={() => setMinimized(true)}
                className="w-full mt-1.5 py-1.5 rounded-lg text-[10px] transition-colors hover:bg-white/5"
                style={{ color: "#52525b" }}
              >
                Baad mein (app band karne par auto install)
              </button>
            </>
          )}

          {state === "error" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={13} style={{ color: "#f87171" }} />
                <span className="text-[11px]" style={{ color: "#f87171" }}>Update check fail hua</span>
              </div>
              <p className="text-[10px] mb-3" style={{ color: "#71717a" }}>
                {info.error || "Internet connection check karein"}
              </p>
              <button
                onClick={checkForUpdates}
                className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-all hover:opacity-90"
                style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}
              >
                <RefreshCw size={11} className="inline mr-1.5" />
                Dobara Try Karo
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[9px]" style={{ color: "#3f3f46" }}>Current: {currentVersion}</span>
            {(state === "idle" || state === "latest") && (
              <button
                onClick={checkForUpdates}
                className="text-[10px] flex items-center gap-1 transition-colors hover:opacity-80"
                style={{ color: "#f97316" }}
              >
                <RefreshCw size={9} />
                Check for Update
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
