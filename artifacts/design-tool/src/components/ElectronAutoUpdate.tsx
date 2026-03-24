import { useState, useEffect } from "react";
import { Download, RefreshCw, CheckCircle, X, Zap, AlertCircle } from "lucide-react";
import { useAppVersion } from "@/lib/appVersion";

type UpdateState = "idle" | "checking" | "available" | "downloading" | "ready" | "error" | "latest";

interface UpdateInfo {
  version?: string;
  percent?: number;
  error?: string;
}

const isElectron = () => !!(window as any).electronAPI?.checkForUpdates;

export function ElectronAutoUpdate() {
  const currentVersion = useAppVersion();
  const [state, setState] = useState<UpdateState>("idle");
  const [info, setInfo] = useState<UpdateInfo>({});
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!isElectron()) return;

    const api = (window as any).electronAPI;

    api.onUpdateAvailable?.((data: { version: string; releaseDate: string }) => {
      setInfo({ version: data.version });
      setState("available");
      setVisible(true);
      setMinimized(false);
    });

    api.onUpdateDownloadProgress?.((data: { percent: number; bytesPerSecond: number }) => {
      setInfo(prev => ({ ...prev, percent: Math.round(data.percent) }));
      setState("downloading");
      setVisible(true);
    });

    api.onUpdateDownloaded?.((data: { version: string }) => {
      setInfo(prev => ({ ...prev, version: data.version }));
      setState("ready");
      setVisible(true);
      setMinimized(false);
    });

    api.onUpdateError?.((data: { message: string }) => {
      setInfo({ error: data.message });
      setState("error");
    });

    api.onUpdateNotAvailable?.(() => {
      setState("latest");
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    });
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
    }
  };

  const installNow = () => {
    if (!(window as any).electronAPI) return;
    (window as any).electronAPI.showNotification?.({
      title: "SAI Rolotech Update",
      message: "App restart ho rahi hai — update install ho raha hai..."
    });
    setTimeout(() => {
      (window as any).electronAPI?.quitAndInstall?.();
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
                onClick={checkForUpdates}
                className="w-full py-2 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg,#f97316,#d97706)", color: "white" }}
              >
                <Download size={13} />
                Auto Download & Install
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
            {state === "idle" && (
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
