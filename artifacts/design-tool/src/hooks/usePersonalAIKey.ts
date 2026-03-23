import { useState, useCallback } from "react";

const KEYS_STORAGE = "sai_gemini_keys";
const ACTIVE_STORAGE = "sai_active_gemini_key";
export const MAX_KEYS = 8;

export interface SavedKey {
  id: string;
  label: string;
  key: string;
  addedAt: string;
  failed?: boolean;
}

function loadKeys(): SavedKey[] {
  try { return JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "[]") as SavedKey[]; } catch { return []; }
}

function saveKeys(keys: SavedKey[]) {
  try { localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys)); } catch {}
}

function loadActiveId(): string {
  try { return localStorage.getItem(ACTIVE_STORAGE) ?? ""; } catch { return ""; }
}

function saveActiveId(id: string) {
  try { localStorage.setItem(ACTIVE_STORAGE, id); } catch {}
}

export function getPersonalGeminiKey(): string {
  const keys = loadKeys();
  const activeId = loadActiveId();
  const active = keys.find(k => k.id === activeId) ?? keys.find(k => !k.failed) ?? keys[0];
  return active?.key ?? "";
}

export function getActiveKeyInfo(): { key: string; id: string; label: string } | null {
  const keys = loadKeys();
  const activeId = loadActiveId();
  const active = keys.find(k => k.id === activeId) ?? keys.find(k => !k.failed) ?? keys[0];
  if (!active) return null;
  return { key: active.key, id: active.id, label: active.label };
}

export function autoSwitchToNextKey(currentId: string): { switched: boolean; newLabel: string; newId: string } {
  const keys = loadKeys();
  const currentIndex = keys.findIndex(k => k.id === currentId);
  const remaining = keys.filter((k, i) => i !== currentIndex && !k.failed);
  if (remaining.length === 0) {
    return { switched: false, newLabel: "", newId: "" };
  }
  const next = remaining[0]!;
  saveActiveId(next.id);
  return { switched: true, newLabel: next.label, newId: next.id };
}

export function markKeyFailed(id: string) {
  const keys = loadKeys();
  const updated = keys.map(k => k.id === id ? { ...k, failed: true } : k);
  saveKeys(updated);
}

export function clearKeyFailed(id: string) {
  const keys = loadKeys();
  const updated = keys.map(k => k.id === id ? { ...k, failed: false } : k);
  saveKeys(updated);
}

export function getActiveKeyLabel(): string {
  const keys = loadKeys();
  const activeId = loadActiveId();
  const active = keys.find(k => k.id === activeId) ?? keys[0];
  return active?.label ?? "";
}

export function getAllKeysForFallback(): { id: string; key: string; label: string }[] {
  const keys = loadKeys();
  const activeId = loadActiveId();
  const active = keys.find(k => k.id === activeId && !k.failed);
  const rest = keys.filter(k => k.id !== activeId && !k.failed);
  const ordered = active ? [active, ...rest] : rest;
  return ordered.map(k => ({ id: k.id, key: k.key, label: k.label }));
}

export function markKeyFailedById(id: string) {
  markKeyFailed(id);
  const keys = loadKeys().filter(k => !k.failed);
  if (keys.length > 0) saveActiveId(keys[0]!.id);
}

export function usePersonalAIKey() {
  const [keys, setKeys] = useState<SavedKey[]>(() => loadKeys());
  const [activeId, setActiveIdState] = useState<string>(() => {
    const stored = loadActiveId();
    const all = loadKeys();
    if (stored && all.find(k => k.id === stored)) return stored;
    const first = all[0];
    if (first) { saveActiveId(first.id); return first.id; }
    return "";
  });

  const hasKey = keys.length > 0;
  const atLimit = keys.length >= MAX_KEYS;
  const activeKey = keys.find(k => k.id === activeId) ?? keys[0];

  const addKey = useCallback((label: string, key: string): string => {
    const all = loadKeys();
    if (all.length >= MAX_KEYS) return "";
    const newEntry: SavedKey = {
      id: `key_${Date.now()}`,
      label: label.trim() || `Key ${all.length + 1}`,
      key: key.trim(),
      addedAt: new Date().toLocaleDateString("en-IN"),
      failed: false,
    };
    const updated = [...all, newEntry];
    saveKeys(updated);
    saveActiveId(newEntry.id);
    setKeys(updated);
    setActiveIdState(newEntry.id);
    return newEntry.id;
  }, []);

  const removeKey = useCallback((id: string) => {
    const all = loadKeys().filter(k => k.id !== id);
    saveKeys(all);
    setKeys(all);
    setActiveIdState(prev => {
      if (prev === id) {
        const next = all[0]?.id ?? "";
        saveActiveId(next);
        return next;
      }
      return prev;
    });
  }, []);

  const setActive = useCallback((id: string) => {
    saveActiveId(id);
    setActiveIdState(id);
  }, []);

  const markFailed = useCallback((id: string) => {
    markKeyFailed(id);
    setKeys(loadKeys());
  }, []);

  const clearFailed = useCallback((id: string) => {
    clearKeyFailed(id);
    setKeys(loadKeys());
  }, []);

  const switchToNext = useCallback((currentId: string) => {
    const result = autoSwitchToNextKey(currentId);
    if (result.switched) {
      setActiveIdState(result.newId);
      setKeys(loadKeys());
    }
    return result;
  }, []);

  return { keys, activeId, activeKey, hasKey, atLimit, addKey, removeKey, setActive, markFailed, clearFailed, switchToNext };
}
