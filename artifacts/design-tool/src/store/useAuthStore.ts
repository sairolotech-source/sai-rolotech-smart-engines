import { create } from "zustand";

const OFFLINE_SESSION_KEY = "sai_offline_session";
const DEMO_LOGIN_TIME_KEY = "sai_demo_login_time";
const DEMO_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

interface OfflineUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  isAnonymous: boolean;
  providerData: unknown[];
  getIdToken: () => Promise<string>;
  getIdTokenResult: () => Promise<{ token: string }>;
  reload: () => Promise<void>;
  toJSON: () => Record<string, unknown>;
  metadata: Record<string, unknown>;
  phoneNumber: string | null;
  tenantId: string | null;
  refreshToken: string;
  providerId: string;
  delete: () => Promise<void>;
}

interface AuthState {
  user: OfflineUser | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;

  setUser: (user: OfflineUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  loginWithPhone: (phone: string, containerId: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  loginWithBiometric: () => Promise<{ ok: boolean; error?: string }>;
  loginWithCrossDevice: () => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshToken: () => Promise<string | null>;
  devLogin: () => void;

  otpConfirmation: null;
}

function createOfflineUser(): OfflineUser {
  return {
    uid: "offline-sai-rolotech-1164",
    email: "engineer@sairolotech.local",
    displayName: "SAI Engineer (Offline)",
    emailVerified: true,
    photoURL: null,
    isAnonymous: false,
    providerData: [],
    getIdToken: async () => "offline-sai-rolotech-local",
    getIdTokenResult: async () => ({ token: "offline-sai-rolotech-local" }),
    reload: async () => {},
    toJSON: () => ({}),
    metadata: {},
    phoneNumber: null,
    tenantId: null,
    refreshToken: "",
    providerId: "local",
    delete: async () => {},
  };
}

function isDemoSessionExpired(): boolean {
  try {
    const saved = localStorage.getItem(DEMO_LOGIN_TIME_KEY);
    if (!saved) return false;
    const elapsed = Date.now() - Number(saved);
    return elapsed > DEMO_MAX_AGE_MS;
  } catch { return false; }
}

function clearDemoSession() {
  try {
    localStorage.removeItem(DEMO_LOGIN_TIME_KEY);
    localStorage.removeItem(OFFLINE_SESSION_KEY);
  } catch {}
  console.log("[Auth] Demo session expired (3 din) — auto logout");
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  loading: false,
  initialized: true,
  error: null,
  otpConfirmation: null,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setInitialized: (initialized) => set({ initialized }),

  login: async (_email: string, _password: string) => {
    set({ loading: true, error: null });
    const offlineUser = createOfflineUser();
    set({ user: offlineUser, token: "offline-sai-rolotech-local", loading: false });
    try {
      localStorage.setItem(OFFLINE_SESSION_KEY, "true");
      localStorage.setItem(DEMO_LOGIN_TIME_KEY, String(Date.now()));
    } catch {}
  },

  signup: async (_email: string, _password: string) => {
    set({ loading: true, error: null });
    const offlineUser = createOfflineUser();
    set({ user: offlineUser, token: "offline-sai-rolotech-local", loading: false });
    try {
      localStorage.setItem(OFFLINE_SESSION_KEY, "true");
      localStorage.setItem(DEMO_LOGIN_TIME_KEY, String(Date.now()));
    } catch {}
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: null });
    const offlineUser = createOfflineUser();
    set({ user: offlineUser, token: "offline-sai-rolotech-local", loading: false });
    try {
      localStorage.setItem(OFFLINE_SESSION_KEY, "true");
      localStorage.setItem(DEMO_LOGIN_TIME_KEY, String(Date.now()));
    } catch {}
  },

  loginWithGitHub: async () => {
    set({ loading: true, error: null });
    const offlineUser = createOfflineUser();
    set({ user: offlineUser, token: "offline-sai-rolotech-local", loading: false });
    try {
      localStorage.setItem(OFFLINE_SESSION_KEY, "true");
      localStorage.setItem(DEMO_LOGIN_TIME_KEY, String(Date.now()));
    } catch {}
  },

  loginWithPhone: async (_phone: string, _containerId: string) => {
    set({ loading: true, error: null });
    const offlineUser = createOfflineUser();
    set({ user: offlineUser, token: "offline-sai-rolotech-local", loading: false });
    try {
      localStorage.setItem(OFFLINE_SESSION_KEY, "true");
      localStorage.setItem(DEMO_LOGIN_TIME_KEY, String(Date.now()));
    } catch {}
  },

  verifyOTP: async (_code: string) => {
    set({ loading: true, error: null });
    const offlineUser = createOfflineUser();
    set({ user: offlineUser, token: "offline-sai-rolotech-local", loading: false });
    try {
      localStorage.setItem(OFFLINE_SESSION_KEY, "true");
      localStorage.setItem(DEMO_LOGIN_TIME_KEY, String(Date.now()));
    } catch {}
  },

  loginWithBiometric: async () => {
    const { authenticateBiometric } = await import("../lib/webauthn");
    set({ loading: true, error: null });
    try {
      const result = await authenticateBiometric();
      if (result.ok) {
        const offlineUser = createOfflineUser();
        set({ user: offlineUser, token: "offline-sai-rolotech-biometric", loading: false });
        localStorage.setItem(OFFLINE_SESSION_KEY, "true");
        localStorage.setItem(DEMO_LOGIN_TIME_KEY, String(Date.now()));
        return { ok: true };
      } else {
        set({ loading: false, error: result.error ?? "Biometric verification failed" });
        return { ok: false, error: result.error };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Biometric error";
      set({ loading: false, error: msg });
      return { ok: false, error: msg };
    }
  },

  loginWithCrossDevice: async () => {
    const { authenticateCrossDevice } = await import("../lib/webauthn");
    set({ loading: true, error: null });
    try {
      const result = await authenticateCrossDevice();
      if (result.ok) {
        const offlineUser = createOfflineUser();
        if (result.email) offlineUser.email = result.email;
        set({ user: offlineUser, token: "offline-sai-rolotech-cross-device", loading: false });
        localStorage.setItem(OFFLINE_SESSION_KEY, "true");
        localStorage.setItem(DEMO_LOGIN_TIME_KEY, String(Date.now()));
        return { ok: true };
      } else {
        set({ loading: false, error: result.error ?? "Mobile verification failed" });
        return { ok: false, error: result.error };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cross-device auth error";
      set({ loading: false, error: msg });
      return { ok: false, error: msg };
    }
  },

  logout: async () => {
    try {
      localStorage.removeItem(DEMO_LOGIN_TIME_KEY);
      localStorage.removeItem(OFFLINE_SESSION_KEY);
    } catch {}
    set({ user: null, token: null, error: null });
  },

  resetPassword: async (_email: string) => {
    set({ loading: false, error: null });
  },

  refreshToken: async () => {
    const user = get().user;
    if (!user) return null;
    return "offline-sai-rolotech-local";
  },

  devLogin: () => {
    const offlineUser = createOfflineUser();
    set({ user: offlineUser, token: "offline-sai-rolotech-local", loading: false, error: null });
    try {
      localStorage.setItem(OFFLINE_SESSION_KEY, "true");
      localStorage.setItem(DEMO_LOGIN_TIME_KEY, String(Date.now()));
    } catch {}
  },
}));

(function initAuth() {
  const hasOfflineSession = (() => { try { return localStorage.getItem(OFFLINE_SESSION_KEY) === "true"; } catch { return false; } })();

  if (hasOfflineSession && isDemoSessionExpired()) {
    clearDemoSession();
    useAuthStore.setState({ user: null, token: null, initialized: true });
    console.log("[Auth] Demo session expired (3 din) — login required");
    return;
  }

  if (hasOfflineSession) {
    const offlineUser = createOfflineUser();
    useAuthStore.setState({ user: offlineUser, token: "offline-sai-rolotech-local", initialized: true });
    console.log("[Auth] Returning user — demo session restored");
  } else {
    useAuthStore.setState({ user: null, token: null, initialized: true });
    console.log("[Auth] New session — login required");
  }
})();
