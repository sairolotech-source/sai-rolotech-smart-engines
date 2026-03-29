/**
 * SAI Rolotech — Structured Engineering Logger (Phase 9)
 * Logs input data, calculation results, missing fields, and crash reasons.
 * Never throws — silent on any internal error.
 */

export type LogLevel = "info" | "warn" | "error" | "calc" | "missing";

export interface EngineLogEntry {
  ts: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

const MAX_ENTRIES = 200;
const STORAGE_KEY = "sai-rolotech-engine-log";

let _sessionLog: EngineLogEntry[] = [];

function write(level: LogLevel, module: string, message: string, data?: unknown) {
  try {
    const entry: EngineLogEntry = {
      ts: new Date().toISOString(),
      level,
      module,
      message,
      data,
    };
    _sessionLog.unshift(entry);
    if (_sessionLog.length > MAX_ENTRIES) _sessionLog.length = MAX_ENTRIES;

    const prefix = `[SAI:${module.toUpperCase()}]`;
    if (level === "error") {
      console.error(`${prefix} ${message}`, data ?? "");
    } else if (level === "warn" || level === "missing") {
      console.warn(`${prefix} ${message}`, data ?? "");
    } else {
      console.log(`${prefix} [${level}] ${message}`, data ?? "");
    }

    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      stored.unshift(entry);
      if (stored.length > MAX_ENTRIES) stored.length = MAX_ENTRIES;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch { /* quota or parse error — ignore */ }
  } catch { /* never throw */ }
}

export const EngineLogger = {
  info: (module: string, message: string, data?: unknown) => write("info", module, message, data),
  warn: (module: string, message: string, data?: unknown) => write("warn", module, message, data),
  error: (module: string, message: string, data?: unknown) => write("error", module, message, data),
  calc: (module: string, message: string, data?: unknown) => write("calc", module, message, data),
  missing: (module: string, field: string, data?: unknown) =>
    write("missing", module, `Missing field: ${field}`, data),

  /** Log incoming input data before a calculation. */
  logInput: (module: string, inputs: Record<string, unknown>) => {
    const missing: string[] = [];
    for (const [k, v] of Object.entries(inputs)) {
      if (v === undefined || v === null || v === "") missing.push(k);
    }
    if (missing.length > 0) {
      write("missing", module, `Input missing: ${missing.join(", ")}`, inputs);
    } else {
      write("info", module, "Input validated", inputs);
    }
  },

  /** Log a calculation result summary. */
  logResult: (module: string, result: Record<string, unknown>) => {
    write("calc", module, "Calculation complete", result);
  },

  /** Log a crash reason with context. */
  logCrash: (module: string, error: unknown, context?: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    write("error", module, `CRASH: ${msg}`, context);
  },

  /** Get all session logs. */
  getLogs: (): EngineLogEntry[] => [..._sessionLog],

  /** Clear all logs. */
  clear: () => {
    _sessionLog = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  },
};
