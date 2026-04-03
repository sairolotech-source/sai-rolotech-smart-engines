/**
 * Service Worker Download Manager
 * Receives real-time download progress from sw.js
 * and exposes it as a simple event-driven API.
 */

export interface DownloadProgress {
  phase: "idle" | "starting" | "downloading" | "complete" | "error";
  done: number;
  total: number;
  progress: number; // 0–100
  kb: number;
  currentFile: string;
}

type ProgressCallback = (p: DownloadProgress) => void;

const listeners = new Set<ProgressCallback>();
let currentProgress: DownloadProgress = {
  phase: "idle",
  done: 0,
  total: 0,
  progress: 0,
  kb: 0,
  currentFile: "",
};

function notify(update: Partial<DownloadProgress>) {
  currentProgress = { ...currentProgress, ...update };
  listeners.forEach((cb) => cb(currentProgress));
}

function handleSWMessage(event: MessageEvent) {
  const { data } = event;
  if (!data?.type) return;

  switch (data.type) {
    case "PRECACHE_START":
      notify({ phase: "starting", progress: 0, done: 0 });
      break;

    case "PRECACHE_TOTAL":
      notify({ total: data.total });
      break;

    case "PRECACHE_PROGRESS":
      notify({
        phase: "downloading",
        done: data.done,
        total: data.total,
        progress: data.progress,
        kb: data.kb ?? 0,
        currentFile: data.file ?? "",
      });
      break;

    case "PRECACHE_COMPLETE":
      notify({
        phase: "complete",
        progress: 100,
        done: data.total,
        total: data.total,
        kb: data.kb ?? 0,
        currentFile: "",
      });
      break;

    case "PRECACHE_ERROR":
      notify({ phase: "error" });
      break;
  }
}

let registered = false;

export function initSWDownloadManager(): Promise<void> {
  if (!("serviceWorker" in navigator) || registered) return Promise.resolve();
  registered = true;

  navigator.serviceWorker.addEventListener("message", handleSWMessage);

  return new Promise((resolve) => {
    navigator.serviceWorker.ready.then((reg) => {
      // If SW is already controlling (returning visitor), trigger pre-cache check
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "START_PRECACHE" });
      }
      resolve();
    });
  });
}

export function onDownloadProgress(cb: ProgressCallback): () => void {
  listeners.add(cb);
  // Immediately call with current state
  cb(currentProgress);
  return () => listeners.delete(cb);
}

export function getDownloadProgress(): DownloadProgress {
  return currentProgress;
}
