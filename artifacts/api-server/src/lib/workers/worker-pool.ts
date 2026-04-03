import os from "os";
import { Worker, isMainThread, workerData, parentPort } from "worker_threads";

const CPU_CORES = os.cpus().length;
// Use ALL cores minus one (reserved for the Node.js event loop)
const POOL_SIZE = Math.max(1, CPU_CORES - 1);

let tasksCompleted = 0;
let tasksRunning = 0;
let totalComputeMs = 0;

// ─── Inline worker code ───────────────────────────────────────────────────────
// Each worker receives { fn: string, args: unknown[] } and evaluates fn with args.
const WORKER_SRC = `
const { workerData, parentPort } = require('worker_threads');
parentPort.on('message', async ({ id, fn, args }) => {
  const start = Date.now();
  try {
    const result = await (new Function('return (' + fn + ')')())(...(args || []));
    parentPort.postMessage({ id, result, ms: Date.now() - start });
  } catch (err) {
    parentPort.postMessage({ id, error: String(err), ms: Date.now() - start });
  }
});
`;

// ─── Worker pool ──────────────────────────────────────────────────────────────
interface PoolEntry {
  worker: Worker;
  busy: boolean;
}

interface PoolTask {
  id: string;
  fn: string;
  args: unknown[];
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

const pool: PoolEntry[] = [];
const queue: PoolTask[] = [];
let taskCounter = 0;

function buildPool() {
  if (pool.length > 0) return;
  for (let i = 0; i < POOL_SIZE; i++) {
    const w = new Worker(WORKER_SRC, {
      eval: true,
      resourceLimits: {
        maxOldGenerationSizeMb: 512,
        maxYoungGenerationSizeMb: 64,
      },
    });
    const entry: PoolEntry = { worker: w, busy: false };
    w.on("message", (msg) => onWorkerMessage(entry, msg));
    w.on("error", (err) => {
      console.error(`[WorkerPool] Worker error:`, err);
      entry.busy = false;
      tasksRunning = Math.max(0, tasksRunning - 1);
      drainQueue();
    });
    pool.push(entry);
  }
  console.log(`[WorkerPool] ${POOL_SIZE} threads started (${CPU_CORES} CPU cores detected)`);
}

function onWorkerMessage(entry: PoolEntry, msg: { id: string; result?: unknown; error?: string; ms: number }) {
  entry.busy = false;
  tasksRunning = Math.max(0, tasksRunning - 1);
  tasksCompleted++;
  totalComputeMs += msg.ms ?? 0;

  const idx = queue.findIndex((t) => t.id === msg.id);
  if (idx >= 0) {
    const task = queue.splice(idx, 1)[0];
    if (msg.error) task.reject(new Error(msg.error));
    else task.resolve(msg.result);
  }
  drainQueue();
}

function drainQueue() {
  for (const entry of pool) {
    if (!entry.busy && queue.length > 0) {
      const pending = queue.find((t) => !(t as any)._sent);
      if (pending) {
        (pending as any)._sent = true;
        entry.busy = true;
        tasksRunning++;
        entry.worker.postMessage({ id: pending.id, fn: pending.fn, args: pending.args });
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getWorkerPoolStats() {
  return {
    poolSize: POOL_SIZE,
    cpuCores: CPU_CORES,
    tasksRunning,
    tasksCompleted,
    avgComputeMs: tasksCompleted > 0 ? Math.round(totalComputeMs / tasksCompleted) : 0,
    status: "active",
  };
}

/**
 * Run `fn` with `args` on a background worker thread.
 * fn must be serialisable (no closures over external scope).
 */
export function runInWorkerPool<T>(fn: (...args: any[]) => T, ...args: unknown[]): Promise<T> {
  buildPool();
  return new Promise<T>((resolve, reject) => {
    const id = `wp-${++taskCounter}-${Date.now()}`;
    const task: PoolTask = { id, fn: fn.toString(), args, resolve: resolve as any, reject };
    queue.push(task);
    drainQueue();
  });
}

/**
 * Convenience: run a synchronous CPU-bound function and return its result.
 */
export async function runCompute<T>(fn: (...args: any[]) => T, ...args: unknown[]): Promise<T> {
  return runInWorkerPool(fn, ...args);
}

export function terminatePool(): void {
  pool.forEach(({ worker }) => worker.terminate());
  pool.length = 0;
  queue.length = 0;
}
