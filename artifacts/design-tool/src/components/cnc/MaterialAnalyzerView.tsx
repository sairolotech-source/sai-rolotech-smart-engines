import React, { useState, useRef, useEffect, useMemo } from "react";
import { Download, BarChart2, TrendingUp, Sliders } from "lucide-react";

// ─── Material Database ─────────────────────────────────────────────────────────

interface Material {
  name: string; grade: string; color: string;
  E: number;      // Young's modulus GPa
  YS: number;     // Yield strength MPa
  UTS: number;    // Ultimate tensile strength MPa
  elongation: number; // % at fracture
  n: number;      // strain hardening exponent
  K: number;      // strength coefficient MPa
  density: number; // g/cm³
  poisson: number;
  r_value: number; // normal anisotropy
  category: string;
}

const MATERIALS: Material[] = [
  { name: "GI (DX51D)",    grade: "EN 10346",  color: "#34d399", E: 210, YS: 140, UTS: 270, elongation: 22, n: 0.22, K: 540, density: 7.85, poisson: 0.3, r_value: 1.6,  category: "Mild Steel" },
  { name: "CR Steel (DC01)",grade: "EN 10130", color: "#60a5fa", E: 210, YS: 160, UTS: 280, elongation: 28, n: 0.24, K: 580, density: 7.85, poisson: 0.3, r_value: 1.8,  category: "Mild Steel" },
  { name: "HSLA 550",      grade: "IS 2062 E550",color:"#fbbf24", E: 210, YS: 550, UTS: 620, elongation: 14, n: 0.10, K: 980, density: 7.85, poisson: 0.3, r_value: 1.0,  category: "HSLA" },
  { name: "DP600",         grade: "ASTM A1008",  color: "#f87171", E: 210, YS: 340, UTS: 600, elongation: 20, n: 0.18, K: 1050,density: 7.87, poisson: 0.3, r_value: 0.9,  category: "Advanced HS" },
  { name: "DP780",         grade: "ASTM A1008",  color: "#fb923c", E: 210, YS: 490, UTS: 780, elongation: 14, n: 0.14, K: 1280,density: 7.87, poisson: 0.3, r_value: 0.85, category: "Advanced HS" },
  { name: "SS 304",        grade: "AISI 304",    color: "#a78bfa", E: 193, YS: 215, UTS: 550, elongation: 40, n: 0.32, K: 1275,density: 8.0,  poisson: 0.28, r_value: 1.1, category: "Stainless" },
  { name: "SS 316L",       grade: "AISI 316L",   color: "#c084fc", E: 193, YS: 170, UTS: 490, elongation: 45, n: 0.34, K: 1180,density: 8.0,  poisson: 0.28, r_value: 1.2, category: "Stainless" },
  { name: "Al 5052-H32",   grade: "ASTM B209",   color: "#22d3ee", E: 70,  YS: 193, UTS: 228, elongation: 12, n: 0.11, K: 380, density: 2.68, poisson: 0.33, r_value: 0.6, category: "Aluminium" },
  { name: "Ti-6Al-4V",     grade: "Grade 5",     color: "#e879f9", E: 114, YS: 880, UTS: 950, elongation: 14, n: 0.04, K: 1220,density: 4.43, poisson: 0.34, r_value: 2.5, category: "Titanium" },
  { name: "MS (Fe 410)",   grade: "IS 2062 E250",color: "#94a3b8", E: 200, YS: 250, UTS: 410, elongation: 23, n: 0.19, K: 680, density: 7.85, poisson: 0.3, r_value: 1.2,  category: "Mild Steel" },
];

// ─── Stress-Strain point generator ───────────────────────────────────────────

function generateCurve(mat: Material, points = 200): { eng: {x:number;y:number}[]; true: {x:number;y:number}[] } {
  const eng: {x:number;y:number}[] = [];
  const tru: {x:number;y:number}[] = [];
  const eps_y = mat.YS / (mat.E * 1000);
  const eps_max = mat.elongation / 100;

  for (let i = 0; i <= points; i++) {
    const eps = (i / points) * eps_max;
    let sigma: number;
    if (eps <= eps_y) {
      sigma = eps * mat.E * 1000; // elastic
    } else {
      const eps_p = eps - eps_y;
      sigma = mat.YS + (mat.UTS - mat.YS) * (1 - Math.exp(-15 * eps_p));
      // Ludwigson: σ = K × (ε_p)^n
      sigma = Math.min(mat.UTS, mat.K * Math.pow(Math.max(eps_p, 1e-5), mat.n));
      sigma = Math.max(mat.YS, sigma);
    }
    // Necking: after UTS, reduce
    if (eps > 0.6 * eps_max) {
      const neckFactor = 1 - Math.pow((eps - 0.6*eps_max) / (0.4*eps_max), 2) * 0.3;
      sigma *= neckFactor;
    }
    eng.push({ x: eps * 100, y: sigma }); // engineering
    tru.push({ x: Math.log(1 + eps) * 100, y: sigma * (1 + eps) }); // true
  }
  return { eng, true: tru };
}

function StressStrainCanvas({ selected, compareMode, showTrue }:
  { selected: string[]; compareMode: boolean; showTrue: boolean }) {
  const W = 760, H = 460;
  const PAD = { t: 30, r: 30, b: 50, l: 65 };
  const CW = W - PAD.l - PAD.r, CH = H - PAD.t - PAD.b;

  const mats = MATERIALS.filter(m => selected.includes(m.name));
  const allCurves = useMemo(() => mats.map(m => ({ m, curve: generateCurve(m) })), [selected, showTrue]);

  if (mats.length === 0) return <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "#07090f", borderRadius: 10 }} />;

  const maxX = Math.max(...allCurves.flatMap(c => (showTrue ? c.curve.true : c.curve.eng).map(p => p.x)));
  const maxY = Math.max(...allCurves.flatMap(c => (showTrue ? c.curve.true : c.curve.eng).map(p => p.y)));
  const txX = (x: number) => PAD.l + (x / maxX) * CW;
  const txY = (y: number) => PAD.t + CH - (y / maxY) * CH;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "#07090f", borderRadius: 10 }}>
      {Array.from({ length: 7 }, (_, i) => {
        const x = PAD.l + (i / 6) * CW;
        return (
          <g key={`xt${i}`}>
            <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + CH} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
            <text x={x} y={PAD.t + CH + 14} fill="#52525b" fontSize="10" fontFamily="sans-serif" textAnchor="middle">{(maxX * i / 6).toFixed(1)}%</text>
          </g>
        );
      })}
      {Array.from({ length: 7 }, (_, i) => {
        const y = PAD.t + CH - (i / 6) * CH;
        return (
          <g key={`yt${i}`}>
            <line x1={PAD.l} y1={y} x2={PAD.l + CW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
            <text x={PAD.l - 8} y={y + 4} fill="#52525b" fontSize="10" fontFamily="sans-serif" textAnchor="end">{(maxY * i / 6).toFixed(0)}</text>
          </g>
        );
      })}

      <path d={`M${PAD.l},${PAD.t} L${PAD.l},${PAD.t + CH} L${PAD.l + CW},${PAD.t + CH}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
      <text x={PAD.l + CW / 2} y={H - 6} fill="#71717a" fontSize="11" fontFamily="sans-serif" textAnchor="middle">{showTrue ? "True Strain (ε_t %)" : "Engineering Strain (ε %)"}</text>
      <text x={14} y={PAD.t + CH / 2} fill="#71717a" fontSize="11" fontFamily="sans-serif" textAnchor="middle" transform={`rotate(-90,14,${PAD.t + CH / 2})`}>{showTrue ? "True Stress (MPa)" : "Engineering Stress (MPa)"}</text>

      {allCurves.map(({ m, curve }) => {
        const pts = showTrue ? curve.true : curve.eng;
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${txX(p.x)},${txY(p.y)}`).join(" ");
        const ysPx = txX(m.YS / (m.E * 1000) * 100);
        const ysPy = txY(m.YS);
        const utsCurve = pts.reduce((max, p) => p.y > max.y ? p : max, pts[0]);
        const lastPt = pts[pts.length - 1];
        return (
          <g key={m.name}>
            <path d={d} fill="none" stroke={m.color} strokeWidth={2.5} />
            <circle cx={ysPx} cy={ysPy} r={4} fill={m.color} stroke="#07090f" strokeWidth={1.5} />
            <circle cx={txX(utsCurve.x)} cy={txY(utsCurve.y)} r={5} fill="#fff" stroke={m.color} strokeWidth={2} />
            <text x={Math.min(txX(lastPt.x) + 4, W - 60)} y={Math.max(txY(lastPt.y), PAD.t + 10)} fill={m.color} fontSize="10" fontFamily="sans-serif">{m.name.split(" ")[0]}</text>
          </g>
        );
      })}

      <circle cx={PAD.l + 10} cy={PAD.t + 12} r={3} fill="#fff" />
      <text x={PAD.l + 18} y={PAD.t + 16} fill="#52525b" fontSize="9" fontFamily="sans-serif">UTS point</text>
      <circle cx={PAD.l + 80} cy={PAD.t + 12} r={3} fill="#94a3b8" />
      <text x={PAD.l + 88} y={PAD.t + 16} fill="#52525b" fontSize="9" fontFamily="sans-serif">Yield point</text>
    </svg>
  );
}

function FLDCanvas({ mat }: { mat: Material }) {
  const W = 240, H = 160;
  const n = mat.n, r = mat.r_value;
  const FLC = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let eps2 = -0.4; eps2 <= 0.4; eps2 += 0.02) {
      const fld_eps1 = n * (1 + r) * (1 - Math.abs(eps2) * 0.6) + n * 0.1 + 0.05;
      pts.push({ x: eps2, y: Math.max(0.02, fld_eps1) });
    }
    return pts;
  }, [n, r]);

  const txX = (x: number) => W / 2 + x * W * 1.1;
  const txY = (y: number) => H - 20 - y * (H - 40) * 1.8;

  const flcPath = FLC.map((p, i) => `${i === 0 ? "M" : "L"}${txX(p.x)},${txY(p.y)}`).join(" ");
  const failZone = `M0,0 L${W},0 ${FLC.slice().reverse().map(p => `L${txX(p.x)},${txY(p.y)}`).join(" ")} Z`;
  const warnPath = FLC.map((p, i) => `${i === 0 ? "M" : "L"}${txX(p.x)},${txY(p.y * 0.88)}`).join(" ");

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "#08091a", borderRadius: 8 }}>
      <defs>
        <linearGradient id={`fld-fail-${mat.name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(239,68,68,0.3)" />
          <stop offset="40%" stopColor="rgba(239,68,68,0.05)" />
        </linearGradient>
      </defs>
      <path d={failZone} fill={`url(#fld-fail-${mat.name})`} />
      <path d={flcPath} fill="none" stroke="#f59e0b" strokeWidth={2} />
      <path d={warnPath} fill="none" stroke="rgba(251,191,36,0.3)" strokeWidth={1} strokeDasharray="3,3" />
      <line x1={W / 2} y1={H - 20} x2={W / 2} y2={10} stroke="rgba(255,255,255,0.12)" />
      <line x1={10} y1={H - 20} x2={W - 10} y2={H - 20} stroke="rgba(255,255,255,0.12)" />
      <text x={W / 2} y={H - 4} fill="#52525b" fontSize="9" fontFamily="sans-serif" textAnchor="middle">ε₂ (Minor Strain)</text>
      <text x={14} y={H / 2} fill="#52525b" fontSize="9" fontFamily="sans-serif" textAnchor="middle" transform={`rotate(-90,14,${H / 2})`}>ε₁ (Major Strain)</text>
      <text x={W / 2} y={18} fill="#f87171" fontSize="9" fontFamily="sans-serif" textAnchor="middle">FAILURE ZONE</text>
      <text x={W - 30} y={14} fill="#52525b" fontSize="9" fontFamily="sans-serif" textAnchor="middle">n={n} r={r}</text>
    </svg>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function MaterialAnalyzerView() {
  const [selected, setSelected] = useState<string[]>(["GI (DX51D)", "CR Steel (DC01)", "HSLA 550"]);
  const [showTrue, setShowTrue] = useState(false);
  const [compareMode, setCompareMode] = useState(true);
  const [activeMat, setActiveMat] = useState<Material>(MATERIALS[0]);
  const [filterCat, setFilterCat] = useState<string>("All");

  const cats = ["All", ...Array.from(new Set(MATERIALS.map(m => m.category)))];
  const filtered = filterCat === "All" ? MATERIALS : MATERIALS.filter(m => m.category === filterCat);

  function toggleMat(name: string) {
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  function exportData() {
    const rows = MATERIALS.filter(m => selected.includes(m.name)).map(m => {
      const curve = generateCurve(m);
      return curve.eng.map(p => `${m.name},${p.x.toFixed(4)},${p.y.toFixed(2)}`);
    }).flat();
    const csv = ["Material,Engineering Strain (%),Stress (MPa)", ...rows].join("\n");
    const b = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "StressStrain_Export.csv"; a.click();
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#070710", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#0f766e,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(15,118,110,0.35)" }}>
          <TrendingUp style={{ width: 20, height: 20, color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>Material Stress-Strain Analyzer</div>
          <div style={{ fontSize: 10, color: "#52525b" }}>Engineering vs True stress · FLD diagram · Power hardening law · Multi-material comparison · CSV export</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => setShowTrue(t => !t)}
            style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${showTrue?"rgba(52,211,153,0.4)":"rgba(255,255,255,0.07)"}`, background: showTrue?"rgba(52,211,153,0.1)":"transparent", color: showTrue?"#34d399":"#52525b", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            {showTrue ? "True Stress" : "Engineering"}
          </button>
          <button onClick={exportData}
            style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "linear-gradient(90deg,#0f766e,#0d9488)", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Download style={{ width: 11, height: 11 }} />Export CSV
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px 1fr", overflow: "hidden" }}>
        {/* Left: Material selection */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Category filter */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {cats.map(c => (
              <button key={c} onClick={() => setFilterCat(c)}
                style={{ padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 9, fontWeight: 700, cursor: "pointer", background: filterCat===c?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.04)", color: filterCat===c?"#34d399":"#52525b" }}>
                {c}
              </button>
            ))}
          </div>

          {/* Material list */}
          <div style={{ flex: 1, overflow: "auto", padding: "8px 10px" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 8, textTransform: "uppercase" }}>
              {selected.length} Selected — Click to toggle
            </div>
            {filtered.map(m => {
              const isSel = selected.includes(m.name);
              return (
                <div key={m.name} onClick={() => { toggleMat(m.name); setActiveMat(m); }}
                  style={{ padding: "9px 10px", borderRadius: 9, marginBottom: 5, background: isSel?"rgba(255,255,255,0.03)":"transparent", border: `1px solid ${isSel?m.color+"50":"rgba(255,255,255,0.04)"}`, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: isSel?m.color:"#3f3f46", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isSel?"#fff":"#71717a" }}>{m.name}</div>
                      <div style={{ fontSize: 9, color: "#52525b" }}>{m.grade} — {m.category}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, color: "#52525b" }}>UTS</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: m.color }}>{m.UTS}</div>
                    </div>
                  </div>
                  {isSel && (
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      {[
                        { l: "YS", v: `${m.YS}` },
                        { l: "n", v: m.n.toFixed(2) },
                        { l: "A%", v: `${m.elongation}%` },
                        { l: "r", v: m.r_value.toFixed(1) },
                      ].map((s, i) => (
                        <div key={i} style={{ fontSize: 9, color: "#71717a" }}><span style={{ color: "#3f3f46" }}>{s.l}:</span> <span style={{ color: "#a1a1aa", fontWeight: 700 }}>{s.v}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected material detail */}
          {activeMat && (
            <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#52525b", marginBottom: 8, textTransform: "uppercase" }}>{activeMat.name} — Properties</div>
              {[
                { l: "E (Young's Mod)", v: `${activeMat.E} GPa` },
                { l: "Yield Strength", v: `${activeMat.YS} MPa` },
                { l: "UTS", v: `${activeMat.UTS} MPa` },
                { l: "K (Strength Coeff)", v: `${activeMat.K} MPa` },
                { l: "n (Strain Harden)", v: activeMat.n.toFixed(2) },
                { l: "Density", v: `${activeMat.density} g/cm³` },
                { l: "Poisson's Ratio", v: activeMat.poisson.toFixed(2) },
                { l: "r-Value (Lanks.)", v: activeMat.r_value.toFixed(1) },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ fontSize: 9, color: "#52525b" }}>{s.l}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#e4e4e7" }}>{s.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Chart + FLD */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, padding: 12, overflow: "hidden" }}>
            <StressStrainCanvas selected={selected} compareMode={compareMode} showTrue={showTrue} />
          </div>

          {/* Bottom: FLD + Stats */}
          <div style={{ height: 190, borderTop: "1px solid rgba(255,255,255,0.05)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", overflow: "hidden" }}>
            {/* FLD */}
            <div style={{ padding: "8px 12px", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 6, textTransform: "uppercase" }}>FLD — {activeMat.name}</div>
              <FLDCanvas mat={activeMat} />
            </div>

            {/* Comparison table */}
            <div style={{ padding: "8px 12px", borderRight: "1px solid rgba(255,255,255,0.05)", overflow: "auto" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 6, textTransform: "uppercase" }}>Comparison</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 48px 36px 36px", gap: 3, fontSize: 9 }}>
                <div style={{ color: "#3f3f46", fontWeight: 800 }}>Material</div>
                <div style={{ color: "#3f3f46", textAlign: "right" }}>YS</div>
                <div style={{ color: "#3f3f46", textAlign: "right" }}>UTS</div>
                <div style={{ color: "#3f3f46", textAlign: "right" }}>n</div>
                <div style={{ color: "#3f3f46", textAlign: "right" }}>A%</div>
                {MATERIALS.filter(m => selected.includes(m.name)).map(m => (
                  <React.Fragment key={m.name}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                      <span style={{ color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name.split(" ")[0]}</span>
                    </div>
                    <div style={{ textAlign: "right", color: "#fbbf24", fontWeight: 700 }}>{m.YS}</div>
                    <div style={{ textAlign: "right", color: "#34d399", fontWeight: 700 }}>{m.UTS}</div>
                    <div style={{ textAlign: "right", color: "#60a5fa" }}>{m.n.toFixed(2)}</div>
                    <div style={{ textAlign: "right", color: "#a1a1aa" }}>{m.elongation}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Formability guide */}
            <div style={{ padding: "8px 12px", overflow: "auto" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 6, textTransform: "uppercase" }}>Formability Guide</div>
              {[
                { mat: "GI/CR Steel",  score: 95, desc: "Best for roll forming" },
                { mat: "HSLA 550",     score: 65, desc: "Higher springback" },
                { mat: "DP600/780",    score: 60, desc: "Needs more passes" },
                { mat: "SS 304/316L",  score: 75, desc: "Work hardens quickly" },
                { mat: "Al 5052",      score: 70, desc: "Low springback" },
                { mat: "Ti-6Al-4V",    score: 40, desc: "Heated forming req." },
              ].map((f, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: "#71717a" }}>{f.mat}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: f.score > 80?"#34d399":f.score>60?"#fbbf24":"#f87171" }}>{f.score}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${f.score}%`, background: f.score>80?"#34d399":f.score>60?"#fbbf24":"#f87171" }} />
                  </div>
                  <div style={{ fontSize: 8, color: "#3f3f46", marginTop: 1 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
