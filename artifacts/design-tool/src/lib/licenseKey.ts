// ─── License Key Client Library ────────────────────────────────────────────────
// Server-side validation — key bypass possible nahi hai
// Device fingerprint binding — ek key ek machine par hi chalega
// Demo: 3 din (72 ghante), server-side permanent lock

const STORAGE_TOKEN  = "sai_lic_token";
const STORAGE_HWID   = "sai_lic_hwid";
const STORAGE_NAME   = "sai_lic_name";
const STORAGE_TYPE   = "sai_lic_type";      // "full" | "demo"
const STORAGE_DEMO_START = "sai_demo_start";

const API_BASE = "/api/license";
const DEMO_KEY = "SAIRDEMO2026";
const DEMO_MAX_MS = 72 * 60 * 60 * 1000;   // 3 din

// ── Device fingerprint — persistent per machine ────────────────────────────────
export function getHwId(): string {
  try {
    let id = localStorage.getItem(STORAGE_HWID);
    if (id) return id;

    // Generate once and store permanently
    const rand = crypto.getRandomValues(new Uint8Array(16));
    const hex  = Array.from(rand).map(b => b.toString(16).padStart(2, "0")).join("");

    // Mix in stable browser signals for better uniqueness
    const signals = [
      navigator.userAgent.length,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
    ].join("-");

    id = `SAIDEV-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${btoa(signals).slice(0, 8).toUpperCase()}`;
    localStorage.setItem(STORAGE_HWID, id);
    return id;
  } catch {
    return "SAIDEV-FALLBACK-0000-0000";
  }
}

export function getSystemInfo(): Record<string, string> {
  return {
    platform: navigator.platform || "unknown",
    userAgent: navigator.userAgent.slice(0, 80),
    screen: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    cores: String(navigator.hardwareConcurrency || 0),
    memory: String((navigator as any).deviceMemory || 0),
  };
}

// ── Local token storage ────────────────────────────────────────────────────────
export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_TOKEN);
}

export function getStoredName(): string | null {
  return localStorage.getItem(STORAGE_NAME);
}

export function getLicenseType(): "full" | "demo" | null {
  return localStorage.getItem(STORAGE_TYPE) as "full" | "demo" | null;
}

function storeActivation(token: string, name: string, type: "full" | "demo") {
  localStorage.setItem(STORAGE_TOKEN, token);
  localStorage.setItem(STORAGE_NAME, name);
  localStorage.setItem(STORAGE_TYPE, type);
  if (type === "demo") localStorage.setItem(STORAGE_DEMO_START, String(Date.now()));
}

export function clearLicense() {
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_NAME);
  localStorage.removeItem(STORAGE_TYPE);
  localStorage.removeItem(STORAGE_DEMO_START);
}

// ── Demo time remaining (client-side estimate) ─────────────────────────────────
export function getDemoRemainingMs(): number {
  const startStr = localStorage.getItem(STORAGE_DEMO_START);
  if (!startStr) return 0;
  const elapsed = Date.now() - Number(startStr);
  return Math.max(0, DEMO_MAX_MS - elapsed);
}

export function isDemoExpiredLocally(): boolean {
  if (getLicenseType() !== "demo") return false;
  return getDemoRemainingMs() <= 0;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export interface ActivateResult {
  ok: boolean;
  token?: string;
  message?: string;
  error?: string;
  blocked?: boolean;
  demoExpired?: boolean;
}

export interface VerifyResult {
  active: boolean;
  name?: string;
  reason?: string;
  blocked?: boolean;
  demoExpired?: boolean;
}

// POST /api/license/register — key validate + token generate
export async function activateLicense(
  key: string,
  name: string,
  mobile: string,
): Promise<ActivateResult> {
  try {
    const hwId = getHwId();
    const systemInfo = getSystemInfo();

    const r = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim().toUpperCase(), name: name.trim(), mobile: mobile.trim(), hwId, systemInfo }),
    });
    const data = await r.json() as ActivateResult & { token?: string };

    if (data.ok && data.token) {
      const type = key.trim().toUpperCase() === DEMO_KEY ? "demo" : "full";
      storeActivation(data.token, name.trim(), type);
    }
    return data;
  } catch {
    return { ok: false, error: "Server se connection nahi ho raha — internet check karo" };
  }
}

// Demo shortcut — SAIR-DEMO-2026-TRIAL key use karta hai
export async function activateDemo(name: string, mobile: string): Promise<ActivateResult> {
  return activateLicense(DEMO_KEY, name, mobile);
}

// GET /api/license/verify — startup check
export async function verifyLicense(): Promise<VerifyResult> {
  const token = getStoredToken();
  const hwId  = getHwId();

  if (!token) return { active: false, reason: "No token" };

  // Client-side quick check for demo expiry (no network needed)
  if (isDemoExpiredLocally()) return { active: false, demoExpired: true, reason: "Demo 3 din pura ho gaya" };

  try {
    const r = await fetch(`${API_BASE}/verify?token=${encodeURIComponent(token)}&hwId=${encodeURIComponent(hwId)}`);
    return await r.json() as VerifyResult;
  } catch {
    // Offline fallback — agar server na mile to local token se kaam chalne do (24 ghante)
    if (token) return { active: true, name: getStoredName() ?? "Engineer" };
    return { active: false, reason: "Server unreachable" };
  }
}
