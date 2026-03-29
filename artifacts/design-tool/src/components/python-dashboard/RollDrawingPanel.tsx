/**
 * RollDrawingPanel.tsx
 * Engineering-grade roll tooling drawing viewer for the Python Dashboard.
 *
 * Shows:
 *  - Station selector with mini previews
 *  - Cross-section nip view (upper + lower roll + strip)
 *  - Circular front view of the roll (OD, bore, keyway, profile)
 *  - DIN-style dimension annotations
 *  - Roll specification table
 */
import { useState, useCallback } from "react";
import JSZip from "jszip";
import {
  ChevronLeft, ChevronRight, Printer, Download,
  Layers, Circle, AlignCenter, ZoomIn, Info, FileDown, Package,
  FileText, Archive, Stamp, Edit3, CheckCircle, Lock
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number; }

interface PassData {
  pass_no:            number;
  station_label:      string;
  target_angle_deg:   number;
  roll_gap_mm:        number;
  strip_width_mm:     number;
  stage_type:         string;
  forming_depth_mm:   number;
  pass_progress_pct:  number;
  upper_roll_profile: Pt[];
  lower_roll_profile: Pt[];
}

interface RollDimensions {
  estimated_roll_od_mm: number;
  face_width_mm:        number;
  bore_dia_mm:          number;
  keyway_width_mm:      number;
  spacer_width_mm:      number;
  shaft_dia_mm:         number;
  notes?:               string[];
}

interface RollContourData {
  status:           string;
  material:         string;
  thickness_mm:     number;
  springback_deg:   number;
  roll_gap_mm:      number;
  bend_radius_mm:   number;
  target_angle_deg: number;
  formed_to_deg:    number;
  passes:           PassData[];
  calibration_pass: PassData;
  forming_summary:  Record<string, any>;
}

interface Props {
  rollContour:    RollContourData | null;
  rollDimensions: RollDimensions  | null;
}

// ─── Stage colours ───────────────────────────────────────────────────────────

const STAGE_COLOR: Record<string, string> = {
  pre_bend:            "#3b82f6",
  initial_bend:        "#6366f1",
  progressive_forming: "#8b5cf6",
  lip_forming:         "#ec4899",
  final_form:          "#f59e0b",
  calibration:         "#10b981",
  flat:                "#64748b",
};

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function ptStr(pts: Pt[]): string {
  return pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

function toPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

// ─── Dimension arrow ─────────────────────────────────────────────────────────

function DimArrow({
  x1, y1, x2, y2, label, offset = 0, color = "#94a3b8"
}: { x1: number; y1: number; x2: number; y2: number; label: string; offset?: number; color?: string }) {
  const mx = (x1 + x2) / 2 + offset;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.8" strokeDasharray="none" />
      {/* Arrowheads */}
      <polygon points={`${x1},${y1} ${x1 + 3},${y1 - 2} ${x1 + 3},${y1 + 2}`} fill={color} />
      <polygon points={`${x2},${y2} ${x2 - 3},${y2 - 2} ${x2 - 3},${y2 + 2}`} fill={color} />
      <text x={mx} y={my - 3} fontSize="6" fill={color} textAnchor="middle" fontFamily="monospace">{label}</text>
    </g>
  );
}

function DimArrowV({
  x, y1, y2, label, offset = 0, color = "#94a3b8"
}: { x: number; y1: number; y2: number; label: string; offset?: number; color?: string }) {
  const my = (y1 + y2) / 2;
  const lx = x + offset;
  return (
    <g>
      <line x1={lx} y1={y1} x2={lx} y2={y2} stroke={color} strokeWidth="0.8" />
      <polygon points={`${lx},${y1} ${lx - 2},${y1 + 3} ${lx + 2},${y1 + 3}`} fill={color} />
      <polygon points={`${lx},${y2} ${lx - 2},${y2 - 3} ${lx + 2},${y2 - 3}`} fill={color} />
      <text x={lx + 5} y={my + 2} fontSize="6" fill={color} fontFamily="monospace">{label}</text>
    </g>
  );
}

// ─── Cross-section view ───────────────────────────────────────────────────────

function CrossSectionView({
  pass, thickness, rollOD, boreD
}: {
  pass:      PassData;
  thickness: number;
  rollOD:    number;
  boreD:     number;
}) {
  const upper = pass.upper_roll_profile;
  const lower = pass.lower_roll_profile;

  if (!upper.length || !lower.length) return (
    <text x="160" y="130" fontSize="10" fill="#64748b" textAnchor="middle">No profile data</text>
  );

  const allPts = [...upper, ...lower];
  const xs = allPts.map(p => p.x);
  const ys = allPts.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const W = 300, H = 220, pad = 30;
  const sx = (v: number) => pad + ((v - minX) / (maxX - minX || 1)) * (W - pad * 2);
  const sy = (v: number) => pad + ((v - minY) / (maxY - minY || 1)) * (H - pad * 2);

  const upperPx: Pt[] = upper.map(p => ({ x: sx(p.x), y: sy(p.y) }));
  const lowerPx: Pt[] = lower.map(p => ({ x: sx(p.x), y: sy(p.y) }));

  // Build filled upper roll body (extends upward from profile)
  const upperFill = [
    { x: pad,     y: pad },
    { x: W - pad, y: pad },
    ...upperPx.slice().reverse(),
  ];

  // Build filled lower roll body (extends downward from profile)
  const lowerFill = [
    { x: pad,     y: H - pad },
    { x: W - pad, y: H - pad },
    ...lowerPx.slice().reverse(),
  ];

  // Strip geometry — between upper and lower mid points
  const uMid = upperPx[Math.floor(upperPx.length / 2)];
  const lMid = lowerPx[Math.floor(lowerPx.length / 2)];
  const stripY1 = uMid.y;
  const stripY2 = lMid.y;
  const stripH = Math.max(3, stripY2 - stripY1);

  // Forming depth annotation
  const depth = pass.forming_depth_mm;
  const angle = pass.target_angle_deg;
  const gap   = pass.roll_gap_mm;

  // Leader lines from edges
  const leftX   = pad;
  const rightX  = W - pad;
  const topY    = pad;
  const bottomY = H - pad;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%"
      className="bg-[#0f172a]"
      style={{ fontFamily: "monospace" }}>

      {/* Grid lines */}
      {[...Array(5)].map((_, i) => (
        <line key={i}
          x1={pad} y1={pad + i * (H - pad * 2) / 4}
          x2={W - pad} y2={pad + i * (H - pad * 2) / 4}
          stroke="#1e293b" strokeWidth="0.5" />
      ))}

      {/* Lower roll body fill */}
      <polygon points={ptStr(lowerFill)} fill="#064e3b" stroke="none" opacity="0.8" />
      <polyline points={ptStr(lowerPx)} fill="none" stroke="#34d399" strokeWidth="1.8" />

      {/* Upper roll body fill */}
      <polygon points={ptStr(upperFill)} fill="#1e1b4b" stroke="none" opacity="0.8" />
      <polyline points={ptStr(upperPx)} fill="none" stroke="#60a5fa" strokeWidth="1.8" />

      {/* Strip */}
      <rect
        x={upperPx[0].x} y={stripY1}
        width={upperPx[upperPx.length - 1].x - upperPx[0].x}
        height={stripH}
        fill="#fbbf24" opacity="0.35" stroke="#fbbf24" strokeWidth="0.8"
      />

      {/* Strip flow arrows */}
      {[0.3, 0.7].map((t, i) => {
        const ax = pad + t * (W - pad * 2);
        const ay = (stripY1 + stripY2) / 2;
        return (
          <g key={i}>
            <line x1={ax - 8} y1={ay} x2={ax + 8} y2={ay} stroke="#fbbf24" strokeWidth="1" />
            <polygon points={`${ax + 8},${ay} ${ax + 3},${ay - 2} ${ax + 3},${ay + 2}`} fill="#fbbf24" />
          </g>
        );
      })}

      {/* Centre line */}
      <line x1={W / 2} y1={pad / 2} x2={W / 2} y2={H - pad / 2}
        stroke="#475569" strokeWidth="0.7" strokeDasharray="4,3" />

      {/* DIMENSION — Strip width */}
      <DimArrow
        x1={upperPx[0].x} y1={H - pad / 2 + 4}
        x2={upperPx[upperPx.length - 1].x} y2={H - pad / 2 + 4}
        label={`${pass.strip_width_mm.toFixed(1)}mm`}
        color="#fbbf24"
      />

      {/* DIMENSION — Form depth */}
      {depth > 0 && (
        <DimArrowV
          x={W - pad / 2 + 4} y1={uMid.y} y2={lMid.y}
          label={`${depth.toFixed(1)}mm`} offset={2}
          color="#a78bfa"
        />
      )}

      {/* DIMENSION — Roll gap */}
      <DimArrowV
        x={upperPx[0].x - 14}
        y1={upperPx[0].y} y2={lowerPx[0].y}
        label={`${gap}mm`} offset={0}
        color="#34d399"
      />

      {/* Angle annotation */}
      {angle > 0 && (
        <g>
          <text x={W / 2 + 4} y={uMid.y - 6} fontSize="6.5" fill="#60a5fa" fontFamily="monospace">
            θ = {angle.toFixed(1)}°
          </text>
        </g>
      )}

      {/* Legend */}
      <rect x={4} y={4} width={70} height={32} fill="#0f172a" stroke="#1e293b" strokeWidth="0.5" rx="2" />
      <line x1={8} y1={12} x2={20} y2={12} stroke="#60a5fa" strokeWidth="1.5" />
      <text x={23} y={14} fontSize="5.5" fill="#94a3b8">Upper Roll</text>
      <line x1={8} y1={22} x2={20} y2={22} stroke="#34d399" strokeWidth="1.5" />
      <text x={23} y={24} fontSize="5.5" fill="#94a3b8">Lower Roll</text>
      <rect x={8} y={27} width={12} height={4} fill="#fbbf24" opacity="0.5" />
      <text x={23} y={33} fontSize="5.5" fill="#94a3b8">Strip</text>

      {/* Title block */}
      <text x={W / 2} y={H - 6} fontSize="6" fill="#475569" textAnchor="middle">
        Cross-Section View · {pass.station_label} · MS 3mm U-Channel
      </text>
    </svg>
  );
}

// ─── Circular front view ──────────────────────────────────────────────────────

function CircularFrontView({
  pass, rollOD, boreD, keyway, faceW, thickness
}: {
  pass: PassData; rollOD: number; boreD: number;
  keyway: number; faceW: number; thickness: number;
}) {
  const W = 200, H = 200;
  const cx = W / 2, cy = H / 2;
  const scale = (W * 0.42) / (rollOD / 2);
  const outerR   = (rollOD / 2)  * scale;
  const boreR    = (boreD  / 2)  * scale;
  const depth    = pass.forming_depth_mm;
  const grooveD  = (depth / (rollOD / 2)) * outerR;
  const grooveW  = pass.strip_width_mm * scale * 0.55;
  const kwW      = (keyway / 2) * scale;
  const kwH      = kwW * 0.8;
  const angle    = pass.target_angle_deg;
  const radAngle = (angle * Math.PI) / 180;
  const shoulderX = grooveW;
  const shoulderY = grooveD * Math.sin(radAngle);

  const stageColor = STAGE_COLOR[pass.stage_type] || "#8b5cf6";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%"
      className="bg-[#0f172a]"
      style={{ fontFamily: "monospace" }}>

      {/* Outer roll body */}
      <circle cx={cx} cy={cy} r={outerR} fill="#1e293b" stroke="#60a5fa" strokeWidth="1.2" />

      {/* Face groove (profile cut into outer surface) */}
      {grooveD > 0.5 && (
        <ellipse cx={cx} cy={cy} rx={outerR} ry={grooveD * 1.2}
          fill="none" stroke={stageColor} strokeWidth="0.8" strokeDasharray="none" opacity="0.5" />
      )}

      {/* Groove indicator — the profile shape on OD */}
      {depth > 0 && (
        <path
          d={`M ${cx - outerR} ${cy}
              L ${cx - outerR + grooveD * 0.5} ${cy}
              L ${cx - grooveW * 0.6} ${cy + grooveD * 1.1}
              L ${cx + grooveW * 0.6} ${cy + grooveD * 1.1}
              L ${cx + outerR - grooveD * 0.5} ${cy}
              L ${cx + outerR} ${cy}`}
          fill="none" stroke={stageColor} strokeWidth="1.2"
        />
      )}

      {/* Bore */}
      <circle cx={cx} cy={cy} r={boreR} fill="#0f172a" stroke="#94a3b8" strokeWidth="0.8"
        strokeDasharray="3,2" />

      {/* Keyway */}
      <rect
        x={cx - kwW} y={cy - boreR - kwH}
        width={kwW * 2} height={kwH}
        fill="#0f172a" stroke="#f59e0b" strokeWidth="0.7"
      />

      {/* Centre cross */}
      <line x1={cx - boreR - 4} y1={cy} x2={cx + boreR + 4} y2={cy}
        stroke="#475569" strokeWidth="0.5" strokeDasharray="3,2" />
      <line x1={cx} y1={cy - boreR - 4} x2={cx} y2={cy + boreR + 4}
        stroke="#475569" strokeWidth="0.5" strokeDasharray="3,2" />

      {/* OD dimension */}
      <line x1={cx} y1={cy} x2={cx + outerR} y2={cy}
        stroke="#60a5fa" strokeWidth="0.7" />
      <text x={cx + outerR * 0.55} y={cy - 3} fontSize="5.5" fill="#60a5fa" textAnchor="middle">
        ⌀{rollOD}
      </text>

      {/* Bore dimension */}
      <line x1={cx} y1={cy} x2={cx - boreR * 0.9} y2={cy - boreR * 0.6}
        stroke="#94a3b8" strokeWidth="0.7" />
      <text x={cx - boreR - 10} y={cy - boreR * 0.5} fontSize="5" fill="#94a3b8">
        ⌀{boreD}H7
      </text>

      {/* Keyway label */}
      <text x={cx} y={cy - boreR - kwH - 4} fontSize="5" fill="#f59e0b" textAnchor="middle">
        KW {keyway}×{Math.round(kwH / scale)}
      </text>

      {/* Depth label */}
      {depth > 0 && (
        <text x={cx} y={cy + outerR * 0.6 + 8} fontSize="5.5" fill={stageColor} textAnchor="middle">
          Groove ↓ {depth.toFixed(1)}mm
        </text>
      )}

      {/* OD tolerance */}
      <text x={cx + outerR + 3} y={cy + 10} fontSize="4.5" fill="#94a3b8">h6</text>

      {/* Angle arc */}
      {angle > 5 && (
        <text x={cx} y={cy + outerR + 12} fontSize="5.5" fill={stageColor} textAnchor="middle">
          θ = {angle.toFixed(1)}° forming
        </text>
      )}

      {/* Title */}
      <text x={cx} y={H - 4} fontSize="5.5" fill="#475569" textAnchor="middle">
        Front View · Station {pass.pass_no}
      </text>
    </svg>
  );
}

// ─── Side profile view (cross-section of the roll disk) ───────────────────────

function SideProfileView({
  pass, rollOD, boreD, faceW, thickness
}: {
  pass: PassData; rollOD: number; boreD: number; faceW: number; thickness: number;
}) {
  const W = 180, H = 160;
  const scale   = (H * 0.55) / (rollOD / 2);
  const outerR  = (rollOD / 2) * scale;
  const boreR   = (boreD  / 2) * scale;
  const halfFW  = (faceW  / 2) * scale;
  const depth   = pass.forming_depth_mm * scale;
  const angle   = pass.target_angle_deg;
  const radA    = (angle * Math.PI) / 180;
  const cx = W / 2, cy = H / 2;

  // Strip half-width at this pass
  const halfSW  = (pass.strip_width_mm / 2) * scale * 0.45;
  const stageColor = STAGE_COLOR[pass.stage_type] || "#8b5cf6";

  // Roll outline (rectangle in side view — it's a disc)
  const upperProfile = [
    { x: cx - halfFW, y: cy - outerR },
    { x: cx - halfSW, y: cy - outerR },
    { x: cx - halfSW, y: cy - outerR + depth },
    { x: cx + halfSW, y: cy - outerR + depth },
    { x: cx + halfSW, y: cy - outerR },
    { x: cx + halfFW, y: cy - outerR },
  ];
  const upperBase = [
    { x: cx + halfFW, y: cy - boreR },
    { x: cx - halfFW, y: cy - boreR },
  ];

  const lowerProfile = [
    { x: cx - halfFW, y: cy + outerR },
    { x: cx - halfSW, y: cy + outerR },
    { x: cx - halfSW, y: cy + outerR - depth },
    { x: cx + halfSW, y: cy + outerR - depth },
    { x: cx + halfSW, y: cy + outerR },
    { x: cx + halfFW, y: cy + outerR },
  ];
  const lowerBase = [
    { x: cx + halfFW, y: cy + boreR },
    { x: cx - halfFW, y: cy + boreR },
  ];

  const upperPts = [...upperProfile, ...upperBase];
  const lowerPts = [...lowerProfile, ...lowerBase];

  const thicknessPx = thickness * scale;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%"
      className="bg-[#0f172a]"
      style={{ fontFamily: "monospace" }}>

      {/* Upper roll */}
      <polygon points={ptStr(upperPts)} fill="#1e293b" stroke="#60a5fa" strokeWidth="1.2" />
      {/* Profile groove highlight */}
      <polyline points={ptStr(upperProfile)} fill="none" stroke={stageColor} strokeWidth="1.5" />

      {/* Lower roll */}
      <polygon points={ptStr(lowerPts)} fill="#064e3b" stroke="#34d399" strokeWidth="1.2" />
      <polyline points={ptStr(lowerProfile)} fill="none" stroke={stageColor} strokeWidth="1.5" />

      {/* Strip */}
      {depth > 0 && (
        <rect
          x={cx - halfSW} y={cy - thicknessPx / 2}
          width={halfSW * 2} height={thicknessPx}
          fill="#fbbf24" opacity="0.4" stroke="#fbbf24" strokeWidth="0.8"
        />
      )}

      {/* Centre line (shaft axis) */}
      <line x1={4} y1={cy} x2={W - 4} y2={cy}
        stroke="#475569" strokeWidth="0.6" strokeDasharray="5,3" />

      {/* Bore zone */}
      <rect x={cx - halfFW} y={cy - boreR} width={halfFW * 2} height={boreR * 2}
        fill="#0f172a" stroke="#94a3b8" strokeWidth="0.6" strokeDasharray="2,2" />

      {/* DIMENSION — Face width */}
      <DimArrow
        x1={cx - halfFW} y1={H - 8}
        x2={cx + halfFW} y2={H - 8}
        label={`${faceW}mm`} color="#60a5fa"
      />

      {/* DIMENSION — Roll OD */}
      <DimArrowV
        x={cx + halfFW + 8}
        y1={cy - outerR} y2={cy + outerR}
        label={`⌀${rollOD}`} offset={2} color="#94a3b8"
      />

      {/* DIMENSION — Bore */}
      <DimArrowV
        x={cx - halfFW - 8}
        y1={cy - boreR} y2={cy + boreR}
        label={`⌀${boreD}`} offset={-2} color="#f59e0b"
      />

      {/* Groove depth */}
      {depth > 1 && (
        <DimArrowV
          x={cx + halfSW + 6}
          y1={cy - outerR} y2={cy - outerR + depth}
          label={`${pass.forming_depth_mm.toFixed(1)}`} offset={2} color={stageColor}
        />
      )}

      {/* Title */}
      <text x={cx} y={10} fontSize="5.5" fill="#475569" textAnchor="middle">
        Side View (Section A-A) · Station {pass.pass_no}
      </text>
    </svg>
  );
}

// ─── Mini thumbnail ───────────────────────────────────────────────────────────

function MiniThumb({ pass, active, onClick }: { pass: PassData; active: boolean; onClick: () => void }) {
  const upper = pass.upper_roll_profile;
  const lower = pass.lower_roll_profile;
  if (!upper.length) return null;

  const all = [...upper, ...lower];
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 56, H = 40, pad = 4;
  const sx = (v: number) => pad + ((v - minX) / (maxX - minX || 1)) * (W - pad * 2);
  const sy = (v: number) => pad + ((v - minY) / (maxY - minY || 1)) * (H - pad * 2);
  const uPts = upper.map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const lPts = lower.map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const sc = STAGE_COLOR[pass.stage_type] || "#64748b";

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-lg border transition-all p-1 ${
        active
          ? "border-violet-400 bg-violet-500/10 ring-1 ring-violet-400/40"
          : "border-slate-700 bg-slate-800/60 hover:border-slate-500"
      }`}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="bg-slate-900 rounded">
        <polyline points={uPts} fill="none" stroke="#60a5fa" strokeWidth="1.2" />
        <polyline points={lPts} fill="none" stroke="#34d399" strokeWidth="1.2" strokeDasharray="2,1" />
      </svg>
      <div className="text-[9px] font-mono leading-none" style={{ color: sc }}>S{pass.pass_no}</div>
      <div className="text-[8px] text-slate-500 font-mono">{pass.target_angle_deg}°</div>
    </button>
  );
}

// ─── SVG EXPORT GENERATOR ────────────────────────────────────────────────────
// Generates a complete A3-landscape engineering drawing as an SVG string.
// All coordinates in "SVG units" (1 unit ≈ 0.75 pt for screen, or mm for print).

function buildStationSVG(
  pass:        PassData,
  rd:          RollDimensions,
  thickness:   number,
  material:    string,
  profileType: string  = "",
  revision:    string  = "A",
  approved:    boolean = false,
): string {
  const W = 1189, H = 841;   // A3 landscape (mm × 3.56 px/mm ÷ 3.56 = mm)
  const stageColor = STAGE_COLOR[pass.stage_type] || "#8b5cf6";
  const date = new Date().toLocaleDateString("en-GB");

  const upper = pass.upper_roll_profile;
  const lower = pass.lower_roll_profile;

  /* ── Cross-section nip view (left third) ── */
  const cW = 380, cH = 380, cX = 40, cY = 80, cPad = 40;
  const allPts = [...upper, ...lower];
  const xs = allPts.map(p => p.x), ys = allPts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (v: number) => cX + cPad + ((v - minX) / (maxX - minX || 1)) * (cW - cPad * 2);
  const sy = (v: number) => cY + cPad + ((v - minY) / (maxY - minY || 1)) * (cH - cPad * 2);
  const uPath = upper.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
  const lPath = lower.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");

  // Upper fill polygon
  const uFillPts = [
    `${cX + cPad},${cY + cPad}`, `${cX + cW - cPad},${cY + cPad}`,
    ...upper.slice().reverse().map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`),
  ].join(" ");
  const lFillPts = [
    `${cX + cPad},${cY + cH - cPad}`, `${cX + cW - cPad},${cY + cH - cPad}`,
    ...lower.slice().reverse().map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`),
  ].join(" ");

  const uMidX = sx((upper[0].x + upper[upper.length - 1].x) / 2);
  const uMidY = sy(upper[Math.floor(upper.length / 2)].y);
  const lMidY = sy(lower[Math.floor(lower.length / 2)].y);
  const stripW = sx(upper[upper.length - 1].x) - sx(upper[0].x);

  /* ── Front view (circle, centre third) ── */
  const fCx = 660, fCy = 300, fR = 140;
  const scale = fR / (rd.estimated_roll_od_mm / 2);
  const fBoreR = (rd.bore_dia_mm / 2) * scale;
  const fGrooveD = (pass.forming_depth_mm / (rd.estimated_roll_od_mm / 2)) * fR;
  const fGrooveW = pass.strip_width_mm * scale * 0.55;
  const fKwW = (rd.keyway_width_mm / 2) * scale;
  const fKwH = fKwW * 0.8;

  /* ── Side view (right area) ── */
  const sX = 880, sW = 260, sH = 360, sCy = 300;
  const scaleS = (sH * 0.45) / (rd.estimated_roll_od_mm / 2);
  const sOuterR = (rd.estimated_roll_od_mm / 2) * scaleS;
  const sBoreR  = (rd.bore_dia_mm / 2) * scaleS;
  const sFW     = (rd.face_width_mm / 2) * scaleS;
  const sDepth  = pass.forming_depth_mm * scaleS;
  const sSW     = (pass.strip_width_mm / 2) * scaleS * 0.45;
  const sCx     = sX + sW / 2;

  const sUpperPts = [
    `${sCx - sFW},${sCy - sOuterR}`,
    `${sCx - sSW},${sCy - sOuterR}`,
    `${sCx - sSW},${sCy - sOuterR + sDepth}`,
    `${sCx + sSW},${sCy - sOuterR + sDepth}`,
    `${sCx + sSW},${sCy - sOuterR}`,
    `${sCx + sFW},${sCy - sOuterR}`,
    `${sCx + sFW},${sCy - sBoreR}`,
    `${sCx - sFW},${sCy - sBoreR}`,
  ].join(" ");

  const sLowerPts = [
    `${sCx - sFW},${sCy + sOuterR}`,
    `${sCx - sSW},${sCy + sOuterR}`,
    `${sCx - sSW},${sCy + sOuterR - sDepth}`,
    `${sCx + sSW},${sCy + sOuterR - sDepth}`,
    `${sCx + sSW},${sCy + sOuterR}`,
    `${sCx + sFW},${sCy + sOuterR}`,
    `${sCx + sFW},${sCy + sBoreR}`,
    `${sCx - sFW},${sCy + sBoreR}`,
  ].join(" ");

  /* ── Build SVG ── */
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <style>
      text { font-family: 'Courier New', monospace; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#0c1220"/>

  <!-- DIN border -->
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}"
    fill="none" stroke="#334155" stroke-width="2"/>
  <rect x="15" y="15" width="${W - 30}" height="${H - 30}"
    fill="none" stroke="#1e40af" stroke-width="0.8"/>

  <!-- Title bar -->
  <rect x="15" y="15" width="${W - 30}" height="52" fill="#1e1b4b" stroke="#312e81" stroke-width="0.6"/>
  <text x="30" y="38" font-size="16" font-weight="bold" fill="#a5b4fc">SAI ROLOTECH SMART ENGINES v2.3.0</text>
  <text x="30" y="56" font-size="10" fill="#64748b">ROLL TOOLING DRAWING — ENGINEERING APPROXIMATION ONLY — NOT FEM</text>
  <text x="${W - 30}" y="38" font-size="12" fill="#60a5fa" text-anchor="end">${pass.station_label.toUpperCase()}</text>
  <text x="${W - 30}" y="56" font-size="10" fill="#475569" text-anchor="end">${material} · ${thickness}mm · ${pass.stage_type.replace(/_/g," ").toUpperCase()}</text>

  <!-- View labels -->
  <text x="${cX + cW / 2}" y="${cY - 10}" font-size="9" fill="#475569" text-anchor="middle" font-style="italic">CROSS-SECTION — NIP VIEW</text>
  <text x="${fCx}" y="75" font-size="9" fill="#475569" text-anchor="middle" font-style="italic">FRONT VIEW — ROLL FACE</text>
  <text x="${sCx}" y="75" font-size="9" fill="#475569" text-anchor="middle" font-style="italic">SECTION A-A — SIDE VIEW</text>

  <!-- ═══ CROSS-SECTION VIEW ═══ -->

  <!-- Upper roll body fill -->
  <polygon points="${uFillPts}" fill="#1e293b"/>
  <!-- Lower roll body fill -->
  <polygon points="${lFillPts}" fill="#064e3b"/>

  <!-- Upper roll profile -->
  <path d="${uPath}" fill="none" stroke="#60a5fa" stroke-width="2.5"/>
  <!-- Lower roll profile -->
  <path d="${lPath}" fill="none" stroke="#34d399" stroke-width="2.5"/>

  <!-- Strip -->
  <rect x="${sx(upper[0].x).toFixed(1)}" y="${uMidY.toFixed(1)}"
    width="${stripW.toFixed(1)}" height="${(lMidY - uMidY).toFixed(1)}"
    fill="#fbbf24" opacity="0.35" stroke="#fbbf24" stroke-width="1"/>

  <!-- Strip flow arrows -->
  <line x1="${(sx(upper[0].x) + stripW * 0.3).toFixed(1)}" y1="${((uMidY + lMidY) / 2).toFixed(1)}"
        x2="${(sx(upper[0].x) + stripW * 0.45).toFixed(1)}" y2="${((uMidY + lMidY) / 2).toFixed(1)}"
        stroke="#fbbf24" stroke-width="1.5"/>
  <polygon points="${(sx(upper[0].x) + stripW * 0.45).toFixed(1)},${((uMidY + lMidY) / 2).toFixed(1)} ${(sx(upper[0].x) + stripW * 0.42).toFixed(1)},${((uMidY + lMidY) / 2 - 3).toFixed(1)} ${(sx(upper[0].x) + stripW * 0.42).toFixed(1)},${((uMidY + lMidY) / 2 + 3).toFixed(1)}" fill="#fbbf24"/>

  <!-- Centre line -->
  <line x1="${uMidX.toFixed(1)}" y1="${cY}" x2="${uMidX.toFixed(1)}" y2="${cY + cH}"
    stroke="#334155" stroke-width="0.8" stroke-dasharray="6,4"/>

  <!-- DIM: strip width -->
  <line x1="${sx(upper[0].x).toFixed(1)}" y1="${(cY + cH - 15).toFixed(1)}"
        x2="${sx(upper[upper.length-1].x).toFixed(1)}" y2="${(cY + cH - 15).toFixed(1)}"
        stroke="#fbbf24" stroke-width="0.8"/>
  <polygon points="${sx(upper[0].x).toFixed(1)},${(cY + cH - 15).toFixed(1)} ${(sx(upper[0].x) + 6).toFixed(1)},${(cY + cH - 18).toFixed(1)} ${(sx(upper[0].x) + 6).toFixed(1)},${(cY + cH - 12).toFixed(1)}" fill="#fbbf24"/>
  <polygon points="${sx(upper[upper.length-1].x).toFixed(1)},${(cY + cH - 15).toFixed(1)} ${(sx(upper[upper.length-1].x) - 6).toFixed(1)},${(cY + cH - 18).toFixed(1)} ${(sx(upper[upper.length-1].x) - 6).toFixed(1)},${(cY + cH - 12).toFixed(1)}" fill="#fbbf24"/>
  <text x="${uMidX.toFixed(1)}" y="${(cY + cH - 18).toFixed(1)}" font-size="9" fill="#fbbf24" text-anchor="middle">Strip W: ${pass.strip_width_mm.toFixed(1)} mm</text>

  <!-- DIM: form depth -->
  ${pass.forming_depth_mm > 0 ? `
  <line x1="${(cX + cW - 20).toFixed(1)}" y1="${uMidY.toFixed(1)}"
        x2="${(cX + cW - 20).toFixed(1)}" y2="${lMidY.toFixed(1)}"
        stroke="#a78bfa" stroke-width="0.8"/>
  <text x="${(cX + cW - 10).toFixed(1)}" y="${((uMidY + lMidY) / 2).toFixed(1)}" font-size="8" fill="#a78bfa">Depth</text>
  <text x="${(cX + cW - 10).toFixed(1)}" y="${((uMidY + lMidY) / 2 + 10).toFixed(1)}" font-size="8" fill="#a78bfa">${pass.forming_depth_mm.toFixed(1)}mm</text>
  ` : ""}

  <!-- DIM: roll gap -->
  <text x="${(cX + 8).toFixed(1)}" y="${((uMidY + lMidY) / 2).toFixed(1)}" font-size="8" fill="#34d399">Gap</text>
  <text x="${(cX + 8).toFixed(1)}" y="${((uMidY + lMidY) / 2 + 10).toFixed(1)}" font-size="8" fill="#34d399">${pass.roll_gap_mm}mm</text>

  <!-- Angle annotation -->
  <text x="${(uMidX + 10).toFixed(1)}" y="${(uMidY - 12).toFixed(1)}" font-size="10" fill="${stageColor}" font-weight="bold">θ = ${pass.target_angle_deg.toFixed(1)}°</text>

  <!-- Legend -->
  <rect x="${cX}" y="${cY + cH + 5}" width="200" height="32" fill="#0f172a" stroke="#1e293b" stroke-width="0.5" rx="2"/>
  <line x1="${cX + 8}" y1="${cY + cH + 16}" x2="${cX + 28}" y2="${cY + cH + 16}" stroke="#60a5fa" stroke-width="2"/>
  <text x="${cX + 32}" y="${cY + cH + 19}" font-size="8" fill="#94a3b8">Upper Roll</text>
  <line x1="${cX + 8}" y1="${cY + cH + 28}" x2="${cX + 28}" y2="${cY + cH + 28}" stroke="#34d399" stroke-width="2"/>
  <text x="${cX + 32}" y="${cY + cH + 31}" font-size="8" fill="#94a3b8">Lower Roll</text>

  <!-- ═══ FRONT VIEW ═══ -->

  <!-- Roll OD circle -->
  <circle cx="${fCx}" cy="${fCy}" r="${fR}" fill="#1e293b" stroke="#60a5fa" stroke-width="2"/>

  <!-- Groove on OD -->
  ${pass.forming_depth_mm > 0 ? `
  <path d="M ${fCx - fR},${fCy}
    L ${fCx - fR + fGrooveD * 0.5},${fCy}
    L ${fCx - fGrooveW * 0.6},${fCy + fGrooveD * 1.2}
    L ${fCx + fGrooveW * 0.6},${fCy + fGrooveD * 1.2}
    L ${fCx + fR - fGrooveD * 0.5},${fCy}
    L ${fCx + fR},${fCy}"
    fill="none" stroke="${stageColor}" stroke-width="2"/>
  ` : ""}

  <!-- Bore circle -->
  <circle cx="${fCx}" cy="${fCy}" r="${fBoreR}" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6,4"/>

  <!-- Keyway -->
  <rect x="${fCx - fKwW}" y="${fCy - fBoreR - fKwH}" width="${fKwW * 2}" height="${fKwH}"
    fill="#0f172a" stroke="#f59e0b" stroke-width="1.2"/>

  <!-- Centre cross -->
  <line x1="${fCx - fBoreR - 8}" y1="${fCy}" x2="${fCx + fBoreR + 8}" y2="${fCy}" stroke="#334155" stroke-width="0.8" stroke-dasharray="5,3"/>
  <line x1="${fCx}" y1="${fCy - fBoreR - 8}" x2="${fCx}" y2="${fCy + fBoreR + 8}" stroke="#334155" stroke-width="0.8" stroke-dasharray="5,3"/>

  <!-- OD dim -->
  <line x1="${fCx}" y1="${fCy}" x2="${fCx + fR}" y2="${fCy}" stroke="#60a5fa" stroke-width="1"/>
  <text x="${fCx + fR * 0.55}" y="${fCy - 6}" font-size="10" fill="#60a5fa" text-anchor="middle" font-weight="bold">⌀${rd.estimated_roll_od_mm} h6</text>

  <!-- Bore dim -->
  <text x="${fCx - fBoreR - 20}" y="${fCy - fBoreR * 0.5}" font-size="9" fill="#e2e8f0">⌀${rd.bore_dia_mm} H7</text>

  <!-- Keyway dim -->
  <text x="${fCx}" y="${fCy - fBoreR - fKwH - 8}" font-size="9" fill="#f59e0b" text-anchor="middle">KW ${rd.keyway_width_mm}mm (DIN 6885)</text>

  <!-- Depth label -->
  ${pass.forming_depth_mm > 0 ? `
  <text x="${fCx}" y="${fCy + fR + 20}" font-size="10" fill="${stageColor}" text-anchor="middle" font-weight="bold">Groove Depth: ${pass.forming_depth_mm.toFixed(1)} mm</text>
  ` : ""}

  <!-- Stage label -->
  <text x="${fCx}" y="${fCy - fR - 12}" font-size="9" fill="${stageColor}" text-anchor="middle">[ ${pass.stage_type.replace(/_/g," ").toUpperCase()} ]</text>

  <!-- ═══ SIDE VIEW ═══ -->

  <!-- Upper roll -->
  <polygon points="${sUpperPts}" fill="#1e293b" stroke="#60a5fa" stroke-width="1.5"/>
  <polyline points="${sCx - sFW},${sCy - sOuterR} ${sCx - sSW},${sCy - sOuterR} ${sCx - sSW},${sCy - sOuterR + sDepth} ${sCx + sSW},${sCy - sOuterR + sDepth} ${sCx + sSW},${sCy - sOuterR} ${sCx + sFW},${sCy - sOuterR}"
    fill="none" stroke="${stageColor}" stroke-width="2.5"/>

  <!-- Lower roll -->
  <polygon points="${sLowerPts}" fill="#064e3b" stroke="#34d399" stroke-width="1.5"/>
  <polyline points="${sCx - sFW},${sCy + sOuterR} ${sCx - sSW},${sCy + sOuterR} ${sCx - sSW},${sCy + sOuterR - sDepth} ${sCx + sSW},${sCy + sOuterR - sDepth} ${sCx + sSW},${sCy + sOuterR} ${sCx + sFW},${sCy + sOuterR}"
    fill="none" stroke="${stageColor}" stroke-width="2.5"/>

  <!-- Strip -->
  <rect x="${sCx - sSW}" y="${sCy - thickness * scaleS / 2}" width="${sSW * 2}" height="${thickness * scaleS}"
    fill="#fbbf24" opacity="0.4" stroke="#fbbf24" stroke-width="1"/>

  <!-- Shaft centre line -->
  <line x1="${sX}" y1="${sCy}" x2="${sX + sW}" y2="${sCy}" stroke="#334155" stroke-width="0.8" stroke-dasharray="6,4"/>

  <!-- Bore zone -->
  <rect x="${sCx - sFW}" y="${sCy - sBoreR}" width="${sFW * 2}" height="${sBoreR * 2}"
    fill="none" stroke="#475569" stroke-width="0.8" stroke-dasharray="4,3"/>

  <!-- DIM: face width -->
  <line x1="${sCx - sFW}" y1="${sCy + sOuterR + 18}" x2="${sCx + sFW}" y2="${sCy + sOuterR + 18}" stroke="#60a5fa" stroke-width="0.8"/>
  <text x="${sCx}" y="${sCy + sOuterR + 32}" font-size="9" fill="#60a5fa" text-anchor="middle">Face: ${rd.face_width_mm} mm</text>

  <!-- DIM: OD -->
  <line x1="${sCx + sFW + 10}" y1="${sCy - sOuterR}" x2="${sCx + sFW + 10}" y2="${sCy + sOuterR}" stroke="#94a3b8" stroke-width="0.8"/>
  <text x="${sCx + sFW + 14}" y="${sCy - 4}" font-size="8" fill="#94a3b8">⌀${rd.estimated_roll_od_mm}</text>

  <!-- DIM: bore -->
  <line x1="${sCx - sFW - 10}" y1="${sCy - sBoreR}" x2="${sCx - sFW - 10}" y2="${sCy + sBoreR}" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="${sCx - sFW - 14}" y="${sCy - 4}" font-size="8" fill="#f59e0b" text-anchor="end">⌀${rd.bore_dia_mm}</text>

  <!-- ═══ TITLE BLOCK (bottom right) ═══ -->
  <rect x="${W - 380}" y="${H - 185}" width="365" height="170" fill="#0f172a" stroke="#1e3a8a" stroke-width="1"/>

  <!-- Title block grid lines -->
  <line x1="${W - 380}" y1="${H - 155}" x2="${W - 15}" y2="${H - 155}" stroke="#1e293b" stroke-width="0.5"/>
  <line x1="${W - 380}" y1="${H - 130}" x2="${W - 15}" y2="${H - 130}" stroke="#1e293b" stroke-width="0.5"/>
  <line x1="${W - 380}" y1="${H - 105}" x2="${W - 15}" y2="${H - 105}" stroke="#1e293b" stroke-width="0.5"/>
  <line x1="${W - 380}" y1="${H - 80}" x2="${W - 15}" y2="${H - 80}" stroke="#1e293b" stroke-width="0.5"/>
  <line x1="${W - 380}" y1="${H - 55}" x2="${W - 15}" y2="${H - 55}" stroke="#1e293b" stroke-width="0.5"/>
  <line x1="${W - 380}" y1="${H - 30}" x2="${W - 15}" y2="${H - 30}" stroke="#1e293b" stroke-width="0.5"/>
  <line x1="${W - 200}" y1="${H - 185}" x2="${W - 200}" y2="${H - 15}" stroke="#1e293b" stroke-width="0.5"/>

  <!-- Labels (left col) -->
  <text x="${W - 375}" y="${H - 167}" font-size="7.5" fill="#64748b">PART NO.</text>
  <text x="${W - 375}" y="${H - 142}" font-size="7.5" fill="#64748b">PROFILE TYPE</text>
  <text x="${W - 375}" y="${H - 117}" font-size="7.5" fill="#64748b">MATERIAL</text>
  <text x="${W - 375}" y="${H - 92}" font-size="7.5" fill="#64748b">THICKNESS</text>
  <text x="${W - 375}" y="${H - 67}" font-size="7.5" fill="#64748b">STAGE</text>
  <text x="${W - 375}" y="${H - 42}" font-size="7.5" fill="#64748b">DATE / REV</text>
  <text x="${W - 375}" y="${H - 17}" font-size="7.5" fill="#64748b">SCALE</text>

  <!-- Labels (right col) -->
  <text x="${W - 195}" y="${H - 167}" font-size="7.5" fill="#64748b">ROLL OD</text>
  <text x="${W - 195}" y="${H - 142}" font-size="7.5" fill="#64748b">BORE DIA.</text>
  <text x="${W - 195}" y="${H - 117}" font-size="7.5" fill="#64748b">FACE WIDTH</text>
  <text x="${W - 195}" y="${H - 92}" font-size="7.5" fill="#64748b">SHAFT DIA.</text>
  <text x="${W - 195}" y="${H - 67}" font-size="7.5" fill="#64748b">KEYWAY</text>
  <text x="${W - 195}" y="${H - 42}" font-size="7.5" fill="#64748b">ROLL MATERIAL</text>
  <text x="${W - 195}" y="${H - 17}" font-size="7.5" fill="#64748b">SURFACE FINISH</text>

  <!-- Values (left col) -->
  <text x="${W - 375}" y="${H - 157}" font-size="9" fill="#e2e8f0" font-weight="bold">SRE-${(profileType||"UCH").substring(0,3).toUpperCase()}-S${pass.pass_no.toString().padStart(2,"0")}-${revision}</text>
  <text x="${W - 375}" y="${H - 132}" font-size="9" fill="#a5b4fc">${profileType || "u_channel"}</text>
  <text x="${W - 375}" y="${H - 107}" font-size="9" fill="#a5b4fc">${material}</text>
  <text x="${W - 375}" y="${H - 82}" font-size="9" fill="#a5b4fc">${thickness} mm</text>
  <text x="${W - 375}" y="${H - 57}" font-size="9" fill="${stageColor}">${pass.stage_type.replace(/_/g," ")}</text>
  <text x="${W - 375}" y="${H - 32}" font-size="9" fill="#94a3b8">${date} / REV ${revision}</text>
  <text x="${W - 375}" y="${H - 17}" font-size="9" fill="#94a3b8">1:1 (approx)</text>

  <!-- Values (right col) -->
  <text x="${W - 195}" y="${H - 157}" font-size="9" fill="#60a5fa" font-weight="bold">⌀${rd.estimated_roll_od_mm} h6</text>
  <text x="${W - 195}" y="${H - 132}" font-size="9" fill="#fbbf24">⌀${rd.bore_dia_mm} H7</text>
  <text x="${W - 195}" y="${H - 107}" font-size="9" fill="#c4b5fd">${rd.face_width_mm} mm</text>
  <text x="${W - 195}" y="${H - 82}" font-size="9" fill="#34d399">⌀${rd.shaft_dia_mm} mm</text>
  <text x="${W - 195}" y="${H - 57}" font-size="9" fill="#f97316">${rd.keyway_width_mm} mm (DIN 6885)</text>
  <text x="${W - 195}" y="${H - 32}" font-size="9" fill="#f87171">EN31 / D2 · 60-62 HRC</text>
  <text x="${W - 195}" y="${H - 17}" font-size="9" fill="#94a3b8">Ra 0.8 μm</text>

  ${approved ? `
  <!-- APPROVED FOR MANUFACTURING stamp -->
  <rect x="${W - 380}" y="${H - 230}" width="365" height="38" fill="#052e16" stroke="#16a34a" stroke-width="1.5" rx="3"/>
  <text x="${W - 197}" y="${H - 218}" font-size="9" fill="#4ade80" text-anchor="middle" font-weight="bold" letter-spacing="2">✔ APPROVED FOR MANUFACTURING</text>
  <text x="${W - 197}" y="${H - 205}" font-size="7.5" fill="#16a34a" text-anchor="middle">Sai Rolotech Smart Engines · ${date} · REV ${revision}</text>
  ` : `
  <!-- DRAFT stamp -->
  <rect x="${W - 380}" y="${H - 230}" width="365" height="38" fill="#1c1917" stroke="#57534e" stroke-width="0.8" rx="3"/>
  <text x="${W - 197}" y="${H - 218}" font-size="9" fill="#78716c" text-anchor="middle" font-weight="bold" letter-spacing="2">⚠ ENGINEERING DRAFT — NOT FOR MANUFACTURE</text>
  <text x="${W - 197}" y="${H - 205}" font-size="7.5" fill="#57534e" text-anchor="middle">Verify all dimensions before production use · REV ${revision}</text>
  `}

  <!-- Forming data box -->
  <rect x="15" y="${H - 185}" width="295" height="170" fill="#0f172a" stroke="#1e3a8a" stroke-width="1"/>
  <text x="20" y="${H - 170}" font-size="8" fill="#64748b">FORMING DATA — ${pass.station_label.toUpperCase()}</text>
  <line x1="15" y1="${H - 162}" x2="310" y2="${H - 162}" stroke="#1e293b" stroke-width="0.5"/>
  ${[
    ["Bend Angle",    `${pass.target_angle_deg}°`],
    ["Overform",      `${pass.target_angle_deg}°`],
    ["Roll Gap",      `${pass.roll_gap_mm} mm`],
    ["Form Depth",    `${pass.forming_depth_mm.toFixed(1)} mm`],
    ["Strip Width",   `${pass.strip_width_mm.toFixed(1)} mm`],
    ["Progress",      `${pass.pass_progress_pct.toFixed(0)}%`],
  ].map(([label, val], i) => `
    <text x="22" y="${H - 148 + i * 22}" font-size="8" fill="#64748b">${label}:</text>
    <text x="130" y="${H - 148 + i * 22}" font-size="9" fill="#e2e8f0" font-weight="bold">${val}</text>
  `).join("")}

  <!-- Watermark -->
  <text x="${W / 2}" y="${H / 2}" font-size="80" fill="#1e293b" text-anchor="middle"
    dominant-baseline="middle" opacity="0.15" transform="rotate(-30 ${W / 2} ${H / 2})">SAI ROLOTECH</text>

</svg>`;
}

// ─── DXF EXPORT GENERATOR ─────────────────────────────────────────────────────
// Generates a minimal ASCII DXF R12 file for the upper/lower roll profiles.

function buildStationDXF(
  pass:      PassData,
  rd:        RollDimensions,
  thickness: number,
  material:  string,
  revision:  string = "A",
): string {
  const upper = pass.upper_roll_profile;
  const lower = pass.lower_roll_profile;
  const date  = new Date().toLocaleDateString("en-GB");

  const lines: string[] = [];

  const push = (...args: (string | number)[]) =>
    args.forEach(a => lines.push(String(a)));

  // Header
  push("0","SECTION","2","HEADER");
  push("9","$ACADVER","1","AC1006");
  push("9","$INSBASE","10","0.0","20","0.0","30","0.0");
  push("9","$EXTMIN","10","0.0","20","0.0","30","0.0");
  push("9","$EXTMAX","10","500.0","20","500.0","30","0.0");
  push("0","ENDSEC");

  // Tables
  push("0","SECTION","2","TABLES");
  push("0","TABLE","2","LAYER","70","3");
  push("0","LAYER","2","UPPER_ROLL","70","0","62","5","6","CONTINUOUS");
  push("0","LAYER","2","LOWER_ROLL","70","0","62","3","6","CONTINUOUS");
  push("0","LAYER","2","STRIP","70","0","62","2","6","CONTINUOUS");
  push("0","LAYER","2","DIMS","70","0","62","1","6","CONTINUOUS");
  push("0","LAYER","2","CENTRE","70","0","62","8","6","CENTER");
  push("0","ENDTAB");
  push("0","ENDSEC");

  // Entities
  push("0","SECTION","2","ENTITIES");

  // Drawing comment text
  push("0","TEXT");
  push("8","DIMS","10","0.0","20","420.0","30","0.0","40","6","1",
    `SAI ROLOTECH · ${pass.station_label} · ${material} · ${thickness}mm · REV ${revision} · ${date}`);

  push("0","TEXT");
  push("8","DIMS","10","0.0","20","410.0","30","0.0","40","4","1",
    `PART: SRE-${(material).substring(0,3).toUpperCase()}-S${String(pass.pass_no).padStart(2,"0")}-${revision}  OD:${rd.estimated_roll_od_mm}  BORE:${rd.bore_dia_mm}H7  FACE:${rd.face_width_mm}  GAP:${pass.roll_gap_mm}mm`);

  // Scale upper profile so it's readable
  const scaleX = 2.5, scaleY = 2.5;
  const offsetX = 50, offsetY = 200;

  // Upper roll profile as polyline
  push("0","POLYLINE","8","UPPER_ROLL","66","1","70","0","62","5");
  upper.forEach(pt => {
    push("0","VERTEX","8","UPPER_ROLL",
      "10", (pt.x * scaleX + offsetX).toFixed(4),
      "20", (pt.y * scaleY + offsetY).toFixed(4),
      "30","0.0");
  });
  push("0","SEQEND");

  // Lower roll profile as polyline
  push("0","POLYLINE","8","LOWER_ROLL","66","1","70","0","62","3");
  lower.forEach(pt => {
    push("0","VERTEX","8","LOWER_ROLL",
      "10", (pt.x * scaleX + offsetX).toFixed(4),
      "20", (pt.y * scaleY + offsetY).toFixed(4),
      "30","0.0");
  });
  push("0","SEQEND");

  // Strip boundary (rectangle)
  const stripLeft   = (upper[0].x  * scaleX + offsetX).toFixed(4);
  const stripRight  = (upper[upper.length-1].x * scaleX + offsetX).toFixed(4);
  const uMidY       = ((upper[0].y + upper[upper.length-1].y) / 2 * scaleY + offsetY).toFixed(4);
  const lMidY       = ((lower[0].y + lower[lower.length-1].y) / 2 * scaleY + offsetY).toFixed(4);
  push("0","LINE","8","STRIP","62","2","10",stripLeft,"20",uMidY,"30","0.0","11",stripRight,"21",uMidY,"31","0.0");
  push("0","LINE","8","STRIP","62","2","10",stripLeft,"20",lMidY,"30","0.0","11",stripRight,"21",lMidY,"31","0.0");
  push("0","LINE","8","STRIP","62","2","10",stripLeft,"20",uMidY,"30","0.0","11",stripLeft,"21",lMidY,"31","0.0");
  push("0","LINE","8","STRIP","62","2","10",stripRight,"20",uMidY,"30","0.0","11",stripRight,"21",lMidY,"31","0.0");

  // Centre line
  const cX = ((upper[0].x + upper[upper.length-1].x) / 2 * scaleX + offsetX).toFixed(4);
  push("0","LINE","8","CENTRE","62","8","10",cX,"20","0.0","30","0.0","11",cX,"21","500.0","31","0.0");

  // Dimension: strip width
  const sw = upper[upper.length-1].x - upper[0].x;
  push("0","TEXT","8","DIMS","10",(upper[0].x * scaleX + offsetX + sw * scaleX / 2).toFixed(4),
    "20",(parseFloat(lMidY) + 15).toFixed(4),"30","0.0","40","5","1",
    `Strip W: ${pass.strip_width_mm.toFixed(1)} mm  Angle: ${pass.target_angle_deg}°  Gap: ${pass.roll_gap_mm} mm`);

  // Front view: bore and OD circles
  const fcx = 350, fcy = 200;
  const fod = rd.estimated_roll_od_mm / 2 * 0.6;
  const fbr = rd.bore_dia_mm / 2 * 0.6;
  push("0","CIRCLE","8","UPPER_ROLL","62","5","10",fcx,"20",fcy,"30","0.0","40",fod.toFixed(4));
  push("0","CIRCLE","8","DIMS","62","8","10",fcx,"20",fcy,"30","0.0","40",fbr.toFixed(4));

  push("0","ENDSEC");
  push("0","EOF");

  return lines.join("\r\n");
}

// ─── PDF PRINT HELPER ─────────────────────────────────────────────────────────
// Opens the SVG in a new print window; user chooses PDF printer or prints.

function printStationPDF(svgString: string, title: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
  @page { size: A3 landscape; margin: 0; }
  body  { margin: 0; padding: 0; background: #000; }
  svg   { width: 100vw; height: 100vh; display: block; }
  @media print {
    body { background: #0c1220; }
    svg  { width: 297mm; height: 420mm; }
  }
</style>
</head>
<body>${svgString}
<script>window.onload = () => { setTimeout(() => window.print(), 400); };<\/script>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerSVGDownload(svgString: string, filename: string) {
  triggerBlobDownload(
    new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
    filename,
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function RollDrawingPanel({ rollContour, rollDimensions }: Props) {
  const [selected,    setSelected]    = useState(0);
  const [view,        setView]        = useState<"all3" | "cross" | "front" | "side">("all3");
  const [downloading, setDownloading] = useState(false);
  const [revision,    setRevision]    = useState("A");
  const [approved,    setApproved]    = useState(false);

  if (!rollContour || rollContour.status !== "pass") {
    return (
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Circle className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300 uppercase tracking-wider">Roll Tooling Drawing</span>
        </div>
        <p className="text-slate-500 text-sm">No roll data. Run the pipeline to generate roll drawings.</p>
      </div>
    );
  }

  const allPasses: PassData[] = [
    ...(rollContour.passes ?? []),
    ...(rollContour.calibration_pass ? [rollContour.calibration_pass] : []),
  ];
  const pass = allPasses[selected] ?? allPasses[0];

  const rd: RollDimensions = rollDimensions ?? {
    estimated_roll_od_mm: 239,
    face_width_mm:        190,
    bore_dia_mm:          70,
    keyway_width_mm:      20,
    spacer_width_mm:      5.6,
    shaft_dia_mm:         70,
  };

  const stageColor = STAGE_COLOR[pass.stage_type] || "#8b5cf6";
  const totalPasses = allPasses.length;
  const material    = rollContour.material as string;
  const thickness   = rollContour.thickness_mm as number;

  const profType  = (rollContour as Record<string,unknown>).profile_type as string || "";
  const partBase  = `SRE-${(profType || material).substring(0,3).toUpperCase()}-S${String(pass.pass_no).padStart(2,"0")}-REV${revision}`;

  const handleDownloadStation = useCallback(() => {
    setDownloading(true);
    try {
      const svg  = buildStationSVG(pass, rd, thickness, material, profType, revision, approved);
      triggerSVGDownload(svg, `${partBase}.svg`);
    } finally { setTimeout(() => setDownloading(false), 600); }
  }, [pass, rd, material, thickness, profType, revision, approved, partBase]);

  const handleDownloadAll = useCallback(() => {
    setDownloading(true);
    allPasses.forEach((p, i) => {
      setTimeout(() => {
        const svg  = buildStationSVG(p, rd, thickness, material, profType, revision, approved);
        const base = `SRE-${(profType || material).substring(0,3).toUpperCase()}-S${String(p.pass_no).padStart(2,"0")}-REV${revision}`;
        triggerSVGDownload(svg, `${base}.svg`);
      }, i * 150);
    });
    setTimeout(() => setDownloading(false), allPasses.length * 150 + 500);
  }, [allPasses, rd, material, thickness, profType, revision, approved]);

  const handleDownloadPDF = useCallback(() => {
    const svg = buildStationSVG(pass, rd, thickness, material, profType, revision, approved);
    printStationPDF(svg, `${partBase}.pdf`);
  }, [pass, rd, material, thickness, profType, revision, approved, partBase]);

  const handleDownloadZIP = useCallback(async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`SRE-${profType || "roll"}-REV${revision}`)!;
      allPasses.forEach(p => {
        const svg  = buildStationSVG(p, rd, thickness, material, profType, revision, approved);
        const dxf  = buildStationDXF(p, rd, thickness, material, revision);
        const base = `SRE-${(profType || material).substring(0,3).toUpperCase()}-S${String(p.pass_no).padStart(2,"0")}-REV${revision}`;
        folder.file(`${base}.svg`, svg);
        folder.file(`${base}.dxf`, dxf);
      });
      // README
      folder.file("README.txt",
        `SAI ROLOTECH SMART ENGINES — Roll Tooling Drawing Pack\n` +
        `Profile: ${profType || "custom"}  Material: ${material}  Thickness: ${thickness}mm\n` +
        `Revision: ${revision}  Stations: ${allPasses.length}\n` +
        `Generated: ${new Date().toLocaleString("en-GB")}\n` +
        `\nFiles: Each station has .svg (engineering drawing) + .dxf (CAD profile)\n` +
        `DXF Layers: UPPER_ROLL (blue), LOWER_ROLL (green), STRIP (yellow), DIMS, CENTRE\n` +
        `\n${approved ? "STATUS: APPROVED FOR MANUFACTURING" : "STATUS: ENGINEERING DRAFT — NOT FOR MANUFACTURE"}\n`
      );
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      triggerBlobDownload(blob, `SRE-${profType || "roll"}-REV${revision}-AllStations.zip`);
    } finally { setDownloading(false); }
  }, [allPasses, rd, material, thickness, profType, revision, approved]);

  const handleDownloadDXF = useCallback(() => {
    const dxf = buildStationDXF(pass, rd, thickness, material, revision);
    triggerBlobDownload(
      new Blob([dxf], { type: "application/dxf;charset=utf-8" }),
      `${partBase}.dxf`,
    );
  }, [pass, rd, material, thickness, revision, partBase]);

  return (
    <div className="bg-[#0c1220] rounded-2xl border border-slate-700/60 overflow-hidden">

      {/* ── Header ── */}
      <div className="px-5 py-3 border-b border-slate-700/60 flex items-center gap-3 flex-wrap">
        <Circle className="w-4 h-4 text-violet-400" />
        <div>
          <span className="text-sm font-bold text-violet-300 uppercase tracking-wider">
            Roll Tooling Drawing
          </span>
          <span className="ml-3 text-xs text-slate-500 font-mono">
            {material} · {thickness}mm · ⌀{rd.estimated_roll_od_mm}OD · ⌀{rd.bore_dia_mm}bore
          </span>
        </div>

        {/* Revision + Approved controls */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-lg px-2.5 py-1">
            <Edit3 className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-400">REV</span>
            <input
              type="text"
              value={revision}
              onChange={e => setRevision(e.target.value.toUpperCase().slice(0,4))}
              className="w-8 bg-transparent text-xs font-bold text-amber-300 text-center outline-none"
              maxLength={4}
            />
          </div>
          <button
            onClick={() => setApproved(v => !v)}
            className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${
              approved
                ? "bg-green-500/15 border-green-500/50 text-green-400"
                : "bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-300"
            }`}
          >
            {approved ? <Lock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
            {approved ? "APPROVED" : "Draft"}
          </button>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
          {([
            ["all3",  "3-View"],
            ["cross", "Cross"],
            ["front", "Front"],
            ["side",  "Side"],
          ] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                view === v ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* ── Station selector ── */}
      <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2 flex-wrap">
        <button onClick={() => setSelected(s => Math.max(0, s - 1))}
          disabled={selected === 0}
          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {allPasses.map((p, i) => (
            <MiniThumb key={i} pass={p} active={i === selected} onClick={() => setSelected(i)} />
          ))}
        </div>

        <button onClick={() => setSelected(s => Math.min(totalPasses - 1, s + 1))}
          disabled={selected === totalPasses - 1}
          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Export toolbar ── */}
      <div className="px-4 py-2 border-b border-slate-700/40 bg-slate-900/40 flex items-center gap-2 flex-wrap">
        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Export</span>

        {/* SVG - current station */}
        <button onClick={handleDownloadStation} disabled={downloading}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-all disabled:opacity-50">
          <FileDown className="w-3 h-3" /> SVG · S{pass.pass_no}
        </button>

        {/* PDF - current station */}
        <button onClick={handleDownloadPDF} disabled={downloading}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-50">
          <FileText className="w-3 h-3" /> PDF · S{pass.pass_no}
        </button>

        {/* DXF - current station */}
        <button onClick={handleDownloadDXF} disabled={downloading}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all disabled:opacity-50">
          <Download className="w-3 h-3" /> DXF · S{pass.pass_no}
        </button>

        <span className="w-px h-4 bg-slate-700 mx-0.5" />

        {/* SVG All */}
        <button onClick={handleDownloadAll} disabled={downloading}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-all disabled:opacity-50">
          <Layers className="w-3 h-3" /> SVG · All {totalPasses}
        </button>

        {/* ZIP All (SVG + DXF) */}
        <button onClick={handleDownloadZIP} disabled={downloading}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-50">
          <Archive className="w-3 h-3" />
          {downloading ? "Building…" : `ZIP Pack · All ${totalPasses}`}
        </button>

        {/* Part number display */}
        <span className="ml-auto text-[9px] font-mono text-slate-500">{partBase}</span>
      </div>

      {/* ── Active station info strip ── */}
      <div className="px-5 py-2.5 border-b border-slate-700/40 flex items-center gap-4 flex-wrap"
        style={{ borderLeftColor: stageColor, borderLeftWidth: 3 }}>
        <div>
          <span className="text-xs font-bold text-white">{pass.station_label}</span>
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: stageColor + "22", color: stageColor }}>
            {pass.stage_type.replace(/_/g, " ")}
          </span>
        </div>
        {[
          { label: "Angle",    value: `${pass.target_angle_deg}°`,       color: "#60a5fa" },
          { label: "Gap",      value: `${pass.roll_gap_mm}mm`,            color: "#34d399" },
          { label: "Depth",    value: `${pass.forming_depth_mm.toFixed(1)}mm`, color: "#a78bfa" },
          { label: "Strip W",  value: `${pass.strip_width_mm.toFixed(1)}mm`,   color: "#fbbf24" },
          { label: "Progress", value: `${pass.pass_progress_pct.toFixed(0)}%`, color: "#f97316" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</span>
            <span className="text-xs font-bold font-mono" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Drawing area ── */}
      <div className={`p-4 ${view === "all3" ? "grid grid-cols-3 gap-3" : ""}`}>
        {(view === "all3" || view === "cross") && (
          <div className={`rounded-xl overflow-hidden border border-slate-700/60 ${view === "all3" ? "aspect-[4/3]" : "aspect-[16/9] max-h-[380px]"}`}>
            <div className="text-[9px] text-slate-500 px-2 py-1 border-b border-slate-700/40 font-mono uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" /> Cross-Section (Nip View)
            </div>
            <CrossSectionView
              pass={pass}
              thickness={rollContour.thickness_mm}
              rollOD={rd.estimated_roll_od_mm}
              boreD={rd.bore_dia_mm}
            />
          </div>
        )}

        {(view === "all3" || view === "front") && (
          <div className={`rounded-xl overflow-hidden border border-slate-700/60 ${view === "all3" ? "aspect-[4/3]" : "aspect-square max-h-[380px] mx-auto"}`}>
            <div className="text-[9px] text-slate-500 px-2 py-1 border-b border-slate-700/40 font-mono uppercase tracking-wider flex items-center gap-1">
              <Circle className="w-3 h-3" /> Front View (Roll Face)
            </div>
            <CircularFrontView
              pass={pass}
              rollOD={rd.estimated_roll_od_mm}
              boreD={rd.bore_dia_mm}
              keyway={rd.keyway_width_mm}
              faceW={rd.face_width_mm}
              thickness={rollContour.thickness_mm}
            />
          </div>
        )}

        {(view === "all3" || view === "side") && (
          <div className={`rounded-xl overflow-hidden border border-slate-700/60 ${view === "all3" ? "aspect-[4/3]" : "aspect-[4/3] max-h-[380px]"}`}>
            <div className="text-[9px] text-slate-500 px-2 py-1 border-b border-slate-700/40 font-mono uppercase tracking-wider flex items-center gap-1">
              <AlignCenter className="w-3 h-3" /> Side View (Section A-A)
            </div>
            <SideProfileView
              pass={pass}
              rollOD={rd.estimated_roll_od_mm}
              boreD={rd.bore_dia_mm}
              faceW={rd.face_width_mm}
              thickness={rollContour.thickness_mm}
            />
          </div>
        )}
      </div>

      {/* ── Roll specification table ── */}
      <div className="border-t border-slate-700/40 px-5 py-4">
        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
          <Info className="w-3 h-3" /> Roll Specification — DIN Standards
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Roll OD",    value: `${rd.estimated_roll_od_mm} mm`,  sub: "Tolerance h6",   color: "text-blue-300" },
            { label: "Bore",       value: `⌀${rd.bore_dia_mm} mm`,          sub: "Tolerance H7",   color: "text-yellow-300" },
            { label: "Face Width", value: `${rd.face_width_mm} mm`,          sub: "Incl. clearance",color: "text-purple-300" },
            { label: "Shaft",      value: `⌀${rd.shaft_dia_mm} mm`,          sub: "EN31 / C45 shaft", color: "text-green-300" },
            { label: "Keyway",     value: `${rd.keyway_width_mm} mm wide`,   sub: "DIN 6885 A",     color: "text-orange-300" },
            { label: "Spacer",     value: `${rd.spacer_width_mm} mm`,        sub: "Between rolls",  color: "text-slate-300" },
            { label: "Material",   value: "EN31 / D2",                       sub: "60–62 HRC",      color: "text-red-300" },
            { label: "Finish",     value: "Ra 0.8 μm",                       sub: "Ground & hardened", color: "text-teal-300" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-slate-800/60 rounded-xl border border-slate-700/40 px-3 py-2">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
              <div className={`text-sm font-bold font-mono mt-0.5 ${color}`}>{value}</div>
              <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {rd.notes && rd.notes.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {rd.notes.map((n, i) => (
              <div key={i} className="text-[10px] text-slate-500">• {n}</div>
            ))}
          </div>
        )}

        <div className="mt-3 text-[9px] text-slate-600 font-mono">
          roll_dimension_engine · roll_contour_engine · Sai Rolotech Smart Engines v2.3.0
        </div>
      </div>
    </div>
  );
}
