import { useState, useEffect } from "react";
import { authFetch } from "../lib/auth-fetch";

export interface NetworkStatus {
  isOnline: boolean;
  isApiReachable: boolean;
  aiMode: "offline" | "online";
  lastChecked: Date;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isApiReachable: true,
    aiMode: "offline",
    lastChecked: new Date(),
  });

  useEffect(() => {
    const checkApi = async () => {
      try {
        const r = await authFetch("/api/ai/status", { signal: AbortSignal.timeout(2000) });
        const data = await r.json();
        setStatus({
          isOnline: navigator.onLine,
          isApiReachable: r.ok,
          aiMode: data.offlineMode ? "offline" : "online",
          lastChecked: new Date(),
        });
      } catch {
        setStatus(prev => ({
          ...prev,
          isOnline: navigator.onLine,
          isApiReachable: false,
          lastChecked: new Date(),
        }));
      }
    };

    checkApi();

    const handleOnline  = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(checkApi, 30_000);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return status;
}
