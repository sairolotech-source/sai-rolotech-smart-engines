import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";

interface SemiAutoValues {
  bend_count: number;
  section_width_mm: number;
  section_height_mm: number;
  profile_type: string;
  thickness: number;
  material: string;
  return_bends: number;
  lips_present: boolean;
  flanges_present: boolean;
  station_count: number;
  shaft_mm: number;
  bearing: string;
}

interface Props {
  selectedMode: string;
  overallConfidence: number;
  blockingReasons: string[];
  recommendedAction: string;
  detectedValues: Partial<SemiAutoValues>;
  onConfirm: (confirmed: SemiAutoValues) => void;
  loading?: boolean;
}

const PROFILE_OPTIONS = [
  "simple_channel",
  "lipped_channel",
  "complex_profile",
  "shutter_profile",
  "custom",
];

const MATERIAL_OPTIONS = ["GI", "CR", "SS", "HR", "AL"];

function FieldRow({
  label,
  detected,
  children,
  note,
}: {
  label: string;
  detected?: string | number | boolean | null;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 160px", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div>
        <div style={{ fontSize: 12, color: "#d1d5db", fontWeight: 500 }}>{label}</div>
        {note && <div style={{ fontSize: 10, color: "#6b7280" }}>{note}</div>}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right", fontFamily: "monospace" }}>
        {detected !== undefined && detected !== null ? String(detected) : "—"}
      </div>
      <div>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 5,
  color: "#f3f4f6",
  fontSize: 12,
  padding: "4px 8px",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#d1d5db",
  cursor: "pointer",
};

export default function SemiAutoPanel({
  selectedMode,
  overallConfidence,
  blockingReasons,
  recommendedAction,
  detectedValues,
  onConfirm,
  loading,
}: Props) {
  const [vals, setVals] = useState<SemiAutoValues>({
    bend_count: detectedValues.bend_count ?? 4,
    section_width_mm: detectedValues.section_width_mm ?? 120,
    section_height_mm: detectedValues.section_height_mm ?? 55,
    profile_type: detectedValues.profile_type ?? "lipped_channel",
    thickness: detectedValues.thickness ?? 1.0,
    material: detectedValues.material ?? "CR",
    return_bends: detectedValues.return_bends ?? 0,
    lips_present: detectedValues.lips_present ?? false,
    flanges_present: detectedValues.flanges_present ?? true,
    station_count: detectedValues.station_count ?? 9,
    shaft_mm: detectedValues.shaft_mm ?? 50,
    bearing: detectedValues.bearing ?? "6210",
  });

  useEffect(() => {
    setVals({
      bend_count: detectedValues.bend_count ?? 4,
      section_width_mm: detectedValues.section_width_mm ?? 120,
      section_height_mm: detectedValues.section_height_mm ?? 55,
      profile_type: detectedValues.profile_type ?? "lipped_channel",
      thickness: detectedValues.thickness ?? 1.0,
      material: detectedValues.material ?? "CR",
      return_bends: detectedValues.return_bends ?? 0,
      lips_present: detectedValues.lips_present ?? false,
      flanges_present: detectedValues.flanges_present ?? true,
      station_count: detectedValues.station_count ?? 9,
      shaft_mm: detectedValues.shaft_mm ?? 50,
      bearing: detectedValues.bearing ?? "6210",
    });
  }, [
    detectedValues.bend_count,
    detectedValues.section_width_mm,
    detectedValues.section_height_mm,
    detectedValues.profile_type,
    detectedValues.thickness,
    detectedValues.material,
  ]);

  if (selectedMode !== "semi_auto" && selectedMode !== "manual_review") return null;

  const isSemiAuto = selectedMode === "semi_auto";
  const headerColor = isSemiAuto ? "#eab308" : "#ef4444";
  const headerBg = isSemiAuto ? "rgba(234,179,8,0.08)" : "rgba(239,68,68,0.08)";
  const headerBorder = isSemiAuto ? "rgba(234,179,8,0.3)" : "rgba(239,68,68,0.3)";
  const modeLabel = isSemiAuto ? "SEMI AUTO MODE — Confirmation Required" : "MANUAL REVIEW MODE — Engineer Verification Required";

  const num = (key: keyof SemiAutoValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVals(v => ({ ...v, [key]: parseFloat(e.target.value) || 0 }));
  const int = (key: keyof SemiAutoValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVals(v => ({ ...v, [key]: parseInt(e.target.value) || 0 }));
  const str = (key: keyof SemiAutoValues) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    setVals(v => ({ ...v, [key]: e.target.value }));
  const bool = (key: keyof SemiAutoValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVals(v => ({ ...v, [key]: e.target.checked }));

  return (
    <div style={{
      border: `1px solid ${headerBorder}`,
      borderRadius: 10,
      overflow: "hidden",
      background: "rgba(255,255,255,0.02)",
    }}>
      {/* Header */}
      <div style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}`, padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <AlertTriangle style={{ color: headerColor, width: 16, height: 16, marginTop: 1, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: headerColor, letterSpacing: "0.04em" }}>{modeLabel}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
            Confidence: <span style={{ color: headerColor }}>{overallConfidence}/100</span>
            {blockingReasons.length > 0 && (
              <span style={{ marginLeft: 8 }}> — {blockingReasons[0]}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{recommendedAction}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 16 }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 160px", gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: "0.08em" }}>PARAMETER</div>
          <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: "0.08em", textAlign: "right" }}>DETECTED</div>
          <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: "0.08em" }}>CONFIRM / CORRECT</div>
        </div>

        {/* Section Geometry */}
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", margin: "10px 0 4px", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          SECTION GEOMETRY
        </div>

        <FieldRow label="Width (mm)" detected={detectedValues.section_width_mm} note="Flat section width">
          <input type="number" style={inputStyle} value={vals.section_width_mm} onChange={num("section_width_mm")} min={10} max={2000} step={0.5} />
        </FieldRow>

        <FieldRow label="Height (mm)" detected={detectedValues.section_height_mm} note="Section depth">
          <input type="number" style={inputStyle} value={vals.section_height_mm} onChange={num("section_height_mm")} min={5} max={500} step={0.5} />
        </FieldRow>

        <FieldRow label="Bend Count" detected={detectedValues.bend_count} note="Total forming bends">
          <input type="number" style={inputStyle} value={vals.bend_count} onChange={int("bend_count")} min={0} max={40} step={1} />
        </FieldRow>

        <FieldRow label="Return Bends" detected={detectedValues.return_bends} note="Hemmed / return bends">
          <input type="number" style={inputStyle} value={vals.return_bends} onChange={int("return_bends")} min={0} max={10} step={1} />
        </FieldRow>

        {/* Profile Features */}
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", margin: "10px 0 4px", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          PROFILE FEATURES
        </div>

        <FieldRow label="Profile Type" detected={detectedValues.profile_type}>
          <select style={selectStyle} value={vals.profile_type} onChange={str("profile_type")}>
            {PROFILE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </FieldRow>

        <FieldRow label="Flanges Present" detected={detectedValues.flanges_present !== undefined ? String(detectedValues.flanges_present) : undefined}>
          <label style={checkboxRowStyle}>
            <input type="checkbox" checked={vals.flanges_present} onChange={bool("flanges_present")} style={{ accentColor: "#8b5cf6" }} />
            {vals.flanges_present ? "Yes — flanges confirmed" : "No flanges"}
          </label>
        </FieldRow>

        <FieldRow label="Lips Present" detected={detectedValues.lips_present !== undefined ? String(detectedValues.lips_present) : undefined} note="Required for lipped_channel">
          <label style={checkboxRowStyle}>
            <input type="checkbox" checked={vals.lips_present} onChange={bool("lips_present")} style={{ accentColor: "#8b5cf6" }} />
            {vals.lips_present ? "Yes — lips confirmed" : "No lips"}
          </label>
        </FieldRow>

        {/* Material */}
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", margin: "10px 0 4px", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          MATERIAL
        </div>

        <FieldRow label="Material Grade" detected={detectedValues.material}>
          <select style={selectStyle} value={vals.material} onChange={str("material")}>
            {MATERIAL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </FieldRow>

        <FieldRow label="Thickness (mm)" detected={detectedValues.thickness}>
          <input type="number" style={inputStyle} value={vals.thickness} onChange={num("thickness")} min={0.3} max={6.0} step={0.1} />
        </FieldRow>

        {/* Machine */}
        <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", margin: "10px 0 4px", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          MACHINE PARAMETERS
        </div>

        <FieldRow label="Station Count" detected={detectedValues.station_count} note="System suggestion">
          <input type="number" style={inputStyle} value={vals.station_count} onChange={int("station_count")} min={1} max={40} step={1} />
        </FieldRow>

        <FieldRow label="Shaft Diameter (mm)" detected={detectedValues.shaft_mm}>
          <select style={selectStyle} value={String(vals.shaft_mm)} onChange={e => setVals(v => ({ ...v, shaft_mm: parseInt(e.target.value) }))}>
            <option value="40">40mm (Light)</option>
            <option value="50">50mm (Medium)</option>
            <option value="60">60mm (Heavy)</option>
            <option value="70">70mm (Industrial)</option>
          </select>
        </FieldRow>

        <FieldRow label="Bearing Type" detected={detectedValues.bearing}>
          <select style={selectStyle} value={vals.bearing} onChange={str("bearing")}>
            <option value="6208">6208 (Light)</option>
            <option value="6210">6210 (Medium)</option>
            <option value="6212">6212 (Heavy)</option>
            <option value="6214">6214 (Industrial)</option>
          </select>
        </FieldRow>

        {/* Confirm button */}
        <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>
            Review all values above. When satisfied, click <strong style={{ color: "#d1d5db" }}>Confirm & Re-run Pipeline</strong> to generate final engineering output.
          </div>
          <button
            onClick={() => onConfirm(vals)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 0",
              background: isSemiAuto ? "rgba(234,179,8,0.15)" : "rgba(139,92,246,0.15)",
              border: `1px solid ${isSemiAuto ? "rgba(234,179,8,0.4)" : "rgba(139,92,246,0.4)"}`,
              borderRadius: 7,
              color: isSemiAuto ? "#fbbf24" : "#a78bfa",
              fontWeight: 700,
              fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              letterSpacing: "0.03em",
            }}
          >
            {loading ? (
              <><RefreshCw style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Re-running Pipeline…</>
            ) : (
              <><CheckCircle2 style={{ width: 14, height: 14 }} /> Confirm &amp; Re-run Pipeline</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
