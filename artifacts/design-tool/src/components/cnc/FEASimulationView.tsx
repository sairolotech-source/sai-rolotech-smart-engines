import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Activity, BarChart2, TrendingUp, Zap, CheckCircle, AlertTriangle, XCircle, RefreshCw, Play, Settings, Info } from "lucide-react";

// ─── Material Database ────────────────────────────────────────────────────────

interface MatFEA {
  name: string; yieldMPa: number; utsMPa: number; E_GPa: number;
  n: number; K_MPa: number; elongPct: number; density: number; poisson: number;
}

const MATS: Record<string, MatFEA> = {
  GI:   { name: "Galvanized Iron",    yieldMPa: 240, utsMPa: 350, E_GPa: 200, n: 0.18, K_MPa: 530, elongPct: 28, density: 7850, poisson: 0.3 },
  CR:   { name: "Cold Rolled Steel",  yieldMPa: 280, utsMPa: 400, E_GPa: 200, n: 0.22, K_MPa: 580, elongPct: 32, density: 7850, poisson: 0.3 },
  HR:   { name: "Hot Rolled Steel",   yieldMPa: 250, utsMPa: 420, E_GPa: 200, n: 0.24, K_MPa: 590, elongPct: 30, density: 7850, poisson: 0.3 },
  SS:   { name: "Stainless 304",      yieldMPa: 310, utsMPa: 620, E_GPa: 193, n: 0.35, K_MPa: 900, elongPct: 40, density: 8000, poisson: 0.29 },
  AL:   { name: "Aluminium 6061",     yieldMPa: 110, utsMPa: 200, E_GPa: 70,  n: 0.20, K_MPa: 280, elongPct: 15, density: 2700, poisson: 0.33 },
  MS:   { name: "Mild Steel",         yieldMPa: 250, utsMPa: 410, E_GPa: 200, n: 0.17, K_MPa: 530, elongPct: 26, density: 7850, poisson: 0.3 },
  HSLA: { name: "HSLA 550",           yieldMPa: 420, utsMPa: 550, E_GPa: 200, n: 0.14, K_MPa: 780, elongPct: 18, density: 7850, poisson: 0.3 },
  DP:   { name: "Dual Phase DP780",   yieldMPa: 380, utsMPa: 780, E_GPa: 200, n: 0.16, K_MPa: 820, elongPct: 20, density: 7850, poisson: 0.3 },
  Ti:   { name: "Titanium Ti-6Al-4V", yieldMPa: 880, utsMPa: 950, E_GPa: 114, n: 0.10, K_MPa: 1200, elongPct: 14, density: 4430, poisson: 0.34 },
};

// ─── FLD Keeler-Goodwin ────────────────────────────────────────────────────────

function getFLC(mat: MatFEA, t: number) {
  const FLC0 = (23.3 + 14.13 * t) * mat.n / 0.21;
  const pts: { minor: number; major: number }[] = [];
  for (let m = -0.45; m <= 0.45; m += 0.015) {
    let major = m <= 0
      ? FLC0 - m * 0.55 + m * m * 0.8
      : FLC0 - m * 1.25 - m * m * 0.5;
    pts.push({ minor: m, major: Math.max(0, major) });
  }
  return { pts, FLC0 };
}

function getOpPoint(t: number, r: number, angle: number) {
  const major = (t / (2 * r + t)) * (angle / 90) * 100 * 0.5;
  const minor = -major * 0.28;
  return { major, minor };
}

function FLDCanvas({ matKey, t, r, angle }: { matKey: string; t: number; r: number; angle: number }) {
  const mat = MATS[matKey] ?? MATS.CR;
  const { pts, FLC0 } = getFLC(mat, t);
  const op = getOpPoint(t, r, angle);

  const W = 560, H = 380;
  const pad = { top: 36, right: 22, bottom: 48, left: 56 };
  const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
  const xS = (v: number) => pad.left + ((v + 0.5) / 1.0) * cw;
  const yS = (v: number) => pad.top + (1 - Math.min(v, 120) / 120) * ch;

  const flcPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xS(p.minor)},${yS(p.major)}`).join(" ");
  const failZone = `${flcPath} L${xS(0.45)},${pad.top} L${xS(-0.45)},${pad.top} Z`;
  const safeZone = `${flcPath} L${xS(0.45)},${yS(0)} L${xS(-0.45)},${yS(0)} Z`;
  const warnPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xS(p.minor)},${yS(p.major * 0.88)}`).join(" ");

  const opX = xS(op.minor / 100), opY = yS(op.major);
  const flcAtOp = pts.find(p => Math.abs(p.minor * 100 - op.minor) < 2);
  const isSafe = !flcAtOp || op.major < flcAtOp.major;
  const uid = `fea-fld-${matKey}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 12, display: "block", background: "#07090f" }}>
      <defs>
        <linearGradient id={`${uid}-fail`} x1="0" y1={pad.top} x2="0" y2={pad.top + ch * 0.4} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(239,68,68,0.18)" />
          <stop offset="100%" stopColor="rgba(239,68,68,0.02)" />
        </linearGradient>
        <linearGradient id={`${uid}-safe`} x1="0" y1={pad.top + ch * 0.5} x2="0" y2={pad.top + ch} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(52,211,153,0.07)" />
          <stop offset="100%" stopColor="rgba(52,211,153,0.03)" />
        </linearGradient>
        <linearGradient id={`${uid}-flc`} x1={pad.left} y1="0" x2={pad.left + cw} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f87171" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx={opX} cy={opY} r="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isSafe ? "rgba(52,211,153,0.35)" : "rgba(239,68,68,0.35)"} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      <path d={failZone} fill={`url(#${uid}-fail)`} />
      <path d={safeZone} fill={`url(#${uid}-safe)`} />

      {[-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4].map(v => (
        <line key={`gv${v}`} x1={xS(v)} y1={pad.top} x2={xS(v)} y2={pad.top + ch} stroke="rgba(255,255,255,0.04)" />
      ))}
      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110].map(v => (
        <line key={`gh${v}`} x1={pad.left} y1={yS(v)} x2={pad.left + cw} y2={yS(v)} stroke="rgba(255,255,255,0.04)" />
      ))}

      <path d={warnPath} fill="none" stroke="rgba(245,158,11,0.3)" strokeWidth={1} strokeDasharray="6,4" />
      <path d={flcPath} fill="none" stroke={`url(#${uid}-flc)`} strokeWidth={3} />
      <line x1={xS(0)} y1={pad.top} x2={xS(0)} y2={pad.top + ch} stroke="rgba(255,255,255,0.12)" strokeDasharray="4,4" />

      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + ch} stroke="rgba(255,255,255,0.1)" />
      <line x1={pad.left} y1={pad.top + ch} x2={pad.left + cw} y2={pad.top + ch} stroke="rgba(255,255,255,0.1)" />

      {[-0.4, -0.2, 0, 0.2, 0.4].map(v => (
        <text key={`xl${v}`} x={xS(v) - 8} y={pad.top + ch + 16} fill="#52525b" fontSize="10" fontFamily="sans-serif">{v}</text>
      ))}
      {[0, 20, 40, 60, 80, 100].map(v => (
        <text key={`yl${v}`} x={pad.left - 32} y={yS(v) + 4} fill="#52525b" fontSize="10" fontFamily="sans-serif">{v}%</text>
      ))}

      <text x={pad.left + cw / 2 - 45} y={H - 6} fill="#71717a" fontSize="11" fontFamily="sans-serif">Minor Strain ε₂ (%)</text>
      <text x={13} y={pad.top + ch / 2} fill="#71717a" fontSize="11" fontFamily="sans-serif" transform={`rotate(-90,13,${pad.top + ch / 2})`} textAnchor="middle">Major Strain ε₁ (%)</text>

      <text x={xS(-0.35)} y={pad.top + 18} fill="rgba(239,68,68,0.6)" fontSize="11" fontWeight="bold" fontFamily="sans-serif">FRACTURE ZONE</text>
      <text x={xS(0.22)} y={yS(FLC0 * 0.9)} fill="rgba(245,158,11,0.6)" fontSize="10" fontFamily="sans-serif">WARNING</text>
      <text x={xS(0.25)} y={yS(5)} fill="rgba(52,211,153,0.6)" fontSize="11" fontFamily="sans-serif">SAFE</text>
      <text x={xS(-0.38)} y={yS(FLC0 * 0.5)} fill="rgba(96,165,250,0.7)" fontSize="9" fontFamily="sans-serif">← Drawing</text>
      <text x={xS(0.18)} y={yS(FLC0 * 0.5)} fill="rgba(96,165,250,0.7)" fontSize="9" fontFamily="sans-serif">Stretching →</text>

      <line x1={xS(0)} y1={yS(0)} x2={opX} y2={opY} stroke={isSafe ? "rgba(52,211,153,0.6)" : "rgba(239,68,68,0.6)"} strokeWidth={1.5} strokeDasharray="5,3" />
      <circle cx={opX} cy={opY} r={18} fill={`url(#${uid}-glow)`} />
      <circle cx={opX} cy={opY} r={7} fill={isSafe ? "#34d399" : "#f87171"} stroke="#fff" strokeWidth={2} />
      <text x={opX + 12} y={opY - 4} fill="#fff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">OP ({op.minor.toFixed(1)}%, {op.major.toFixed(1)}%)</text>
      <text x={pad.left + 4} y={pad.top + 16} fill="#fbbf24" fontSize="10" fontWeight="bold" fontFamily="sans-serif">FLC₀ = {FLC0.toFixed(1)}% | {mat.name}</text>
    </svg>
  );
}

// ─── Animated Stress Bar ───────────────────────────────────────────────────────

function StressBar({ mat, t, r }: { mat: MatFEA; t: number; r: number }) {
  const LAYERS = 12;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>Cross-Section Stress (FEA Nodes)</span>
        <div style={{ display: "flex", gap: 10, fontSize: 9, color: "#71717a" }}>
          <span style={{ color: "#60a5fa" }}>■ Compression (inner)</span>
          <span style={{ color: "#f59e0b" }}>■ Tension (outer)</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {Array.from({ length: LAYERS }, (_, i) => {
          const y = (i / (LAYERS - 1) - 0.5) * t;
          const eps = y / (r + y);
          const isOuter = y > 0;
          const E = mat.E_GPa * 1000;
          const sigElastic = eps * E;
          const sigma = Math.sign(sigElastic) * Math.min(mat.utsMPa, Math.abs(sigElastic) > mat.yieldMPa
            ? mat.yieldMPa + mat.K_MPa * Math.pow(Math.abs(eps) - mat.yieldMPa / E, mat.n)
            : Math.abs(sigElastic));
          const pct = Math.abs(sigma) / mat.utsMPa;
          const danger = pct > 0.9;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: "#3f3f46", width: 36, textAlign: "right" }}>{y.toFixed(2)}</span>
              <div style={{ flex: 1, display: "flex", alignItems: "center", height: 14 }}>
                {!isOuter && (
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ height: 10, width: `${Math.min(pct * 100, 100)}%`, borderRadius: "4px 0 0 4px", background: danger ? "rgba(239,68,68,0.8)" : "linear-gradient(90deg,rgba(96,165,250,0.8),rgba(96,165,250,0.3))" }} />
                  </div>
                )}
                <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
                {isOuter && (
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 10, width: `${Math.min(pct * 100, 100)}%`, borderRadius: "0 4px 4px 0", background: danger ? "rgba(239,68,68,0.8)" : "linear-gradient(90deg,rgba(245,158,11,0.3),rgba(245,158,11,0.8))" }} />
                  </div>
                )}
              </div>
              <span style={{ fontSize: 9, color: danger ? "#f87171" : "#52525b", width: 58, textAlign: "right" }}>{sigma.toFixed(0)} MPa</span>
              {danger && <span style={{ fontSize: 8, color: "#f87171" }}>⚠</span>}
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 6, fontSize: 9, color: "#3f3f46" }}>
          <span>Neutral axis at r={r.toFixed(1)}mm</span>
          <span>·</span>
          <span>σy={mat.yieldMPa}MPa · UTS={mat.utsMPa}MPa</span>
        </div>
      </div>
    </div>
  );
}

// ─── Springback Panel (Pro) ───────────────────────────────────────────────────

function SpringbackPanel({ mat, r, t, angle }: { mat: MatFEA; r: number; t: number; angle: number }) {
  const E = mat.E_GPa * 1000;
  const ratio = (mat.yieldMPa * r) / (E * t);
  const sb_schaffer = angle * Math.max(0, 3 * ratio - 4 * Math.pow(ratio, 3));
  const sb_simplified = (3 * mat.yieldMPa * r) / (E * t) * (180 / Math.PI);
  const toolAngle = angle + sb_schaffer;
  const outerStrain = (t / (2 * r + t)) * 100;
  const safetyPct = ((mat.elongPct - outerStrain) / mat.elongPct * 100);
  const rtRatio = r / t;
  const minRt = mat.yieldMPa > 500 ? 3.0 : mat.yieldMPa > 350 ? 2.0 : mat.yieldMPa > 250 ? 1.5 : 0.8;
  const status = safetyPct < 0 ? "fail" : safetyPct < 25 ? "warn" : "safe";

  const statusStyle = {
    safe: { color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
    warn: { color: "#fbbf24", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
    fail: { color: "#f87171", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" },
  }[status];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { label: "Springback Angle", value: `${sb_schaffer.toFixed(2)}°`, sub: "Shaffer-Johnson formula", color: "#f59e0b" },
          { label: "Tool Must Be Set To", value: `${toolAngle.toFixed(2)}°`, sub: `To achieve final angle: ${angle}°`, color: "#60a5fa" },
          { label: "Outer Fiber Strain", value: `${outerStrain.toFixed(1)}%`, sub: `Limit: ${(mat.elongPct * 0.6).toFixed(0)}%`, color: "#a78bfa" },
          { label: "Safety Margin", value: `${Math.max(0, safetyPct).toFixed(0)}%`, sub: "To fracture limit", color: statusStyle.color },
        ].map((item, i) => (
          <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 10, color: "#52525b", marginBottom: 3, fontWeight: 700, textTransform: "uppercase" }}>{item.label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "#52525b", marginTop: 4 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ padding: 14, borderRadius: 12, background: "#0a0b18", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "monospace", fontSize: 11.5, color: "#a1a1aa", lineHeight: 1.85 }}>
          <div style={{ color: "#52525b", marginBottom: 6 }}>{/* Shaffer-Johnson Model */}θ_SB formula:</div>
          <div>θ_SB = θ × [3×(σy×r)/(E×t) - 4×((σy×r)/(E×t))³]</div>
          <div style={{ marginTop: 6, color: "#52525b" }}>─────────────────</div>
          <div>σy = <span style={{ color: "#fbbf24" }}>{mat.yieldMPa}</span> MPa</div>
          <div>E  = <span style={{ color: "#60a5fa" }}>{mat.E_GPa}</span> GPa</div>
          <div>r  = <span style={{ color: "#a78bfa" }}>{r}</span> mm, t = <span style={{ color: "#a78bfa" }}>{t}</span> mm</div>
          <div>θ  = <span style={{ color: "#34d399" }}>{angle}°</span></div>
          <div>ratio = <span style={{ color: "#e4e4e7" }}>{ratio.toFixed(4)}</span></div>
          <div style={{ marginTop: 6 }}>θ_SB = <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 14 }}>{sb_schaffer.toFixed(2)}°</span></div>
          <div style={{ marginTop: 4, color: "#3f3f46", fontSize: 10 }}>Simplified = {sb_simplified.toFixed(2)}°</div>
        </div>

        <div style={{ padding: 14, borderRadius: 12, background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: statusStyle.color, marginBottom: 8 }}>
            {status === "safe" ? "✅ Process Safe" : status === "warn" ? "⚠️ Caution — Near Limit" : "🔴 Risk — Adjust Parameters"}
          </div>
          {[
            `r/t = ${rtRatio.toFixed(2)} (min required: ${minRt})`,
            rtRatio < minRt ? `⚠️ r/t below minimum — risk of cracking` : `✓ r/t adequate for ${mat.name}`,
            `Overbend last 2 stations by ${sb_schaffer.toFixed(1)}°`,
            `Cold environment (<15°C): add 0.5° extra`,
            mat.yieldMPa > 400 ? "High-strength mat: verify with first-off measurement" : "Standard springback compensation sufficient",
          ].map((tip, i) => (
            <div key={i} style={{ fontSize: 10, color: "#a1a1aa", marginBottom: 3 }}>
              <span style={{ color: statusStyle.color }}>› </span>{tip}
            </div>
          ))}
        </div>

        <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "r/t Ratio", value: rtRatio.toFixed(2), ok: rtRatio >= minRt },
            { label: "Min r/t", value: minRt.toString(), ok: true },
            { label: "Poisson ν", value: mat.poisson.toString(), ok: true },
            { label: "Density", value: `${mat.density} kg/m³`, ok: true },
          ].map((s, i) => (
            <div key={i} style={{ fontSize: 10 }}>
              <span style={{ color: "#52525b" }}>{s.label}: </span>
              <span style={{ color: s.ok ? "#e4e4e7" : "#f87171", fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Station Strain Table ──────────────────────────────────────────────────────

function StationTable({ stations, t, r, mat }: { stations: number; t: number; r: number; mat: MatFEA }) {
  const anglePer = 90 / stations;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 12 }}>Station-by-Station FEA Strain Analysis</div>
      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "50px 70px 70px 80px 1fr 90px", padding: "8px 14px", background: "rgba(255,255,255,0.04)", fontSize: 9, fontWeight: 800, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.05em", gap: 8 }}>
          <div>Stn</div><div>Δ Angle</div><div>Cum. °</div><div>ε₁ (%)</div><div>Strain gauge</div><div>Status</div>
        </div>
        {Array.from({ length: Math.min(stations, 14) }, (_, i) => {
          const cumAngle = (i + 1) * anglePer;
          const strain = (t / (2 * r + t)) * (cumAngle / 90) * 50;
          const limit = mat.elongPct * 0.6;
          const pct = strain / limit;
          const status = pct < 0.6 ? "ok" : pct < 0.85 ? "warn" : "crit";
          const stress = Math.min(mat.utsMPa, mat.yieldMPa + (strain / 100) * mat.K_MPa);
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "50px 70px 70px 80px 1fr 90px", gap: 8, padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent", alignItems: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#a1a1aa" }}>S{i + 1}</div>
              <div style={{ fontSize: 11, color: "#71717a" }}>{anglePer.toFixed(1)}°</div>
              <div style={{ fontSize: 11, color: "#c4c4cc" }}>{cumAngle.toFixed(0)}°</div>
              <div style={{ fontSize: 11, color: status === "ok" ? "#34d399" : status === "warn" ? "#fbbf24" : "#f87171", fontWeight: 700 }}>{strain.toFixed(2)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 7, borderRadius: 99, background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, pct * 100)}%`, borderRadius: 99, background: status === "ok" ? "linear-gradient(90deg,#34d399,#6ee7b7)" : status === "warn" ? "#fbbf24" : "#f87171", transition: "width 0.4s" }} />
                </div>
                <span style={{ fontSize: 9, color: "#52525b", width: 32 }}>{(pct * 100).toFixed(0)}%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: status === "ok" ? "#34d399" : status === "warn" ? "#fbbf24" : "#f87171", background: status === "ok" ? "rgba(52,211,153,0.1)" : status === "warn" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)", padding: "2px 7px", borderRadius: 99 }}>
                  {status === "ok" ? "✓ OK" : status === "warn" ? "⚠ WATCH" : "✕ RISK"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tube Mill FEA Pro ────────────────────────────────────────────────────────

function TubeMillPanel({ od, t, mat }: { od: number; t: number; mat: MatFEA }) {
  const stripW = Math.PI * (od - t / 2);
  const id = od - 2 * t;
  const A = Math.PI * (od * od - id * id) / 4;
  const finForce = (mat.yieldMPa * t * Math.PI * od) / 1000;
  const sqzPressure = finForce / (Math.PI * od * t * 0.1);
  const burstPressure = (2 * mat.yieldMPa * t) / (od - t);
  const weldHeat = (mat.yieldMPa * t * 0.5).toFixed(0);
  const springback = (od * 0.005 * (mat.yieldMPa / (mat.E_GPa * 1000))).toFixed(2);
  const ovality = (od * 0.002).toFixed(2);
  const weightPerM = (A * mat.density / 1e6).toFixed(3);

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 14 }}>
        Tube Mill FEA — Ø{od}mm × {t}mm ({mat.name})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { l: "Strip Width", v: stripW.toFixed(1), u: "mm", c: "#60a5fa", d: "π × (D − t/2)" },
          { l: "Fin Pass Force", v: finForce.toFixed(1), u: "kN", c: "#f59e0b", d: "σy × t × π × D / 1000" },
          { l: "Squeeze Pressure", v: sqzPressure.toFixed(1), u: "MPa", c: "#a78bfa", d: "At weld squeeze" },
          { l: "Burst Pressure", v: burstPressure.toFixed(0), u: "MPa", c: "#34d399", d: "2σy × t / (D−t)" },
          { l: "HF Weld Heat", v: weldHeat, u: "J/mm", c: "#fbbf24", d: "Estimated input" },
          { l: "OD Springback", v: springback, u: "mm", c: "#fb923c", d: "Post-sizing offset" },
          { l: "Ovality (est.)", v: ovality, u: "mm", c: "#f87171", d: "After HF weld" },
          { l: "Weight", v: weightPerM, u: "kg/m", c: "#71717a", d: `ρ=${mat.density} kg/m³` },
        ].map((item, i) => (
          <div key={i} style={{ padding: "12px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${item.c}20` }}>
            <div style={{ fontSize: 9, color: "#52525b", fontWeight: 700, marginBottom: 3, textTransform: "uppercase" }}>{item.l}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: item.c }}>{item.v}<span style={{ fontSize: 10, color: "#71717a", marginLeft: 2 }}>{item.u}</span></div>
            <div style={{ fontSize: 9, color: "#3f3f46", marginTop: 2 }}>{item.d}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 14, borderRadius: 12, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", marginBottom: 8 }}>FEA Recommendations — Tube Mill Setup</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            `Strip width tolerance: ±${(t * 0.15).toFixed(2)} mm (for weld gap ≤ 1.5×t)`,
            `Fin pass entry gap: ${(t * 0.8).toFixed(1)} – ${(t * 1.2).toFixed(1)} mm (0.8–1.2×t)`,
            `Sizing reduction/pass: max ${(od * 0.01).toFixed(1)} mm (1% OD)`,
            `HF weld frequency: ${od < 50 ? "400–450" : od < 100 ? "300–400" : "200–300"} kHz`,
            mat.yieldMPa > 350 ? "High-yield: use 3 fin pass stations minimum" : "Standard: 2 fin pass stations OK",
            `Weld flash height: ≤ ${(t * 0.3).toFixed(1)} mm before scarfing`,
            `Min wall ratio (D/t): ${(od / t).toFixed(1)} (ideal: 10–40)`,
            `Post-sizing annealing: ${mat.yieldMPa > 450 ? "Required for stress relief" : "Not required"}`,
          ].map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: 5, fontSize: 10, color: "#a1a1aa" }}>
              <span style={{ color: "#f59e0b", flexShrink: 0 }}>›</span>{tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function FEASimulationView() {
  const [matKey, setMatKey] = useState("CR");
  const [t, setT] = useState(2);
  const [r, setR] = useState(4);
  const [angle, setAngle] = useState(90);
  const [stations, setStations] = useState(8);
  const [od, setOd] = useState(50);
  const [tab, setTab] = useState<"fld" | "springback" | "stress" | "station" | "tube">("fld");

  const mat = MATS[matKey] ?? MATS.CR;
  const { FLC0 } = getFLC(mat, t);
  const op = getOpPoint(t, r, angle);
  const flcAtOp = getFLC(mat, t).pts.find(p => Math.abs(p.minor * 100 - op.minor) < 3);
  const isSafe = !flcAtOp || op.major < flcAtOp.major;
  const isWarn = flcAtOp && op.major > flcAtOp.major * 0.85 && op.major < flcAtOp.major;
  const outerStrain = (t / (2 * r + t)) * 100;
  const safetyPct = (mat.elongPct - outerStrain) / mat.elongPct * 100;

  const statusBadge = isSafe && !isWarn
    ? { label: "✅ Process Safe", color: "#34d399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.25)" }
    : isWarn
    ? { label: "⚠️ Near FLC — Review", color: "#fbbf24", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" }
    : { label: "🔴 FRACTURE RISK", color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" };

  return (
    <div style={{ height: "100%", overflow: "auto", background: "#070710", padding: 18 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(124,58,237,0.3)" }}>
            <Activity style={{ width: 21, height: 21, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1 }}>FEA Simulation Engine</div>
            <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>Keeler-Goodwin FLD · Springback FEA · Stress Nodes · Tube Mill · Station Analysis</div>
          </div>
          <div style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 9, background: statusBadge.bg, border: `1px solid ${statusBadge.border}`, fontSize: 12, fontWeight: 800, color: statusBadge.color }}>
            {statusBadge.label}
          </div>
        </div>

        {/* Inputs */}
        <div style={{ borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Material</div>
              <select value={matKey} onChange={e => setMatKey(e.target.value)}
                style={{ width: "100%", padding: "7px 8px", borderRadius: 8, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.09)", color: "#e4e4e7", fontSize: 11, outline: "none" }}>
                {Object.entries(MATS).map(([k, v]) => <option key={k} value={k}>{k} — {v.name}</option>)}
              </select>
            </div>
            {[
              { label: "Thickness (mm)", val: t, set: setT, min: 0.3, max: 10, step: 0.1 },
              { label: "Inner Radius (mm)", val: r, set: setR, min: 0.3, max: 40, step: 0.5 },
              { label: "Bend Angle (°)", val: angle, set: setAngle, min: 5, max: 180, step: 5 },
              { label: "Stations", val: stations, set: setStations, min: 2, max: 20, step: 1 },
              { label: "Tube OD (mm)", val: od, set: setOd, min: 10, max: 400, step: 5 },
            ].map((inp, i) => (
              <div key={i}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{inp.label}</div>
                <input type="number" value={inp.val} min={inp.min} max={inp.max} step={inp.step}
                  onChange={e => inp.set(parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: "7px 8px", borderRadius: 8, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.09)", color: "#e4e4e7", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>

          {/* KPI strip */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {[
              { l: "r/t", v: (r/t).toFixed(2), ok: r/t >= 0.8, info: `min ${mat.yieldMPa > 400 ? 2 : 0.8}` },
              { l: "Outer strain ε₁", v: `${outerStrain.toFixed(1)}%`, ok: outerStrain < mat.elongPct * 0.6, info: `limit ${(mat.elongPct*0.6).toFixed(0)}%` },
              { l: "FLC₀", v: `${FLC0.toFixed(1)}%`, ok: true, info: "at plane strain" },
              { l: "Operating ε₁", v: `${op.major.toFixed(1)}%`, ok: isSafe, info: "current point" },
              { l: "Safety margin", v: `${Math.max(0, safetyPct).toFixed(0)}%`, ok: safetyPct > 25, info: "to fracture" },
              { l: "σy / E", v: (mat.yieldMPa / (mat.E_GPa * 1000) * 1000).toFixed(2), ok: true, info: "×10⁻³" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "7px 12px", borderRadius: 8, background: s.ok ? "rgba(52,211,153,0.05)" : "rgba(239,68,68,0.06)", border: `1px solid ${s.ok ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.2)"}` }}>
                <div style={{ fontSize: 9, color: "#52525b", fontWeight: 700, textTransform: "uppercase" }}>{s.l}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.ok ? "#34d399" : "#f87171" }}>{s.v}</div>
                <div style={{ fontSize: 9, color: "#52525b" }}>{s.info}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 3, marginBottom: 14, padding: 4, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", width: "fit-content" }}>
          {[
            { id: "fld", label: "Forming Limit Diagram" },
            { id: "springback", label: "Springback FEA" },
            { id: "stress", label: "Stress Distribution" },
            { id: "station", label: "Station Analysis" },
            { id: "tube", label: "Tube Mill FEA" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              style={{ padding: "7px 14px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: tab === t.id ? "rgba(124,58,237,0.22)" : "transparent", color: tab === t.id ? "#a78bfa" : "#52525b", transition: "all 0.12s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ borderRadius: 14, padding: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {tab === "fld" && <>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 14 }}>Forming Limit Diagram — {mat.name} t={t}mm</div>
            <FLDCanvas matKey={matKey} t={t} r={r} angle={angle} />
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.15)", fontSize: 11, color: "#a1a1aa", lineHeight: 1.6 }}>
              <strong style={{ color: "#a78bfa" }}>Keeler-Goodwin FLD: </strong>
              Amber-blue gradient = Forming Limit Curve (FLC). Dashed amber = warning band (12% below FLC).
              Colored dot = current operation. <strong>Dot below FLC → SAFE.</strong>
              FLC₀ = <strong style={{ color: "#fbbf24" }}>{FLC0.toFixed(1)}%</strong> for {mat.name} t={t}mm (n={mat.n}).
            </div>
          </>}
          {tab === "springback" && <SpringbackPanel mat={mat} r={r} t={t} angle={angle} />}
          {tab === "stress" && <StressBar mat={mat} t={t} r={r} />}
          {tab === "station" && <StationTable stations={stations} t={t} r={r} mat={mat} />}
          {tab === "tube" && <TubeMillPanel od={od} t={t} mat={mat} />}
        </div>
      </div>
    </div>
  );
}
