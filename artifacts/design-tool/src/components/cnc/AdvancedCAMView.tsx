import React, { useState, useRef, useEffect } from "react";
import { Cpu, CheckCircle, BarChart2, Copy, Download, Play, Settings, Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostProc = "fanuc" | "siemens840d" | "haas" | "mazak" | "heidenhain";
type StrategyId = "adaptive" | "trochoidal" | "contour" | "pencil" | "spiral" | "hsm" | "g71rough" | "g71finish" | "g76thread" | "g72face";
type MaterialId = "AL" | "MS" | "CR" | "SS" | "Ti" | "CI" | "Brass" | "HSLA";

interface Strategy {
  id: StrategyId; name: string; icon: string; type: "mill" | "turn"; shortDesc: string;
  adv: string[]; bestFor: string; engagement: string;
}

const STRATEGIES: Strategy[] = [
  { id: "adaptive",   name: "Adaptive Clearing",     icon: "⚡", type: "mill", shortDesc: "Constant chip load — iMachining/HSMWorks style. Varies stepover to maintain engagement angle.", adv: ["Constant chip load", "Full depth-of-cut always", "30–50% faster than conventional", "Works on hardened steel", "Less heat → longer tool life"], bestFor: "Pockets, cavities, complex cores. All hardness levels.", engagement: "8–15% tool Ø (keep thin chip)" },
  { id: "trochoidal", name: "Trochoidal Milling",    icon: "🌀", type: "mill", shortDesc: "Circular arcs advancing through slot. Eliminates full-width engagement — ideal for SS/Ti.", adv: ["No full-width engagement", "High-speed slotting", "Better chip evacuation", "SS, Ti, Inconel friendly", "Low vibration"], bestFor: "Slots, stainless steel, titanium, thin walls", engagement: "Arc radius = 55–65% tool Ø" },
  { id: "contour",    name: "Z-Level Contour",       icon: "📐", type: "mill", shortDesc: "2D offsets at each Z level. Classic, reliable, universal. Best surface finish on vertical walls.", adv: ["Consistent surface finish", "Simple post-processing", "Works on any controller", "Predictable cutting forces"], bestFor: "Vertical walls, profile finishing, 2.5D milling", engagement: "Full radial (Ae = D), light axial (Ap = 5–10%)" },
  { id: "pencil",     name: "Pencil Tracing",        icon: "✏️", type: "mill", shortDesc: "Auto-finds corners missed by large tools. Single-pass clean with ball-nose — eliminates hand finishing.", adv: ["Automatic corner detection", "No manual offset needed", "Accurate ±0.01mm", "Eliminates benching"], bestFor: "Corner finishing after roughing", engagement: "Single light pass" },
  { id: "spiral",     name: "Spiral Pocket",         icon: "🔄", type: "mill", shortDesc: "Center-out spiral. No plunge into material — smooth entry, constant load.", adv: ["No tool plunge", "Smooth continuous cut", "Good chip control", "Low entry forces"], bestFor: "Circular pockets, face milling", engagement: "Radial: 50% core, 70% outer" },
  { id: "hsm",        name: "HSM High-Speed",        icon: "🚀", type: "mill", shortDesc: "Light axial, high feed, high RPM. Thin-chip strategy keeps heat in chip not workpiece.", adv: ["Light ap (10% D), high Ae (50%)", "Reduced heat in workpiece", "Excellent Al surface finish", "Long tool life on Al/Brass"], bestFor: "Aluminium, brass, thin walls, die inserts", engagement: "Low Ap, high Ae" },
  { id: "g71rough",   name: "G71 OD Roughing",       icon: "⚙️", type: "turn", shortDesc: "Fanuc/Mazak standard roughing cycle — removes material in uniform U-depth passes.", adv: ["Single-block program", "Automatic feed retract", "Works with G70 finish", "Universal Fanuc/Haas/Mazak"], bestFor: "OD/ID turning roughing", engagement: "U = depth/pass (1.5–3mm)" },
  { id: "g71finish",  name: "G70 Finish Pass",       icon: "🏁", type: "turn", shortDesc: "Follows G71 roughing with G70 finishing pass at tighter feed/speed.", adv: ["Automatically uses G71 contour", "Single command finish", "Ra 0.8–1.6μm achievable", "Separate speed/feed control"], bestFor: "OD finish pass after G71 roughing", engagement: "Light finish, Fz = 0.05–0.1 mm/rev" },
  { id: "g76thread",  name: "G76 Threading",         icon: "🔩", type: "turn", shortDesc: "Multi-pass threading with compound infeed. Built-in spring passes, chip breaking, tapered feed.", adv: ["Automatic spring passes", "60°/55° insert standard", "Self-calculating depth", "Compound infeed → longer insert"], bestFor: "Metric, UN, BSPT threads — all pitches", engagement: "Compound infeed: P word controls passes" },
  { id: "g72face",    name: "G72 Face Roughing",     icon: "🔲", type: "turn", shortDesc: "Face-direction roughing cycle — removes material in axial (Z) passes across face.", adv: ["Axial passes, not radial", "Ideal for large diameter facing", "Single block program", "Paired with G70 finish"], bestFor: "Large face, disc turning, facing operations", engagement: "W = depth/pass, retract angle = R" },
];

// ─── Material data ────────────────────────────────────────────────────────────

const MATERIALS: Record<MaterialId, { name: string; Vc: number; Fz: number; ap: number; ae: number; hardness: number }> = {
  AL:   { name: "Aluminium",          Vc: 300, Fz: 0.06, ap: 0.80, ae: 0.50, hardness: 80 },
  Brass:{ name: "Brass",             Vc: 250, Fz: 0.05, ap: 0.75, ae: 0.45, hardness: 100 },
  MS:   { name: "Mild Steel",        Vc: 100, Fz: 0.04, ap: 0.70, ae: 0.15, hardness: 150 },
  CR:   { name: "CR Steel",          Vc: 90,  Fz: 0.04, ap: 0.70, ae: 0.12, hardness: 180 },
  CI:   { name: "Cast Iron",         Vc: 110, Fz: 0.05, ap: 0.65, ae: 0.30, hardness: 200 },
  HSLA: { name: "HSLA Steel",        Vc: 75,  Fz: 0.03, ap: 0.60, ae: 0.10, hardness: 260 },
  SS:   { name: "Stainless 304",     Vc: 60,  Fz: 0.03, ap: 0.55, ae: 0.08, hardness: 200 },
  Ti:   { name: "Titanium Ti-6Al-4V",Vc: 45,  Fz: 0.02, ap: 0.40, ae: 0.05, hardness: 340 },
};

// ─── G-code generators ────────────────────────────────────────────────────────

function genAdaptive(toolDia: number, mat: MaterialId, depth: number, pocketW: number, pocketL: number, postProc: PostProc): string {
  const m = MATERIALS[mat];
  const Vc = m.Vc; const Fz = m.Fz;
  const rpm = Math.round((1000 * Vc) / (Math.PI * toolDia));
  const ae = toolDia * m.ae;
  const ap = toolDia * m.ap;
  const feed = Math.round(rpm * Fz * 4); // 4 flutes
  const passes = Math.ceil(depth / ap);
  const helix_r = toolDia * 0.3;

  if (postProc === "siemens840d") return `; ADAPTIVE CLEARING — SIEMENS 840D
; Tool: D${toolDia}mm | Mat: ${MATERIALS[mat].name}
G71 G18 G40 G94 G90
T1 D1
G00 G17 G90
M03 S${rpm} G96 LIMS=${rpm + 200}
M08
; --- HELICAL ENTRY ---
G00 X${(pocketW/2).toFixed(2)} Y${(pocketL/2).toFixed(2)} Z5.0
${Array.from({length: passes}, (_, i) => {
  const z = -ap * (i+1);
  return `; Pass ${i+1} — Z${z.toFixed(2)}
POCKET3(RTP=5, RFP=0, SDIS=2, DP=${Math.abs(z).toFixed(2)}, LENG=${pocketL}, WID=${pocketW}, CRAD=${(toolDia*0.4).toFixed(2)}, FAL=0.2, FALD=0.1, FFD=${feed}, FFF=${Math.round(feed*0.6)}, VARI=0, MIDA=${ae.toFixed(2)})`;
}).join("\n")}
G00 Z50.0
M05 M09
M30`;

  if (postProc === "heidenhain") return `BEGIN PGM ADAPTIVE MM
; Tool: T${toolDia}R${(toolDia/2).toFixed(1)} | ${MATERIALS[mat].name}
TOOL CALL 1 Z S${rpm}
L Z+50 R0 FMAX
M13                      ; Spindle + Coolant
; --- CYCL DEF 256 RECTANGULAR POCKET ---
CYCL DEF 256 RECTANGULAR POCKET ~
  Q218=${pocketL} ~   ; LENGTH
  Q219=${pocketW} ~   ; WIDTH
  Q368=0.2 ~            ; FINISH ALLOW
  Q224=0 ~              ; ROTATION
  Q315=${feed} ~        ; FEED ROUGH
  Q316=${Math.round(feed*0.6)} ~ ; FEED FINISH
  Q300=${depth} ~       ; DEPTH
  Q333=${ap.toFixed(2)} ; MAX DEPTH CUT
CYCL CALL
M05 M09
END PGM ADAPTIVE MM`;

  const machineComment = postProc === "haas" ? "(HAAS NGC)" : postProc === "mazak" ? "(MAZAK SMOOTH)" : "(FANUC 0i-MD)";
  return `%
${postProc === "haas" ? "O00001" : "O0001"} (ADAPTIVE CLEARING — ${MATERIALS[mat].name.toUpperCase()})
${machineComment}
(TOOL: D${toolDia}mm ENDMILL — 4 FLUTE)
(Vc=${Vc} m/min | Fz=${Fz}mm/t | Ap=${ap.toFixed(1)}mm | Ae=${ae.toFixed(1)}mm)
(EST. CYCLE TIME: ${Math.round(passes * pocketW * pocketL / (feed * ae / toolDia))}min)
${postProc === "haas" ? "G21 G17 G40 G49 G80 G90 G94" : "G21 G17 G40 G80 G90 G94"}
T${postProc === "haas" ? "1 M06" : "01"}
G43 H01 Z100.0
G00 X${(pocketW/2).toFixed(2)} Y${(pocketL/2).toFixed(2)}
M03 S${rpm}
M08
; --- HELICAL PLUNGE (avoid direct plunge) ---
G00 Z5.0
${Array.from({length: passes}, (_, i) => {
  const zTop = -ap * i;
  const zBot = -ap * (i+1);
  return `; === PASS ${i+1}/${passes} — Z${zBot.toFixed(2)} ===
G03 X${(pocketW/2 + helix_r).toFixed(2)} Y${(pocketL/2).toFixed(2)} Z${zBot.toFixed(2)} I${helix_r.toFixed(2)} J0 F${Math.round(feed*0.4)}
G01 X${(ae).toFixed(2)} F${feed}
G01 Y${(pocketL - ae).toFixed(2)}
G01 X${(pocketW - ae).toFixed(2)}
G01 Y${(ae).toFixed(2)}
G01 X${(ae*2).toFixed(2)}
; (Adaptive step: ae=${ae.toFixed(1)}mm = ${Math.round(m.ae*100)}% D)`;
}).join("\n")}
G00 Z100.0
M05
M09
G91 G28 Z0.
${postProc === "haas" ? "G28 X0. Y0." : "G28 U0."}
M30
%`;
}

function genTrochoidal(toolDia: number, mat: MaterialId, slotW: number, slotL: number, postProc: PostProc): string {
  const m = MATERIALS[mat];
  const rpm = Math.round((1000 * m.Vc) / (Math.PI * toolDia));
  const feed = Math.round(rpm * m.Fz * 4);
  const stepAlong = toolDia * 0.5;
  const circleR = toolDia * 0.55;
  const steps = Math.ceil(slotL / stepAlong);
  return `%
O0002 (TROCHOIDAL MILLING — ${MATERIALS[mat].name.toUpperCase()})
(SLOT: W${slotW}mm × L${slotL}mm)
(TOOL: D${toolDia}mm — Circle radius = ${circleR.toFixed(1)}mm)
G21 G17 G40 G90
T02
G43 H02 Z100.0
G00 X${(slotW/2).toFixed(2)} Y0 S${rpm} M03
M08
G00 Z2.0
G01 Z-${(toolDia * 0.8).toFixed(1)} F${Math.round(feed * 0.3)}
; --- TROCHOIDAL PASSES ---
${Array.from({length: Math.min(steps, 12)}, (_, i) => {
  const cy = stepAlong * i;
  return `G03 X${(slotW/2 + circleR).toFixed(2)} Y${cy.toFixed(2)} I${circleR.toFixed(2)} J0 F${feed}
G03 X${(slotW/2).toFixed(2)} Y${(cy + stepAlong).toFixed(2)} I${(-circleR).toFixed(2)} J0 F${feed}`;
}).join("\n")}
G01 Z50.0 F3000
M05 M09
G28 U0. W0.
M30
%`;
}

function genG71(toolDia: number, mat: MaterialId, dia: number, length: number, postProc: PostProc): string {
  const m = MATERIALS[mat];
  const rpm = Math.round((1000 * m.Vc) / (Math.PI * dia));
  const roughFeed = m.Fz * 5;
  const finFeed = m.Fz * 2;
  const depth = 2.0;
  const ctrl = postProc === "siemens840d" ? "SIEMENS 840D" : postProc === "haas" ? "HAAS" : postProc === "mazak" ? "MAZAK" : "FANUC";
  return `%
O0003 (G71 OD ROUGHING + G70 FINISH — ${MATERIALS[mat].name.toUpperCase()})
(CONTROLLER: ${ctrl})
(DIA: Ø${dia}mm | LENGTH: ${length}mm | TOOL: ${toolDia}mm CCMT)
G21 G18 G40 G97 G99
T0101 (OD ROUGHING CNMG${toolDia < 20 ? "120408" : "160608"})
G96 S${Math.round(m.Vc)} M03
M08
G00 X${(dia + 10).toFixed(1)} Z5.0
; --- G71 ROUGHING CYCLE ---
G71 U${depth.toFixed(1)} R0.5
G71 P10 Q80 U0.3 W0.1 F${roughFeed.toFixed(3)}
; --- CONTOUR DEFINITION (N10 to N80) ---
N10 G00 X${(dia * 0.4).toFixed(1)}
    G01 Z0 F${finFeed.toFixed(3)}
    G01 X${(dia * 0.5).toFixed(1)} Z-2.5
    G01 Z-${(length * 0.3).toFixed(1)}
    G02 X${(dia * 0.65).toFixed(1)} Z-${(length * 0.35).toFixed(1)} R${(dia*0.075).toFixed(1)}
    G01 Z-${(length * 0.7).toFixed(1)}
    G01 X${(dia * 0.85).toFixed(1)} Z-${(length * 0.85).toFixed(1)}
N80 G01 X${(dia + 5).toFixed(1)}
; --- G70 FINISH PASS ---
G70 P10 Q80 F${finFeed.toFixed(3)} S${Math.round(m.Vc * 1.3)}
G00 X${(dia + 30).toFixed(1)} Z50.0
M05 M09
; --- GROOVING (optional) ---
T0202 (GROOVE TOOL 3mm)
G97 S${Math.min(rpm, 800)} M03
G00 X${(dia + 5).toFixed(1)} Z-${(length * 0.45).toFixed(1)}
G01 X${(dia * 0.55).toFixed(1)} F0.04
G04 P300
G01 X${(dia + 5).toFixed(1)} F0.3
G00 X${(dia + 30).toFixed(1)} Z50.0
M05 M09
G28 U0. W0.
M30
%`;
}

function genG76(pitch: number, majorDia: number, length: number, postProc: PostProc): string {
  const minorDia = majorDia - 1.0825 * pitch;
  const threadDepth = (majorDia - minorDia) / 2;
  const ctrl = postProc === "siemens840d" ? `; SIEMENS 840D — USE CYCLE97 INSTEAD\n; CYCLE97(TP=${pitch}, TDEP=${threadDepth.toFixed(3)}, IANG=30, NST=5, NWT=2, VARI=1)` : "";
  return `%
O0004 (G76 THREADING CYCLE — M${majorDia}×${pitch})
(CONTROLLER: ${postProc.toUpperCase()})
(MAJOR Ø: ${majorDia}mm | MINOR Ø: ${minorDia.toFixed(3)}mm | PITCH: ${pitch}mm)
(THREAD DEPTH: ${threadDepth.toFixed(3)}mm | LENGTH: ${length}mm)
${ctrl}
G21 G18 G40 G97 G99
T0303 (THREADING TOOL 60°)
G97 S${Math.min(Math.round(600 / pitch), 1200)} M03
M08
G00 X${(majorDia + 5).toFixed(1)} Z5.0
; --- G76 THREADING CYCLE ---
; P = spring passes | thread angle | min infeed
; Q = minimum depth of cut (×0.001mm)
; R = finish allowance (×0.001mm)
G76 P030060 Q${Math.round(threadDepth * 0.1 * 1000)} R${Math.round(0.05 * 1000)}
; X = minor diameter | Z = thread end | P = depth×1000 | Q = 1st infeed×1000 | F = pitch
G76 X${minorDia.toFixed(3)} Z-${length.toFixed(1)} P${Math.round(threadDepth * 1000)} Q${Math.round(threadDepth * 0.4 * 1000)} F${pitch.toFixed(3)}
G00 X${(majorDia + 30).toFixed(1)} Z50.0
M05 M09
G28 U0. W0.
M30
%
; ─── THREAD VERIFICATION ────────────────────────
; Major dia: ${majorDia}.000 mm
; Minor dia: ${minorDia.toFixed(3)} mm
; Pitch:     ${pitch} mm
; Depth:     ${threadDepth.toFixed(3)} mm
; Go gauge:  ${(majorDia - 0.015).toFixed(3)} mm
; No-go:     ${(majorDia + 0.015).toFixed(3)} mm`;
}

function ToolpathCanvas({ id, toolDia, pocketW = 200, pocketL = 150 }: { id: StrategyId; toolDia: number; pocketW?: number; pocketL?: number }) {
  const W = 360, H = 220;
  const cx = W / 2, cy = H / 2;

  const strategyElements: React.ReactNode[] = [];

  if (id === "adaptive") {
    strategyElements.push(<rect key="bnd" x={40} y={30} width={W - 80} height={H - 60} fill="none" stroke="rgba(255,255,255,0.07)" />);
    for (let p = 0; p < 7; p++) {
      const off = 18 + p * 15;
      const pts: string[] = [];
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const ripple = Math.sin(a * 6 + p * 1.1) * 2;
        pts.push(`${cx + (off + ripple) * Math.cos(a)},${cy + (off + ripple) * Math.sin(a) * 0.7}`);
      }
      strategyElements.push(<polygon key={`ad${p}`} points={pts.join(" ")} fill="none" stroke={`hsla(${155 + p * 15}, 65%, 52%, 0.85)`} strokeWidth={1.8} />);
    }
  } else if (id === "trochoidal") {
    strategyElements.push(<rect key="sl" x={40} y={cy - 28} width={W - 80} height={56} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />);
    for (let i = 0; i < 7; i++) {
      const x0 = 65 + i * 30;
      strategyElements.push(<circle key={`tc${i}`} cx={x0} cy={cy} r={22} fill="none" stroke={`hsla(${200 + i * 12}, 70%, 58%, 0.9)`} strokeWidth={1.8} />);
      strategyElements.push(<circle key={`td${i}`} cx={x0 + 7} cy={cy - 7} r={5} fill={`hsla(${200 + i * 12}, 80%, 65%, 0.8)`} />);
    }
    strategyElements.push(<text key="tl" x={42} y={cy + 42} fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="sans-serif">arc r = 55% D</text>);
  } else if (id === "contour") {
    [0, 18, 36, 54, 72].forEach((off, i) => {
      strategyElements.push(<rect key={`co${i}`} x={40 + off} y={30 + off} width={W - 80 - off * 2} height={H - 60 - off * 2} rx={4} fill="none" stroke={`rgba(245,158,11,${0.9 - i * 0.15})`} strokeWidth={1.5} />);
    });
  } else if (id === "spiral") {
    const pts: string[] = [];
    for (let a = 0, r = 3; a < Math.PI * 14; a += 0.05, r += 0.85) {
      if (r > Math.min(cx, cy) - 30) break;
      pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a) * 0.7}`);
    }
    strategyElements.push(<polyline key="sp" points={pts.join(" ")} fill="none" stroke="rgba(167,139,250,0.85)" strokeWidth={1.8} />);
  } else if (id === "hsm") {
    for (let i = 0; i < 7; i++) {
      const y0 = 35 + i * (H - 70) / 7;
      strategyElements.push(<line key={`hs${i}`} x1={45} y1={y0} x2={W - 45} y2={y0} stroke={`rgba(96,165,250,${0.9 - i * 0.08})`} strokeWidth={2} />);
    }
    strategyElements.push(<text key="hsl" x={44} y={H - 10} fill="#60a5fa" fontSize="9" fontWeight="bold" fontFamily="sans-serif">High-speed — light ap, heavy Ae</text>);
  } else if (id === "pencil") {
    strategyElements.push(<rect key="pb" x={40} y={30} width={W - 80} height={H - 60} fill="none" stroke="rgba(255,255,255,0.06)" />);
    [[40, 30], [W - 40, 30], [W - 40, H - 30], [40, H - 30]].forEach(([x, y], i) => {
      strategyElements.push(<circle key={`pc${i}`} cx={x} cy={y} r={18} fill="none" stroke="rgba(251,191,36,0.8)" strokeWidth={2} />);
      strategyElements.push(<circle key={`pd${i}`} cx={x} cy={y} r={4} fill="#fbbf24" />);
    });
  } else if (id === "g71rough" || id === "g71finish" || id === "g72face") {
    const lines = id === "g72face" ? 6 : 7;
    for (let i = 0; i < lines; i++) {
      const col = id === "g71rough" ? `rgba(245,158,11,${0.9 - i * 0.1})` : id === "g71finish" ? `rgba(52,211,153,${0.9 - i * 0.05})` : `rgba(96,165,250,${0.9 - i * 0.09})`;
      if (id === "g72face") {
        strategyElements.push(<line key={`gl${i}`} x1={50} y1={35 + i * 18} x2={W - 50} y2={35 + i * 18} stroke={col} strokeWidth={1.8} />);
      } else {
        const x = 50 + i * 22;
        strategyElements.push(<line key={`gl${i}`} x1={x} y1={35} x2={x} y2={H - 35} stroke={col} strokeWidth={1.8} />);
      }
    }
    const profileD = "M50,35 L70,50 L80," + H / 2 + " L90," + (H - 60) + " L" + (W - 50) + "," + (H - 40);
    strategyElements.push(<path key="prof" d={profileD} fill="none" stroke="#34d399" strokeWidth={2.5} />);
  } else if (id === "g76thread") {
    for (let i = 0; i < 6; i++) {
      const y = 50 + i * (H - 80) / 5;
      strategyElements.push(<line key={`thr${i}`} x1={50} y1={y} x2={W - 50} y2={y - (i + 1) * 5} stroke={`rgba(167,139,250,${0.9 - i * 0.1})`} strokeWidth={1.8} />);
      const teeth: string[] = [];
      for (let x = 65; x < W - 55; x += 18) {
        teeth.push(`M${x},${y - i * 4} L${x + 9},${y - i * 4 - 8} L${x + 18},${y - i * 4}`);
      }
      strategyElements.push(<path key={`tt${i}`} d={teeth.join(" ")} fill="none" stroke="rgba(167,139,250,0.5)" strokeWidth={1} />);
    }
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 10, display: "block", background: "#07090f" }}>
      {strategyElements}
      <circle cx={cx + 6} cy={cy - 10} r={8} fill="rgba(245,158,11,0.9)" stroke="#fff" strokeWidth={1.5} />
      <text x={cx + 16} y={cy - 6} fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="sans-serif">● Tool</text>
    </svg>
  );
}

// ─── Post-processor selector ──────────────────────────────────────────────────

const PP_INFO: Record<PostProc, { name: string; color: string; maker: string }> = {
  fanuc:      { name: "Fanuc 0i / 32i-B",   color: "#f59e0b", maker: "FANUC" },
  siemens840d:{ name: "SINUMERIK 840D sl",  color: "#60a5fa", maker: "SIEMENS" },
  haas:       { name: "Haas NGC",            color: "#34d399", maker: "HAAS" },
  mazak:      { name: "Mazatrol Smooth-X",   color: "#a78bfa", maker: "MAZAK" },
  heidenhain: { name: "Heidenhain TNC640",   color: "#fb923c", maker: "HEIDENHAIN" },
};

// ─── Main View ────────────────────────────────────────────────────────────────

export function AdvancedCAMView() {
  const [stratId, setStratId] = useState<StrategyId>("adaptive");
  const [postProc, setPostProc] = useState<PostProc>("fanuc");
  const [mat, setMat] = useState<MaterialId>("MS");
  const [toolDia, setToolDia] = useState(16);
  const [depth, setDepth] = useState(20);
  const [pocketW, setPocketW] = useState(80);
  const [pocketL, setPocketL] = useState(60);
  const [threadPitch, setThreadPitch] = useState(2.0);
  const [threadMajor, setThreadMajor] = useState(30);
  const [threadLen, setThreadLen] = useState(25);
  const [gcode, setGcode] = useState("");
  const [copied, setCopied] = useState(false);
  const [tabFilter, setTabFilter] = useState<"all" | "mill" | "turn">("all");

  const strat = STRATEGIES.find(s => s.id === stratId) ?? STRATEGIES[0];
  const matData = MATERIALS[mat];
  const rpm = Math.round((1000 * matData.Vc) / (Math.PI * toolDia));
  const feed = Math.round(rpm * matData.Fz * 4);
  const ap = toolDia * matData.ap;
  const ae = toolDia * matData.ae;
  const mrr = (ae * ap * feed) / 1000;

  function generateGCode() {
    let code = "";
    if (stratId === "adaptive") code = genAdaptive(toolDia, mat, depth, pocketW, pocketL, postProc);
    else if (stratId === "trochoidal") code = genTrochoidal(toolDia, mat, pocketW, pocketL, postProc);
    else if (stratId === "contour" || stratId === "pencil" || stratId === "spiral" || stratId === "hsm")
      code = genAdaptive(toolDia, mat, depth, pocketW, pocketL, postProc).replace("ADAPTIVE CLEARING", stratId.toUpperCase().replace(/-/g," "));
    else if (stratId === "g71rough" || stratId === "g71finish")
      code = genG71(toolDia, mat, pocketW * 2, pocketL * 2, postProc);
    else if (stratId === "g76thread")
      code = genG76(threadPitch, threadMajor, threadLen, postProc);
    else if (stratId === "g72face")
      code = genG71(toolDia, mat, pocketW * 2, pocketL * 2, postProc).replace("G71", "G72").replace("OD ROUGHING", "FACE ROUGHING");
    setGcode(code);
  }

  function copyCode() { navigator.clipboard.writeText(gcode); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  function downloadCode() {
    const ext = postProc === "siemens840d" ? "mpf" : postProc === "heidenhain" ? "h" : "nc";
    const b = new Blob([gcode], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b);
    a.download = `SAI_${stratId}_${mat}.${ext}`; a.click();
  }

  const filtered = STRATEGIES.filter(s => tabFilter === "all" || s.type === tabFilter);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "260px 1fr", overflow: "hidden", background: "#070710" }}>
      {/* LEFT: Strategy list */}
      <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #2563eb,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>
              <Cpu style={{ width: 18, height: 18, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>Advanced CAM</div>
              <div style={{ fontSize: 10, color: "#52525b" }}>iMachining-style Pro</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {(["all", "mill", "turn"] as const).map(f => (
              <button key={f} onClick={() => setTabFilter(f)}
                style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: tabFilter === f ? "rgba(37,99,235,0.2)" : "transparent", color: tabFilter === f ? "#60a5fa" : "#52525b" }}>
                {f === "all" ? "All" : f === "mill" ? "Mill" : "Turn"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {filtered.map(s => (
            <div key={s.id} onClick={() => setStratId(s.id)}
              style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", background: stratId === s.id ? "rgba(37,99,235,0.09)" : "transparent", borderLeft: stratId === s.id ? "3px solid #3b82f6" : "3px solid transparent", transition: "all 0.1s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 15 }}>{s.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: stratId === s.id ? "#60a5fa" : "#c4c4cc" }}>{s.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 800, color: s.type === "mill" ? "#a78bfa" : "#fbbf24", background: s.type === "mill" ? "rgba(167,139,250,0.1)" : "rgba(245,158,11,0.1)", padding: "1px 5px", borderRadius: 99, letterSpacing: "0.05em" }}>{s.type.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 10, color: "#52525b", lineHeight: 1.4 }}>{s.shortDesc.slice(0, 70)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Detail + G-code */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar: post-processor */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Post-Processor:</span>
          {(Object.keys(PP_INFO) as PostProc[]).map(p => (
            <button key={p} onClick={() => setPostProc(p)}
              style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${postProc === p ? PP_INFO[p].color + "55" : "rgba(255,255,255,0.06)"}`, background: postProc === p ? PP_INFO[p].color + "15" : "transparent", color: postProc === p ? PP_INFO[p].color : "#52525b", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
              {PP_INFO[p].maker}
            </button>
          ))}
          <span style={{ fontSize: 10, color: "#3f3f46", marginLeft: 4 }}>{PP_INFO[postProc].name}</span>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {/* Strategy header */}
          <div style={{ borderRadius: 14, padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 26 }}>{strat.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{strat.name}</div>
                    <div style={{ fontSize: 11, color: "#71717a" }}>{strat.bestFor}</div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 10px", lineHeight: 1.6 }}>{strat.shortDesc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {strat.adv.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.12)" }}>
                      <CheckCircle style={{ width: 10, height: 10, color: "#34d399" }} />
                      <span style={{ fontSize: 10, color: "#a1a1aa" }}>{a}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.15)", fontSize: 11, color: "#a1a1aa" }}>
                  <span style={{ fontWeight: 700, color: "#60a5fa" }}>Engagement: </span>{strat.engagement}
                </div>
              </div>
              <div style={{ width: 220, flexShrink: 0 }}>
                <ToolpathCanvas id={stratId} toolDia={toolDia} pocketW={pocketW} pocketL={pocketL} />
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div style={{ borderRadius: 14, padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Settings style={{ width: 13, height: 13, color: "#52525b" }} />Parameters
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#52525b", marginBottom: 3, textTransform: "uppercase" }}>Material</div>
                <select value={mat} onChange={e => setMat(e.target.value as MaterialId)}
                  style={{ width: "100%", padding: "7px 6px", borderRadius: 7, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.09)", color: "#e4e4e7", fontSize: 11, outline: "none" }}>
                  {(Object.entries(MATERIALS)).map(([k, v]) => <option key={k} value={k}>{k} — {v.name}</option>)}
                </select>
              </div>
              {[
                { label: "Tool Ø (mm)", val: toolDia, set: setToolDia, min: 2, max: 80 },
                strat.type === "turn" && stratId === "g76thread"
                  ? { label: "Pitch (mm)", val: threadPitch, set: setThreadPitch, min: 0.5, max: 6, step: 0.25 }
                  : { label: "Depth (mm)", val: depth, set: setDepth, min: 1, max: 200 },
                strat.type === "turn" && stratId === "g76thread"
                  ? { label: "Major Ø (mm)", val: threadMajor, set: setThreadMajor, min: 6, max: 200 }
                  : { label: strat.type === "turn" ? "Part Ø (mm)" : "Pocket W (mm)", val: pocketW, set: setPocketW, min: 10, max: 500 },
                strat.type === "turn" && stratId === "g76thread"
                  ? { label: "Thread L (mm)", val: threadLen, set: setThreadLen, min: 5, max: 200 }
                  : { label: strat.type === "turn" ? "Part L (mm)" : "Pocket L (mm)", val: pocketL, set: setPocketL, min: 10, max: 500 },
              ].filter(Boolean).map((inp: any, i) => (
                <div key={i}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#52525b", marginBottom: 3, textTransform: "uppercase" }}>{inp.label}</div>
                  <input type="number" value={inp.val} min={inp.min} max={inp.max} step={inp.step ?? 1}
                    onChange={e => inp.set(parseFloat(e.target.value) || 0)}
                    style={{ width: "100%", padding: "7px 6px", borderRadius: 7, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.09)", color: "#e4e4e7", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>

            {/* Cutting params */}
            {strat.type === "mill" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {[
                  { label: "Vc (m/min)", value: matData.Vc.toFixed(0), color: "#60a5fa" },
                  { label: "RPM", value: rpm.toLocaleString(), color: "#f59e0b" },
                  { label: "Feed (mm/min)", value: feed.toLocaleString(), color: "#34d399" },
                  { label: "Fz (mm/t)", value: matData.Fz.toFixed(3), color: "#a78bfa" },
                  { label: "Ap (mm)", value: ap.toFixed(2), color: "#fb923c" },
                  { label: "Ae (mm)", value: ae.toFixed(2), color: "#34d399" },
                  { label: "MRR (cm³/min)", value: mrr.toFixed(1), color: "#f87171" },
                  { label: "Est. passes", value: Math.ceil(depth / ap).toString(), color: "#71717a" },
                ].map((r, i) => (
                  <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${r.color}20`, textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#52525b", marginBottom: 1 }}>{r.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: r.color }}>{r.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* G-code output */}
          <div style={{ borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Generated G-Code</span>
              <span style={{ fontSize: 10, color: "#52525b" }}>{PP_INFO[postProc].name}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {gcode && <>
                  <button onClick={copyCode} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.03)", color: copied ? "#34d399" : "#a1a1aa", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                  <button onClick={downloadCode} style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: "rgba(37,99,235,0.15)", color: "#60a5fa", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    Download .{postProc === "siemens840d" ? "mpf" : postProc === "heidenhain" ? "h" : "nc"}
                  </button>
                </>}
                <button onClick={generateGCode}
                  style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "linear-gradient(90deg, #2563eb, #1d4ed8)", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Play style={{ width: 11, height: 11 }} />Generate
                </button>
              </div>
            </div>
            {gcode ? (
              <pre style={{ margin: 0, padding: "14px 16px", fontFamily: "monospace", fontSize: 11.5, color: "#34d399", background: "#08091a", overflow: "auto", maxHeight: 340, lineHeight: 1.75 }}>{gcode}</pre>
            ) : (
              <div style={{ padding: 30, textAlign: "center", color: "#3f3f46", fontSize: 12 }}>
                Configure parameters and click <strong style={{ color: "#60a5fa" }}>Generate</strong> to create G-code
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
