const BACKUP_KEY_PREFIX = "sai-rolotech-backup-";
const BACKUP_INDEX_KEY = "sai-rolotech-backup-index";
const MAX_BACKUPS = 50;
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;
const STORE_KEY = "sai-rolotech-smart-enginesai-cnc-v3";

interface BackupEntry {
  id: string;
  timestamp: number;
  date: string;
  sizeKB: number;
  tab: string;
  profileName: string;
  materialType: string;
  stations: number;
  auto: boolean;
}

function getBackupIndex(): BackupEntry[] {
  try {
    const raw = localStorage.getItem(BACKUP_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBackupIndex(index: BackupEntry[]): void {
  try {
    localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(index));
  } catch {}
}

export function createBackup(manual = false): BackupEntry | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const state = parsed?.state || parsed;

    const id = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const sizeKB = Math.round(raw.length / 1024);

    const entry: BackupEntry = {
      id,
      timestamp: now,
      date: new Date(now).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }),
      sizeKB,
      tab: state.activeTab || "setup",
      profileName: state.profileName || "Untitled",
      materialType: state.materialType || "GI",
      stations: state.stations?.length || 0,
      auto: !manual,
    };

    localStorage.setItem(BACKUP_KEY_PREFIX + id, raw);

    const index = getBackupIndex();
    index.unshift(entry);

    while (index.length > MAX_BACKUPS) {
      const old = index.pop();
      if (old) {
        try { localStorage.removeItem(BACKUP_KEY_PREFIX + old.id); } catch {}
      }
    }

    saveBackupIndex(index);
    return entry;
  } catch (err) {
    console.error("[AutoBackup] Failed to create backup:", err);
    return null;
  }
}

export function restoreBackup(id: string): boolean {
  try {
    const data = localStorage.getItem(BACKUP_KEY_PREFIX + id);
    if (!data) return false;

    localStorage.setItem(STORE_KEY, data);
    return true;
  } catch {
    return false;
  }
}

export function deleteBackup(id: string): void {
  try {
    localStorage.removeItem(BACKUP_KEY_PREFIX + id);
    const index = getBackupIndex().filter(b => b.id !== id);
    saveBackupIndex(index);
  } catch {}
}

export function getBackups(): BackupEntry[] {
  return getBackupIndex();
}

export function getBackupData(id: string): string | null {
  try {
    return localStorage.getItem(BACKUP_KEY_PREFIX + id);
  } catch {
    return null;
  }
}

export function exportBackupAsFile(id: string): void {
  const data = getBackupData(id);
  if (!data) return;

  const index = getBackupIndex();
  const entry = index.find(b => b.id === id);
  const filename = `sai-rolotech-backup-${entry?.profileName || "project"}-${new Date().toISOString().slice(0, 10)}.json`;

  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackupFromFile(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        JSON.parse(text);
        localStorage.setItem(STORE_KEY, text);
        createBackup(true);
        resolve(true);
      } catch {
        resolve(false);
      }
    };
    reader.onerror = () => resolve(false);
    reader.readAsText(file);
  });
}

export function getStorageUsage(): { usedKB: number; totalBackupKB: number; backupCount: number } {
  let totalSize = 0;
  let backupSize = 0;
  let backupCount = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      const size = (key.length + (val?.length || 0)) * 2;
      totalSize += size;

      if (key.startsWith(BACKUP_KEY_PREFIX)) {
        backupSize += size;
        backupCount++;
      }
    }
  } catch {}

  return {
    usedKB: Math.round(totalSize / 1024),
    totalBackupKB: Math.round(backupSize / 1024),
    backupCount,
  };
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastBackupHash = "";

export function startAutoBackup(): void {
  if (intervalId) return;

  createBackup(false);

  intervalId = setInterval(() => {
    try {
      const currentData = localStorage.getItem(STORE_KEY) || "";
      const hash = simpleHash(currentData);

      if (hash !== lastBackupHash) {
        const entry = createBackup(false);
        if (entry) {
          lastBackupHash = hash;
          console.log(`[AutoBackup] Saved at ${entry.date} (${entry.sizeKB} KB)`);
        }
      } else {
        console.log("[AutoBackup] No changes detected, skipping backup");
      }
    } catch {}
  }, BACKUP_INTERVAL_MS);

  console.log(`[AutoBackup] Started — saving every ${BACKUP_INTERVAL_MS / 60000} minutes`);
}

export function stopAutoBackup(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[AutoBackup] Stopped");
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    createBackup(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      createBackup(false);
    }
  });
}
