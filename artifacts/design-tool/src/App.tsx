import { useState, useCallback, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import { LandingPage } from "@/pages/LandingPage";
import { Dashboard } from "@/pages/Dashboard";
import DemoVideo from "@/pages/DemoVideo";
import { LoginPage } from "@/components/auth/LoginPage";
import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";
import { useAuthStore } from "@/store/useAuthStore";
import { UpdateNotification } from "@/components/UpdateNotification";
import { KeyboardShortcutOverlay } from "@/components/KeyboardShortcutOverlay";
import { ContextualGuide } from "@/components/ContextualGuide";
import { useCncStore, type AppTab } from "@/store/useCncStore";
import { SplashScreen3D } from "@/components/SplashScreen3D";
import { startAutoBackup } from "@/lib/auto-backup";
import { initGPUComputePipeline } from "@/lib/gpu-compute-pipeline";
import { getHardwareCapabilities, ensureWorkerPool, requestPersistentStorage } from "@/lib/hardware-engine";
import { pushNotificationService } from "@/services/pushNotifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { syncOfflineQueue, getOfflineQueue } from "@/lib/api";

function OfflineGuard() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    const goOff = () => setOffline(true);
    const goOn = () => {
      setOffline(false);
      const q = getOfflineQueue();
      if (q.length > 0) {
        setSyncing(true);
        setSyncResult(null);
        syncOfflineQueue().then(r => {
          setSyncing(false);
          if (r.synced > 0) setSyncResult(`${r.synced} pending requests synced`);
          setTimeout(() => setSyncResult(null), 5000);
        }).catch(() => setSyncing(false));
      }
    };
    window.addEventListener("online", goOn);
    window.addEventListener("offline", goOff);
    return () => { window.removeEventListener("online", goOn); window.removeEventListener("offline", goOff); };
  }, []);

  if (!offline && !syncing && !syncResult) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] text-center text-xs py-1 font-medium transition-all"
         style={{ background: offline ? "#dc2626" : syncing ? "#d97706" : "#16a34a", color: "#fff" }}>
      {offline && "Offline Mode — App hardware se chal raha hai, data locally save ho raha hai"}
      {syncing && "Syncing pending data to server..."}
      {syncResult && syncResult}
    </div>
  );
}

// ── Crash-resilient QueryClient ──────────────────────────────────────────────
// Retries 1× on network errors; never retries on 4xx (user errors)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: unknown) => {
        const status = (error as any)?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      retryDelay: 1500,
    },
    mutations: {
      retry: false,
    },
  },
});

type AppView = "landing" | "login" | "forgot" | "dashboard" | "workspace";

function AuthGate() {
  const { user, initialized } = useAuthStore();
  const [view, setView] = useState<AppView>(user ? "dashboard" : "landing");
  const [splashDone, setSplashDone] = useState(false);

  // Hide the native HTML pre-splash once React SplashScreen is mounted
  useEffect(() => {
    const hide = (window as any).__hideSplashNative;
    if (typeof hide === "function") hide();
  }, []);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
    startAutoBackup();

    // ── Full hardware init ──────────────────────────────────────────
    // 1. Detect GPU + request high-performance WebGL
    initGPUComputePipeline().then(status => {
      console.log(`[GPU] ${status.dedicatedGPU ? "DEDICATED" : "Integrated"} | ~${status.vramGB}GB VRAM | Mode: ${status.renderingMode} | ${status.optimizations.length} opt`);
    }).catch(() => {});

    // 2. Detect CPU cores + pre-start the worker thread pool
    const hw = getHardwareCapabilities();
    ensureWorkerPool();
    console.log(`[CPU] ${hw.cpu.cores} logical cores | ${hw.recommended.workerPoolSize} worker threads | ${hw.recommended.simulationQuality} quality`);

    // 3. Request persistent storage so IndexedDB/Cache never auto-evicted
    requestPersistentStorage().then((granted) => {
      if (granted) console.log("[RAM] Persistent storage — cache protected from RAM pressure eviction");
    });

    // 4. User login is handled by LandingPage/LoginPage — no auto-login
  }, []);

  if (!initialized || !splashDone) {
    return <SplashScreen3D onComplete={handleSplashComplete} />;
  }

  if (!user) {
    if (view === "forgot") {
      return <ForgotPasswordPage onBack={() => setView("login")} />;
    }
    if (view === "login") {
      return <LoginPage onForgotPassword={() => setView("forgot")} />;
    }
    return <LandingPage onGetStarted={() => setView("login")} />;
  }

  if (view === "workspace") {
    return (
      <Switch>
        <Route path="/demo">
          <ErrorBoundary fallbackTitle="Demo Video Error">
            <DemoVideo />
          </ErrorBoundary>
        </Route>
        <Route path="/">
          <ErrorBoundary fallbackTitle="Workspace Error — Click Recover to continue">
            <Home onBackToDashboard={() => setView("dashboard")} />
          </ErrorBoundary>
        </Route>
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Dashboard Error — Click Recover to continue">
      <Dashboard
        onOpenWorkspace={(tab?: AppTab) => {
          if (tab) useCncStore.getState().setActiveTab(tab);
          setView("workspace");
        }}
      />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ErrorBoundary fallbackTitle="Application Error — Click Recover to continue" fullScreen>
            <AuthGate />
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
        <OfflineGuard />
        <ErrorBoundary fallbackTitle="Notification Error">
          <UpdateNotification />
        </ErrorBoundary>
        <KeyboardShortcutOverlay />
        <ContextualGuide />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
