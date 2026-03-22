import { create } from "zustand";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  GithubAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { auth, firebaseReady } from "../lib/firebase";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;

  otpConfirmation: ConfirmationResult | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  loginWithPhone: (phone: string, containerId: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshToken: () => Promise<string | null>;
  devLogin: () => void;
}

function createOfflineUser(): User {
  return {
    uid: "offline-sai-rolotech-1164",
    email: "engineer@sairolotech.local",
    displayName: "SAI Engineer (Offline)",
    emailVerified: true,
    photoURL: null,
    isAnonymous: false,
    providerData: [],
    getIdToken: async () => "offline-sai-rolotech-local",
    getIdTokenResult: async () => ({ token: "offline-sai-rolotech-local" } as any),
    reload: async () => {},
    toJSON: () => ({}),
    metadata: {},
    phoneNumber: null,
    tenantId: null,
    refreshToken: "",
    providerId: "local",
    delete: async () => {},
  } as unknown as User;
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

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();
      set({ user: result.user, token, loading: false });
    } catch (err: unknown) {
      const message = getFirebaseErrorMessage(err);
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  signup: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();
      set({ user: result.user, token, loading: false });
    } catch (err: unknown) {
      const message = getFirebaseErrorMessage(err);
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: null });
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    try {
      // Try popup first; if blocked (Replit iframe / mobile), fall back to redirect
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      set({ user: result.user, token, loading: false });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-blocked" || code === "auth/popup-cancelled" || code === "auth/cancelled-popup-request") {
        // Redirect flow — page will reload after Google login
        try {
          await signInWithRedirect(auth, provider);
          // signInWithRedirect navigates away; code below won't execute
          return;
        } catch (redirectErr: unknown) {
          const message = getOAuthErrorMessage(redirectErr);
          set({ error: message, loading: false });
          throw new Error(message);
        }
      }
      const message = getOAuthErrorMessage(err);
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  loginWithGitHub: async () => {
    set({ loading: true, error: null });
    const provider = new GithubAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      set({ user: result.user, token, loading: false });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: unknown) {
          const message = getOAuthErrorMessage(redirectErr);
          set({ error: message, loading: false });
          throw new Error(message);
        }
      }
      const message = getOAuthErrorMessage(err);
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  loginWithPhone: async (phone: string, containerId: string) => {
    set({ loading: true, error: null });
    try {
      const recaptcha = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
        callback: () => {},
      });
      const confirmation = await signInWithPhoneNumber(auth, phone, recaptcha);
      set({ otpConfirmation: confirmation, loading: false });
    } catch (err: unknown) {
      const message = getFirebaseErrorMessage(err);
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  verifyOTP: async (code: string) => {
    set({ loading: true, error: null });
    const { otpConfirmation } = get();
    if (!otpConfirmation) {
      set({ error: "OTP session expired. Please try again.", loading: false });
      return;
    }
    try {
      const result = await otpConfirmation.confirm(code);
      const token = await result.user.getIdToken();
      set({ user: result.user, token, loading: false, otpConfirmation: null });
    } catch (err: unknown) {
      const message = getFirebaseErrorMessage(err);
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
      set({ user: null, token: null, error: null });
    } catch {
      set({ user: null, token: null, error: null });
    }
  },

  resetPassword: async (email: string) => {
    set({ loading: true, error: null });
    try {
      await sendPasswordResetEmail(auth, email);
      set({ loading: false });
    } catch (err: unknown) {
      const message = getFirebaseErrorMessage(err);
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  refreshToken: async () => {
    const user = get().user;
    if (!user) return null;
    try {
      const token = await user.getIdToken(true);
      set({ token });
      return token;
    } catch {
      return null;
    }
  },

  devLogin: () => {
    const offlineUser = createOfflineUser();
    set({ user: offlineUser, token: "offline-sai-rolotech-local", loading: false, error: null });
    try { localStorage.setItem("sai_offline_session", "true"); } catch {}
  },
}));

// ── Auto-start: Offline-first — app loads instantly, Firebase optional ────────
// Check for saved offline session or auto-login offline
(function initAuth() {
  const hasOfflineSession = (() => { try { return localStorage.getItem("sai_offline_session") === "true"; } catch { return false; } })();

  if (hasOfflineSession || !firebaseReady || !navigator.onLine) {
    const offlineUser = createOfflineUser();
    useAuthStore.setState({ user: offlineUser, token: "offline-sai-rolotech-local", initialized: true });
    console.log("[Auth] Offline mode — app ready, hardware local");
  }

  if (firebaseReady) {
    try {
      getRedirectResult(auth).then(async (result) => {
        if (result?.user) {
          const token = await result.user.getIdToken();
          useAuthStore.setState({ user: result.user, token, loading: false, error: null });
          try { localStorage.removeItem("sai_offline_session"); } catch {}
        }
      }).catch(() => {});
    } catch {}

    try {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const token = await user.getIdToken();
          useAuthStore.setState({ user, token, initialized: true });
          try { localStorage.removeItem("sai_offline_session"); } catch {}
        } else {
          if (!useAuthStore.getState().user) {
            const offlineUser = createOfflineUser();
            useAuthStore.setState({ user: offlineUser, token: "offline-sai-rolotech-local", initialized: true });
          }
        }
      });
    } catch {
      useAuthStore.setState({ initialized: true });
    }
  }
})();

function getOAuthErrorMessage(err: unknown): string {
  const error = err as { code?: string };
  switch (error.code) {
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed. Please try again.";
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled. Please try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with the same email but a different sign-in method. Try signing in with the original method.";
    case "auth/popup-blocked":
      return "Sign-in popup was blocked by the browser. Please allow popups and try again.";
    case "auth/unauthorized-domain":
      console.warn("[Firebase] Unauthorized domain. Add this domain to Firebase Console > Authentication > Settings > Authorized domains:", window.location.hostname);
      return `Domain "${window.location.hostname}" authorized nahi hai. Firebase Console > Authentication > Authorized Domains mein add karein.`;
    case "auth/operation-not-allowed":
      console.warn("[Firebase] Google/GitHub Sign-in not enabled. Go to: Firebase Console > Authentication > Sign-in method > Enable Google.");
      return "Google Sign-in abhi enable nahi hai. Firebase Console > Authentication > Sign-in method > Google enable karein.";
    case "auth/network-request-failed":
      return "Network error — please check your internet connection.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

function getFirebaseErrorMessage(err: unknown): string {
  const error = err as { code?: string };
  switch (error.code) {
    case "auth/invalid-email":
      return "Email format galat hai";
    case "auth/user-disabled":
      return "Ye account disable kar diya gaya hai";
    case "auth/user-not-found":
      return "Is email se koi account nahi mila";
    case "auth/wrong-password":
      return "Password galat hai";
    case "auth/invalid-credential":
      return "Email ya password galat hai";
    case "auth/email-already-in-use":
      return "Is email se pehle se account bana hua hai";
    case "auth/weak-password":
      return "Password kamzor hai — kam se kam 6 characters hone chahiye";
    case "auth/too-many-requests":
      return "Bahut zyada attempts. Thodi der baad try karein";
    case "auth/network-request-failed":
      return "Network error — internet connection check karein";
    default:
      return "Login mein error aaya. Dobara try karein.";
  }
}
