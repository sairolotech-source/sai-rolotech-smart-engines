import { useState, useCallback, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import { LandingPage } from "@/pages/LandingPage";
import { Dashboard } from "@/pages/Dashboard";
import DemoVideo from "@/pages/DemoVideo";
import DemoDownloadPage from "@/pages/DemoDownloadPage";
import AdminPanel from "@/pages/AdminPanel";
import { LoginPage } from "@/components/auth/LoginPage";
import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";
import { useAuthStore } from "@/store/useAuthStore";
import { UpdateNotification } from "@/components/UpdateNotification";
import { ElectronAutoUpdate } from "@/components/ElectronAutoUpdate";
import { KeyboardShortcutOverlay } from "@/components/KeyboardShortcutOverlay";
import { ContextualGuide } from "@/components/ContextualGuide";
import { useCncStore, type AppTab } from "@/store/useCncStore";
import { SplashScreen3D } from "@/components/SplashScreen3D";
import { startAutoBackup } from "@/lib/auto-backup";
import { initGPUComputePipeline } from "@/lib/gpu-compute-pipeline";
import { getHardwareCapabilities, ensureWorkerPool, requestPersistentStorage } from "@/lib/hardware-engine";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { syncOfflineQueue, getOfflineQueue } from "@/lib/api";
import { useThemeStore, applyTheme } from "@/store/useThemeStore";
import { useRoleStore, ROLE_LABELS, ROLE_COLORS, type UserRole } from "@/store/useRoleStore";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { ProjectShare } from "@/components/ProjectShare";

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

// ─── Floating Toolbar — Theme + Share + Role + Tutorial ──────────────────────
function FloatingToolbar({ loggedIn }: { loggedIn: boolean }) {
  const { theme, toggleTheme } = useThemeStore();
  const { role, setRole } = useRoleStore();
  const [showShare, setShowShare] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  if (!loggedIn) return null;

  const roles: UserRole[] = ["admin", "engineer", "viewer"];

  return (
    <>
      {/* Floating toolbar — bottom-left */}
      <div
        className="fixed bottom-4 left-4 z-[9990] flex flex-col gap-2"
        style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))" }}
      >
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-all hover:scale-110 active:scale-95"
          style={{
            background: theme === "dark"
              ? "linear-gradient(135deg,#1e1f3a,#2a2b4a)"
              : "linear-gradient(135deg,#fff9e6,#fef3c7)",
            border: "1px solid rgba(245,158,11,0.3)",
            color: theme === "dark" ? "#f59e0b" : "#92400e",
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>

        {/* Project Share */}
        <button
          onClick={() => setShowShare(true)}
          title="Project Share"
          className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-all hover:scale-110 active:scale-95"
          style={{
            background: "linear-gradient(135deg,#0d0e1e,#1a1b30)",
            border: "1px solid rgba(6,182,212,0.3)",
            color: "#06b6d4",
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
        >
          🔗
        </button>

        {/* Tutorial */}
        <button
          onClick={() => setShowTutorial(true)}
          title="Tutorial Replay"
          className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-all hover:scale-110 active:scale-95"
          style={{
            background: "linear-gradient(135deg,#0d0e1e,#1a1b30)",
            border: "1px solid rgba(139,92,246,0.3)",
            color: "#8b5cf6",
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
        >
          📚
        </button>

        {/* Role badge / switcher */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(v => !v)}
            title="User Role"
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all hover:scale-110 active:scale-95"
            style={{
              background: `${ROLE_COLORS[role]}22`,
              border: `1px solid ${ROLE_COLORS[role]}55`,
              color: ROLE_COLORS[role],
              boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            {role === "admin" ? "★" : role === "engineer" ? "⚙" : "👁"}
          </button>
          {showRoleMenu && (
            <div
              className="absolute left-10 bottom-0 rounded-xl overflow-hidden flex flex-col min-w-[130px]"
              style={{
                background: "#0d0e1e",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              <div className="px-3 py-2 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
                Role
              </div>
              {roles.map(r => (
                <button
                  key={r}
                  onClick={() => { setRole(r); setShowRoleMenu(false); }}
                  className="flex items-center gap-2 px-3 py-2 text-xs transition-all hover:bg-white/5 text-left"
                  style={{ color: role === r ? ROLE_COLORS[r] : "rgba(255,255,255,0.6)" }}
                >
                  <span style={{ color: ROLE_COLORS[r] }}>
                    {r === "admin" ? "★" : r === "engineer" ? "⚙" : "👁"}
                  </span>
                  {ROLE_LABELS[r]}
                  {role === r && <span className="ml-auto text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showShare && <ProjectShare onClose={() => setShowShare(false)} />}
      {showTutorial && <OnboardingTutorial onClose={() => setShowTutorial(false)} />}
    </>
  );
}

// ─── Crash-resilient QueryClient ────────────────────────────────────────────
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
    mutations: { retry: false },
  },
});

type AppView = "landing" | "login" | "forgot" | "dashboard" | "workspace";

function AuthGate() {
  const { user, initialized } = useAuthStore();
  const [view, setView] = useState<AppView>(user ? "dashboard" : "landing");
  const [splashDone, setSplashDone] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const { theme } = useThemeStore();

  // Apply saved theme on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Show tutorial on first login
  useEffect(() => {
    if (user && !localStorage.getItem("sai-tutorial-done")) {
      const t = setTimeout(() => setShowTutorial(true), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [user]);

  useEffect(() => {
    const hide = (window as any).__hideSplashNative;
    if (typeof hide === "function") hide();
  }, []);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
    startAutoBackup();

    initGPUComputePipeline().then(status => {
      console.log(`[GPU] ${status.dedicatedGPU ? "DEDICATED" : "Integrated"} | ~${status.vramGB}GB VRAM | Mode: ${status.renderingMode} | ${status.optimizations.length} opt`);
    }).catch(() => {});

    const hw = getHardwareCapabilities();
    ensureWorkerPool();
    console.log(`[CPU] ${hw.cpu.cores} logical cores | ${hw.recommended.workerPoolSize} worker threads | ${hw.recommended.simulationQuality} quality`);

    requestPersistentStorage().then((granted) => {
      if (granted) console.log("[RAM] Persistent storage — cache protected from RAM pressure eviction");
    });
  }, []);

  const [isDownloadPage] = useRoute("/download");
  const [isAdminPage] = useRoute("/admin");

  if (isAdminPage) return <AdminPanel />;
  if (!initialized || !splashDone) return <SplashScreen3D onComplete={handleSplashComplete} />;
  if (isDownloadPage) return <DemoDownloadPage />;

  if (!user) {
    if (view === "forgot") return <ForgotPasswordPage onBack={() => setView("login")} />;
    if (view === "login") return <LoginPage onForgotPassword={() => setView("forgot")} />;
    return <LandingPage onGetStarted={() => setView("login")} />;
  }

  if (view === "workspace") {
    return (
      <>
        <Switch>
          <Route path="/demo">
            <ErrorBoundary fallbackTitle="Demo Video Error"><DemoVideo /></ErrorBoundary>
          </Route>
          <Route path="/">
            <ErrorBoundary fallbackTitle="Workspace Error — Click Recover to continue">
              <Home onBackToDashboard={() => setView("dashboard")} />
            </ErrorBoundary>
          </Route>
          <Route component={NotFound} />
        </Switch>
        <FloatingToolbar loggedIn={!!user} />
        {showTutorial && <OnboardingTutorial onClose={() => setShowTutorial(false)} />}
      </>
    );
  }

  return (
    <>
      <ErrorBoundary fallbackTitle="Dashboard Error — Click Recover to continue">
        <Dashboard
          onOpenWorkspace={(tab?: AppTab) => {
            if (tab) useCncStore.getState().setActiveTab(tab);
            setView("workspace");
          }}
        />
      </ErrorBoundary>
      <FloatingToolbar loggedIn={!!user} />
      {showTutorial && <OnboardingTutorial onClose={() => setShowTutorial(false)} />}
    </>
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
        <ElectronAutoUpdate />
        <KeyboardShortcutOverlay />
        <ContextualGuide />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
