/**
 * RollDrawingPanel.tsx
 * Phase 2 Engineering Roll Tooling Drawing Panel — Sai Rolotech Smart Engines v2.3.0
 *
 * Views: Cross-section nip · Front roll face · Side Section A-A
 * Export: SVG · DXF · PDF (single + all stations) · ZIP manufacturing package
 * Release: Draft · Internal Review · Shop Drawing · Manufacturing Release
 */
import { useState, useCallback, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Download,
  Layers, Circle, AlignCenter, Info, FileDown,
  FileText, Archive, Edit3, CheckCircle, Lock,
  AlertTriangle, ShieldCheck, User, ClipboardCheck, XCircle,
} from "lucide-react";

import {
  buildDrawingModel,
  validateDrawingModel,
  renderDrawingToSVG,
  renderDrawingToDXF,
  printSinglePDF,
  printAllStationsPDF,
  buildZipPackage,
  triggerBlobDownload,
  triggerSVGDownload,
  generateFileName,
  generatePackageZipName,
  generateAllPdfName,
  RELEASE_META,
  type ReleaseState,
  type DrawingModel,
} from "@/lib/rollDrawingExport";

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
  profileType?:   string;
  springbackDeg?: number;
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

      {/* ── Contact-point red dots ──────────────────── */}
      {(() => {
        const contactPts: Array<{ x: number; y: number; label: string }> = [];
        // Upper roll contact: first, last, and inflection points
        if (upperPx.length > 0) {
          contactPts.push({ ...upperPx[0],                           label: "U" });
          contactPts.push({ ...upperPx[upperPx.length - 1],          label: "U" });
          if (upperPx.length > 4) contactPts.push({ ...upperPx[Math.floor(upperPx.length / 2)], label: "U" });
        }
        // Lower roll contact: first, last
        if (lowerPx.length > 0) {
          contactPts.push({ ...lowerPx[0],                           label: "L" });
          contactPts.push({ ...lowerPx[lowerPx.length - 1],          label: "L" });
        }
        // Detect corner inflection points in upper profile
        for (let i = 1; i < upperPx.length - 1; i++) {
          const dx1 = upperPx[i].x - upperPx[i-1].x;
          const dy1 = upperPx[i].y - upperPx[i-1].y;
          const dx2 = upperPx[i+1].x - upperPx[i].x;
          const dy2 = upperPx[i+1].y - upperPx[i].y;
          const ang = Math.abs(Math.atan2(dy1*dx2 - dx1*dy2, dx1*dx2 + dy1*dy2));
          if (ang > 0.15) contactPts.push({ ...upperPx[i], label: "C" });
        }
        return contactPts.map((cp, ci) => (
          <g key={`rdp-cp-${ci}`}>
            <circle cx={cp.x} cy={cp.y} r="5" fill="#ef4444" opacity="0.12" />
            <circle cx={cp.x} cy={cp.y} r="3" fill="#ef4444" opacity="0.8" />
            <circle cx={cp.x} cy={cp.y} r="1.2" fill="#ffffff" opacity="0.95" />
          </g>
        ));
      })()}

      {/* ── Neutral zone shading — mid-strip region ── */}
      <rect
        x={upperPx[Math.floor(upperPx.length * 0.3)]?.x ?? pad}
        y={stripY1}
        width={Math.abs((upperPx[Math.floor(upperPx.length * 0.7)]?.x ?? W-pad) - (upperPx[Math.floor(upperPx.length * 0.3)]?.x ?? pad))}
        height={stripH}
        fill="#6366f1" opacity="0.08"
        stroke="#6366f1" strokeWidth="0.4" strokeDasharray="2,2"
      />
      <text
        x={W / 2} y={(stripY1 + stripY2) / 2 + 2}
        fontSize="4.5" fill="#6366f1" textAnchor="middle" opacity="0.7"
      >Neutral Zone</text>

      {/* Legend */}
      <rect x={4} y={4} width={82} height={44} fill="#0f172a" stroke="#1e293b" strokeWidth="0.5" rx="2" />
      <line x1={8} y1={12} x2={20} y2={12} stroke="#60a5fa" strokeWidth="1.5" />
      <text x={23} y={14} fontSize="5.5" fill="#94a3b8">Upper Roll</text>
      <line x1={8} y1={22} x2={20} y2={22} stroke="#34d399" strokeWidth="1.5" />
      <text x={23} y={24} fontSize="5.5" fill="#94a3b8">Lower Roll</text>
      <rect x={8} y={27} width={12} height={4} fill="#fbbf24" opacity="0.5" />
      <text x={23} y={33} fontSize="5.5" fill="#94a3b8">Strip</text>
      <circle cx={13} cy={39} r="2.5" fill="#ef4444" opacity="0.85" />
      <circle cx={13} cy={39} r="1" fill="#ffffff" opacity="0.9" />
      <text x={23} y={41} fontSize="5.5" fill="#94a3b8">Contact Point</text>

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


// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const REVISION_OPTIONS = ["R0","R1","R2","R3","R4","R5"];

const RELEASE_STATE_OPTIONS: { value: ReleaseState; label: string; color: string }[] = [
  { value: "draft",                label: "Draft",                color: "text-slate-400" },
  { value: "internal_review",      label: "Internal Review",      color: "text-blue-400"  },
  { value: "shop_drawing",         label: "Shop Drawing",         color: "text-orange-400"},
  { value: "manufacturing_release",label: "Manufacturing Release",color: "text-green-400" },
];

export default function RollDrawingPanel({
  rollContour,
  rollDimensions,
  profileType: profileTypeProp,
  springbackDeg: springbackDegProp,
}: Props) {
  const [selected,      setSelected]      = useState(0);
  const [view,          setView]          = useState<"all3"|"cross"|"front"|"side">("all3");
  const [drawingMode,   setDrawingMode]   = useState<"basic"|"engineering"|"manufacturing">("engineering");
  const [downloading,   setDownloading]   = useState(false);
  const [revision,      setRevision]      = useState("R0");
  const [releaseState,  setReleaseState]  = useState<ReleaseState>("draft");
  const [checkedBy,     setCheckedBy]     = useState("");
  const [approvedBy,    setApprovedBy]    = useState("");
  const [showRelease,   setShowRelease]   = useState(false);
  const [validErrors,   setValidErrors]   = useState<string[]>([]);

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

  const stageColor   = STAGE_COLOR[pass.stage_type] || "#8b5cf6";
  const totalPasses  = allPasses.length;
  const material     = rollContour.material as string;
  const thickness    = rollContour.thickness_mm as number;
  const rc = rollContour as unknown as Record<string,unknown>;
  const profType     = profileTypeProp || (rc.profile_type as string) || "";
  const springbackDeg = springbackDegProp ?? (rc.springback_deg as number) ?? 0;

  // ── Build all DrawingModels (memoized) ──────────────────────────────────────
  const modelOpts = useMemo(() => ({
    totalStations: totalPasses,
    material,
    thickness,
    profileType:  profType,
    springbackDeg,
    revision,
    releaseState,
    checkedBy,
    approvedBy,
  }), [totalPasses, material, thickness, profType, springbackDeg, revision, releaseState, checkedBy, approvedBy]);

  const currentModel: DrawingModel = useMemo(
    () => buildDrawingModel(pass, rd, modelOpts),
    [pass, rd, modelOpts],
  );

  const allModels: DrawingModel[] = useMemo(
    () => allPasses.map(p => buildDrawingModel(p, rd, modelOpts)),
    [allPasses, rd, modelOpts],
  );

  // ── Pre-export validation ───────────────────────────────────────────────────
  const runValidation = (forRelease?: ReleaseState): boolean => {
    const result = validateDrawingModel(allModels, forRelease ?? releaseState);
    setValidErrors(result.errors);
    return result.valid;
  };

  const wallMm = (rd.estimated_roll_od_mm - rd.bore_dia_mm) / 2;

  // ── File naming ─────────────────────────────────────────────────────────────
  const partBase   = currentModel.drawingNo;
  const fSVG       = generateFileName(currentModel, "svg");
  const fDXF       = generateFileName(currentModel, "dxf");
  const fZIP       = generatePackageZipName(currentModel);
  const fAllPDF    = generateAllPdfName(currentModel);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleDownloadStation = useCallback(() => {
    if (!runValidation()) return;
    setDownloading(true);
    try {
      triggerSVGDownload(renderDrawingToSVG(currentModel), fSVG);
    } finally { setTimeout(() => setDownloading(false), 600); }
  }, [currentModel, fSVG]);

  const handleDownloadAll = useCallback(() => {
    if (!runValidation()) return;
    setDownloading(true);
    allModels.forEach((m, i) => {
      setTimeout(() => {
        triggerSVGDownload(renderDrawingToSVG(m), generateFileName(m, "svg"));
      }, i * 150);
    });
    setTimeout(() => setDownloading(false), allModels.length * 150 + 500);
  }, [allModels]);

  const handleDownloadPDF = useCallback(() => {
    if (!runValidation()) return;
    printSinglePDF(currentModel, `${partBase}.pdf`);
  }, [currentModel, partBase]);

  const handleDownloadAllPDF = useCallback(() => {
    if (!runValidation()) return;
    printAllStationsPDF(allModels, fAllPDF);
  }, [allModels, fAllPDF]);

  const handleDownloadDXF = useCallback(() => {
    if (!runValidation()) return;
    const dxf = renderDrawingToDXF(currentModel);
    triggerBlobDownload(
      new Blob([dxf], { type: "application/dxf;charset=utf-8" }),
      fDXF,
    );
  }, [currentModel, fDXF]);

  const handleDownloadZIP = useCallback(async () => {
    if (!runValidation()) return;
    setDownloading(true);
    try {
      const blob = await buildZipPackage(allModels);
      triggerBlobDownload(blob, fZIP);
    } finally { setDownloading(false); }
  }, [allModels, fZIP]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/70 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/40 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <Circle className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300 uppercase tracking-wider">Roll Tooling Drawing</span>
          <span className="ml-2 text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
            Phase 2 Export Engine
          </span>
        </div>
        {/* Revision + Release selector */}
        <div className="flex items-center gap-2">
          <select
            value={revision}
            onChange={e => setRevision(e.target.value)}
            className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 font-mono"
          >
            {REVISION_OPTIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            onClick={() => setShowRelease(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
              releaseState === "manufacturing_release"
                ? "bg-green-500/10 border-green-500/40 text-green-400"
                : releaseState === "shop_drawing"
                ? "bg-orange-500/10 border-orange-500/40 text-orange-400"
                : releaseState === "internal_review"
                ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            {RELEASE_STATE_OPTIONS.find(o => o.value === releaseState)?.label ?? "Draft"}
          </button>
        </div>
      </div>

      {/* ── Release mode panel ── */}
      {showRelease && (
        <div className="px-5 py-4 border-b border-slate-700/40 bg-slate-900/60">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> Manufacturing Release Settings
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {RELEASE_STATE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setReleaseState(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-all ${
                  releaseState === opt.value
                    ? `${opt.color} border-current bg-current/10 ring-1 ring-current/30`
                    : "text-slate-500 border-slate-700 bg-slate-800/60 hover:border-slate-500"
                }`}
              >
                {releaseState === opt.value
                  ? <CheckCircle className="w-3 h-3" />
                  : <div className="w-3 h-3 rounded-full border border-current opacity-40" />
                }
                {opt.label}
              </button>
            ))}
          </div>
          {/* Checked/Approved fields — only shown for non-draft states */}
          {releaseState !== "draft" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <User className="w-2.5 h-2.5" /> Checked By
                </label>
                <input
                  value={checkedBy}
                  onChange={e => setCheckedBy(e.target.value)}
                  placeholder={releaseState === "manufacturing_release" ? "Required" : "Optional"}
                  className={`w-full text-xs bg-slate-900 border rounded-lg px-3 py-1.5 text-slate-200 font-mono placeholder-slate-600 ${
                    releaseState === "manufacturing_release" && !checkedBy
                      ? "border-amber-500/50"
                      : "border-slate-700"
                  }`}
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <ClipboardCheck className="w-2.5 h-2.5" /> Approved By
                </label>
                <input
                  value={approvedBy}
                  onChange={e => setApprovedBy(e.target.value)}
                  placeholder={releaseState === "manufacturing_release" ? "Required" : "Optional"}
                  className={`w-full text-xs bg-slate-900 border rounded-lg px-3 py-1.5 text-slate-200 font-mono placeholder-slate-600 ${
                    releaseState === "manufacturing_release" && !approvedBy
                      ? "border-amber-500/50"
                      : "border-slate-700"
                  }`}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Validation errors ── */}
      {validErrors.length > 0 && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/8">
          <div className="flex items-center gap-1.5 mb-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Export blocked — fix before proceeding</span>
          </div>
          {validErrors.map((e, i) => (
            <div key={i} className="text-[10px] text-red-300">• {e}</div>
          ))}
        </div>
      )}

      {/* ── Station thumbnails ── */}
      <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto border-b border-slate-700/30">
        <button
          onClick={() => setSelected(s => Math.max(0, s - 1))}
          disabled={selected === 0}
          className="p-1 rounded-lg text-slate-500 hover:text-slate-300 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {allPasses.map((p, i) => (
          <MiniThumb key={p.pass_no} pass={p} active={i === selected} onClick={() => setSelected(i)} />
        ))}
        <button
          onClick={() => setSelected(s => Math.min(allPasses.length - 1, s + 1))}
          disabled={selected === allPasses.length - 1}
          className="p-1 rounded-lg text-slate-500 hover:text-slate-300 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="ml-auto flex-shrink-0 text-[10px] font-mono text-slate-500">
          {selected + 1} / {totalPasses} · {pass.station_label}
        </div>
      </div>

      {/* ── View toggle ── */}
      <div className="flex gap-1.5 px-5 py-2 border-b border-slate-700/30 flex-wrap">
        {([
          ["all3",  "All 3 Views",   Layers      ],
          ["cross", "Cross-Section", Circle      ],
          ["front", "Front View",    Circle      ],
          ["side",  "Side View",     AlignCenter ],
        ] as const).map(([v, label, Icon]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
              view === v
                ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
                : "border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600"
            }`}
          >
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[9px] text-slate-600 mr-1">Mode:</span>
          {([
            ["basic",           "Basic",         "text-sky-400",    "border-sky-500/40 bg-sky-500/10"   ],
            ["engineering",     "Engineering",   "text-violet-400", "border-violet-500/40 bg-violet-500/10"],
            ["manufacturing",   "Mfg Release",   "text-amber-400",  "border-amber-500/40 bg-amber-500/10"],
          ] as const).map(([m, label, activeText, activeBg]) => (
            <button
              key={m}
              onClick={() => setDrawingMode(m)}
              className={`text-[9px] px-2.5 py-1 rounded-lg border transition-all ${
                drawingMode === m
                  ? `${activeText} ${activeBg} font-semibold`
                  : "border-slate-700/50 text-slate-600 hover:text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Drawing mode info banner ── */}
      {drawingMode === "basic" && (
        <div className="px-5 py-1.5 border-b border-sky-500/15 bg-sky-500/5 text-[9px] text-sky-400 flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          Basic View — station number, bend angle, flower step, upper/lower roll contact. For operator or client demos.
        </div>
      )}
      {drawingMode === "manufacturing" && (
        <div className="px-5 py-1.5 border-b border-amber-500/15 bg-amber-500/5 text-[9px] text-amber-400 flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          Manufacturing View — full machining details with tolerances, part number, revision, and assembly relation.
        </div>
      )}

      {/* ── Stage badge ── */}
      <div className="px-5 pt-3 pb-1 flex items-center gap-2">
        <div
          className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
          style={{ color: stageColor, borderColor: stageColor + "50", backgroundColor: stageColor + "15" }}
        >
          {pass.stage_type.replace(/_/g," ").toUpperCase()}
        </div>
        <span className="text-[10px] text-slate-600 font-mono">
          θ = {pass.target_angle_deg}°
          {springbackDeg > 0 && ` · Tool ${(pass.target_angle_deg + springbackDeg).toFixed(1)}°`}
          · Gap {pass.roll_gap_mm} mm
          · Depth {pass.forming_depth_mm.toFixed(1)} mm
        </span>
      </div>

      {/* ── Drawing views ── */}
      <div className={`grid gap-4 px-5 py-3 ${view === "all3" ? "grid-cols-3" : "grid-cols-1"}`}>
        {(view === "all3" || view === "cross") && (
          <div className={`rounded-xl overflow-hidden border border-slate-700/60 ${view === "all3" ? "aspect-[4/3]" : "aspect-[4/3] max-h-[420px]"}`}>
            <div className="text-[9px] text-slate-500 px-2 py-1 border-b border-slate-700/40 font-mono uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" /> Cross-Section — Nip View
            </div>
            <CrossSectionView
              pass={pass}
              thickness={thickness}
              rollOD={rd.estimated_roll_od_mm}
              boreD={rd.bore_dia_mm}
            />
          </div>
        )}

        {(view === "all3" || view === "front") && (
          <div className={`rounded-xl overflow-hidden border border-slate-700/60 ${view === "all3" ? "aspect-[4/3]" : "aspect-[4/3] max-h-[420px]"}`}>
            <div className="text-[9px] text-slate-500 px-2 py-1 border-b border-slate-700/40 font-mono uppercase tracking-wider flex items-center gap-1">
              <Circle className="w-3 h-3" /> Front View — Roll Face
            </div>
            <CircularFrontView
              pass={pass}
              rollOD={rd.estimated_roll_od_mm}
              boreD={rd.bore_dia_mm}
              keyway={rd.keyway_width_mm}
              faceW={rd.face_width_mm}
              thickness={thickness}
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

      {/* ── Drawing Mode Detail Panel ── */}
      {drawingMode === "basic" && (
        <div className="mx-5 mb-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
          <div className="text-[9px] uppercase tracking-wider text-sky-500 font-semibold mb-2 flex items-center gap-1.5">
            <Info className="w-3 h-3" /> Basic View Summary
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ["Station",       `${pass.pass_no} / ${totalPasses}`             ],
              ["Bend Angle",    `${pass.target_angle_deg}°`                     ],
              ["Stage",         pass.stage_type.replace(/_/g," ").toUpperCase() ],
              ["Progress",      `${pass.pass_progress_pct.toFixed(0)}%`         ],
              ["Strip Width",   `${pass.strip_width_mm.toFixed(1)} mm`          ],
              ["Roll Gap",      `${pass.roll_gap_mm.toFixed(2)} mm`             ],
              ["Upper Contact", "Left + Right edges"],
              ["Lower Contact", "Web center zone"],
            ].map(([k, v]) => (
              <div key={k} className="text-xs">
                <div className="text-sky-600 text-[9px]">{k}</div>
                <div className="text-slate-300 font-mono">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {drawingMode === "manufacturing" && (
        <div className="mx-5 mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="text-[9px] uppercase tracking-wider text-amber-500 font-semibold mb-2 flex items-center gap-1.5">
            <Info className="w-3 h-3" /> Manufacturing Release Details
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              ["Part Number",   `SRT-${profType?.toUpperCase() ?? "ROLL"}-S${pass.pass_no.toString().padStart(2,"0")}-${revision}` ],
              ["Material",      "EN31 / D2 Tool Steel (60+ HRC)"               ],
              ["OD Tolerance",  `Ø ${rd.estimated_roll_od_mm.toFixed(1)} ±0.02 mm` ],
              ["Bore Tolerance",`Ø ${rd.bore_dia_mm.toFixed(1)} H7 (+0.025/0)` ],
              ["Face Width",    `${rd.face_width_mm} ±0.05 mm`                  ],
              ["Keyway",        `${rd.keyway_width_mm} mm JS9`                  ],
              ["Surface Finish","Ra 0.8 µm (ground)"                            ],
              ["Hardness",      "58–62 HRC (case), 38–42 HRC (core)"           ],
              ["Inspection",    "100% CMM + Hardness check"                    ],
            ].map(([k, v]) => (
              <div key={k} className="text-xs">
                <div className="text-amber-600 text-[9px]">{k}</div>
                <div className="text-slate-300 font-mono text-[10px] leading-tight">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-amber-500/15 text-[9px] text-slate-600 font-mono">
            Machining note: Rough turn → Hardening → Finish grind OD → Bore → Keyway → Profile mill.
            Profile contour to be verified by CMM against CAD model before assembly.
          </div>
        </div>
      )}

      {/* ── Export toolbar ── */}
      <div className="border-t border-slate-700/40 px-5 py-3 bg-slate-900/30">
        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-2.5 flex items-center gap-1.5">
          <Download className="w-3 h-3" /> Export — {partBase}
        </div>

        {/* ★ ONE-CLICK FULL PRODUCTION SET ★ */}
        <button
          onClick={handleDownloadZIP}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-xl mb-3 transition-all disabled:opacity-50
            bg-gradient-to-r from-amber-600/25 to-orange-600/20
            border-2 border-amber-500/50 text-amber-300
            hover:from-amber-600/40 hover:to-orange-600/35 hover:border-amber-400
            shadow-lg shadow-amber-900/20"
        >
          <Archive className="w-4 h-4" />
          {downloading ? "Building Package…" : `📦 Download Full Production Set — All ${totalPasses} Stations`}
          <span className="text-[9px] text-amber-500 font-normal ml-1">(SVG + DXF + PDF + Manifest)</span>
        </button>

        {/* Row 1: SVG */}
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={handleDownloadStation}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-300 hover:bg-blue-600/25 disabled:opacity-50 transition-all"
          >
            <FileDown className="w-3 h-3" />
            SVG — Station {pass.pass_no}
          </button>
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 disabled:opacity-50 transition-all"
          >
            <Layers className="w-3 h-3" />
            SVG — All {totalPasses} Stations
          </button>
        </div>

        {/* Row 2: PDF */}
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-600/15 border border-red-500/30 text-red-300 hover:bg-red-600/25 disabled:opacity-50 transition-all"
          >
            <FileText className="w-3 h-3" />
            PDF — Station {pass.pass_no}
          </button>
          <button
            onClick={handleDownloadAllPDF}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 disabled:opacity-50 transition-all"
          >
            <FileText className="w-3 h-3" />
            PDF — All {totalPasses} Stations (Multi-page)
          </button>
        </div>

        {/* Row 3: DXF + ZIP */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadDXF}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-600/15 border border-amber-500/30 text-amber-300 hover:bg-amber-600/25 disabled:opacity-50 transition-all"
          >
            <Edit3 className="w-3 h-3" />
            DXF — Station {pass.pass_no}
          </button>
          <button
            onClick={handleDownloadZIP}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:bg-violet-600/25 disabled:opacity-50 transition-all"
          >
            <Archive className="w-3 h-3" />
            {downloading ? "Building ZIP…" : `Manufacturing Package (SVG+DXF+Manifest) — ${totalPasses} stations`}
          </button>
        </div>

        {/* File name preview */}
        <div className="mt-2 text-[9px] text-slate-600 font-mono flex flex-wrap gap-x-4 gap-y-0.5">
          <span>SVG: {fSVG}</span>
          <span>DXF: {fDXF}</span>
          <span>ZIP: {fZIP}</span>
        </div>
      </div>

      {/* ── Roll specification table ── */}
      <div className="border-t border-slate-700/40 px-5 py-4">
        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
          <Info className="w-3 h-3" /> Roll Specification — DIN Standards · {revision}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Roll OD",    value: `${rd.estimated_roll_od_mm} mm`,  sub: "Tolerance h6",       color: "text-blue-300"   },
            { label: "Bore",       value: `⌀${rd.bore_dia_mm} mm`,          sub: "Tolerance H7",       color: "text-yellow-300" },
            { label: "Face Width", value: `${rd.face_width_mm} mm`,          sub: "Incl. clearance",    color: "text-purple-300" },
            { label: "Shaft",      value: `⌀${rd.shaft_dia_mm} mm`,          sub: "EN31 / C45 shaft",   color: "text-green-300"  },
            { label: "Keyway",     value: `${rd.keyway_width_mm} mm wide`,   sub: "DIN 6885 A",         color: "text-orange-300" },
            { label: "Spacer",     value: `${rd.spacer_width_mm} mm`,        sub: "Between rolls",      color: "text-slate-300"  },
            { label: "Material",   value: "EN31 / D2",                       sub: "60–62 HRC",          color: "text-red-300"    },
            { label: "Finish",     value: "Ra 0.8 μm",                       sub: "Ground & hardened",  color: "text-teal-300"   },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-slate-800/60 rounded-xl border border-slate-700/40 px-3 py-2">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
              <div className={`text-sm font-bold font-mono mt-0.5 ${color}`}>{value}</div>
              <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* Thin-wall engineering warning */}
        {wallMm < 15 && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/8">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-[10px] text-amber-300">
              <span className="font-semibold">Thin Wall Warning: </span>
              Roll wall = {wallMm.toFixed(1)} mm (OD {rd.estimated_roll_od_mm} − Bore {rd.bore_dia_mm}).
              Minimum recommended: 15 mm for rigidity. Verify roll design before machining.
            </div>
          </div>
        )}

        {/* Springback info row */}
        {springbackDeg > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="text-violet-400">Springback ({material}):</span>
            <span className="text-amber-300">+{springbackDeg.toFixed(1)}°</span>
            <span className="text-slate-600">→ Tool Angle = Bend Angle + Springback</span>
          </div>
        )}

        {/* Release status row */}
        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
          <span className="text-slate-500">Release:</span>
          <span className={RELEASE_STATE_OPTIONS.find(o=>o.value===releaseState)?.color ?? "text-slate-400"}>
            {RELEASE_STATE_OPTIONS.find(o=>o.value===releaseState)?.label ?? releaseState}
          </span>
          {checkedBy && <span className="text-slate-600">· Chk: {checkedBy}</span>}
          {approvedBy && <span className="text-slate-600">· Appvd: {approvedBy}</span>}
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
          roll_dimension_engine · roll_contour_engine · Sai Rolotech Smart Engines v2.3.0 · Phase 2 Export Engine
        </div>
      </div>
    </div>
  );
}
