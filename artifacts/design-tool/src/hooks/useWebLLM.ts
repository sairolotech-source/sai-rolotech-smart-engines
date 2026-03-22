import { useState, useRef, useCallback } from "react";
import { DOMAIN_SYSTEM_PROMPT } from "../lib/domain-system-prompt";
import { EXPANDED_KB } from "../lib/offline-ai-kb-expanded";

export type WebLLMStatus =
  | "idle"
  | "checking"
  | "not_supported"
  | "not_downloaded"
  | "downloading"
  | "loading"
  | "ready"
  | "ready_cpu"
  | "error";

export interface WebLLMState {
  status: WebLLMStatus;
  progress: number;
  progressText: string;
  error: string | null;
  timeoutCountdown: number | null;
  vramWarning: string | null;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const MODEL_ID = "Phi-3.5-mini-instruct-q4f16_1-MLC";
const INIT_TIMEOUT_SECONDS = 90;

let engineInstance: unknown = null;
let activeAttemptId = 0;
let cpuFallbackActive = false;

interface CpuKBEntry {
  patterns: RegExp[];
  keywords: string[];
  response: string;
}

const CPU_KB_CORE: CpuKBEntry[] = [
  {
    patterns: [/springback/i, /spring\s*back/i],
    keywords: ["springback", "overbend", "compensation"],
    response: `**Springback Compensation — Expert Guide**

Springback is the elastic recovery of the strip after bending. The overbend percentage depends on material:

| Material | Springback Factor | Overbend % |
|----------|------------------|------------|
| GI | 1.05× | +5% |
| MS (Mild Steel) | 1.06× | +6% |
| CR (Cold Rolled) | 1.08× | +8% |
| HR (Hot Rolled) | 1.12× | +12% |
| AL (Aluminium) | 1.15× | +15% |
| SS 304 | 1.20× | +20% |
| Duplex SS 2205 | 1.24× | +24% |
| Titanium Gr2 | 1.25× | +25% |
| Inconel 625 | 1.28× | +28% |
| Spring Steel | 1.30× | +30% |
| Ti-6Al-4V | 1.35× | +35% |

**Key Rules:**
- Always add 2-3 calibration stations at the end
- For SS: NEVER stop the line mid-run (differential cooling = uneven springback)
- For AHSS (DP/TRIP): springback is non-linear — use FEA prediction
- Formula: Springback angle = (Yield × t) / (2 × E × R) × (180/π)`
  },
  {
    patterns: [/defect|bow|camber|twist|edge\s*wave|flare|crack|oil\s*can/i],
    keywords: ["defect", "bow", "camber", "twist", "edge wave", "flare", "crack", "oil canning"],
    response: `**Roll Forming Defects — Quick Diagnosis**

| Defect | Root Cause | Fix |
|--------|-----------|-----|
| **BOW** (longitudinal curve) | Unequal top/bottom strain | Equalize roll pressure, check pass line ±0.1mm |
| **CAMBER** (lateral curve) | Unequal left/right strain | Center strip, check roll alignment symmetry |
| **TWIST** (helical) | Shafts not parallel, asymmetric profile | Laser-align shafts ±0.05mm/m, add twist-correction rolls |
| **EDGE WAVE** | Roll gap too tight, >15°/station | Open gap 0.1-0.15mm, max 12° increment |
| **FLARE** (end flare) | Springback at flange | Close final gap to t+0.05mm, add calibration pass |
| **CRACKING** | r/t below minimum, cold material | Increase bend radius, warm material to room temp |
| **OIL CANNING** | Web too wide vs thickness | Max web = 100×t (GI), add stiffener rib |
| **SURFACE MARKING** | Rough rolls Ra>0.8µm | Polish rolls to Ra 0.4-0.8µm, add lubricant |

**CRITICAL defects (stop line immediately):** Twist, Cracking
Always check: strip centering → roll gap → shaft parallelism → lubrication`
  },
  {
    patterns: [/g71|g70|g76|g-?code|g\s*code|roughing\s*cycle|threading\s*cycle|cnc\s*program/i],
    keywords: ["g71", "g70", "g76", "g-code", "roughing", "threading", "cnc program"],
    response: `**CNC G-Code Quick Reference — Turning**

**G71 — OD Roughing Cycle (Stock Removal)**
\`\`\`
G71 U2.0 R0.5        (DOC=2mm, retract=0.5mm)
G71 P100 Q200 U0.5 W0.1 F0.25  (profile P-Q, finish allowance U/W)
\`\`\`

**G70 — Finish Cycle**
\`\`\`
G70 P100 Q200        (follows same profile, single finish pass)
\`\`\`

**G76 — Threading Cycle (2-block Fanuc)**
\`\`\`
G76 P010060 Q050 R0.05   (1 finish pass, 60° angle, min cut 50µm)
G76 X18.376 Z-25.0 P812 Q400 F1.5  (M20×1.5 thread)
\`\`\`
- P812 = thread height (0.812mm × 2 sides = 1.624mm on diameter)
- Q400 = first pass depth (0.4mm)

**G75 — Grooving Cycle**
\`\`\`
G75 R0.5             (retract amount)
G75 X25.0 Z-10.0 P2000 Q5000 F0.05  (groove to X25, Z-10)
\`\`\`

**Delta 2X Special Rules:**
- Use M4 (reverse spindle) — ALWAYS
- G92 S500 before G96 — RPM clamp mandatory
- NO M8/M9 coolant commands
- Tool call: T0404 () — empty parentheses`
  },
  {
    patterns: [/rpm|cutting\s*speed|vc|feed\s*rate|depth\s*of\s*cut/i],
    keywords: ["rpm", "cutting speed", "vc", "feed", "depth of cut", "speed"],
    response: `**RPM & Cutting Data Calculator**

**RPM Formula:** N = (1000 × Vc) / (π × D)
Where: Vc = cutting speed (m/min), D = workpiece diameter (mm)

**Material Cutting Data:**
| Material | Vc Rough | Vc Finish | Feed Rough | Feed Finish |
|----------|----------|-----------|------------|-------------|
| Mild Steel | 150-200 | 200-250 | 0.25-0.35 | 0.08-0.12 |
| EN8 | 120-180 | 180-220 | 0.20-0.30 | 0.06-0.10 |
| SS 304 | 80-120 | 120-150 | 0.15-0.20 | 0.05-0.08 |
| Aluminium | 250-400 | 350-500 | 0.20-0.35 | 0.10-0.15 |
| Copper | 200-350 | 300-500 | 0.20-0.35 | 0.08-0.15 |
| Titanium Gr2 | 40-60 | 60-90 | 0.10-0.18 | 0.05-0.08 |
| Inconel 625 | 15-30 | 25-45 | 0.08-0.15 | 0.03-0.06 |
| Cast Iron | 80-150 | 150-200 | 0.20-0.30 | 0.08-0.12 |

**Example:** D=50mm, Vc=200 → N = (1000×200)/(3.14159×50) = **1273 RPM**

**Surface Finish:** Ra = f²/(8×r)
At f=0.1, r=0.8mm → Ra = 0.01/6.4 = **1.56 µm** (fine finish)`
  },
  {
    patterns: [/roll\s*design|roll\s*gap|roll\s*diameter|keyway|bore|roll\s*material/i],
    keywords: ["roll design", "roll gap", "roll diameter", "keyway", "bore", "roll material"],
    response: `**Roll Design Rules — Expert Reference**

**Roll Material:** EN31 (52100) hardened to HRC 58-62
- Surface finish: Ra 0.4-0.8 µm (ground and polished)
- Bore tolerance: H7 (typically Ø50H7 or Ø60H7)

**Roll Gap Setting:**
- Standard gap = material thickness + 0.05mm clearance
- Final station (ironing): gap = thickness + 0.03mm
- Measure with feeler gauge both sides

**Roll Diameter Rules:**
- Min OD: 10× shaft diameter (for rigidity)
- Max face width: 3× OD (to prevent deflection)
- Chamfer: 1×45° on all edges

**Station Spacing:** Equal spacing ±0.5mm
**Shaft Parallelism:** ±0.05mm/meter
**Roll Runout:** Max 0.02mm TIR
**Keyway:** DIN 6885 standard

**Forming Force (Karnezis model):**
F = (σ_y × t² × w) / (2 × R) × (1 + µ × L/t)
Where σ_y=yield, t=thickness, w=web, R=bend radius, µ=friction, L=contact arc`
  },
  {
    patterns: [/material|ss\s*304|ss\s*316|alumin|copper|titanium|inconel|duplex|dp\s*\d|trip|hsla|brass/i],
    keywords: ["material", "ss304", "stainless", "aluminium", "copper", "titanium", "inconel", "duplex", "dp600", "trip", "brass"],
    response: `**Material Properties — Ultra Pro Max Database (33 Materials)**

| Material | Yield (MPa) | UTS (MPa) | K-Factor | Min R/t | Springback |
|----------|-------------|-----------|----------|---------|------------|
| MS (IS 1079 CR) | 210-260 | 340-410 | 0.38 | 1.0 | 2-4° |
| SS 304 | 210-290 | 520-720 | 0.42 | 2.0 | 5-10° |
| SS 316 | 220-290 | 520-680 | 0.42 | 2.0 | 6-11° |
| AL 6061-T6 | 275 | 310 | 0.44 | 0.5 | 1-3° |
| DP 600 | 340-420 | 590-700 | 0.33 | 2.0 | 6-12° |
| DP 780 | 450-550 | 780-900 | 0.31 | 2.5 | 8-15° |
| TRIP 780 | 450-600 | 780-900 | 0.32 | 2.0 | 7-13° |
| Copper (ETP) | 69-220 | 220-340 | 0.44 | 0.5 | 1-2° |
| Titanium Gr2 | 275-345 | 345-490 | 0.36 | 2.5 | 8-15° |
| Ti-6Al-4V | 880-950 | 950-1050 | 0.28 | 4.0 | 15-35° |
| Inconel 625 | 414-655 | 827-1034 | 0.34 | 3.5 | 12-20° |
| Duplex 2205 | 450-550 | 620-880 | 0.38 | 2.5 | 7-14° |

**Special Notes:**
- Titanium: extreme springback, warm forming preferred
- Inconel: HOT FORMING ONLY for tight bends, carbide rolls mandatory
- Magnesium: FIRE HAZARD — Class D extinguisher required
- DP/TRIP: 30-50% more stations than mild steel needed`
  },
  {
    patterns: [/corrugat|trapezoidal|purlin|c.?purlin|z.?purlin|roofing|standing\s*seam/i],
    keywords: ["corrugated", "trapezoidal", "purlin", "roofing", "standing seam", "cladding"],
    response: `**Corrugated Panels & Purlin Design**

**Corrugated Types:** Sinusoidal, Trapezoidal, Standing seam, Clip-lock
**Materials:** GI (Z120-Z275), PPGI, AL 3003/3105, Copper, Zinc

**Trapezoidal Rules:**
- Web angle: 60°-80°, Crest width ≥25mm, Valley ≥30mm
- Rib height: 25-100mm (higher = greater span)
- Min thickness: 0.40mm roofing, 0.50mm cladding
- Add stiffening ribs in flat areas >100×t to prevent oil-canning

**Purlin Design (C & Z):**
- C-Purlin: 100-300mm depth, 10-16 stations
- Z-Purlin: same depths, 12-18 stations, needs anti-twist brackets
- Material: HSLA 350-550, thickness 1.5-3.0mm
- Lip stiffener: 15° inward lip prevents local buckling
- Z-purlins can be nested for 50% shipping space savings

**Standing Seam:**
- Single-lock (180°), Double-lock (360°), Snap-lock
- Min slope: 3° (vs 10° for lapped trapezoidal)
- Fixed clip at ridge, sliding clips for thermal expansion`
  },
  {
    patterns: [/flower|station\s*count|bend\s*sequence|pass\s*line|neutral/i],
    keywords: ["flower pattern", "station count", "bend sequence", "pass line", "neutral fiber"],
    response: `**Flower Pattern Engineering**

**Station Count Formula:**
N = (Total bend angle) / (Max increment per station)
Max increment: 12-15° for MS, 8-10° for SS/AHSS, 5-8° for Titanium

**Rules:**
1. First station: max 50% of normal increment
2. Last 2-3 stations: ironing/calibration (0.5-2° adjustments only)
3. Symmetry: both sides should bend simultaneously when possible
4. Overbend: add springback compensation at each station
5. Pass line must stay constant ±0.1mm through all stations

**K-Factor:** K = δ/t (neutral axis offset / thickness)
- MS: 0.38, SS: 0.42, AL: 0.44, Copper: 0.44, Titanium: 0.36

**Bend Allowance:** BA = π × (R + K×t) × (θ/180)
**Strip Width:** W = Σ flat segments + Σ bend allowances

**Edge Strain:** ε = (L_edge - L_center) / L_center × 100%
Acceptable: <2% MS, <1.5% SS, <1% AL`
  },
  {
    patterns: [/safety|e.?stop|loto|ppe|emergency|accident/i],
    keywords: ["safety", "e-stop", "loto", "ppe", "emergency", "accident"],
    response: `**Safety Rules — Roll Forming & CNC**

**PPE Required:** Safety glasses (always), ear protection (near machine), cut-resistant gloves (strip handling), safety shoes

**E-STOP Rules:**
- Press E-STOP immediately if: unusual noise, tool break, strip jam, any injury risk
- After E-STOP: do NOT move axes until position is understood
- Re-home machine (G28 U0. W0.) after clearing

**LOTO (Lock-Out Tag-Out):**
- MANDATORY before any maintenance or roll change
- Your lock = your life. Nobody removes your lock except you.

**Strip Handling:**
- Strip edges are razor-sharp — ALWAYS wear gloves
- Never stand under crane during coil loading (500-5000 kg)
- If strip jams: STOP machine first, then remove

**CNC Safety:**
- Run new programs in single block mode first
- Always verify tool offsets before auto run
- Delta 2X: Use M4 (reverse), G92 S500 before G96
- Check coolant level daily for SS cutting`
  },
  {
    patterns: [/delta\s*2x|t2|t4|t6|t8|t10|vnmg|vaaa|tool\s*library/i],
    keywords: ["delta 2x", "t2", "t4", "t6", "t8", "t10", "vnmg", "vaaa"],
    response: `**Delta 2X Machine — Tool Library**

| Tool | Insert | IC (mm) | Radius | Feed | Purpose |
|------|--------|---------|--------|------|---------|
| T2 | VNMG 160408 | 9.52 | 0.8mm | 0.1016 | Heavy roughing/contour |
| T4 | VNMG 060108 | 3.97 | 0.8mm | 0.1016 | Fine profiling |
| T6 | VAAA 160404 | 9.52 | 0.4mm | 2.5 | Aggressive profiling |
| T8 | VNMG 060108 | 3.97 | 0.8mm | 0.1016 | Backup for T4 |
| T10 | Round 6mm | 6.0 | 3.0mm | 2.5 | OD grooving |

**Delta 2X Rules:**
- Always use M4 (reverse spindle)
- G92 S500/S1000 before G96 (RPM clamp)
- NO M8/M9 coolant commands
- Tool call format: T0404 () — empty parens
- N-number = tool number (N4 for T04)
- Trailing decimal on whole numbers: Z50. X150.

**Surface Finish:** Ra = f²/(8×r)
- VNMG (r=0.8): at f=0.1016 → Ra = 1.61 µm
- VAAA (r=0.4): at f=0.1016 → Ra = 3.22 µm`
  },
  {
    patterns: [/thread|acme|buttress|npt|worm\s*thread|multi.?start/i],
    keywords: ["thread", "acme", "buttress", "npt", "worm", "multi-start"],
    response: `**Thread Types — Complete Reference**

| Type | Angle | Standard | Application |
|------|-------|----------|-------------|
| ISO Metric (M) | 60° | ISO 261 | General purpose |
| UNC/UNF | 60° | ANSI B1.1 | US/UK imperial |
| BSP | 55° | ISO 228 | Pipe fittings |
| ACME | 29° | ASME B1.5 | Lead screws |
| Trapezoidal (Tr) | 30° | ISO 2904 | European lead screws |
| Buttress | 45°/7° | ISO 7721 | High axial load |
| NPT | 60° | ANSI B1.20.1 | Tapered pipe |

**G76 for Non-Standard Threads:**
- ACME: P010029 (change angle from 60 to 29)
- Buttress: compound infeed at 3° (shallow side)
- NPT: program X-axis taper (1:16 = 3.58°)
- Multi-start: phase shift = 360°/starts

**Thread Whirling:** 5-10× faster than single-point. Whirl head at 5000-12000 RPM. For bone screws, lead screws.`
  },
];

const CPU_KB: CpuKBEntry[] = [...CPU_KB_CORE, ...EXPANDED_KB as CpuKBEntry[]];

function cpuFallbackChat(userMessage: string, history: { role: string; content: string }[]): string {
  const q = userMessage.toLowerCase();

  for (const entry of CPU_KB) {
    for (const pattern of entry.patterns) {
      if (pattern.test(userMessage)) return entry.response;
    }
  }

  let bestMatch: CpuKBEntry | null = null;
  let bestScore = 0;
  for (const entry of CPU_KB) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch && bestScore > 3) return bestMatch.response;

  const contextHints: string[] = [];
  for (const msg of history.slice(-4)) {
    if (msg.role === "assistant") {
      for (const entry of CPU_KB) {
        for (const kw of entry.keywords) {
          if (msg.content.toLowerCase().includes(kw)) {
            contextHints.push(kw);
          }
        }
      }
    }
  }

  if (contextHints.length > 0) {
    const contextQ = contextHints.join(" ") + " " + q;
    for (const entry of CPU_KB) {
      let score = 0;
      for (const kw of entry.keywords) {
        if (contextQ.includes(kw)) score += kw.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }
    if (bestMatch && bestScore > 3) return bestMatch.response;
  }

  return `I'm running in CPU mode with a built-in knowledge base covering roll forming, CNC turning, materials, defects, G-code, and safety.

**38 Expert Domains Available — Ask anything:**
- Springback compensation for any material
- Roll forming defects (bow, camber, twist, edge wave)
- G-code cycles (G71, G70, G76, G75)
- RPM & cutting speed calculations
- Material properties (33 materials available)
- Corrugated panels & purlin design
- Flower pattern engineering
- Safety rules (LOTO, PPE, E-STOP)
- Delta 2X machine & tooling
- Thread types (ACME, Buttress, NPT)
- **Bearings** (SKF/NSK/Timken tables, L10 life)
- **Gearbox sizing** (WPA/helical/bevel, torque calc)
- **Motor & VFD selection** (kW calc, servo drives)
- **Station count** (per material & profile type)
- **Station spacing** (shaft center, frame design)
- **Roll diameter** (OD tables, bore/keyway)
- **Machine frame** (C-frame, closed, monoblock)
- **Line speed** (m/min tables, production calc)
- **Coil handling** (decoiler, straightener, mandrel)
- **Shear/cut-off** (flying shear, punch, force calc)
- **Lubrication** (forming oils, bearing grease)
- **Tolerances & QC** (DIN EN 10162, SPC, Cpk)
- **Welding/ERW** (tube mill, seam, spot weld)
- **Surface finish** (GI, PPGI, chrome, PVD)
- **Maintenance** (PM schedule, spare parts)
- **Cost & ROI** (machine pricing, payback calc)
- **Standards** (DIN/ISO/IS/ASTM/JIS reference)
- **Electrical/PLC** (Siemens/Mitsubishi, sensors, HMI)
- **C-Channel design** (full forming sequence, machine specs)
- **Strip width calc** (K-factor table, bend allowance)
- **Forming force** (Karnezis model, motor sizing)
- **Heat treatment** (HRC, tempering, PVD/TiN)
- **Shaft & keyway** (DIN 6885, coupling types)
- **Entry/exit guides** (straightener, feed design)
- **ISO 9001** (documentation, traceability, audit)

Offline AI — 100% Local, Zero Internet Required.`;
}

export function useWebLLM() {
  const [state, setState] = useState<WebLLMState>({
    status: "idle",
    progress: 0,
    progressText: "",
    error: null,
    timeoutCountdown: null,
    vramWarning: null,
  });

  const abortRef = useRef<boolean>(false);

  const checkSupport = useCallback((): boolean => {
    if (typeof navigator === "undefined") return false;
    if (!("gpu" in navigator)) return false;
    return true;
  }, []);

  const checkVram = useCallback(async (): Promise<{ ok: boolean; warning: string | null }> => {
    try {
      if (!("gpu" in navigator)) return { ok: true, warning: null };
      const gpu = (navigator as unknown as { gpu: { requestAdapter: () => Promise<{ limits?: { maxBufferSize?: number } } | null> } }).gpu;
      const adapter = await gpu.requestAdapter();
      if (!adapter) return { ok: true, warning: null };
      const limits = adapter.limits;
      if (!limits) return { ok: true, warning: null };
      const maxBuffer = limits.maxBufferSize;
      if (typeof maxBuffer === "number") {
        const estimatedVramGB = maxBuffer / (1024 * 1024 * 1024);
        if (estimatedVramGB < 2) {
          return {
            ok: false,
            warning: `Low GPU memory detected (~${estimatedVramGB.toFixed(1)} GB). The AI model requires at least 2 GB of VRAM. Loading may fail or cause browser instability.`,
          };
        }
      }
      return { ok: true, warning: null };
    } catch {
      return { ok: true, warning: null };
    }
  }, []);

  const singleAttempt = useCallback(async (
    webllm: { CreateMLCEngine: (id: string, opts: unknown) => Promise<unknown> },
    attemptId: number,
  ): Promise<{ success: boolean; engine?: unknown; timedOut: boolean }> => {
    const isStale = () => activeAttemptId !== attemptId || abortRef.current;

    let localTimedOut = false;
    let localTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let localCountdownHandle: ReturnType<typeof setInterval> | null = null;

    const cleanupLocal = () => {
      if (localTimeoutHandle) { clearTimeout(localTimeoutHandle); localTimeoutHandle = null; }
      if (localCountdownHandle) { clearInterval(localCountdownHandle); localCountdownHandle = null; }
    };

    return new Promise<{ success: boolean; engine?: unknown; timedOut: boolean }>((resolve) => {
      let settled = false;
      const settle = (result: { success: boolean; engine?: unknown; timedOut: boolean }) => {
        if (settled) return;
        settled = true;
        cleanupLocal();
        resolve(result);
      };

      let secondsLeft = INIT_TIMEOUT_SECONDS;
      localCountdownHandle = setInterval(() => {
        secondsLeft -= 1;
        if (!isStale()) {
          setState((prev) => ({ ...prev, timeoutCountdown: secondsLeft }));
        }
      }, 1000);

      localTimeoutHandle = setTimeout(() => {
        localTimedOut = true;
        settle({ success: false, timedOut: true });
      }, INIT_TIMEOUT_SECONDS * 1000);

      webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          if (isStale() || localTimedOut) return;
          const pct = Math.round((report.progress ?? 0) * 100);
          setState((prev) => ({
            ...prev,
            status: pct >= 100 ? "loading" : "downloading",
            progress: pct,
            progressText: report.text ?? `Loading… ${pct}%`,
            error: null,
          }));
        },
      })
        .then((engine) => {
          if (isStale() || localTimedOut) return;
          settle({ success: true, engine, timedOut: false });
        })
        .catch(() => {
          if (isStale() || localTimedOut) return;
          settle({ success: false, timedOut: false });
        });
    });
  }, []);

  const initialize = useCallback(async () => {
    if (state.status === "ready" || state.status === "ready_cpu" || state.status === "downloading" || state.status === "loading") return;

    if (!checkSupport()) {
      cpuFallbackActive = true;
      setState({ status: "ready_cpu", progress: 100, progressText: "CPU Mode — Domain Knowledge Engine active", error: null, timeoutCountdown: null, vramWarning: "WebGPU not available. Running in CPU fallback mode with built-in engineering knowledge base (11 expert domains, 33 materials)." });
      return;
    }

    abortRef.current = false;
    activeAttemptId++;

    setState({ status: "checking", progress: 0, progressText: "Checking browser capabilities…", error: null, timeoutCountdown: null, vramWarning: null });

    const vramCheck = await checkVram();
    const vramWarning = vramCheck.warning;

    if (!vramCheck.ok) {
      setState((prev) => ({ ...prev, vramWarning }));
    }

    try {
      const webllm = await import("@mlc-ai/web-llm");

      if (engineInstance) {
        setState({ status: "ready", progress: 100, progressText: "AI Model ready", error: null, timeoutCountdown: null, vramWarning });
        return;
      }

      const webllmTyped = webllm as unknown as { CreateMLCEngine: (id: string, opts: unknown) => Promise<unknown> };

      const attempt1Id = ++activeAttemptId;
      setState({ status: "downloading", progress: 0, progressText: "Starting model download…", error: null, timeoutCountdown: INIT_TIMEOUT_SECONDS, vramWarning });

      const firstAttempt = await singleAttempt(webllmTyped, attempt1Id);

      if (abortRef.current) return;

      if (firstAttempt.success && firstAttempt.engine) {
        engineInstance = firstAttempt.engine;
        setState({ status: "ready", progress: 100, progressText: "AI Model ready — Phi-3.5 Mini online", error: null, timeoutCountdown: null, vramWarning });
        return;
      }

      const attempt2Id = ++activeAttemptId;
      setState((prev) => ({
        ...prev,
        status: "downloading",
        progress: 0,
        progressText: "First attempt failed. Retrying…",
        timeoutCountdown: INIT_TIMEOUT_SECONDS,
        error: null,
      }));

      const secondAttempt = await singleAttempt(webllmTyped, attempt2Id);

      if (abortRef.current) return;

      if (secondAttempt.success && secondAttempt.engine) {
        engineInstance = secondAttempt.engine;
        setState({ status: "ready", progress: 100, progressText: "AI Model ready — Phi-3.5 Mini online", error: null, timeoutCountdown: null, vramWarning });
        return;
      }

      setState((prev) => ({
        ...prev,
        status: "error",
        progress: 0,
        progressText: "",
        timeoutCountdown: null,
        error: "AI model failed to load after two attempts. This may be due to slow network or insufficient GPU memory. Please refresh the page to try again.",
      }));
    } catch (err) {
      activeAttemptId++;
      if (abortRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, status: "error", progress: 0, progressText: "", error: msg, timeoutCountdown: null }));
    }
  }, [state.status, checkSupport, checkVram, singleAttempt]);

  const chat = useCallback(async (
    userMessage: string,
    history: { role: "user" | "assistant"; content: string }[] = []
  ): Promise<string> => {
    if (cpuFallbackActive) {
      await new Promise(r => setTimeout(r, 150 + Math.random() * 350));
      return cpuFallbackChat(userMessage, history);
    }
    if (!engineInstance) throw new Error("AI model is not loaded. Please initialize first.");

    const messages: ChatMessage[] = [
      { role: "system", content: DOMAIN_SYSTEM_PROMPT },
      ...history.slice(-12),
      { role: "user", content: userMessage },
    ];

    const engine = engineInstance as {
      chat: {
        completions: {
          create: (opts: {
            messages: ChatMessage[];
            temperature: number;
            max_tokens: number;
            stream: boolean;
            top_p?: number;
            repetition_penalty?: number;
          }) => Promise<{ choices: { message: { content: string } }[] }>;
        };
      };
    };

    const response = await engine.chat.completions.create({
      messages,
      temperature: 0.6,
      max_tokens: 2048,
      stream: false,
      top_p: 0.92,
      repetition_penalty: 1.05,
    });

    return response.choices?.[0]?.message?.content ?? "No response generated.";
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    activeAttemptId++;
    engineInstance = null;
    cpuFallbackActive = false;
    setState({ status: "idle", progress: 0, progressText: "", error: null, timeoutCountdown: null, vramWarning: null });
  }, []);

  return {
    state,
    isSupported: checkSupport(),
    initialize,
    chat,
    reset,
  };
}
