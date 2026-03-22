import { useState, useCallback } from "react";

const STORAGE_KEY = "sai_personal_gemini_key";

export function usePersonalAIKey() {
  const [key, setKeyState] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
  });

  const saveKey = useCallback((newKey: string) => {
    try {
      if (newKey.trim()) {
        localStorage.setItem(STORAGE_KEY, newKey.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      setKeyState(newKey.trim());
    } catch {}
  }, []);

  const clearKey = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setKeyState("");
  }, []);

  return { key, saveKey, clearKey, hasKey: key.trim().length > 0 };
}

export function getPersonalGeminiKey(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}
