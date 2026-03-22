import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Download, RefreshCw, Settings, Layers, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number; }
interface Station {
  id: number;
  label: string;
  pts: Pt[];
  color: string;
  bendAngle: number;
  webWidth: number;
  flangeLen: number;
}

interface ProfileSpec {
  name: string;
  webWidth: number;
  flangeLen: number;
  lipLen: number;
  thickness: number;
  totalStations: number;
}

const PROFILES: Record<string, ProfileSpec> = {
  "C-Channel 100×50×1.5": { name: "C-Channel", webWidth: 100, flangeLen: 50, lipLen: 0, thickness: 1.5, totalStations: 7 },
  "Z-Purlin 150×65×2.0":  { name: "Z-Purlin",  webWidth: 150, flangeLen: 65, lipLen: 0, thickness: 2.0, totalStations: 8 },
  "C-Lipped 200×75×20": { name: "C-Lipped",  webWidth: 200, flangeLen: 75, lipLen: 20, thickness: 2.5, totalStations: 10 },
  "Hat Section 120×60":   { name: "Hat Section", webWidth: 120, flangeLen: 60, lipLen: 0, thickness: 1.2, totalStations: 6 },
  "Angle 60×60×3.0":      { name: "Angle",      webWidth: 60,  flangeLen: 60, lipLen: 0, thickness: 3.0, totalStations: 5 },
};

const STATION_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#a78bfa","#22d3ee","#fb923c","#84cc16","#f472b6","#e2e8f0"];

// ─── Geometry generators ─────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function generateCChannelStations(spec: ProfileSpec, count: number): Station[] {
  const { webWidth: W, flangeLen: F, lipLen: L, thickness: T } = spec;
  const stations: Station[] = [];
  const hasLip = L > 0;

  for (let s = 0; s < count; s++) {
    const t = s / (count - 1); // 0 = flat strip, 1 = final
    const angle = t * 90; // degrees
    const rad = angle * Math.PI / 180;

    // Build cross-section points (in mm, centered)
    const pts: Pt[] = [];
    const cx = 0, cy = 0;

    if (spec.name === "C-Channel" || spec.name === "C-Lipped") {
      // Web: horizontal at bottom
      const webY = -W / 2 * Math.sin(0);
      const flangeAngle = rad;

      // Left flange (rotated inward)
      if (hasLip) {
        const lipAngle = Math.max(0, t * 1.3 - 0.3) * 90 * Math.PI / 180;
        pts.push({ x: -W/2 - F * Math.sin(flangeAngle) - L * Math.sin(flangeAngle + lipAngle), y: F * Math.cos(flangeAngle) + L * Math.cos(flangeAngle + lipAngle) });
        pts.push({ x: -W/2 - F * Math.sin(flangeAngle), y: F * Math.cos(flangeAngle) });
      } else {
        pts.push({ x: -W/2 - F * Math.sin(flangeAngle), y: F * Math.cos(flangeAngle) });
      }
      pts.push({ x: -W/2, y: 0 });
      pts.push({ x:  W/2, y: 0 });
      pts.push({ x:  W/2 + F * Math.sin(flangeAngle), y: F * Math.cos(flangeAngle) });
      if (hasLip) {
        const lipAngle = Math.max(0, t * 1.3 - 0.3) * 90 * Math.PI / 180;
        pts.push({ x: W/2 + F * Math.sin(flangeAngle) + L * Math.sin(flangeAngle + lipAngle), y: F * Math.cos(flangeAngle) + L * Math.cos(flangeAngle + lipAngle) });
      }
    } else if (spec.name === "Z-Purlin") {
      const topFlangeAngle = rad;
      const botFlangeAngle = rad;
      pts.push({ x: W/2 + F * Math.cos(topFlangeAngle), y: W/2 + F * Math.sin(topFlangeAngle) });
      pts.push({ x: W/2, y: W/2 });
      pts.push({ x: -W/2, y: -W/2 });
      pts.push({ x: -W/2 - F * Math.cos(botFlangeAngle), y: -W/2 - F * Math.sin(botFlangeAngle) });
    } else if (spec.name === "Hat Section") {
      const fAng = rad;
      pts.push({ x: -W/2 - F*Math.sin(fAng), y: -F*Math.cos(fAng) });
      pts.push({ x: -W/2, y: 0 });
      pts.push({ x: -W/4, y: 0 });
      pts.push({ x: -W/4, y: W/4 });
      pts.push({ x:  W/4, y: W/4 });
      pts.push({ x:  W/4, y: 0 });
      pts.push({ x:  W/2, y: 0 });
      pts.push({ x:  W/2 + F*Math.sin(fAng), y: -F*Math.cos(fAng) });
    } else if (spec.name === "Angle") {
      const fAng = rad;
      pts.push({ x: -W/2 + F * (1-t), y: W/2 * t });
      pts.push({ x: 0, y: 0 });
      pts.push({ x: W/2, y: 0 });
    }

    stations.push({
      id: s + 1,
      label: s === 0 ? "Flat Strip" : s === count - 1 ? "Final Profile" : `Pass ${s}`,
      pts,
      color: STATION_COLORS[s % STATION_COLORS.length],
      bendAngle: parseFloat((angle).toFixed(1)),
      webWidth: W,
      flangeLen: F,
    });
  }
  return stations;
}

function FlowerCanvas({ stations, selectedStation, showAll, scale: sc, thickness }:
  { stations: Station[]; selectedStation: number; showAll: boolean; scale: number; thickness: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 700, h: 460 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = dims.w;
  const H = dims.h;
  const cx = W / 2;
  const cy = H / 2;
  const gs = 20;

  const stationsToRender = showAll ? stations : (selectedStation >= 0 && selectedStation < stations.length ? [stations[selectedStation]] : []);
  const sel = selectedStation >= 0 && selectedStation < stations.length ? stations[selectedStation] : null;
  const finalSt = stations[stations.length - 1];
  const showRollTooling = (showAll || selectedStation === stations.length - 1) && finalSt;

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", borderRadius: 10 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "#07090f", borderRadius: 10 }}>
        {Array.from({ length: Math.ceil(W / gs) }, (_, i) => (
          <line key={`gv${i}`} x1={cx % gs + i * gs} y1={0} x2={cx % gs + i * gs} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        ))}
        {Array.from({ length: Math.ceil(H / gs) }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={cy % gs + i * gs} x2={W} y2={cy % gs + i * gs} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        ))}
        <line x1={cx} y1={0} x2={cx} y2={H} stroke="rgba(255,255,255,0.1)" />
        <line x1={0} y1={cy} x2={W} y2={cy} stroke="rgba(255,255,255,0.1)" />

        {stationsToRender.map((st, idx) => {
          if (st.pts.length < 2) return null;
          const isSel = showAll ? stations.indexOf(st) === selectedStation : true;
          const alpha = isSel ? 1.0 : 0.25;
          const lw = isSel ? 2.5 : 1.0;
          const d = st.pts.map((p, j) => `${j === 0 ? "M" : "L"}${cx + p.x * sc},${cy - p.y * sc}`).join(" ");
          return (
            <g key={st.id}>
              {isSel && (
                <polyline
                  points={st.pts.map(p => `${cx + p.x * sc},${cy - p.y * sc}`).join(" ")}
                  fill="none" stroke={st.color} strokeWidth={thickness * sc * 2} opacity={0.19}
                  strokeLinejoin="round" strokeLinecap="round"
                />
              )}
              <path d={d} fill="none" stroke={st.color} strokeWidth={lw} opacity={alpha}
                strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}

        {sel && sel.pts.map((p, i) => (
          <circle key={`pt${i}`} cx={cx + p.x * sc} cy={cy - p.y * sc} r={3} fill={sel.color} />
        ))}

        {showRollTooling && finalSt.pts.map((p, i) => (
          <circle key={`rt${i}`} cx={cx + p.x * sc} cy={cy - p.y * sc} r={6 * sc}
            fill="none" stroke="rgba(245,158,11,0.2)" strokeWidth={1} strokeDasharray="2,3" />
        ))}

        <text x={cx - 40} y={cy - 6} fill="rgba(255,255,255,0.1)" fontSize="10" fontFamily="sans-serif">↔ Neutral Axis</text>
      </svg>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function RollFlowerDesignerView() {
  const [profile, setProfile] = useState<string>("C-Channel 100×50×1.5");
  const [customSpec, setCustomSpec] = useState<ProfileSpec>(PROFILES["C-Channel 100×50×1.5"]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState(0);
  const [showAll, setShowAll] = useState(true);
  const [scale, setScale] = useState(1.4);
  const [activePanel, setActivePanel] = useState<"profile" | "stations" | "calc">("profile");

  const generate = useCallback(() => {
    const st = generateCChannelStations(customSpec, customSpec.totalStations);
    setStations(st);
    setSelectedStation(0);
  }, [customSpec]);

  useEffect(() => { generate(); }, [generate]);

  useEffect(() => {
    const spec = PROFILES[profile];
    if (spec) setCustomSpec({ ...spec });
  }, [profile]);

  const sel = stations[selectedStation];

  // Engineering calculations
  const { webWidth: W, flangeLen: F, thickness: T, totalStations: N } = customSpec;
  const neutralFactor = 0.5 - T / (2 * (W / 10)); // simplified
  const stripWidth = W + 2 * F;
  const bendAllowance = (T * 0.4443) * Math.PI * 90 / 180; // for 90° bend
  const rollDia = W * 0.8;
  const shaftDia = Math.max(40, rollDia * 0.4);
  const speedRPM = 15;
  const lineSpeed = (Math.PI * rollDia / 1000) * speedRPM;

  function exportSVG() {
    if (stations.length === 0) return;
    const W_SVG = 800, H_SVG = 500;
    const cx = W_SVG / 2, cy = H_SVG / 2, sc = 1.4;
    let paths = stations.map((st, i) => {
      const d = st.pts.map((p, j) => `${j===0?"M":"L"}${(cx + p.x*sc).toFixed(1)},${(cy - p.y*sc).toFixed(1)}`).join(" ");
      return `<path d="${d}" stroke="${st.color}" stroke-width="${i===stations.length-1?2.5:1}" fill="none" opacity="${i===stations.length-1?1:0.4}"/>`;
    }).join("\n");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W_SVG}" height="${H_SVG}" style="background:#07090f">\n${paths}\n</svg>`;
    const b = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `FlowerDiagram_${profile.replace(/\s/g,"_")}.svg`; a.click();
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#070710", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(124,58,237,0.35)" }}>
          <Layers style={{ width: 20, height: 20, color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>Roll Flower Designer — COPRA RF Style</div>
          <div style={{ fontSize: 10, color: "#52525b" }}>Multi-station forming sequence · Neutral axis · Bend allowance · Roll geometry · SVG export</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setShowAll(a => !a)}
            style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${showAll?"rgba(124,58,237,0.4)":"rgba(255,255,255,0.06)"}`, background: showAll?"rgba(124,58,237,0.1)":"transparent", color: showAll?"#a78bfa":"#52525b", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            {showAll ? "Overlay ON" : "Overlay OFF"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#52525b" }}>Zoom:</span>
            <button onClick={() => setScale(s => Math.max(0.4, s - 0.2))} style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#71717a", cursor: "pointer", fontSize: 12 }}>-</button>
            <span style={{ fontSize: 10, color: "#a1a1aa", width: 36, textAlign: "center" }}>{(scale * 100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.min(4, s + 0.2))} style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#71717a", cursor: "pointer", fontSize: 12 }}>+</button>
          </div>
          <button onClick={exportSVG}
            style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(90deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Download style={{ width: 12, height: 12 }} />Export SVG
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px 1fr", overflow: "hidden" }}>
        {/* Left */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 3, flexShrink: 0 }}>
            {(["profile", "stations", "calc"] as const).map(p => (
              <button key={p} onClick={() => setActivePanel(p)}
                style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", background: activePanel===p?"rgba(124,58,237,0.2)":"transparent", color: activePanel===p?"#a78bfa":"#52525b" }}>
                {p}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "10px" }}>
            {activePanel === "profile" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 6, textTransform: "uppercase" }}>Profile Preset</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {Object.keys(PROFILES).map(p => (
                      <div key={p} onClick={() => setProfile(p)}
                        style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${profile===p?"rgba(124,58,237,0.4)":"rgba(255,255,255,0.05)"}`, background: profile===p?"rgba(124,58,237,0.08)":"transparent", cursor: "pointer" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: profile===p?"#a78bfa":"#a1a1aa" }}>{p}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 8, textTransform: "uppercase" }}>Parameters</div>
                  {[
                    { l: "Web Width (mm)",  k: "webWidth",     min: 30, max: 400, step: 5  },
                    { l: "Flange Len (mm)", k: "flangeLen",    min: 10, max: 200, step: 5  },
                    { l: "Lip Len (mm)",    k: "lipLen",       min: 0,  max: 50,  step: 2  },
                    { l: "Thickness (mm)",  k: "thickness",    min: 0.5, max: 6,  step: 0.1 },
                    { l: "Pass Count",      k: "totalStations",min: 3,  max: 14,  step: 1  },
                  ].map(f => (
                    <div key={f.k} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: "#71717a" }}>{f.l}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24" }}>{customSpec[f.k as keyof ProfileSpec]}</span>
                      </div>
                      <input type="range" min={f.min} max={f.max} step={f.step}
                        value={customSpec[f.k as keyof ProfileSpec] as number}
                        onChange={e => setCustomSpec(prev => ({ ...prev, [f.k]: parseFloat(e.target.value) }))}
                        style={{ width: "100%", accentColor: "#7c3aed" }} />
                    </div>
                  ))}
                  <button onClick={generate}
                    style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: "linear-gradient(90deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <RefreshCw style={{ width: 13, height: 13 }} />Regenerate Flower
                  </button>
                </div>
              </>
            )}

            {activePanel === "stations" && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 8, textTransform: "uppercase" }}>{stations.length} Stations</div>
                {stations.map((st, i) => (
                  <div key={st.id} onClick={() => setSelectedStation(i)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, marginBottom: 4, background: selectedStation===i?"rgba(124,58,237,0.1)":"rgba(255,255,255,0.02)", border: `1px solid ${selectedStation===i?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.04)"}`, cursor: "pointer" }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: st.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: selectedStation===i?"#a78bfa":"#a1a1aa" }}>{st.label}</div>
                      <div style={{ fontSize: 9, color: "#52525b" }}>Bend: {st.bendAngle.toFixed(0)}° | {st.pts.length} pts</div>
                    </div>
                    {selectedStation===i && <div style={{ width: 6, height: 6, borderRadius: 99, background: "#a78bfa" }} />}
                  </div>
                ))}
              </div>
            )}

            {activePanel === "calc" && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 10, textTransform: "uppercase" }}>Roll Engineering</div>
                {[
                  { l: "Strip Width", v: `${stripWidth.toFixed(1)} mm`, c: "#60a5fa" },
                  { l: "Neutral Factor", v: neutralFactor.toFixed(3), c: "#34d399" },
                  { l: "Bend Allowance (90°)", v: `${bendAllowance.toFixed(2)} mm`, c: "#fbbf24" },
                  { l: "Roll Dia (approx)", v: `${rollDia.toFixed(0)} mm`, c: "#a78bfa" },
                  { l: "Shaft Dia", v: `${shaftDia.toFixed(0)} mm`, c: "#e4e4e7" },
                  { l: "Roll Speed", v: `${speedRPM} RPM`, c: "#71717a" },
                  { l: "Line Speed", v: `${lineSpeed.toFixed(1)} m/min`, c: "#34d399" },
                  { l: "Material", v: "GI / CR Steel", c: "#71717a" },
                  { l: "Total Passes", v: `${N}`, c: "#fbbf24" },
                  { l: "Per-pass Angle", v: `${(90 / (N-1)).toFixed(1)}°`, c: "#e4e4e7" },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 11, color: "#71717a" }}>{s.l}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: s.c }}>{s.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Flower diagram */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Station navigation */}
          <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <button onClick={() => setSelectedStation(s => Math.max(0, s - 1))}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#71717a", cursor: "pointer" }}>
              <ChevronLeft style={{ width: 13, height: 13 }} />
            </button>
            <div style={{ display: "flex", gap: 5, flex: 1, flexWrap: "wrap" }}>
              {stations.map((st, i) => (
                <div key={i} onClick={() => setSelectedStation(i)}
                  style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", background: selectedStation===i?st.color+"25":"rgba(255,255,255,0.03)", border: `1px solid ${selectedStation===i?st.color+"60":"rgba(255,255,255,0.05)"}`, color: selectedStation===i?st.color:"#52525b" }}>
                  {st.id === 1 ? "Flat" : st.id === stations.length ? "Final" : `P${i}`}
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedStation(s => Math.min(stations.length - 1, s + 1))}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#71717a", cursor: "pointer" }}>
              <ChevronRight style={{ width: 13, height: 13 }} />
            </button>
          </div>

          <div style={{ flex: 1, padding: 12, overflow: "hidden" }}>
            <FlowerCanvas stations={stations} selectedStation={selectedStation} showAll={showAll} scale={scale} thickness={customSpec.thickness} />
          </div>

          {/* Selected station info */}
          {sel && (
            <div style={{ padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 14, flexWrap: "wrap", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: sel.color }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: sel.color }}>{sel.label}</span>
              </div>
              {[
                { l: "Bend Angle", v: `${sel.bendAngle.toFixed(0)}°` },
                { l: "Points", v: sel.pts.length.toString() },
                { l: "Profile", v: profile.split(" ")[0] },
                { l: "Strip Width", v: `${stripWidth.toFixed(1)} mm` },
              ].map((s, i) => (
                <div key={i} style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                  <span style={{ fontSize: 9, color: "#52525b" }}>{s.l}: </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e4e4e7" }}>{s.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
