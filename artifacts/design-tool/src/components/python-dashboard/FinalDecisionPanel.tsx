import React from "react";

interface Subscores {
  import_confidence_20?: number;
  geometry_confidence_20?: number;
  bend_detection_confidence_20?: number;
  section_feature_confidence_15?: number;
  flower_logic_confidence_10?: number;
  station_confidence_10?: number;
  mechanical_confidence_5?: number;
}

interface FinalDecisionData {
  selected_mode?: string;
  overall_confidence?: number;
  confidence_subscores?: Subscores;
  blocking?: boolean;
  blocking_reasons?: string[];
  recommended_next_action?: string;
}

interface ConsistencyData {
  consistency_status?: string;
  confidence?: string;
  blocking?: boolean;
  blocking_reasons?: string[];
  fail_checks?: string[];
  review_checks?: string[];
  issues_found?: number;
}

interface Props {
  finalDecision?: FinalDecisionData;
  consistency?: ConsistencyData;
}

const MODE_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  auto_mode: {
    label: "AUTO MODE",
    bg: "rgba(34,197,94,0.1)",
    text: "#22c55e",
    border: "rgba(34,197,94,0.4)",
  },
  semi_auto: {
    label: "SEMI AUTO",
    bg: "rgba(234,179,8,0.1)",
    text: "#eab308",
    border: "rgba(234,179,8,0.4)",
  },
  manual_review: {
    label: "MANUAL REVIEW",
    bg: "rgba(239,68,68,0.1)",
    text: "#ef4444",
    border: "rgba(239,68,68,0.4)",
  },
};

const CONS_STYLES: Record<string, { text: string; icon: string }> = {
  pass: { text: "#22c55e", icon: "✓" },
  review_required: { text: "#eab308", icon: "⚠" },
  fail: { text: "#ef4444", icon: "✗" },
};

function ConfidenceBar({ label, value, max }: { label: string; value?: number; max: number }) {
  const pct = value !== undefined ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2, color: "#9ca3af" }}>
        <span>{label}</span>
        <span style={{ color }}>{value ?? 0}/{max}</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 4, height: 5, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 4, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

export default function FinalDecisionPanel({ finalDecision, consistency }: Props) {
  if (!finalDecision && !consistency) {
    return (
      <div style={panelStyle}>
        <div style={headingStyle}>ACCURACY CONTROL SYSTEM</div>
        <p style={{ color: "#6b7280", fontSize: 13 }}>Run the pipeline to see mode selection and confidence scoring.</p>
      </div>
    );
  }

  const mode = finalDecision?.selected_mode ?? "manual_review";
  const modeStyle = MODE_STYLES[mode] ?? MODE_STYLES.manual_review;
  const conf = finalDecision?.overall_confidence ?? 0;
  const confColor = conf >= 85 ? "#22c55e" : conf >= 65 ? "#eab308" : "#ef4444";
  const consStatus = consistency?.consistency_status ?? "unknown";
  const consStyle = CONS_STYLES[consStatus] ?? { text: "#9ca3af", icon: "?" };
  const sub = finalDecision?.confidence_subscores ?? {};

  return (
    <div style={panelStyle}>
      <div style={headingStyle}>ACCURACY CONTROL SYSTEM</div>

      {/* Mode badge + confidence ring */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <div style={{
          padding: "10px 20px",
          borderRadius: 8,
          background: modeStyle.bg,
          border: `1px solid ${modeStyle.border}`,
          color: modeStyle.text,
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.05em",
          minWidth: 160,
          textAlign: "center",
        }}>
          {modeStyle.label}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: confColor, lineHeight: 1 }}>{conf}</div>
          <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.05em" }}>/ 100</div>
          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>CONFIDENCE</div>
        </div>

        <div style={{ fontSize: 13 }}>
          <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 4 }}>CONSISTENCY CHECK</div>
          <div style={{ color: consStyle.text, fontWeight: 600 }}>
            {consStyle.icon} {consStatus.replace("_", " ").toUpperCase()}
          </div>
          {consistency?.issues_found !== undefined && (
            <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
              {consistency.issues_found} issue{consistency.issues_found !== 1 ? "s" : ""} found
            </div>
          )}
        </div>
      </div>

      {/* Confidence subscores */}
      <div style={{ marginBottom: 14, background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.08em", marginBottom: 8 }}>CONFIDENCE BREAKDOWN</div>
        <ConfidenceBar label="Import Quality" value={sub.import_confidence_20} max={20} />
        <ConfidenceBar label="Geometry Quality" value={sub.geometry_confidence_20} max={20} />
        <ConfidenceBar label="Bend Detection" value={sub.bend_detection_confidence_20} max={20} />
        <ConfidenceBar label="Section Features" value={sub.section_feature_confidence_15} max={15} />
        <ConfidenceBar label="Flower Logic" value={sub.flower_logic_confidence_10} max={10} />
        <ConfidenceBar label="Station Logic" value={sub.station_confidence_10} max={10} />
        <ConfidenceBar label="Mechanical" value={sub.mechanical_confidence_5} max={5} />
      </div>

      {/* Recommended action */}
      {finalDecision?.recommended_next_action && (
        <div style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: 6,
          padding: "8px 12px",
          fontSize: 12,
          color: "#d1d5db",
          borderLeft: `3px solid ${modeStyle.text}`,
          marginBottom: 12,
        }}>
          <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4, letterSpacing: "0.08em" }}>RECOMMENDED ACTION</div>
          {finalDecision.recommended_next_action}
        </div>
      )}

      {/* Blocking reasons */}
      {finalDecision?.blocking_reasons && finalDecision.blocking_reasons.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#ef4444", letterSpacing: "0.08em", marginBottom: 6 }}>BLOCKING REASONS</div>
          {finalDecision.blocking_reasons.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: "#fca5a5", padding: "3px 0", borderBottom: "1px solid rgba(239,68,68,0.1)" }}>
              ✗ {r}
            </div>
          ))}
        </div>
      )}

      {/* Consistency fail / review checks */}
      {consistency?.fail_checks && consistency.fail_checks.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#ef4444", letterSpacing: "0.08em", marginBottom: 6 }}>CONSISTENCY FAILURES</div>
          {consistency.fail_checks.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: "#fca5a5", padding: "3px 0" }}>✗ {r}</div>
          ))}
        </div>
      )}

      {consistency?.review_checks && consistency.review_checks.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#eab308", letterSpacing: "0.08em", marginBottom: 6 }}>REVIEW REQUIRED</div>
          {consistency.review_checks.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: "#fde68a", padding: "3px 0" }}>⚠ {r}</div>
          ))}
        </div>
      )}

      {/* All-good note */}
      {!finalDecision?.blocking && consistency?.consistency_status === "pass" && (
        <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>
          ✓ All consistency checks passed — no contradictions detected
        </div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: 16,
};

const headingStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  letterSpacing: "0.1em",
  marginBottom: 14,
};
