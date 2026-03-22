import type { ProfileGeometry, GcodeConfig, MachineProfile, MaterialType, OpenSectionType } from "../store/useCncStore";
import { auth } from "./firebase";

function getApiUrl(path: string): string {
  const base = window.location.origin;
  return `${base}/api${path}`;
}

const CACHE_PREFIX = "sai-api-cache-";
const CACHE_TTL = 30 * 60 * 1000;
const OFFLINE_QUEUE_KEY = "sai-offline-queue";

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data as T;
  } catch { return null; }
}

function cacheSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage full — ignore */ }
}

interface OfflineQueueItem {
  id: string;
  url: string;
  method: string;
  body?: string;
  timestamp: string;
  label: string;
}

function queueOfflineRequest(url: string, method: string, body?: string, label?: string): void {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: OfflineQueueItem[] = raw ? JSON.parse(raw) : [];
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url, method,
      body,
      timestamp: new Date().toISOString(),
      label: label ?? url,
    });
    if (queue.length > 50) queue.splice(0, queue.length - 50);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch { /* ignore */ }
}

export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

export class OfflineError extends Error {
  isOffline = true;
  constructor(message: string) {
    super(message);
    this.name = "OfflineError";
  }
}

const OFFLINE_TOKEN = "offline-sai-rolotech-local";

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
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
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new OfflineError("Server response timeout — network slow ya offline hai. Local data se kaam chalayein.");
    }
    throw new OfflineError("Network unavailable — app offline mode mein hai. Internet connect hone par data sync ho jayega.");
  }
}

async function authFetchJson(url: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return authFetch(url, {
    method: body !== undefined ? "POST" : "GET",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function safeFetchWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: { skipCache?: boolean; queueLabel?: string }
): Promise<T> {
  try {
    const result = await fetcher();
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    if (err instanceof OfflineError) {
      const cached = cacheGet<T>(cacheKey);
      if (cached) return cached;
    }
    throw err;
  }
}

export async function uploadDxf(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetch(getApiUrl("/upload-dxf"), {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
  return res.json();
}

export async function analyzeProfile(
  material: string,
  thickness: number,
  bends: { bend_angle: number }[]
) {
  const cacheKey = `analyze-${material}-${thickness}-${bends.length}`;
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetchJson(getApiUrl("/analyze-profile"), { material, thickness, bends });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Analysis failed" }));
      throw new Error(err.error || "Analysis failed");
    }
    return res.json();
  });
}

export async function generateFlower(
  geometry: ProfileGeometry,
  numStations: number,
  stationPrefix: string,
  materialType: MaterialType = "GI",
  materialThickness: number = 1.0,
  openSectionType: OpenSectionType = "C-Section",
  sectionModel?: "open" | "closed" | null
) {
  const cacheKey = `flower-${numStations}-${materialType}-${materialThickness}-${openSectionType}`;
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetchJson(getApiUrl("/generate-flower"), { geometry, numStations, stationPrefix, materialType, materialThickness, openSectionType, sectionModel: sectionModel ?? undefined });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Generation failed" }));
      throw new Error(err.error || "Generation failed");
    }
    return res.json();
  });
}

export async function generateGcode(
  geometry: ProfileGeometry,
  numStations: number,
  stationPrefix: string,
  config: GcodeConfig,
  machineProfile: MachineProfile | null
) {
  const cacheKey = `gcode-${numStations}-${config.postProcessor}-${config.spindleSpeed}`;
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetchJson(getApiUrl("/generate-gcode"), { geometry, numStations, stationPrefix, config, machineProfile });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Generation failed" }));
      throw new Error(err.error || "Generation failed");
    }
    return res.json();
  });
}

export async function generateRollTooling(
  geometry: ProfileGeometry,
  numStations: number,
  stationPrefix: string,
  materialThickness: number,
  rollDiameter: number,
  shaftDiameter: number,
  clearance: number,
  materialType: string = "GI",
  postProcessorId: string = "delta_2x",
  openSectionType: OpenSectionType = "C-Section",
  sectionModel?: "open" | "closed" | null
) {
  const cacheKey = `tooling-${numStations}-${rollDiameter}-${shaftDiameter}-${materialType}`;
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetchJson(getApiUrl("/generate-roll-tooling"), {
      geometry, numStations, stationPrefix, materialThickness,
      rollDiameter, shaftDiameter, clearance, materialType, postProcessorId, openSectionType,
      sectionModel: sectionModel ?? undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Generation failed" }));
      throw new Error(err.error || "Generation failed");
    }
    return res.json();
  });
}

export async function uploadReferences(files: File[]) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const res = await authFetch(getApiUrl("/upload-references"), {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
  return res.json();
}

export async function saveProject(data: {
  projectName: string;
  material: string;
  thickness: number;
  numStations: number;
  stationPrefix: string;
  lineSpeed: number;
  rollDiameter: number;
  shaftDiameter: number;
  clearance: number;
  profileName: string;
  fileName: string;
  bends?: { bend_angle?: number; bend_radius?: number; side?: string }[];
  analysis?: {
    bendCount: number;
    suggestedPasses: number;
    riskLevel: string;
    totalBendAngle: number;
    notes?: object;
  } | null;
}) {
  try {
    const res = await authFetchJson(getApiUrl("/projects"), data);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Save failed" }));
      throw new Error(err.error || "Save failed");
    }
    const result = await res.json();
    cacheSet(`project-${data.projectName}`, data);
    return result;
  } catch (err) {
    if (err instanceof OfflineError) {
      cacheSet(`project-${data.projectName}`, data);
      queueOfflineRequest(
        getApiUrl("/projects"), "POST",
        JSON.stringify(data),
        `Save Project: ${data.projectName}`
      );
      return { success: true, savedLocally: true, message: "Project locally saved — server sync pending." };
    }
    throw err;
  }
}

export async function listProjects(userId: string) {
  const cacheKey = `projects-list-${userId}`;
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetch(getApiUrl(`/projects?userId=${encodeURIComponent(userId)}`));
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Fetch failed" }));
      throw new Error(err.error || "Fetch failed");
    }
    return res.json();
  });
}

export async function deleteProject(id: string) {
  try {
    const res = await authFetch(getApiUrl(`/projects/${id}`), { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Delete failed" }));
      throw new Error(err.error || "Delete failed");
    }
    return res.json();
  } catch (err) {
    if (err instanceof OfflineError) {
      queueOfflineRequest(getApiUrl(`/projects/${id}`), "DELETE", undefined, `Delete Project: ${id}`);
      return { success: true, queuedForSync: true };
    }
    throw err;
  }
}

export async function uploadReference(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetch(getApiUrl("/upload-reference"), {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
  return res.json();
}

export async function calcStripWidth(data: {
  segments: { startX: number; startY: number; endX: number; endY: number }[];
  materialThickness: number;
  materialType: string;
  insideBendRadius?: number;
}) {
  const cacheKey = `strip-${data.materialType}-${data.materialThickness}-${data.segments.length}`;
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetchJson(getApiUrl("/strip-width"), data);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Calculation failed" }));
      throw new Error(err.error || "Strip width calculation failed");
    }
    return res.json();
  });
}

export async function getDriveStatus() {
  try {
    const res = await authFetch(getApiUrl("/drive/status"));
    if (!res.ok) throw new Error("Failed to get Drive status");
    return res.json() as Promise<{ connected: boolean; user?: { displayName?: string; emailAddress?: string } }>;
  } catch (err) {
    if (err instanceof OfflineError) {
      return { connected: false } as { connected: boolean; user?: { displayName?: string; emailAddress?: string } };
    }
    throw err;
  }
}

export async function backupProjectToDrive(projectId: string) {
  const res = await authFetch(getApiUrl(`/drive/backup/${projectId}`), { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Backup failed" }));
    throw new Error(err.error || "Backup failed");
  }
  return res.json() as Promise<{ success: boolean; file: { id: string; name: string; createdTime: string; size: string } }>;
}

export async function listDriveBackups() {
  try {
    const res = await authFetch(getApiUrl("/drive/backups"));
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to list backups" }));
      throw new Error(err.error || "Failed to list backups");
    }
    return res.json() as Promise<{ success: boolean; backups: { id: string; name: string; createdTime: string; size: string; description?: string }[] }>;
  } catch (err) {
    if (err instanceof OfflineError) {
      return { success: false, backups: [] } as { success: boolean; backups: { id: string; name: string; createdTime: string; size: string; description?: string }[] };
    }
    throw err;
  }
}

export async function restoreFromDrive(fileId: string) {
  const res = await authFetch(getApiUrl(`/drive/restore/${fileId}`), { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Restore failed" }));
    throw new Error(err.error || "Restore failed");
  }
  return res.json();
}

export async function disconnectDrive() {
  const res = await authFetch(getApiUrl("/drive/disconnect"), { method: "POST" });
  if (!res.ok) throw new Error("Failed to disconnect");
  return res.json();
}

export async function autoBackupProjectToDrive(projectId: string) {
  try {
    const res = await authFetch(getApiUrl(`/drive/auto-backup/${projectId}`), { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Auto-backup failed" }));
      throw new Error(err.error || "Auto-backup failed");
    }
    return res.json() as Promise<{ success: boolean; file: { id: string; name: string; createdTime: string; size: string }; isAutoBackup: boolean }>;
  } catch (err) {
    if (err instanceof OfflineError) {
      return { success: false, file: { id: "", name: "", createdTime: "", size: "" }, isAutoBackup: true };
    }
    throw err;
  }
}

export async function listBackupVersions(projectName: string) {
  try {
    const res = await authFetch(getApiUrl(`/drive/backup-versions/${encodeURIComponent(projectName)}`));
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to list versions" }));
      throw new Error(err.error || "Failed to list versions");
    }
    return res.json() as Promise<{ success: boolean; versions: { id: string; name: string; createdTime: string; size: string; description?: string }[] }>;
  } catch (err) {
    if (err instanceof OfflineError) {
      return { success: false, versions: [] } as { success: boolean; versions: { id: string; name: string; createdTime: string; size: string; description?: string }[] };
    }
    throw err;
  }
}

export async function exportToSheets(projectId: string) {
  const res = await authFetch(getApiUrl(`/drive/export-sheets/${projectId}`), { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Export failed" }));
    throw new Error(err.error || "Export to Sheets failed");
  }
  return res.json() as Promise<{ success: boolean; spreadsheetId: string; spreadsheetUrl: string; name: string; note?: string }>;
}

export async function getSystemInfo() {
  const cacheKey = "system-info";
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetch(getApiUrl("/system/info"));
    if (!res.ok) throw new Error("Failed to get system info");
    return res.json();
  });
}

export async function aiAdviseFlower(payload: {
  materialType: string;
  thickness: number;
  totalBends: number;
  bendAngles?: number[];
  profileWidth?: number;
  flangeHeights?: number[];
  profileComplexity?: string;
}) {
  const cacheKey = `ai-flower-${payload.materialType}-${payload.thickness}-${payload.totalBends}`;
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetchJson(getApiUrl("/ai/advise-flower"), payload);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "AI flower advice failed" }));
      throw new Error(err.error || "AI flower advice failed");
    }
    return res.json() as Promise<{ success: boolean; advice: Record<string, unknown>; mode: "online" | "offline" }>;
  });
}

export async function aiAnalyzeDesign(payload: {
  materialType: string;
  thickness: number;
  numStations: number;
  totalBends: number;
  bendAngles?: number[];
  rollDiameter?: number;
  shaftDiameter?: number;
  lineSpeed?: number;
  profileComplexity?: string;
  kFactor?: number;
  maxThinningRatio?: number;
}) {
  const cacheKey = `ai-design-${payload.materialType}-${payload.thickness}-${payload.numStations}`;
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetchJson(getApiUrl("/ai/analyze-design"), payload);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "AI design analysis failed" }));
      throw new Error(err.error || "AI design analysis failed");
    }
    return res.json() as Promise<{ success: boolean; analysis: Record<string, unknown>; mode: "online" | "offline" }>;
  });
}

export async function aiRecommendTools(payload: {
  materialType: string;
  thickness: number;
  rollDiameter?: number;
  shaftDiameter?: number;
  profileComplexity?: string;
  totalBends?: number;
  surfaceFinishRequired?: string;
}) {
  const cacheKey = `ai-tools-${payload.materialType}-${payload.thickness}`;
  return safeFetchWithCache(cacheKey, async () => {
    const res = await authFetchJson(getApiUrl("/ai/recommend-tools"), payload);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "AI tool recommendation failed" }));
      throw new Error(err.error || "AI tool recommendation failed");
    }
    return res.json() as Promise<{ success: boolean; recommendation: Record<string, unknown>; mode: "online" | "offline" }>;
  });
}

export async function aiOptimizeGcode(payload: {
  gcode: string;
  materialType?: string;
  machineType?: string;
  rollDiameter?: number;
  feedRate?: number;
  spindleSpeed?: number;
}) {
  const res = await authFetchJson(getApiUrl("/ai/optimize-gcode"), payload);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "AI G-code optimization failed" }));
    throw new Error(err.error || "AI G-code optimization failed");
  }
  return res.json() as Promise<{ success: boolean; optimization: Record<string, unknown>; mode: "online" | "offline" }>;
}

export interface GcodeOutputPayload {
  label: string;
  gcode: string;
  stationNumber?: number;
  lineCount?: number;
  totalPathLength?: number;
}

export interface RollToolingPayload {
  stationNumber: number;
  label: string;
  rollProfile: {
    upperRoll: unknown[];
    lowerRoll: unknown[];
    upperLatheGcode?: string;
    lowerLatheGcode?: string;
    [key: string]: unknown;
  };
}

export async function saveJobPackage(payload: {
  baseDir?: string;
  profileName: string;
  geometry?: unknown;
  stations?: unknown[];
  rollTooling?: RollToolingPayload[];
  gcodeOutputs?: GcodeOutputPayload[];
  bomText?: string;
  setupSheetText?: string;
  qualityChecklistText?: string;
  coverPageHtml?: string;
  readmeText?: string;
}) {
  try {
    const res = await authFetchJson(getApiUrl("/files/save-job-package"), payload);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Save job package failed" }));
      throw new Error(err.error || "Save job package failed");
    }
    return res.json() as Promise<{
      success: boolean;
      projectRoot: string;
      paths: {
        projectRoot: string;
        flowerPattern: string;
        rollsTop: string;
        rollsBottom: string;
        cncCode: string;
      };
      savedFiles: string[];
      fileCount: number;
    }>;
  } catch (err) {
    if (err instanceof OfflineError) {
      cacheSet(`job-pkg-${payload.profileName}`, payload);
      queueOfflineRequest(
        getApiUrl("/files/save-job-package"), "POST",
        JSON.stringify(payload),
        `Save Job Package: ${payload.profileName}`
      );
      return {
        success: true,
        projectRoot: "(offline-queued)",
        paths: { projectRoot: "", flowerPattern: "", rollsTop: "", rollsBottom: "", cncCode: "" },
        savedFiles: [],
        fileCount: 0,
      };
    }
    throw err;
  }
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: OfflineQueueItem[] = [];

  for (const item of queue) {
    try {
      const res = await authFetch(item.url, {
        method: item.method,
        headers: item.body ? { "Content-Type": "application/json" } : undefined,
        body: item.body,
      });
      if (res.ok) {
        synced++;
      } else {
        failed++;
        remaining.push(item);
      }
    } catch {
      failed++;
      remaining.push(item);
    }
  }

  if (remaining.length) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } else {
    clearOfflineQueue();
  }
  return { synced, failed };
}
