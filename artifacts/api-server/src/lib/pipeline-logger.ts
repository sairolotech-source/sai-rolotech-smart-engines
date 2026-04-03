/**
 * pipeline-logger.ts — P1.K Audit & Traceability Pipeline Logger
 *
 * Records each pipeline step result with timestamp, status, and data snapshot.
 * Steps: parse → normalize → thickness-apply → dimensions → flower → tooling → export
 * Provides downloadable debug report.
 */

export type PipelineStepName =
  | "dxf-parse"
  | "geometry-normalize"
  | "centerline-convert"
  | "dimension-extract"
  | "flower-pattern"
  | "pass-progression"
  | "roll-tooling"
  | "springback"
  | "interference-check"
  | "export-validate"
  | "export-dxf"
  | "export-gcode"
  | "export-pdf";

export type StepStatus = "pending" | "running" | "pass" | "fail" | "skipped" | "warning";

export interface PipelineStep {
  name: PipelineStepName;
  status: StepStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  message: string;
  warnings: string[];
  errors: string[];
  dataSnapshot?: Record<string, unknown>;
}

export interface PipelineSession {
  sessionId: string;
  startedAt: number;
  completedAt?: number;
  steps: PipelineStep[];
  overallStatus: "in-progress" | "complete" | "failed" | "partial";
  summary: string;
}

// In-memory session store (per server instance)
const sessions = new Map<string, PipelineSession>();
const MAX_SESSIONS = 100;

function generateSessionId(): string {
  return `PL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function startSession(): string {
  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    sessionId,
    startedAt: Date.now(),
    steps: [],
    overallStatus: "in-progress",
    summary: "Pipeline started",
  });

  // Rotate old sessions
  if (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.keys()][0];
    if (oldest) sessions.delete(oldest);
  }

  return sessionId;
}

export function logStep(
  sessionId: string,
  name: PipelineStepName,
  status: StepStatus,
  message: string,
  options: {
    warnings?: string[];
    errors?: string[];
    dataSnapshot?: Record<string, unknown>;
  } = {},
): PipelineStep {
  const session = sessions.get(sessionId);
  const now = Date.now();

  const step: PipelineStep = {
    name,
    status,
    startedAt: now,
    completedAt: now,
    durationMs: 0,
    message,
    warnings: options.warnings ?? [],
    errors: options.errors ?? [],
    dataSnapshot: options.dataSnapshot,
  };

  if (session) {
    // Update existing step if same name, otherwise append
    const existing = session.steps.find(s => s.name === name);
    if (existing) {
      const startedAt = existing.startedAt;
      Object.assign(existing, { ...step, startedAt, durationMs: now - startedAt });
    } else {
      session.steps.push(step);
    }

    // Update overall status
    const failed = session.steps.some(s => s.status === "fail");
    const allDone = session.steps.every(s => ["pass", "fail", "skipped", "warning"].includes(s.status));
    if (failed) session.overallStatus = "failed";
    else if (allDone) session.overallStatus = "complete";
    else session.overallStatus = "in-progress";

    session.summary = buildSummary(session.steps);
  }

  return step;
}

function buildSummary(steps: PipelineStep[]): string {
  const pass = steps.filter(s => s.status === "pass").length;
  const fail = steps.filter(s => s.status === "fail").length;
  const warn = steps.filter(s => s.status === "warning").length;
  const parts: string[] = [];
  if (pass > 0) parts.push(`${pass} passed`);
  if (warn > 0) parts.push(`${warn} warned`);
  if (fail > 0) parts.push(`${fail} FAILED`);
  return parts.join(", ") || "No steps recorded";
}

export function getSession(sessionId: string): PipelineSession | null {
  return sessions.get(sessionId) ?? null;
}

export function listSessions(): PipelineSession[] {
  return [...sessions.values()].sort((a, b) => b.startedAt - a.startedAt);
}

export function generateDebugReport(sessionId: string): string {
  const session = sessions.get(sessionId);
  if (!session) return `Session ${sessionId} not found`;

  const lines: string[] = [
    "═══════════════════════════════════════════════════════",
    " SAI ROLOTECH — PIPELINE DEBUG REPORT",
    "═══════════════════════════════════════════════════════",
    `Session ID : ${session.sessionId}`,
    `Started    : ${new Date(session.startedAt).toISOString()}`,
    `Status     : ${session.overallStatus.toUpperCase()}`,
    `Summary    : ${session.summary}`,
    "───────────────────────────────────────────────────────",
    "",
    "PIPELINE STEPS:",
    "",
  ];

  for (const step of session.steps) {
    const icon = step.status === "pass" ? "✓" : step.status === "fail" ? "✗" : step.status === "warning" ? "⚠" : "○";
    lines.push(`${icon} [${step.status.toUpperCase().padEnd(7)}] ${step.name}`);
    lines.push(`   Message  : ${step.message}`);
    if (step.durationMs !== undefined) lines.push(`   Duration : ${step.durationMs}ms`);
    if (step.warnings.length > 0) lines.push(`   Warnings : ${step.warnings.join("; ")}`);
    if (step.errors.length > 0) lines.push(`   Errors   : ${step.errors.join("; ")}`);
    if (step.dataSnapshot) {
      lines.push(`   Snapshot : ${JSON.stringify(step.dataSnapshot)}`);
    }
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════════════");
  return lines.join("\n");
}
