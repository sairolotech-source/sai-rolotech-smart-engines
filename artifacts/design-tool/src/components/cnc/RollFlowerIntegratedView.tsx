import React, { useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  ENTRY:       { bg: "#1e3a5f", border: "#3b82f6", text: "#60a5fa", label: "ENTRY" },
  PRE_FORM:    { bg: "#1a2e1a", border: "#22c55e", text: "#4ade80", label: "PRE-FORM" },
  MAIN:        { bg: "#431407", border: "#f97316", text: "#fb923c", label: "FORMING" },
  PRE_CLOSE:   { bg: "#3b1a00", border: "#f59e0b", text: "#fbbf24", label: "PRE-CLOSE" },
  CALIBRATION: { bg: "#052e16", border: "#22c55e", text: "#4ade80", label: "SIZING" },
};

function getPhase(idx: number, total: number): keyof typeof PHASE_COLORS {
  if (idx === 0) return "ENTRY";
  if (idx === total - 1) return "CALIBRATION";
  const pct = idx / (total - 1);
  if (pct <= 0.2) return "PRE_FORM";
  if (pct >= 0.75) return "PRE_CLOSE";
  return "MAIN";
}

// ── Mini cross-section SVG (parametric C-profile) ────────────────────────────
function MiniCrossSection({ angle, w = 80, h = 60 }: { angle: number; w?: number; h?: number }) {
  const cx = w / 2, cy = h / 2;
  const webW = w * 0.5;
  const flange = h * 0.38;
  const rad = (angle * Math.PI) / 180;
  const fx = flange * Math.sin(rad);
  const fy = flange * Math.cos(rad);
  const pts = [
    [cx - webW / 2 - fx, cy - fy],
    [cx - webW / 2,      cy],
    [cx + webW / 2,      cy],
    [cx + webW / 2 + fx, cy - fy],
  ];
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const prog = angle / 90;
  const col = `hsl(${30 + prog * 180},${60 + prog * 30}%,${55 - prog * 15}%)`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block mx-auto">
      <rect width={w} height={h} fill="#0a0f1a" rx={4} />
      <line x1={cx - webW / 2 - 3} y1={cy + 2} x2={cx + webW / 2 + 3} y2={cy + 2} stroke="#22c55e" strokeWidth={1} strokeDasharray="3 2" />
      <path d={d} stroke={col} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x={cx} y={h - 4} textAnchor="middle" fill="#52525b" fontSize={7} fontFamily="monospace">{angle.toFixed(0)}°</text>
    </svg>
  );
}

// ── Pass Schedule Bar Chart ───────────────────────────────────────────────────
function PassScheduleChart({ angles, phases }: { angles: number[]; phases: string[] }) {
  const maxAngle = 90;
  const W = 600, H = 110;
  const padL = 32, padR = 12, padT = 12, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = angles.length;
  const barW = Math.min(32, chartW / n - 3);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <rect width={W} height={H} fill="#09090b" rx={6} />
      {/* Grid lines */}
      {[0, 30, 60, 90].map(angle => {
        const y = padT + chartH - (angle / maxAngle) * chartH;
        return (
          <g key={angle}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1f2937" strokeWidth={0.8} />
            <text x={padL - 4} y={y + 3.5} textAnchor="end" fill="#52525b" fontSize={7} fontFamily="monospace">{angle}°</text>
          </g>
        );
      })}
      {/* Bars */}
      {angles.map((a, i) => {
        const ph = phases[i] ?? "MAIN";
        const col = PHASE_COLORS[ph]?.border ?? "#f97316";
        const barH = (a / maxAngle) * chartH;
        const x = padL + (i / n) * chartW + (chartW / n - barW) / 2;
        const y = padT + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 1)} fill={col} opacity={0.8} rx={2} />
            <text x={x + barW / 2} y={padT + chartH + 10} textAnchor="middle" fill="#52525b" fontSize={7} fontFamily="monospace">S{i + 1}</text>
            <text x={x + barW / 2} y={y - 3} textAnchor="middle" fill={col} fontSize={6.5} fontFamily="monospace">{a.toFixed(0)}°</text>
          </g>
        );
      })}
      {/* Title */}
      <text x={padL} y={9} fill="#71717a" fontSize={7.5} fontFamily="monospace" fontWeight="bold">PASS SCHEDULE — BEND ANGLE PROGRESSION</text>
    </svg>
  );
}

// ── OD Progression Chart ──────────────────────────────────────────────────────
function OdProgressionChart({ upperODs, lowerODs }: { upperODs: number[]; lowerODs: number[] }) {
  const W = 320, H = 130;
  const padL = 38, padR = 12, padT = 18, padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const all = [...upperODs, ...lowerODs];
  const minV = Math.min(...all) - 5;
  const maxV = Math.max(...all) + 5;
  const n = upperODs.length;
  const scaleY = (v: number) => padT + chartH - ((v - minV) / (maxV - minV)) * chartH;
  const scaleX = (i: number) => padL + (i / Math.max(n - 1, 1)) * chartW;

  const toPath = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <rect width={W} height={H} fill="#09090b" rx={6} />
      <text x={padL} y={12} fill="#71717a" fontSize={7.5} fontFamily="monospace" fontWeight="bold">ROLL OD PROGRESSION (mm)</text>
      {[minV, (minV + maxV) / 2, maxV].map(v => {
        const y = scaleY(v);
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1f2937" strokeWidth={0.7} />
            <text x={padL - 4} y={y + 3} textAnchor="end" fill="#52525b" fontSize={6.5} fontFamily="monospace">{v.toFixed(0)}</text>
          </g>
        );
      })}
      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#374151" strokeWidth={1} />
      <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#374151" strokeWidth={1} />
      {/* Upper OD line */}
      <path d={toPath(upperODs)} stroke="#3b82f6" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Lower OD line */}
      <path d={toPath(lowerODs)} stroke="#f97316" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {upperODs.map((v, i) => <circle key={`u${i}`} cx={scaleX(i)} cy={scaleY(v)} r={2.5} fill="#3b82f6" />)}
      {lowerODs.map((v, i) => <circle key={`l${i}`} cx={scaleX(i)} cy={scaleY(v)} r={2.5} fill="#f97316" />)}
      {/* Station labels */}
      {upperODs.map((_, i) => (
        <text key={i} x={scaleX(i)} y={padT + chartH + 10} textAnchor="middle" fill="#52525b" fontSize={6.5} fontFamily="monospace">S{i + 1}</text>
      ))}
      {/* Legend */}
      <rect x={W - padR - 60} y={padT + 2} width={8} height={5} fill="#3b82f6" rx={1} />
      <text x={W - padR - 50} y={padT + 8} fill="#3b82f6" fontSize={7} fontFamily="monospace">Upper</text>
      <rect x={W - padR - 60} y={padT + 12} width={8} height={5} fill="#f97316" rx={1} />
      <text x={W - padR - 50} y={padT + 18} fill="#f97316" fontSize={7} fontFamily="monospace">Lower</text>
    </svg>
  );
}

// ── Station Card ──────────────────────────────────────────────────────────────
function StationCard({
  idx, total, bendAngle, station, rt,
}: {
  idx: number;
  total: number;
  bendAngle: number;
  station: ReturnType<typeof useCncStore>["stations"][0] | undefined;
  rt: ReturnType<typeof useCncStore>["rollTooling"][0] | undefined;
}) {
  const phase = getPhase(idx, total);
  const pc = PHASE_COLORS[phase];
  const sc = rt?.shaftCalc;
  const br = rt?.bearing;

  return (
    <div
      className="flex-shrink-0 rounded-xl overflow-hidden"
      style={{
        width: 164,
        border: `1px solid ${pc.border}40`,
        background: pc.bg + "80",
      }}
    >
      {/* Phase header */}
      <div className="px-2 py-1.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${pc.border}40` }}>
        <span className="text-[9px] font-bold font-mono" style={{ color: pc.text }}>{pc.label}</span>
        <span className="text-[9px] font-mono text-zinc-500">S{String(idx + 1).padStart(2, "0")}</span>
      </div>

      {/* Cross-section viz */}
      <div className="px-2 pt-2">
        <MiniCrossSection angle={bendAngle} w={140} h={56} />
      </div>

      {/* Bend angle badge */}
      <div className="flex items-center justify-center py-1">
        <span
          className="text-xs font-bold font-mono px-2 py-0.5 rounded"
          style={{ background: `${pc.border}25`, color: pc.text, border: `1px solid ${pc.border}50` }}
        >
          {bendAngle.toFixed(1)}°
        </span>
        {station?.passZone && (
          <span className="ml-1.5 text-[8px] text-zinc-600 font-mono">{station.passZone}</span>
        )}
      </div>

      {/* Roll data */}
      <div className="px-2 pb-2 space-y-0.5">
        {[
          ["Upper OD", rt ? `Ø${rt.upperRollOD?.toFixed(1) ?? "—"} mm` : "—", "#93c5fd"],
          ["Lower OD", rt ? `Ø${rt.lowerRollOD?.toFixed(1) ?? "—"} mm` : "—", "#fdba74"],
          ["Shaft",    sc  ? `Ø${sc.selectedDiaMm} mm`                   : "—", "#a3e635"],
          ["Bearing",  br  ? br.designation                               : "—", "#67e8f9"],
          ["Torque",   sc  ? `${sc.torqueNm.toFixed(0)} Nm`               : "—", "#c084fc"],
          ["Deflect",  sc  ? `${sc.deflectionMm.toFixed(4)} mm`           : "—",
            sc && sc.deflectionMm > 0.05 ? "#f87171" : "#4ade80"],
        ].map(([lbl, val, col]) => (
          <div key={lbl} className="flex justify-between items-center border-b border-zinc-800/60 pb-0.5">
            <span className="text-[9px] text-zinc-500">{lbl}</span>
            <span className="text-[9px] font-mono font-semibold" style={{ color: col }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Camber / Crown Compensation Panel ────────────────────────────────────────
const CAMBER_DATA: Record<string, { crownPct: string; springbackOverbend: string; entryGuide: string; note: string }> = {
  GI:   { crownPct: "0.03–0.05%", springbackOverbend: "1–2°",  entryGuide: "Light", note: "Zinc coating — avoid sharp tool edges. Crown < 0.05% of OD." },
  CR:   { crownPct: "0.03–0.05%", springbackOverbend: "1–2°",  entryGuide: "Light", note: "Smooth surface — standard crown formula. Friction guide recommended." },
  HR:   { crownPct: "0.05–0.08%", springbackOverbend: "2–4°",  entryGuide: "Medium", note: "Scale on surface — use positive crown. Lubrication mandatory." },
  MS:   { crownPct: "0.04–0.06%", springbackOverbend: "2–3°",  entryGuide: "Medium", note: "Mild steel — standard process. Light overbend at last 2 stations." },
  SS:   { crownPct: "0.08–0.12%", springbackOverbend: "4–8°",  entryGuide: "Heavy", note: "High springback! Crown compensation critical. Multiple calibration passes." },
  AL:   { crownPct: "0.02–0.04%", springbackOverbend: "2–4°",  entryGuide: "Light", note: "Soft — reduce forming speed. Anodized: avoid sharp edges." },
  CU:   { crownPct: "0.02–0.03%", springbackOverbend: "1–2°",  entryGuide: "Light", note: "Very soft — use slow speed. No iron contamination." },
  TI:   { crownPct: "0.10–0.15%", springbackOverbend: "6–10°", entryGuide: "Heavy", note: "Severe springback. VFD mandatory. High-strength tooling required." },
  HSLA: { crownPct: "0.06–0.10%", springbackOverbend: "3–6°",  entryGuide: "Heavy", note: "High strength — increase stations. Precision calibration essential." },
  PP:   { crownPct: "0.02–0.04%", springbackOverbend: "3–5°",  entryGuide: "Light", note: "Pre-painted — protect surface at all times." },
};

function CamberCrownPanel({ materialType }: { materialType: string }) {
  const d = CAMBER_DATA[materialType] ?? CAMBER_DATA["GI"];
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 font-semibold">
        Camber &amp; Crown Compensation — {materialType}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Roll Crown", d.crownPct, "#f59e0b", "% of roll OD — positive crown on upper roll to prevent camber"],
          ["Springback Overbend", d.springbackOverbend, "#f87171", "Last 1–2 stations over-bent to compensate elastic recovery"],
          ["Entry Guide Force", d.entryGuide, "#60a5fa", "Strip guide load at station 1"],
          ["Lubrication", materialType === "TI" || materialType === "SS" ? "Heavy (EP grease)" : "Standard (mineral oil)", "#4ade80", "Roll-strip interface lubrication"],
        ].map(([label, val, col, desc]) => (
          <div key={label} className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
            <div className="text-[8px] text-zinc-600 uppercase tracking-wider mb-1">{label}</div>
            <div className="text-sm font-bold font-mono" style={{ color: col }}>{val}</div>
            <div className="text-[8px] text-zinc-600 mt-1 leading-tight">{desc}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 px-3 py-2 rounded-lg text-[10px] leading-relaxed"
        style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}>
        💡 {d.note}
      </div>

      {/* Crown formula */}
      <div className="mt-3 bg-zinc-950 rounded-lg px-3 py-2 font-mono text-[9px]">
        <span className="text-zinc-500">Crown formula: </span>
        <span className="text-green-400">C = OD × {d.crownPct.split("–")[0]} / 100</span>
        <span className="text-zinc-600 ml-2">→ Crown height on upper roll face (barrel-shaped)</span>
      </div>
    </div>
  );
}

// ── Machine Summary Panel ─────────────────────────────────────────────────────
function MachineSummaryPanel() {
  const { motorCalc, machineData } = useCncStore();

  if (!motorCalc && !machineData) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-center justify-center text-zinc-600 text-xs">
        Generate roll tooling to see machine specification
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 font-semibold">Machine Specification</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {motorCalc && [
          ["Selected Motor",   `${motorCalc.selectedMotorKw} kW`,         "#f59e0b"],
          ["IEC Frame",        motorCalc.motorFrame,                      "#fbbf24"],
          ["Motor Speed",      `${motorCalc.motorRpm} rpm`,               "#60a5fa"],
          ["Motor Torque",     `${motorCalc.motorTorqueNm.toFixed(0)} Nm`, "#93c5fd"],
          ["Gearbox Ratio",    `${motorCalc.recommendedGearboxRatio}:1`,   "#4ade80"],
          ["Output Shaft RPM", `${motorCalc.outputShaftRpm.toFixed(1)}`,   "#86efac"],
          ["Line Speed",       `${motorCalc.lineSpeedActualMpm.toFixed(2)} m/min`, "#22d3ee"],
          ["Drive Efficiency", `${motorCalc.driveEfficiency}%`,            "#67e8f9"],
          ["VFD Required",     motorCalc.vfdRecommended ? "YES" : "Not required", motorCalc.vfdRecommended ? "#f87171" : "#4ade80"],
          ["Required Power",   `${motorCalc.totalRequiredKw.toFixed(2)} kW`, "#d97706"],
          ["Service Factor",   `${motorCalc.serviceFactor}×`,             "#a78bfa"],
          ["Power/Station",    `${motorCalc.powerDensityKwPerStation.toFixed(3)} kW`, "#c084fc"],
        ].map(([label, val, col]) => (
          <div key={label} className="bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800">
            <div className="text-[8px] text-zinc-600 uppercase tracking-wider">{label}</div>
            <div className="text-xs font-bold font-mono mt-0.5" style={{ color: col }}>{val}</div>
          </div>
        ))}
        {machineData && [
          ["Pass Line Y",    `${machineData.passLine} mm`,             "#a78bfa"],
          ["Total Stations", `${machineData.totalStations}`,            "#f59e0b"],
          ["Total Rolls",    `${machineData.totalRolls}`,               "#fb923c"],
          ["Entry Speed",    machineData.formingSpeeds.entry,           "#60a5fa"],
          ["Main Speed",     machineData.formingSpeeds.main,            "#f97316"],
          ["Final Speed",    machineData.formingSpeeds.final,           "#22c55e"],
        ].map(([label, val, col]) => (
          <div key={label} className="bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800">
            <div className="text-[8px] text-zinc-600 uppercase tracking-wider">{label}</div>
            <div className="text-xs font-bold font-mono mt-0.5" style={{ color: col }}>{val}</div>
          </div>
        ))}
      </div>
      {motorCalc?.warnings && motorCalc.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {motorCalc.warnings.map((w, i) => (
            <div key={i} className="px-3 py-1.5 rounded text-[10px] text-amber-300"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Integrated View ──────────────────────────────────────────────────────
export function RollFlowerIntegratedView() {
  const { stations, rollTooling, materialType } = useCncStore();

  const bendAngles = useMemo(() => {
    if (stations.length > 0) {
      return stations.map(s => s.totalAngle ?? 0);
    }
    if (rollTooling.length > 0) {
      const n = rollTooling.length;
      return rollTooling.map((_, i) => Math.round((i / Math.max(n - 1, 1)) * 90));
    }
    return [];
  }, [stations, rollTooling]);

  const phases = useMemo(() =>
    bendAngles.map((_, i) => getPhase(i, bendAngles.length)),
    [bendAngles]
  );

  const upperODs = rollTooling.map(rt => rt.upperRollOD ?? rt.rollProfile?.rollDiameter ?? 120);
  const lowerODs = rollTooling.map(rt => rt.lowerRollOD ?? rt.rollProfile?.rollDiameter ?? 118);

  const n = Math.max(stations.length, rollTooling.length);

  if (n === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3">
        <div className="text-4xl">🌸</div>
        <div className="text-base font-semibold text-zinc-400">No data yet</div>
        <div className="text-sm text-center text-zinc-600 max-w-xs">
          Generate roll tooling to see the integrated Flower + Roll design view.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {/* ── 1. Header Info Strip ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="px-3 py-1.5 rounded-lg text-xs font-semibold font-mono"
          style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}>
          🌸 Flower Pattern — {n} Stations
        </div>
        <div className="px-3 py-1.5 rounded-lg text-xs font-semibold font-mono"
          style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}>
          ⚙ Roll Tooling — {rollTooling.length * 2} Rolls ({rollTooling.length} Upper + {rollTooling.length} Lower)
        </div>
        <div className="px-3 py-1.5 rounded-lg text-xs font-semibold font-mono"
          style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }}>
          Material: {materialType}
        </div>
        <div className="ml-auto px-3 py-1.5 rounded-lg text-[9px] font-mono text-zinc-600"
          style={{ background: "#09090b", border: "1px solid #27272a" }}>
          SAI Rolotech v2.2.20 · Integrated View
        </div>
      </div>

      {/* ── 2. Pass Schedule Chart ── */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 font-semibold">Pass Schedule</div>
        <PassScheduleChart angles={bendAngles} phases={phases} />
        {/* Phase legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(PHASE_COLORS).map(([key, pc]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: pc.border }} />
              <span className="text-[9px] font-mono" style={{ color: pc.text }}>{pc.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Station Cards (horizontal scroll) ── */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 font-semibold">
          Station-by-Station — Flower Cross-Section + Roll Specification
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2.5" style={{ minWidth: "max-content" }}>
            {Array.from({ length: n }).map((_, idx) => (
              <StationCard
                key={idx}
                idx={idx}
                total={n}
                bendAngle={bendAngles[idx] ?? Math.round((idx / Math.max(n - 1, 1)) * 90)}
                station={stations[idx]}
                rt={rollTooling[idx]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. Charts Row ── */}
      {rollTooling.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OD Progression */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 font-semibold">OD Progression per Station</div>
            <OdProgressionChart upperODs={upperODs} lowerODs={lowerODs} />
            <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] font-mono">
              <div className="flex justify-between px-2 py-1 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-600">Upper OD range</span>
                <span className="text-blue-400">{Math.min(...upperODs).toFixed(1)} – {Math.max(...upperODs).toFixed(1)} mm</span>
              </div>
              <div className="flex justify-between px-2 py-1 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-600">Lower OD range</span>
                <span className="text-orange-400">{Math.min(...lowerODs).toFixed(1)} – {Math.max(...lowerODs).toFixed(1)} mm</span>
              </div>
            </div>
          </div>

          {/* Machine Summary */}
          <MachineSummaryPanel />
        </div>
      )}

      {/* ── 5. Camber & Crown Compensation ── */}
      <CamberCrownPanel materialType={materialType} />

      {/* ── 6. Roll Types Classification Guide ── */}
      {rollTooling.length > 0 && rollTooling.some(rt => rt.rollType) && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700 flex items-center gap-3">
            <span className="text-xs font-bold text-zinc-100">Roll Type Classification</span>
            <span className="text-[9px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">Auto-assigned per station</span>
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {[
              { code: "GUIDE",     name: "Guide Roll",     shape: "flat",      color: "#64748b", desc: "Entry — strip alignment, no bending",          angle: "0°",   fillet: "5mm" },
              { code: "BREAKDOWN", name: "Breakdown Roll",  shape: "shallow-v", color: "#0ea5e9", desc: "First bend initiation, edge forming begins",     angle: "≤30°", fillet: "4mm" },
              { code: "FORMING",   name: "Forming Roll",   shape: "v-groove",  color: "#f59e0b", desc: "Progressive bend angle, side wall development",   angle: "≤60°", fillet: "3mm" },
              { code: "GROOVE",    name: "Groove Roll",    shape: "u/deep",    color: "#8b5cf6", desc: "Deep contoured groove, both walls fully formed",   angle: "≤85°", fillet: "2mm" },
              { code: "FINPASS",   name: "Fin Pass Roll",  shape: "fin",       color: "#ec4899", desc: "Profile closing, near-net shape, weld seam prep",  angle: "≤90°", fillet: "1.5mm" },
              { code: "SIZING",    name: "Sizing Roll",    shape: "u-groove",  color: "#22c55e", desc: "Final calibration, OD/width, surface finish",      angle: "90°",  fillet: "1mm" },
            ].map(rt => (
              <div key={rt.code} className="flex-1 min-w-[140px] rounded-lg border p-2.5" style={{ borderColor: rt.color + "33", background: rt.color + "08" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: rt.color }} />
                  <span className="text-[9px] font-bold font-mono" style={{ color: rt.color }}>{rt.name.toUpperCase()}</span>
                </div>
                <div className="text-[8px] text-zinc-500 leading-tight mb-1.5">{rt.desc}</div>
                <div className="flex gap-2 text-[8px] font-mono">
                  <span className="text-zinc-600">Shape: <span style={{ color: rt.color }}>{rt.shape}</span></span>
                  <span className="text-zinc-600">∠: <span className="text-amber-400">{rt.angle}</span></span>
                </div>
              </div>
            ))}
          </div>
          {/* Roll Type + Material summary per station */}
          <div className="border-t border-zinc-800 overflow-x-auto">
            <table className="w-full text-[9px] font-mono">
              <thead>
                <tr className="bg-zinc-800/40">
                  {["Stn", "Roll Type", "Groove Shape", "Groove ∠", "Depth%", "Tool Steel", "Hardness", "Surface Treatment", "Est. Life"].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rollTooling.map((rt, i) => {
                  const typ = rt.rollType;
                  const mat = rt.rollMaterial;
                  if (!typ || !mat) return null;
                  return (
                    <tr key={i} className={`border-t border-zinc-800/40 ${i % 2 === 0 ? "" : "bg-zinc-800/10"}`}>
                      <td className="px-2 py-1 font-bold text-zinc-300">S{i + 1}</td>
                      <td className="px-2 py-1 font-bold" style={{ color: typ.color }}>{typ.name}</td>
                      <td className="px-2 py-1 text-zinc-400">{typ.grooveShape.replace("-", " ")}</td>
                      <td className="px-2 py-1 text-amber-400">{typ.grooveAngleDeg}°</td>
                      <td className="px-2 py-1 text-purple-400">{(typ.grooveDepthFraction * 100).toFixed(0)}%</td>
                      <td className="px-2 py-1 text-amber-300">{mat.toolSteel}</td>
                      <td className="px-2 py-1 text-zinc-300">{mat.hardnessHRC}</td>
                      <td className="px-2 py-1 text-green-400">{mat.surfaceTreatment.split(" ").slice(0, 2).join(" ")}</td>
                      <td className="px-2 py-1 text-cyan-300">{mat.lifeHrs.toLocaleString()} h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 7. Springback Overbend Table ── */}
      {rollTooling.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700 flex items-center gap-3">
            <span className="text-xs font-bold text-zinc-100">Springback &amp; Overbend per Station</span>
            <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Auto-calculated</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/30">
                  {["Stn", "Roll Type", "Phase", "Nominal°", "Springback°", "Overbend°", "Final Tool°", "Upper OD", "Lower OD", "Shaft Ø", "Bearing"].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-zinc-500 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: n }).map((_, i) => {
                  const angle = bendAngles[i] ?? 0;
                  const phase = phases[i];
                  const pc = PHASE_COLORS[phase];
                  const rt = rollTooling[i];
                  const sc = rt?.shaftCalc;
                  const br = rt?.bearing;
                  const typ = rt?.rollType;
                  const stProp = stations[i];
                  const sbAngle = stProp?.springbackAngles?.[0] ?? (angle * 0.03);
                  const overbend = phase === "CALIBRATION" || phase === "PRE_CLOSE" ? (sbAngle).toFixed(1) : "—";
                  const finalTool = overbend !== "—" ? (angle + parseFloat(overbend)).toFixed(1) + "°" : `${angle.toFixed(1)}°`;
                  return (
                    <tr key={i} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "bg-zinc-900/20" : ""}`}>
                      <td className="px-2 py-1.5 font-bold text-zinc-300">S{i + 1}</td>
                      <td className="px-2 py-1.5 font-bold text-[9px] whitespace-nowrap" style={{ color: typ?.color ?? "#71717a" }}>
                        {typ ? typ.name : "—"}
                      </td>
                      <td className="px-2 py-1.5 font-bold" style={{ color: pc.text }}>{pc.label}</td>
                      <td className="px-2 py-1.5 text-zinc-300">{angle.toFixed(1)}°</td>
                      <td className="px-2 py-1.5 text-amber-400">{sbAngle.toFixed(2)}°</td>
                      <td className="px-2 py-1.5 font-bold" style={{ color: overbend !== "—" ? "#f87171" : "#52525b" }}>{overbend !== "—" ? `+${overbend}°` : "—"}</td>
                      <td className="px-2 py-1.5 font-bold text-green-400">{finalTool}</td>
                      <td className="px-2 py-1.5 text-blue-300">Ø{rt ? (rt.upperRollOD ?? rt.rollProfile?.rollDiameter ?? 0).toFixed(1) : "—"} mm</td>
                      <td className="px-2 py-1.5 text-orange-300">Ø{rt ? (rt.lowerRollOD ?? rt.rollProfile?.rollDiameter ?? 0).toFixed(1) : "—"} mm</td>
                      <td className="px-2 py-1.5 text-green-300">{sc ? `Ø${sc.selectedDiaMm} mm` : "—"}</td>
                      <td className="px-2 py-1.5 text-cyan-300">{br ? br.designation : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
