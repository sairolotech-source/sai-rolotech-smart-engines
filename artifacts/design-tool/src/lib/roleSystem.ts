/**
 * roleSystem.ts — RBAC + Manufacturing Approval Workflow
 * Sai Rolotech Smart Engines v2.4.0
 *
 * Roles: Admin · Designer · Checker · Approver · Viewer
 * States: Draft → Under Review → Checked → Approved for Manufacturing → Superseded
 * Lock rules:
 *   - revision missing → release blocked
 *   - bore / OD / face width / keyway missing → release blocked
 *   - approved drawing edited → status auto-reset to "under_review"
 *   - only Approver role can approve; only Checker can check
 */

export type UserRole = "admin" | "designer" | "checker" | "approver" | "viewer";

export type ApprovalState =
  | "draft"
  | "under_review"
  | "checked"
  | "approved_for_manufacturing"
  | "superseded";

export interface RoleUser {
  id:       string;
  name:     string;
  role:     UserRole;
  initials: string;
}

export interface ApprovalRecord {
  state:       ApprovalState;
  revision:    string;
  checkedBy:   string;
  checkedAt?:  string;
  approvedBy:  string;
  approvedAt?: string;
  supersededBy?: string;
  supersededAt?: string;
  history:     ApprovalHistoryEntry[];
}

export interface ApprovalHistoryEntry {
  timestamp: string;
  actor:     string;
  role:      UserRole;
  fromState: ApprovalState;
  toState:   ApprovalState;
  note?:     string;
}

export interface ReleaseGateResult {
  canRelease: boolean;
  blockers:   string[];
  warnings:   string[];
}

// ─── State labels and colours ─────────────────────────────────────────────────

export const STATE_META: Record<ApprovalState, {
  label:    string;
  color:    string;
  bgColor:  string;
  icon:     string;
  order:    number;
}> = {
  draft: {
    label:   "Draft",
    color:   "text-slate-400",
    bgColor: "bg-slate-800/60 border-slate-600",
    icon:    "✏️",
    order:   0,
  },
  under_review: {
    label:   "Under Review",
    color:   "text-blue-400",
    bgColor: "bg-blue-900/30 border-blue-700",
    icon:    "🔍",
    order:   1,
  },
  checked: {
    label:   "Checked",
    color:   "text-yellow-400",
    bgColor: "bg-yellow-900/30 border-yellow-700",
    icon:    "✅",
    order:   2,
  },
  approved_for_manufacturing: {
    label:   "Approved for Manufacturing",
    color:   "text-green-400",
    bgColor: "bg-green-900/30 border-green-700",
    icon:    "🏭",
    order:   3,
  },
  superseded: {
    label:   "Superseded",
    color:   "text-red-400",
    bgColor: "bg-red-900/30 border-red-700",
    icon:    "🚫",
    order:   4,
  },
};

// ─── Role permissions ─────────────────────────────────────────────────────────

export const ROLE_META: Record<UserRole, {
  label:       string;
  color:       string;
  bgColor:     string;
  canEdit:     boolean;
  canSubmit:   boolean;
  canCheck:    boolean;
  canApprove:  boolean;
  canSupersede:boolean;
  canExport:   boolean;
}> = {
  admin: {
    label: "Admin", color: "text-violet-400", bgColor: "bg-violet-900/30 border-violet-700",
    canEdit: true, canSubmit: true, canCheck: true, canApprove: true, canSupersede: true, canExport: true,
  },
  designer: {
    label: "Designer", color: "text-blue-400", bgColor: "bg-blue-900/30 border-blue-700",
    canEdit: true, canSubmit: true, canCheck: false, canApprove: false, canSupersede: false, canExport: true,
  },
  checker: {
    label: "Checker", color: "text-yellow-400", bgColor: "bg-yellow-900/30 border-yellow-700",
    canEdit: false, canSubmit: false, canCheck: true, canApprove: false, canSupersede: false, canExport: true,
  },
  approver: {
    label: "Approver", color: "text-green-400", bgColor: "bg-green-900/30 border-green-700",
    canEdit: false, canSubmit: false, canCheck: false, canApprove: true, canSupersede: true, canExport: true,
  },
  viewer: {
    label: "Viewer", color: "text-slate-400", bgColor: "bg-slate-800/60 border-slate-600",
    canEdit: false, canSubmit: false, canCheck: false, canApprove: false, canSupersede: false, canExport: false,
  },
};

// ─── Transition rules ─────────────────────────────────────────────────────────

type TransitionKey = `${ApprovalState}→${ApprovalState}`;

export const ALLOWED_TRANSITIONS: Partial<Record<TransitionKey, UserRole[]>> = {
  "draft→under_review":                   ["designer", "admin"],
  "under_review→checked":                 ["checker", "admin"],
  "under_review→draft":                   ["designer", "admin"],
  "checked→approved_for_manufacturing":   ["approver", "admin"],
  "checked→under_review":                 ["checker", "admin"],
  "approved_for_manufacturing→superseded":["approver", "admin"],
  "approved_for_manufacturing→under_review":["admin"],
  "superseded→draft":                     ["admin"],
};

// ─── Release gate validator ───────────────────────────────────────────────────

export function checkReleaseGate(params: {
  state:       ApprovalState;
  revision:    string;
  rollOD:      number;
  bore:        number;
  faceWidth:   number;
  keyway:      number;
  checkedBy:   string;
  approvedBy:  string;
  currentRole: UserRole;
}): ReleaseGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!params.revision || params.revision === "R0") {
    blockers.push("Revision must be R1 or higher before manufacturing release.");
  }
  if (!params.rollOD || params.rollOD <= 0) {
    blockers.push("Roll OD is missing or zero — cannot release.");
  }
  if (!params.bore || params.bore <= 0) {
    blockers.push("Bore diameter is missing — cannot release.");
  }
  if (!params.faceWidth || params.faceWidth <= 0) {
    blockers.push("Face width is missing — cannot release.");
  }
  if (!params.keyway || params.keyway <= 0) {
    warnings.push("Keyway width is not specified — verify before machining.");
  }
  if (!params.checkedBy?.trim()) {
    blockers.push("Checked by field is required before manufacturing release.");
  }
  if (!params.approvedBy?.trim()) {
    blockers.push("Approved by field is required before manufacturing release.");
  }
  if (params.state !== "approved_for_manufacturing") {
    blockers.push(`Current state is "${STATE_META[params.state].label}". Must be "Approved for Manufacturing".`);
  }
  if (!ROLE_META[params.currentRole].canApprove && !ROLE_META[params.currentRole].canExport) {
    blockers.push(`Role "${ROLE_META[params.currentRole].label}" does not have manufacturing export permission.`);
  }

  return {
    canRelease: blockers.length === 0,
    blockers,
    warnings,
  };
}

// ─── Transition validator ─────────────────────────────────────────────────────

export function canTransition(
  from: ApprovalState,
  to: ApprovalState,
  role: UserRole,
): { allowed: boolean; reason?: string } {
  const key: TransitionKey = `${from}→${to}`;
  const allowedRoles = ALLOWED_TRANSITIONS[key];
  if (!allowedRoles) {
    return { allowed: false, reason: `Transition ${from} → ${to} is not allowed.` };
  }
  if (!allowedRoles.includes(role)) {
    return { allowed: false, reason: `Role "${ROLE_META[role].label}" cannot perform this transition.` };
  }
  return { allowed: true };
}

// ─── History entry builder ────────────────────────────────────────────────────

export function buildHistoryEntry(
  actor: string,
  role: UserRole,
  fromState: ApprovalState,
  toState: ApprovalState,
  note?: string,
): ApprovalHistoryEntry {
  return {
    timestamp: new Date().toISOString(),
    actor,
    role,
    fromState,
    toState,
    note,
  };
}

// ─── Storage key ─────────────────────────────────────────────────────────────

const ROLE_STORAGE_KEY = "sai_rolotech_current_role";
const APPROVAL_STORAGE_KEY = "sai_rolotech_approval_record";

export function loadCurrentRole(): UserRole {
  try {
    const stored = localStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null;
    if (stored && ROLE_META[stored]) return stored;
  } catch {}
  return "designer";
}

export function saveCurrentRole(role: UserRole): void {
  try { localStorage.setItem(ROLE_STORAGE_KEY, role); } catch {}
}

export function loadApprovalRecord(): ApprovalRecord {
  try {
    const raw = localStorage.getItem(APPROVAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ApprovalRecord;
  } catch {}
  return {
    state:     "draft",
    revision:  "R0",
    checkedBy: "",
    approvedBy:"",
    history:   [],
  };
}

export function saveApprovalRecord(record: ApprovalRecord): void {
  try { localStorage.setItem(APPROVAL_STORAGE_KEY, JSON.stringify(record)); } catch {}
}

export function resetApprovalOnEdit(record: ApprovalRecord, actor: string, role: UserRole): ApprovalRecord {
  if (record.state === "approved_for_manufacturing") {
    const entry = buildHistoryEntry(actor, role, record.state, "under_review", "Drawing modified — approval reset.");
    return { ...record, state: "under_review", history: [entry, ...record.history] };
  }
  return record;
}
