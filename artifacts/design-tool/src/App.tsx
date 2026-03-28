import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/useAuthStore";

type AppTab = "profile" | "gcode" | "flower" | "cnc" | "3d" | "bom" | "accuracy" | "dxf" | "report" | "sheet" | "coil" | "manual" | "digital-twin" | "dashboard";

const LicenseKeyScreen = lazy(() => import("@/components/auth/LicenseKeyScreen").then(m => ({ default: m.LicenseKeyScreen })));
const Home             = lazy(() => import("@/pages/Home"));
const LandingPage      = lazy(() => import("@/pages/LandingPage").then(m => ({ default: m.LandingPage })));
const Dashboard        = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })));
const LoginPage        = lazy(() => import("@/components/auth/LoginPage").then(m => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import("@/components/auth/ForgotPasswordPage").then(m => ({ default: m.ForgotPasswordPage })));
const DemoVideo        = lazy(() => import("@/pages/DemoVideo"));
const DemoDownloadPage = lazy(() => import("@/pages/DemoDownloadPage"));
const AdminPanel       = lazy(() => import("@/pages/AdminPanel"));
const NotFound         = lazy(() => import("@/pages/not-found"));
const OnboardingTutorial = lazy(() => import("@/components/OnboardingTutorial").then(m => ({ default: m.OnboardingTutorial })));

function PageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#08090f]">
      <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );
}

const idle = (fn: () => void, ms: number) => {
  const t = setTimeout(() => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => { try { fn(); } catch {} });
    } else {
      try { fn(); } catch {}
    }
  }, ms);
  return () => clearTimeout(t);
};

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

const LazyToaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const LazyUpdateNotification = lazy(() => import("@/components/UpdateNotification").then(m => ({ default: m.UpdateNotification })));
const LazyElectronAutoUpdate = lazy(() => import("@/components/ElectronAutoUpdate").then(m => ({ default: m.ElectronAutoUpdate })));
const LazyKeyboardShortcutOverlay = lazy(() => import("@/components/KeyboardShortcutOverlay").then(m => ({ default: m.KeyboardShortcutOverlay })));
const LazyContextualGuide = lazy(() => import("@/components/ContextualGuide").then(m => ({ default: m.ContextualGuide })));

const LazyOfflineGuard = lazy(() =>
  import("@/lib/api").then(api => ({
    default: function OfflineGuard() {
      const [offline, setOffline] = useState(!navigator.onLine);
      const [syncing, setSyncing] = useState(false);
      const [syncResult, setSyncResult] = useState<string | null>(null);

      useEffect(() => {
        let clearTimer: ReturnType<typeof setTimeout> | null = null;
        const goOff = () => setOffline(true);
        const goOn = () => {
          setOffline(false);
          const q = api.getOfflineQueue();
          if (q.length > 0) {
            setSyncing(true);
            setSyncResult(null);
            api.syncOfflineQueue().then(r => {
              setSyncing(false);
              if (r.synced > 0) {
                setSyncResult(`${r.synced} pending requests synced`);
                clearTimer = setTimeout(() => setSyncResult(null), 5000);
              }
            }).catch(() => setSyncing(false));
          }
        };
        window.addEventListener("online", goOn);
        window.addEventListener("offline", goOff);
        return () => {
          window.removeEventListener("online", goOn);
          window.removeEventListener("offline", goOff);
          if (clearTimer) clearTimeout(clearTimer);
        };
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
  }))
);

function DeferredExtras() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallbackTitle="Extras Error"><LazyToaster /></ErrorBoundary>
      <ErrorBoundary fallbackTitle="Notification Error"><LazyUpdateNotification /></ErrorBoundary>
      <ErrorBoundary fallbackTitle=""><LazyElectronAutoUpdate /></ErrorBoundary>
      <ErrorBoundary fallbackTitle=""><LazyKeyboardShortcutOverlay /></ErrorBoundary>
      <ErrorBoundary fallbackTitle=""><LazyContextualGuide /></ErrorBoundary>
    </Suspense>
  );
}

function DeferredOfflineGuard() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;

  return (
    <ErrorBoundary fallbackTitle="">
      <Suspense fallback={null}><LazyOfflineGuard /></Suspense>
    </ErrorBoundary>
  );
}

const FloatingToolbar = lazy(() =>
  Promise.all([
    import("@/store/useThemeStore"),
    import("@/store/useRoleStore"),
    import("@/components/OnboardingTutorial"),
    import("@/components/ProjectShare"),
  ]).then(([themeM, roleM, tutM, shareM]) => ({
    default: function FloatingToolbar({ loggedIn }: { loggedIn: boolean }) {
      const { theme, toggleTheme } = themeM.useThemeStore();
      const { role, setRole } = roleM.useRoleStore();
      const [showShare, setShowShare] = useState(false);
      const [showTutorial, setShowTutorial] = useState(false);
      const [showRoleMenu, setShowRoleMenu] = useState(false);

      if (!loggedIn) return null;

      type UserRole = "admin" | "engineer" | "viewer";
      const roles: UserRole[] = ["admin", "engineer", "viewer"];

      return (
        <>
          <div
            className="fixed bottom-4 left-4 z-[9990] flex flex-col gap-2"
            style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))" }}
          >
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

            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(v => !v)}
                title="User Role"
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all hover:scale-110 active:scale-95"
                style={{
                  background: `${roleM.ROLE_COLORS[role]}22`,
                  border: `1px solid ${roleM.ROLE_COLORS[role]}55`,
                  color: roleM.ROLE_COLORS[role],
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
                      style={{ color: role === r ? roleM.ROLE_COLORS[r] : "rgba(255,255,255,0.6)" }}
                    >
                      <span style={{ color: roleM.ROLE_COLORS[r] }}>
                        {r === "admin" ? "★" : r === "engineer" ? "⚙" : "👁"}
                      </span>
                      {roleM.ROLE_LABELS[r]}
                      {role === r && <span className="ml-auto text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showShare && <shareM.ProjectShare onClose={() => setShowShare(false)} />}
          {showTutorial && <tutM.OnboardingTutorial onClose={() => setShowTutorial(false)} />}
        </>
      );
    }
  }))
);

function AuthGate() {
  const { user, initialized } = useAuthStore();
  const [view, setView] = useState<AppView>(user ? "dashboard" : "landing");
  const [licenseOk, setLicenseOk] = useState(() => !!localStorage.getItem("sai_lic_token"));
  const [showTutorial, setShowTutorial] = useState(false);
  const [softwareActivated, setSoftwareActivated] = useState(() => !!user);

  useEffect(() => {
    try {
      const hide = (window as any).__hideSplashNative;
      if (typeof hide === "function") hide();
    } catch {}

    import("@/store/useThemeStore").then(m => {
      try { m.applyTheme(m.useThemeStore.getState().theme); } catch {}
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!softwareActivated) return;
    return idle(() => {
      import("@/lib/auto-backup").then(m => m.startAutoBackup()).catch(() => {});
    }, 3000);
  }, [softwareActivated]);

  useEffect(() => {
    if (!softwareActivated) return;
    return idle(() => {
      import("@/lib/gpu-compute-pipeline").then(m => m.initGPUComputePipeline()).then(status => {
        console.log(`[GPU] ${status.dedicatedGPU ? "DEDICATED" : "Integrated"} | ~${status.vramGB}GB VRAM | Mode: ${status.renderingMode}`);
      }).catch(() => {});
    }, 6000);
  }, [softwareActivated]);

  useEffect(() => {
    if (!softwareActivated) return;
    return idle(() => {
      import("@/lib/hardware-engine").then(m => {
        try {
          const hw = m.getHardwareCapabilities();
          console.log(`[CPU] ${hw.cpu.cores} cores | ${hw.recommended.workerPoolSize} workers`);
          m.ensureWorkerPool();
        } catch {}
        m.requestPersistentStorage().catch(() => {});
      }).catch(() => {});
    }, 8000);
  }, [softwareActivated]);

  useEffect(() => {
    if (user && !localStorage.getItem("sai-tutorial-done")) {
      const t = setTimeout(() => setShowTutorial(true), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [user]);

  const openWorkspace = useCallback((tab?: AppTab) => {
    if (tab) {
      import("@/store/useCncStore").then(m => {
        m.useCncStore.getState().setActiveTab(tab);
      }).catch(() => {});
    }
    setView("workspace");
  }, []);

  const [isDownloadPage] = useRoute("/download");
  const [isAdminPage] = useRoute("/admin");
  const [isDemoVideoPage] = useRoute("/demo");

  if (isAdminPage) return <Suspense fallback={<PageSpinner />}><AdminPanel /></Suspense>;
  if (isDemoVideoPage) return <Suspense fallback={<PageSpinner />}><DemoVideo /></Suspense>;
  if (!initialized) return <PageSpinner />;
  if (isDownloadPage) return <Suspense fallback={<PageSpinner />}><DemoDownloadPage /></Suspense>;

  if (!licenseOk) {
    return (
      <Suspense fallback={<PageSpinner />}>
        <LicenseKeyScreen onUnlocked={() => setLicenseOk(true)} />
      </Suspense>
    );
  }

  if (!user) {
    if (view === "forgot") return <Suspense fallback={<PageSpinner />}><ForgotPasswordPage onBack={() => setView("login")} /></Suspense>;
    if (view === "login") return <Suspense fallback={<PageSpinner />}><LoginPage onForgotPassword={() => setView("forgot")} /></Suspense>;
    return <Suspense fallback={<PageSpinner />}><LandingPage onPreload={() => setSoftwareActivated(true)} onGetStarted={() => setView("login")} /></Suspense>;
  }

  if (view === "workspace") {
    return (
      <Suspense fallback={<PageSpinner />}>
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
        <Suspense fallback={null}><FloatingToolbar loggedIn={!!user} /></Suspense>
        {showTutorial && (
          <Suspense fallback={null}>
            <OnboardingTutorial onClose={() => setShowTutorial(false)} />
          </Suspense>
        )}
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageSpinner />}>
      <ErrorBoundary fallbackTitle="Dashboard Error — Click Recover to continue">
        <Dashboard onOpenWorkspace={openWorkspace} />
      </ErrorBoundary>
      <Suspense fallback={null}><FloatingToolbar loggedIn={!!user} /></Suspense>
      {showTutorial && (
        <Suspense fallback={null}>
          <OnboardingTutorial onClose={() => setShowTutorial(false)} />
        </Suspense>
      )}
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <ErrorBoundary fallbackTitle="Application Error — Click Recover to continue" fullScreen>
          <AuthGate />
        </ErrorBoundary>
      </WouterRouter>
      <DeferredExtras />
      <DeferredOfflineGuard />
    </QueryClientProvider>
  );
}

export default App;
