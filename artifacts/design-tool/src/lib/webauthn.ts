// ─── WebAuthn Biometric + Cross-Device Helper ─────────────────────────────────
// Mode 1: Platform   — isi device ka fingerprint (Windows Hello / Touch ID / Android)
// Mode 2: Cross-Device — laptop pe QR code dikhao, mobile se scan karo, fingerprint lagao → laptop khul jaye

const CRED_KEY        = "sai_biometric_cred_id";      // is device ka credential
const CROSS_CRED_KEY  = "sai_cross_device_cred_id";   // phone se register hua credential
const CRED_USER_KEY   = "sai_biometric_user";
const RP_NAME         = "Sai Rolotech Smart Engines";

function getRpId(): string {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" ? "localhost" : h;
}

function makeChallenge(): ArrayBuffer {
  const buf  = new ArrayBuffer(32);
  const arr  = new Uint8Array(buf);
  const seed = "sai-rolotech-passkey-challenge-2024";
  for (let i = 0; i < 32; i++) arr[i] = seed.charCodeAt(i % seed.length) ^ (i * 13 + 7);
  return buf;
}

function encodeStr(s: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(s);
  const buf = new ArrayBuffer(encoded.length);
  new Uint8Array(buf).set(encoded);
  return buf;
}

function b64encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64decode(str: string): ArrayBuffer {
  const arr = Uint8Array.from(atob(str), c => c.charCodeAt(0));
  const buf = new ArrayBuffer(arr.length);
  new Uint8Array(buf).set(arr);
  return buf;
}

function parseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NotAllowedError")  || msg.includes("cancelled"))    return "Scan cancel ho gaya";
  if (msg.includes("NotSupportedError"))  return "Is device/browser mein support nahi hai";
  if (msg.includes("SecurityError"))      return "Security error — HTTPS ya localhost required";
  if (msg.includes("InvalidStateError"))  return "Credential nahi mili — dobara register karo";
  if (msg.includes("AbortError"))         return "Timeout — dobara try karo";
  return msg;
}

// ── Public checks ──────────────────────────────────────────────────────────────
export function isBiometricSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function isBiometricRegistered(): boolean {
  return !!localStorage.getItem(CRED_KEY);
}

export function isCrossDeviceRegistered(): boolean {
  return !!localStorage.getItem(CROSS_CRED_KEY);
}

export function getBiometricUser(): string | null {
  return localStorage.getItem(CRED_USER_KEY);
}

export async function checkPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    if (!isBiometricSupported()) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

// ── MODE 1: Platform — isi device ka fingerprint ──────────────────────────────
export async function registerBiometric(userEmail: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: makeChallenge(),
        rp: { name: RP_NAME, id: getRpId() },
        user: {
          id: encodeStr("sai-platform-" + userEmail),
          name: userEmail,
          displayName: "SAI Engineer",
        },
        pubKeyCredParams: [
          { alg: -7,   type: "public-key" },  // ES256
          { alg: -257, type: "public-key" },  // RS256 (Windows Hello)
          { alg: -8,   type: "public-key" },  // EdDSA
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",  // isi device ka biometric
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    }) as PublicKeyCredential | null;

    if (!credential) return { ok: false, error: "Registration cancel ho gaya" };

    localStorage.setItem(CRED_KEY, b64encode(credential.rawId));
    localStorage.setItem(CRED_USER_KEY, userEmail);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: parseError(err) };
  }
}

export async function authenticateBiometric(): Promise<{ ok: boolean; email?: string; error?: string }> {
  try {
    const credId    = localStorage.getItem(CRED_KEY);
    const userEmail = localStorage.getItem(CRED_USER_KEY);
    if (!credId) return { ok: false, error: "Pehle is device par fingerprint register karo" };

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: makeChallenge(),
        rpId: getRpId(),
        allowCredentials: [{
          type: "public-key",
          id: b64decode(credId),
          transports: ["internal"],
        }],
        userVerification: "required",
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!assertion) return { ok: false, error: "Verification fail ho gaya" };
    return { ok: true, email: userEmail ?? "engineer@sairolotech.local" };
  } catch (err) {
    return { ok: false, error: parseError(err) };
  }
}

// ── MODE 2: Cross-Device — Laptop pe QR, Mobile se fingerprint ────────────────
//
//  Kaise kaam karta hai:
//  1. Laptop: "Mobile se Login Setup" click karo → browser QR code dikhata hai
//  2. Mobile: Camera se QR scan karo (Android Chrome / iOS Safari)
//  3. Mobile: "Passkey banana hai?" prompt aata hai → fingerprint lagao
//  4. Credential mobile pe store hota hai (Bluetooth/hybrid channel se)
//  5. Login: Laptop pe "Mobile se Login" dabao → browser phir QR/Bluetooth se
//     mobile ko ping karta hai → mobile pe fingerprint → laptop unlock!
//
//  Note: Browser apna khudd ka UI dikhata hai (QR dialog) — developer ko kuch
//        extra banana zaroori nahi. Chrome 108+, Safari 16+, Edge 108+ support karte hain.

export async function registerCrossDevice(userEmail: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // authenticatorAttachment bilkul specify nahi kiya →
    // Browser apne aap "Save to phone" / QR code option dikhayega
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: makeChallenge(),
        rp: { name: RP_NAME, id: getRpId() },
        user: {
          id: encodeStr("sai-crossdev-" + userEmail),
          name: userEmail,
          displayName: "SAI Engineer (Mobile)",
        },
        pubKeyCredParams: [
          { alg: -7,   type: "public-key" },  // ES256
          { alg: -257, type: "public-key" },  // RS256
          { alg: -8,   type: "public-key" },  // EdDSA
        ],
        authenticatorSelection: {
          // authenticatorAttachment: NOT SET → browser shows QR / phone option
          userVerification: "required",
          residentKey: "required",  // passkey — phone pe store hoga
        },
        timeout: 120000,  // 2 min — QR scan karne ka waqt
        attestation: "none",
      },
    }) as PublicKeyCredential | null;

    if (!credential) return { ok: false, error: "Setup cancel ho gaya" };

    localStorage.setItem(CROSS_CRED_KEY, b64encode(credential.rawId));
    localStorage.setItem(CRED_USER_KEY, userEmail);
    return { ok: true };
  } catch (err) {
    const msg = parseError(err);
    // Agar browser ne "cross-platform not supported" throw kiya, fallback batao
    if (msg.includes("NotSupportedError") || msg.includes("not supported")) {
      return { ok: false, error: "Aapka browser cross-device login support nahi karta. Chrome 108+ ya Safari 16+ use karo." };
    }
    return { ok: false, error: msg };
  }
}

export async function authenticateCrossDevice(): Promise<{ ok: boolean; email?: string; error?: string }> {
  try {
    const credId    = localStorage.getItem(CROSS_CRED_KEY);
    const userEmail = localStorage.getItem(CRED_USER_KEY);

    // allowCredentials mein cross-device credential + hybrid transport
    // Browser phir QR / Bluetooth se phone se connect karega
    const pubKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: makeChallenge(),
      rpId: getRpId(),
      userVerification: "required",
      timeout: 120000,
    };

    if (credId) {
      // Agar pehle se registered hai — direct connect karo
      pubKeyOptions.allowCredentials = [{
        type: "public-key",
        id: b64decode(credId),
        transports: ["hybrid", "internal", "cable"] as AuthenticatorTransport[],
      }];
    } else {
      // Koi credential nahi → browser passkey chooser dikhayega (QR, nearby phone, etc.)
      pubKeyOptions.allowCredentials = [];
    }

    const assertion = await navigator.credentials.get({
      publicKey: pubKeyOptions,
    }) as PublicKeyCredential | null;

    if (!assertion) return { ok: false, error: "Mobile verification fail" };

    // Store credential ID agar nahi tha
    if (!credId) {
      localStorage.setItem(CROSS_CRED_KEY, b64encode(assertion.rawId));
    }

    return { ok: true, email: userEmail ?? "engineer@sairolotech.local" };
  } catch (err) {
    return { ok: false, error: parseError(err) };
  }
}

// ── Remove registrations ───────────────────────────────────────────────────────
export function removeBiometricRegistration(): void {
  localStorage.removeItem(CRED_KEY);
  localStorage.removeItem(CRED_USER_KEY);
}

export function removeCrossDeviceRegistration(): void {
  localStorage.removeItem(CROSS_CRED_KEY);
  localStorage.removeItem(CRED_USER_KEY);
}
