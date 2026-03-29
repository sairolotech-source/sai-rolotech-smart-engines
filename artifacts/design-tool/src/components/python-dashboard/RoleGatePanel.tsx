/**
 * RoleGatePanel.tsx — RBAC + Manufacturing Approval Workflow
 * Sai Rolotech Smart Engines v2.4.0
 *
 * Roles: Admin · Designer · Checker · Approver · Viewer
 * States: Draft → Under Review → Checked → Approved for Manufacturing → Superseded
 */

import React, { useState, useEffect } from "react";
import {
  Shield, User, ChevronDown, ChevronRight, AlertCircle,
  CheckCircle, Clock, XCircle, History, Lock, Unlock,
} from "lucide-react";
import {
  type UserRole,
  type ApprovalState,
  type ApprovalRecord,
  STATE_META,
  ROLE_META,
  ALLOWED_TRANSITIONS,
  canTransition,
  buildHistoryEntry,
  checkReleaseGate,
  loadCurrentRole,
  saveCurrentRole,
  loadApprovalRecord,
  saveApprovalRecord,
} from "@/lib/roleSystem";

interface Props {
  rollOD:     number;
  bore:       number;
  faceWidth:  number;
  keyway:     number;
  revision:   string;
  onStateChange?: (state: ApprovalState) => void;
}

const ALL_ROLES: UserRole[] = ["admin", "designer", "checker", "approver", "viewer"];
const ALL_STATES: ApprovalState[] = ["draft", "under_review", "checked", "approved_for_manufacturing", "superseded"];

export function RoleGatePanel({ rollOD, bore, faceWidth, keyway, revision, onStateChange }: Props) {
  const [currentRole,     setCurrentRole]     = useState<UserRole>(() => loadCurrentRole());
  const [record,          setRecord]          = useState<ApprovalRecord>(() => loadApprovalRecord());
  const [actorName,       setActorName]       = useState("");
  const [note,            setNote]            = useState("");
  const [showHistory,     setShowHistory]     = useState(false);
  const [showRoleSwitch,  setShowRoleSwitch]  = useState(false);
  const [gateResult,      setGateResult]      = useState(() =>
    checkReleaseGate({ state: "draft", revision, rollOD, bore, faceWidth, keyway, checkedBy: "", approvedBy: "", currentRole: "designer" })
  );

  useEffect(() => {
    saveCurrentRole(currentRole);
  }, [currentRole]);

  useEffect(() => {
    saveApprovalRecord(record);
    onStateChange?.(record.state);
    setGateResult(checkReleaseGate({
      state:       record.state,
      revision,
      rollOD,
      bore,
      faceWidth,
      keyway,
      checkedBy:   record.checkedBy,
      approvedBy:  record.approvedBy,
      currentRole,
    }));
  }, [record, currentRole, revision, rollOD, bore, faceWidth, keyway, onStateChange]);

  const tryTransition = (to: ApprovalState) => {
    const check = canTransition(record.state, to, currentRole);
    if (!check.allowed) {
      alert(check.reason);
      return;
    }
    const name = actorName.trim() || currentRole;
    const entry = buildHistoryEntry(name, currentRole, record.state, to, note.trim() || undefined);
    const updated: ApprovalRecord = {
      ...record,
      state:    to,
      history:  [entry, ...record.history],
      ...(to === "checked"    ? { checkedBy: name, checkedAt: new Date().toISOString()  } : {}),
      ...(to === "approved_for_manufacturing" ? { approvedBy: name, approvedAt: new Date().toISOString() } : {}),
    };
    setRecord(updated);
    setNote("");
  };

  const curMeta  = STATE_META[record.state];
  const roleMeta = ROLE_META[currentRole];

  // Available transitions from current state + role
  const availableTransitions = ALL_STATES.filter(to => {
    if (to === record.state) return false;
    const key = `${record.state}→${to}` as keyof typeof ALLOWED_TRANSITIONS;
    return ALLOWED_TRANSITIONS[key]?.includes(currentRole);
  });

  return (
    <div className="bg-slate-800/70 rounded-xl border border-slate-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300 uppercase tracking-wider">
            Approval Workflow
          </span>
        </div>
        <button
          onClick={() => setShowRoleSwitch(v => !v)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          <User className="w-3 h-3" />
          <span className={`font-semibold ${roleMeta.color}`}>{roleMeta.label}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      {/* Role switcher */}
      {showRoleSwitch && (
        <div className="mb-3 bg-slate-700/60 rounded-lg p-2 grid grid-cols-5 gap-1">
          {ALL_ROLES.map(r => (
            <button
              key={r}
              onClick={() => { setCurrentRole(r); setShowRoleSwitch(false); }}
              className={`text-xs py-1.5 px-2 rounded font-medium transition-colors ${
                currentRole === r
                  ? "bg-violet-700 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {ROLE_META[r].label}
            </button>
          ))}
        </div>
      )}

      {/* Current state */}
      <div className={`rounded-lg border p-3 mb-3 ${curMeta.bgColor}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{curMeta.icon}</span>
          <span className={`text-sm font-bold ${curMeta.color}`}>{curMeta.label}</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 space-y-0.5">
          {record.checkedBy && <div>Checked by: <span className="text-slate-200">{record.checkedBy}</span></div>}
          {record.approvedBy && <div>Approved by: <span className="text-slate-200">{record.approvedBy}</span></div>}
        </div>
      </div>

      {/* Release gate */}
      {record.state === "approved_for_manufacturing" && (
        <div className={`rounded-lg border p-2 mb-3 text-xs ${gateResult.canRelease ? "bg-green-900/30 border-green-700" : "bg-red-900/30 border-red-700"}`}>
          <div className="flex items-center gap-1.5 mb-1">
            {gateResult.canRelease
              ? <><Unlock className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400 font-semibold">Manufacturing Release — CLEARED</span></>
              : <><Lock className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400 font-semibold">Release Blocked</span></>
            }
          </div>
          {gateResult.blockers.map((b, i) => (
            <div key={i} className="text-red-300 flex gap-1">
              <span className="shrink-0">•</span>{b}
            </div>
          ))}
          {gateResult.warnings.map((w, i) => (
            <div key={i} className="text-yellow-300 flex gap-1">
              <span className="shrink-0">⚠</span>{w}
            </div>
          ))}
        </div>
      )}

      {/* Actor name */}
      <input
        value={actorName}
        onChange={e => setActorName(e.target.value)}
        placeholder={`Your name (${roleMeta.label})`}
        className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 mb-2"
      />

      {/* Note */}
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Comment (optional)"
        className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 mb-2"
      />

      {/* Transition buttons */}
      {availableTransitions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {availableTransitions.map(to => {
            const toMeta = STATE_META[to];
            return (
              <button
                key={to}
                onClick={() => tryTransition(to)}
                className={`text-xs px-3 py-1.5 rounded font-medium border transition-colors flex items-center gap-1 ${toMeta.bgColor} ${toMeta.color} hover:opacity-90`}
              >
                {toMeta.icon} {toMeta.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
          <AlertCircle className="w-3.5 h-3.5" />
          No transitions available for {roleMeta.label} at this state.
        </div>
      )}

      {/* History toggle */}
      <button
        onClick={() => setShowHistory(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <History className="w-3.5 h-3.5" />
        Approval History ({record.history.length})
        {showHistory ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {showHistory && record.history.length > 0 && (
        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto border-t border-slate-700 pt-2">
          {record.history.map((entry, i) => (
            <div key={i} className="text-xs text-slate-400 flex gap-2">
              <div className="shrink-0 text-slate-500">
                {new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
              </div>
              <div>
                <span className={`font-semibold ${ROLE_META[entry.role].color}`}>{entry.actor}</span>
                {" "}{STATE_META[entry.fromState].icon}→{STATE_META[entry.toState].icon}{" "}
                <span className={STATE_META[entry.toState].color}>{STATE_META[entry.toState].label}</span>
                {entry.note && <span className="text-slate-500"> — {entry.note}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
