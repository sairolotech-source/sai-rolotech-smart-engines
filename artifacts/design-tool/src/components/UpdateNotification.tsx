import { useState, useEffect } from "react";
import { Download, X, RefreshCw } from "lucide-react";
import { APP_VERSION_TAG } from "@/lib/appVersion";

const APP_VERSION = APP_VERSION_TAG.replace("v", "");
const VERSION_CHECK_INTERVAL = 30 * 60 * 1000;

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const handleSwUpdate = (e: Event) => {
      const reg = (e as CustomEvent).detail as ServiceWorkerRegistration;
      setSwRegistration(reg);
      setUpdateAvailable(true);
      setDismissed(false);
    };

    window.addEventListener("sw-update-available", handleSwUpdate);
    return () => window.removeEventListener("sw-update-available", handleSwUpdate);
  }, []);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) {
          await reg.update();
          setLastChecked(new Date());
        }
      } catch {}
    };

    const interval = setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.update();
        setLastChecked(new Date());
        if (!reg.installing && !reg.waiting) {
          setUpdateAvailable(false);
        }
      }
    } catch {}
    setTimeout(() => setChecking(false), 1500);
  };

  if (updateAvailable && !dismissed) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-in slide-in-from-bottom-4">
        <div className="bg-gradient-to-r from-orange-500/95 to-amber-500/95 backdrop-blur-lg rounded-xl shadow-2xl shadow-orange-500/30 border border-orange-400/30 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">New Update Available!</p>
              <p className="text-xs text-orange-100 mt-0.5">
                A newer version is ready to install. Update for latest features and fixes.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleUpdate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-50 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3 h-3" />
                  Update Now
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-1.5 text-white/80 hover:text-white text-xs transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            <button onClick={() => setDismissed(true)} className="text-white/60 hover:text-white transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function UpdateChecker() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"idle" | "up-to-date" | "error">("idle");

  const handleCheck = async () => {
    setChecking(true);
    setStatus("idle");
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.update();
        if (!reg.installing && !reg.waiting) {
          setStatus("up-to-date");
        }
      } else {
        setStatus("up-to-date");
      }
    } catch {
      setStatus("error");
    }
    setTimeout(() => setChecking(false), 1000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-300">Current Version</p>
          <p className="text-[10px] text-zinc-500">v{APP_VERSION}</p>
        </div>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking..." : "Check for Updates"}
        </button>
      </div>
      {status === "up-to-date" && (
        <div className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded px-2 py-1">
          App is up to date!
        </div>
      )}
      {status === "error" && (
        <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
          Could not check for updates. Check internet connection.
        </div>
      )}
      <div className="text-[9px] text-zinc-600">
        Auto-checks every 30 minutes. Updates install on next app restart.
      </div>
    </div>
  );
}
