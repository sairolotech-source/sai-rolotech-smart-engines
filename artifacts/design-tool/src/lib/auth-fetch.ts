import { auth } from "./firebase";

const OFFLINE_TOKEN = "offline-sai-rolotech-local";

export function getApiUrl(path: string): string {
  return `${window.location.origin}/api${path}`;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  const headers = new Headers(options.headers || {});

  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch {
      headers.set("Authorization", `Bearer ${OFFLINE_TOKEN}`);
    }
  } else {
    headers.set("Authorization", `Bearer ${OFFLINE_TOKEN}`);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timeout — server is not responding");
    }
    throw new Error("Network unavailable — offline mode active");
  }
}
