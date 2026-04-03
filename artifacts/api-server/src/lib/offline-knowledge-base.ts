// ═══════════════════════════════════════════════════════════════════════════════
// SAI ROLOTECH SMART ENGINES v2.2.0 — Offline AI Knowledge Engine
// Advanced scoring engine: TF-IDF style keyword scoring + pattern matching
// 60+ engineering topics | Hindi/Urdu keyword support
// Based on: Halmos Roll Forming Handbook, Shigley's, ISO 281, DIN 6935, Fanuc
// ═══════════════════════════════════════════════════════════════════════════════

interface KBEntry {
  id: string;
  keywords: string[];
  hindiKeywords?: string[];
  patterns?: RegExp[];
  weight: number;
  response: string;
  conciseResponse: string;
}

// ─── Score a query against a KB entry ────────────────────────────────────────
function scoreEntry(query: string, entry: KBEntry): number {
  const q = query.toLowerCase();
  const words = q.split(/\s+/);
  let score = 0;

  for (const kw of entry.keywords) {
    if (q.includes(kw.toLowerCase())) {
      score += kw.includes(" ") ? 3 : 1; // phrase match scores higher
    }
  }
  if (entry.hindiKeywords) {
    for (const kw of entry.hindiKeywords) {
      if (q.includes(kw.toLowerCase())) score += 2;
    }
  }
  if (entry.patterns) {
    for (const pat of entry.patterns) {
      if (pat.test(q)) score += 4;
    }
  }
  return score * entry.weight;
}

// ─── Main Knowledge Base ─────────────────────────────────────────────────────
const KB: KBEntry[] = [

  // ═══════════ G-CODE CYCLES ═══════════════════════════════════════════════

  {
    id: "g71",
    keywords: ["g71", "roughing cycle", "rough turning", "stock removal", "turning cycle", "g71 cycle", "roughing"],
    hindiKeywords: ["roughing", "khorasna", "thafna", "stock hatana"],
    patterns: [/g71|rough.*turn|turning.*rough|stock.*remov/i],
    weight: 2,
    conciseResponse: "G71 roughing: Line1: G71 U(doc) R(retract)  Line2: G71 P(start) Q(end) U(X-allow) W(Z-allow) F(feed). Doc typically 1.5-2mm, retract 0.5-1mm.",
    response: `**G71 — Roughing Cycle (Fanuc Standard)**

\`\`\`gcode
G71 U(depth_per_pass) R(retract_distance)
G71 P(profile_start_N) Q(profile_end_N) U(X_allowance) W(Z_allowance) F(roughing_feed)
\`\`\`

**Parameters:**
| Parameter | Description | Typical Value |
|-----------|-------------|---------------|
| U (line 1) | Depth of cut per pass (radius) | 1.5–2.0 mm |
| R | Retract after each pass | 0.5–1.0 mm |
| P | First block number of finish profile | e.g. N100 |
| Q | Last block number of finish profile | e.g. N200 |
| U (line 2) | X finishing allowance (diameter) | 0.3–0.5 mm |
| W | Z finishing allowance | 0.1–0.2 mm |
| F | Roughing feedrate | 0.20–0.35 mm/rev |

**Complete Example — Roll OD Turning:**
\`\`\`gcode
O1001 (ROLL UPPER - ST1 - OD TURN)
T0101
G96 S120 M03          (CSS 120 m/min CW)
G92 S2500             (RPM limit)
G00 X165.0 Z2.0       (Rapid to start - Roll OD+5)
G71 U2.0 R0.5         (2mm cut depth, 0.5mm retract)
G71 P100 Q200 U0.4 W0.1 F0.28  (roughing params)
N100 G00 X50.0        (Bore diameter - profile start)
N110 G01 Z0 F0.15
N120 X52.0 Z-1.0      (Chamfer)
N130 Z-80.0           (Bore length)
N140 X158.0           (Shoulder to OD)
N150 Z-130.0          (OD face width)
N200 X165.0           (Profile end)
T0303
G96 S160 M03          (CSS finishing)
G92 S3000
G70 P100 Q200 F0.10   (Finishing cycle)
G28 U0.0 W0.0
M30
\`\`\`

**Rules:**
- Profile P-Q must be defined BEFORE G71 call
- U allowance = 2× your finishing tool depth (radius mode = /2)
- For inside bore: U is negative (-0.3)
- G71 Type I: simple monotonic profile; Type II: undercuts allowed`
  },

  {
    id: "g70",
    keywords: ["g70", "finishing cycle", "finish pass", "finish turning", "g70 cycle"],
    hindiKeywords: ["finishing", "mahan", "final cut"],
    patterns: [/g70|finish.*cycle|finish.*pass/i],
    weight: 2,
    conciseResponse: "G70 P(start) Q(end) — uses same profile blocks as G71. Use finishing tool, CSS mode G96.",
    response: `**G70 — Finishing Cycle**

\`\`\`gcode
T0303 (Finishing tool)
G96 S160 M03           (CSS — higher speed for finish)
G92 S3000              (RPM max)
G00 X[OD+5] Z3.0
G70 P100 Q200          (Same P/Q as G71 roughing)
G28 U0. W0.
M30
\`\`\`

**Key Points:**
- Uses SAME profile block numbers (P/Q) as roughing
- No U/W parameters needed (cuts to exact profile)
- Use higher Vc for finish: Steel 160–200 m/min, SS 100–130 m/min
- Nose radius re = 0.4mm for Ra<1.6µm, re=0.8mm for Ra<3.2µm
- Insert: positive rake angle (CCMT/DCMT) for better finish
- **Ra formula:** Ra = f² / (8×re) × 1000 µm`
  },

  {
    id: "g72",
    keywords: ["g72", "facing cycle", "face turning", "facing roughing"],
    patterns: [/g72|facing.*cycle|face.*rough/i],
    weight: 2,
    conciseResponse: "G72 W(depth) R(retract) then G72 P(start) Q(end) U(X-allow) W(Z-allow) F(feed). Z-direction roughing (facing).",
    response: `**G72 — Facing Cycle (Z-direction roughing)**

\`\`\`gcode
G72 W(depth_per_pass) R(retract)
G72 P(start) Q(end) U(X_allowance) W(Z_allowance) F(feed)
\`\`\`

**vs G71:**
- G71 = X-direction (OD/ID longitudinal turning)
- G72 = Z-direction (face turning, facing off material)

**Example:**
\`\`\`gcode
T0101
G96 S100 M03
G00 X125.0 Z2.0
G72 W2.0 R0.5
G72 P10 Q50 U0.3 W0.05 F0.25
N10 G00 Z-20.0
N20 G01 X80.0 F0.15
N30 Z-15.0
N40 X40.0 Z-8.0
N50 X20.0
G70 P10 Q50
\`\`\``
  },

  {
    id: "g73",
    keywords: ["g73", "pattern repeat", "pattern cycle", "cast rough", "forged part", "g73 cycle"],
    patterns: [/g73|pattern.*repeat|cast.*blank|forged/i],
    weight: 2,
    conciseResponse: "G73 U(X-escape) W(Z-escape) R(passes) then G73 P Q U W F. Use for cast/forged blanks — follows existing shape.",
    response: `**G73 — Pattern Repeating Cycle**
Used for: cast blanks, forged parts, pre-machined stock (follows existing shape)

\`\`\`gcode
G73 U(X_relief) W(Z_relief) R(number_of_passes)
G73 P(start) Q(end) U(X_allow) W(Z_allow) F(feed)
\`\`\`

**Parameters:**
- U (1st line): Total X escape distance = (stock-finish)/2 for radius
- W (1st line): Total Z escape distance
- R: Number of passes (U/R = depth per pass)

**Example — Cast Roll Blank:**
\`\`\`gcode
G00 X165.0 Z2.0
G73 U7.0 W3.0 R4         (4 passes, 7mm total X escape)
G73 P10 Q60 U0.4 W0.1 F0.25
N10 G00 G42 X50.0 Z2.0
N20 G01 Z-80.0 F0.15
N30 X160.0
N60 G40 G00 X200.0
\`\`\``
  },

  {
    id: "g74",
    keywords: ["g74", "peck drilling", "face groove", "drilling cycle", "deep hole drilling"],
    hindiKeywords: ["drilling", "drill", "ched banana"],
    patterns: [/g74|peck.*drill|drill.*cycle|deep.*hole/i],
    weight: 2,
    conciseResponse: "G74 R(retract) then G74 Z(depth) Q(peck mm×1000) F(feed). X=0 for center drilling.",
    response: `**G74 — Peck Drilling / Face Grooving**

**Center Drilling:**
\`\`\`gcode
T0500 (Drill)
G97 S500 M03
G00 X0.0 Z3.0
G74 R1.0                  (1mm retract per peck)
G74 Z-60.0 Q15000 F0.10   (Q15000 = 15mm peck depth)
G28 W0.
\`\`\`

**Face Grooving (multiple grooves):**
\`\`\`gcode
G74 R1.0
G74 X30.0 Z-8.0 P5000 Q3000 F0.08
(X=innerDia, Z=depth, P=X step(µm), Q=Z peck(µm))
\`\`\`

**Parameter Q:** Always in microns (µm) — Q15000 = 15mm, Q8000 = 8mm
**Peck sequence:** Feed down Q, retract R, repeat until Z depth reached`
  },

  {
    id: "g75",
    keywords: ["g75", "grooving cycle", "groove", "snap ring groove", "oil groove", "groove turning"],
    hindiKeywords: ["groove", "channel", "nali", "grooving"],
    patterns: [/g75|groov.*cycle|grooving|snap.*ring.*groove|retainer.*groove/i],
    weight: 2,
    conciseResponse: "G75 R(retract) then G75 X(bottom_dia) Z(end_pos) P(X_peck×1000) Q(Z_step×1000) F(feed).",
    response: `**G75 — Grooving Cycle (X-axis)**

\`\`\`gcode
G75 R(relief)
G75 X(groove_bottom_dia) Z(last_groove_Z) P(X_peck_µm) Q(Z_step_µm) F(feed)
\`\`\`

**Single Groove Example (Snap Ring Groove):**
\`\`\`gcode
T0303 (3mm grooving insert)
G96 S80 M03
G00 X85.0 Z-45.0          (Rapid to groove position)
G75 R0.5
G75 X70.0 Z-45.0 P3000 Q0 F0.06
(X=groove bottom Ø70, Z stay at -45, P=3mm peck)
\`\`\`

**Multiple Grooves (equal spacing):**
\`\`\`gcode
G75 R0.5
G75 X70.0 Z-65.0 P3000 Q10000 F0.06
(Q10000 = 10mm between grooves)
\`\`\`

**Grooving Tips:**
- Feed: 0.04–0.08 mm/rev (slower than turning)
- Vc: 50–80 m/min (slower for groove)
- Insert width = groove width +0.1mm clearance
- For deep grooves: Use G75 with P steps (peck in X)
- Always program to groove BOTTOM diameter`
  },

  {
    id: "g76",
    keywords: ["g76", "threading cycle", "thread turning", "thread cutting", "metric thread", "inch thread", "thread program", "threading"],
    hindiKeywords: ["thread", "chura", "pech", "threading", "bolt thread"],
    patterns: [/g76|thread.*cycle|thread.*cut|threading/i],
    weight: 2,
    conciseResponse: "G76 P(spring)(chamfer)(angle) Q(min_cut) R(finish_allow) then G76 X(minor_dia) Z(thread_end) R(taper) P(depth×1000) Q(1st_cut×1000) F(pitch).",
    response: `**G76 — Threading Cycle (Fanuc 2-line format)**

\`\`\`gcode
G76 P(m)(r)(a) Q(min_depth) R(finish_stock)
G76 X(minor_dia) Z(thread_end) R(taper) P(thread_depth) Q(first_cut) F(pitch)
\`\`\`

**P parameter breakdown (6 digits):**
- mm (digits 1-2): Spring passes — typically 02
- rr (digits 3-4): Chamfer at thread end (00=none, 11=1 lead, 21=2 leads)
- aa (digits 5-6): Thread angle (60=metric, 55=BSF/UNC/UNF, 29=ACME, 80=STUB)

**Common Thread Calculations:**
| Thread | Minor Dia | Depth (P) | 1st Cut (Q) |
|--------|-----------|-----------|-------------|
| M20×2.0 | X17.40 | P1299 | Q400 |
| M24×3.0 | X20.80 | P1950 | Q500 |
| M30×3.5 | X26.20 | P2278 | Q600 |
| M36×4.0 | X31.70 | P2597 | Q650 |

**Minor Dia formula:** d_minor = d_nominal - 1.0825 × pitch (metric)
**Thread depth:** h = 0.6495 × pitch

**Complete M20×2.0 External Thread Example:**
\`\`\`gcode
T0700 (Threading tool)
G97 S600 M03              (Constant RPM for thread)
G00 X22.0 Z5.0
G76 P020060 Q100 R0.1     (2 spring passes, no chamfer, 60° angle)
G76 X17.40 Z-35.0 R0 P1299 Q400 F2.0
(X=minor Ø17.40, Z=-35 end, P=1.299mm depth×1000, Q=0.4mm 1st cut, F=2mm pitch)
G28 U0. W0.
M30
\`\`\`

**IMPORTANT for Delta 2X:** G76 format may differ — always verify controller manual`
  },

  {
    id: "g96_g97",
    keywords: ["g96", "g97", "css", "constant surface speed", "constant rpm", "spindle speed", "g92 rpm", "g50 rpm", "rpm limit", "spindle control"],
    hindiKeywords: ["spindle speed", "rpm", "cutting speed"],
    patterns: [/g96|g97|css|constant.*surface.*speed|spindle.*speed|rpm.*limit/i],
    weight: 1.5,
    conciseResponse: "G96 S(Vc_m_min) = CSS mode (auto RPM changes). G97 S(RPM) = constant RPM. G92 S(max) = RPM cap. Use G96 for turning, G97 for threading/grooving/drilling.",
    response: `**G96 / G97 / G92 — Spindle Speed Control**

**G96 — Constant Surface Speed (CSS):**
\`\`\`gcode
G96 S120 M03    (120 m/min CSS, clockwise)
G92 S2500       (Max RPM cap — prevents runaway on small diameters!)
\`\`\`
- RPM automatically changes as diameter changes: N = 1000×Vc / (π×D)
- USE for: OD turning, facing, boring — any where diameter changes

**G97 — Constant RPM:**
\`\`\`gcode
G97 S800 M03    (800 RPM fixed)
\`\`\`
- RPM stays fixed regardless of diameter
- USE for: Threading (G76), drilling (G74), tapping — constant feed/rev matters

**G92 — RPM Limit (Fanuc):**
\`\`\`gcode
G92 S2500    (Cap at 2500 RPM)
\`\`\`
- MUST use with G96 to prevent overspeed on small diameters
- Set before G96 command

**CSS Calculation Table:**
| Material | Vc (m/min) | For Ø60mm → RPM |
|----------|-----------|-----------------|
| GI / Mild Steel | 100–150 | 530–800 RPM |
| SS 304 | 80–120 | 425–640 RPM |
| Aluminium | 200–350 | 1060–1860 RPM |
| Cast Iron | 80–120 | 425–640 RPM |
| D2 Tool Steel | 60–100 | 320–530 RPM |
| Titanium | 30–60 | 160–320 RPM |`
  },

  {
    id: "cnc_cutting_params",
    keywords: ["rpm", "feed rate", "cutting speed", "spindle", "surface speed", "mrr", "material removal", "cutting time", "machining time"],
    hindiKeywords: ["cutting speed", "rpm", "feed", "cutting time", "machining"],
    patterns: [/cutting.*speed|spindle.*speed|feed.*rate|mrr|machining.*time/i],
    weight: 1.5,
    conciseResponse: "RPM = 1000×Vc/(π×D). Feed(mm/min) = RPM×f. MRR = Vc×1000×f×ap (mm³/min). Tc = L/(RPM×f) sec × 60.",
    response: `**CNC Turning — Complete Cutting Parameter Formulas**

**1. Spindle Speed:**
\`\`\`
N (RPM) = 1000 × Vc / (π × D)
D = workpiece diameter (mm)
Vc = cutting speed (m/min)
\`\`\`

**2. Feed Rate:**
\`\`\`
F (mm/min) = N × f
f = feed per revolution (mm/rev)
\`\`\`

**3. Material Removal Rate:**
\`\`\`
MRR (mm³/min) = Vc × 1000 × f × ap
ap = depth of cut (mm)
\`\`\`

**4. Cutting Time (1 pass):**
\`\`\`
Tc (min) = L / (N × f)    →  × 60 for seconds
L = length of cut (mm)
\`\`\`

**5. Surface Roughness Ra:**
\`\`\`
Ra (µm) = f² / (8 × re) × 1000
re = insert nose radius (mm)
\`\`\`

**Example Calculation:**
D=60mm, Vc=120m/min, f=0.2mm/rev, ap=2mm, L=100mm, re=0.8mm
- N = 1000×120/(π×60) = **637 RPM**
- F = 637×0.2 = **127 mm/min**
- MRR = 120×1000×0.2×2 = **48,000 mm³/min = 48 cm³/min**
- Tc = 100/(637×0.2) = 0.785 min = **47 sec**
- Ra = 0.04/(8×0.8)×1000 = **6.25 µm**

**Recommended Values by Material:**
| Material | Vc (m/min) | f (mm/rev) | ap (mm) | Insert |
|----------|-----------|-----------|---------|--------|
| GI/CR Steel | 100–180 | 0.15–0.35 | 1–4 | TNMG |
| SS 304 | 80–130 | 0.10–0.20 | 0.5–2 | DCMT |
| Aluminium | 200–400 | 0.20–0.40 | 2–5 | CCGT |
| Cast Iron | 80–130 | 0.20–0.40 | 2–4 | CNMG |
| D2 Tool Steel | 60–90 | 0.10–0.20 | 0.5–1.5 | VCMT |
| Titanium | 30–60 | 0.05–0.12 | 0.5–1.5 | VNMG |`
  },

  {
    id: "delta_cnc",
    keywords: ["delta cnc", "delta 2x", "delta controller", "delta lathe", "delta gcode"],
    patterns: [/delta.*cnc|delta.*2x|delta.*controller|delta.*lathe/i],
    weight: 2,
    conciseResponse: "Delta 2X: M4 (not M3), G92 S500, G28 U0. + G28 W0. separate lines, T0404 () format, Z50. safe, NO M8/M9. G96 CSS, G90 abs, G53 before G28.",
    response: `**Delta CNC Controller — VERIFIED from Actual Machine TAP Files**

**Critical Differences from Fanuc:**
| Feature | Fanuc | Delta 2X (Verified) |
|---------|-------|---------------------|
| Spindle CW | M03 | **M04** |
| Spindle CCW | M04 | M03 |
| Coolant ON | M08 | **Not supported** |
| Coolant OFF | M09 | **Not supported** |
| Dwell | G04 | **Not supported** |
| Max RPM | G50 S2500 | **G92 S500** |
| Home return | G28 U0 W0 (one line) | **G28 U0.** + **G28 W0.** (SEPARATE lines!) |
| Tool call | T0101 | **T0404 ()** (empty brackets) |
| Safe Z | varies | **G0 Z50.** |
| CSS | G96 | G96 (same) |
| Pre-home | none | **G53** before G28 |
| Optional stop | M01 | **M1** |
| Arc format | G02/G03 I/K | G2/G3 R (radius format) |

**Verified Delta 2X Program Structure (from NEWD4TR_contour.TAP):**
\`\`\`gcode
O5000
(TR_CONTOUR.TAP)
( T04   )
G0
G53
G28 U0.
G28 W0.
M1
N4
T0404  ()
G92 S500
(-----------------)
(TR-CONTOUR - TURN)
(-----------------)
G96 S200 M4
G90
G0 Z50.
G0 X114.38 Z2.
   X109.4
G1 Z-107.8 F0.102
... (contour passes)
G96 S225 M4
G1 ... F0.051          (finish pass — lower feed)
M5
G28 U0.
G28 W0.
M30
%
\`\`\`

**Key Machine Patterns (Actual):**
- Rough: G96 S200 M4, F0.102 mm/rev
- Finish: G96 S225 M4, F0.051 mm/rev
- Arcs: G2/G3 with R format (R0.7, R0.8, R1.7)
- Start: G0 → G53 → G28 U0. → G28 W0. → M1 → Tool call
- End: M5 → G28 U0. → G28 W0. → M30 → %
- Safe retract: G0 X... Z2. or Z2.8 (varies by program)
- Manual contour passes used (not G71 cycle for complex profiles)

**Machine Specs (from SolidCAM VMID):**
- Model: 2X_DELTA2 | SimName: SL603C
- X Axis: Rapid 6000 mm/min | Max 6000 mm/min | Accel 2500
- Z Axis: Rapid 5000 mm/min | Max 3000 mm/min
- Turret: 12 stations | Tool change: 3 seconds
- 2-Axis Lathe | Fanuc 21 IB compatible controller

**Tool Library (from SolidCAM TOOLKIT screenshots — VERIFIED):**
| Tool | ISO Insert | Type | Holder | IC | R | Lead | Dir | Shank |
|------|-----------|------|--------|-----|-----|------|-----|-------|
| T02 | VNMG 160408 | Profile | Ext. Turning | 9.52mm | R0.8 | — | R | 25x25 |
| T04 | VNMG 060108 | **Groove** | **Ext. Grooving** | 3.97mm | R0.8 | A(90) | R | 25x25 |
| T06 | VNMG 160402 | Profile | Ext. Turning | 9.52mm | **R0.2** | J(93) | **L** | 25x25 |
| T08 | VNMG 060108 | Profile | Ext. Turning | 3.97mm | R0.8 | A(90) | R | 25x25 |
| T10 | VNMG 160402 | Profile | **Ext. Grooving** | 9.52mm | **R0.2** | L(95) | **L** | 25x25 |

All tools: G96 S200 M4 rough → G96 S225 M4 finish → G92 S500 max RPM

**T02 Neutral Tool — Full SolidCAM Settings (from screenshots):**
- Operation: TR_contour | Type: Profile | Orientation: Right | Station_2 | Offset: 2-8
- Feed: 0.175 mm/rev (normal + finish + lead in/out) | Spin CW | X+ output
- Vc rough: 200 m/min (454 RPM) | Vc finish: 225 m/min (511 RPM) | Max Spin: 500
- Gear: 0-5000rpm 15kW | Reference dia: 139.997mm
- Rough: Smooth type, Step down 0.75 (Equal + Adaptive), Offset X=0.6 Z=0.2, Retreat 0.2, One way
- Finish: ISO-Turning method, Rest material only, 1 pass, Stairs last 45 deg
- Safety distance: 2mm | Start ext: 0 Tangential | End ext: 10 Tangential
- Geometry: Contour, MAC 1, Limit by cutter angle

**NEVER use with Delta 2X:** M08, M09, G04, G50, M03 (use M4), single-line G28 U0 W0`
  },

  {
    id: "fanuc_gcode",
    keywords: ["fanuc", "fanuc 0i", "fanuc 18i", "fanuc 30i", "fanuc program", "fanuc controller"],
    patterns: [/fanuc|fanuc.*0i|fanuc.*18i|fanuc.*30i/i],
    weight: 1.5,
    conciseResponse: "Fanuc 0i: G28 U0 W0 home, G96/G92 CSS, G71/G70 turning, G76 thread, G75 groove, T0101 tool call. M03/M04 spindle.",
    response: `**Fanuc CNC — Complete G-Code Reference for Roll Turning**

**Program Header:**
\`\`\`gcode
O1001 (PROGRAM NAME)
G28 U0. W0.       (Return to reference)
T0101             (Tool + offset)
G96 S120 M03      (CSS 120 m/min, CW)
G92 S2500         (Max RPM)
G00 X[D+5] Z2.0   (Rapid approach)
\`\`\`

**Essential G-Codes:**
| Code | Function | Notes |
|------|----------|-------|
| G28 | Reference return | G28 U0. W0. at program end |
| G50 | Coordinate/max RPM | G50 S2500 = max 2500 RPM |
| G92 | Max RPM (Fanuc 0i) | Use with G96 |
| G96 | CSS | Vc in m/min |
| G97 | Fixed RPM | Use for thread, drill |
| G70 | Finish cycle | After G71/G72/G73 |
| G71 | OD rough cycle | P-Q profile definition |
| G72 | Face rough cycle | Z-direction |
| G73 | Pattern repeat | For cast blanks |
| G74 | Peck drill/face groove | Q in microns |
| G75 | OD groove cycle | P,Q in microns |
| G76 | Thread cycle | 2-line format |

**Essential M-Codes:**
| Code | Function |
|------|----------|
| M03 | Spindle CW |
| M04 | Spindle CCW |
| M05 | Spindle stop |
| M08 | Coolant ON |
| M09 | Coolant OFF |
| M30 | Program end + reset |`
  },

  // ═══════════ ROLL DESIGN ═══════════════════════════════════════════════════

  {
    id: "strip_width",
    keywords: ["strip width", "blank width", "flat blank", "blank development", "coil width", "strip calculation"],
    hindiKeywords: ["strip width", "patti chaurai", "blank width", "flat blank"],
    patterns: [/strip.*width|blank.*width|blank.*develop|coil.*width/i],
    weight: 2,
    conciseResponse: "Strip width = Web + Σ flanges + Σ bend allowances. BA = (π/180)×θ×(R + K×T). K-factor by material.",
    response: `**Strip Width Calculation — Complete Method (DIN 6935 / SME)**

**Formula:**
\`\`\`
Total Strip Width = Web + Σ(Flange lengths) + Σ(Bend Allowances)

BA = (π/180) × θ × (R + K × T)
OSSB = tan(θ/2) × (R + T)
BD = 2 × OSSB - BA  (Bend Deduction)
\`\`\`

**K-Factor by Material:**
| Material | K-Factor | Reason |
|----------|---------|--------|
| GI (Galvanized) | 0.43–0.45 | Zinc coat effect |
| Cold Rolled Steel | 0.43–0.45 | Good formability |
| Hot Rolled Steel | 0.40–0.43 | Rougher, more deformation |
| SS 304 | 0.48–0.52 | Work hardening / austenitic |
| Aluminium 6061 | 0.41–0.44 | Soft, consistent |
| HSLA S355 | 0.43–0.47 | High strength AHSS |

**Worked Example — C-Channel 200×75×20mm, t=2.0mm, r=2.0mm, GI (K=0.44):**
1. Web = 200mm
2. Flanges = 75 + 75 = 150mm (2 flanges)
3. Lips = 20 + 20 = 40mm (2 lips)
4. BA at 90° bend: (π/180)×90×(2.0 + 0.44×2.0) = 1.5708×2.88 = **4.52mm per bend**
5. BA at lip 90°: same = 4.52mm per bend
6. Total BA = 4 bends × 4.52 = 18.08mm
7. **Strip Width = 200 + 150 + 40 + 18.08 = 408.08mm → Order 409mm coil**

**Tolerance:**
- Add 0.5–1.0mm for edge conditioning
- Standard coil tolerance: ±0.3mm (DIN EN 10162)
- Always round UP to nearest 0.5mm for ordering`
  },

  {
    id: "flower_pattern",
    keywords: ["flower pattern", "bend progression", "forming sequence", "angle progression", "flower diagram", "hermite", "halmos"],
    hindiKeywords: ["flower pattern", "bend progression", "forming angle"],
    patterns: [/flower.*pattern|bend.*progress|form.*sequence|angle.*progress/i],
    weight: 2,
    conciseResponse: "Flower pattern: θᵢ = θ_final × (3t²-2t³) [Hermite]. More bending early, gentle at end. Halmos method. Last 2 stations = calibration.",
    response: `**Flower Pattern Design — Halmos Roll Forming Handbook Method**

**Best Method: Hermite Smooth-Step Distribution**
\`\`\`
θᵢ = θ_final × (3t² - 2t³)    where t = i/N  (0 to 1)
\`\`\`
This gives: aggressive early bending → smooth finishGiving the correct S-curve progression that minimizes edge strain.

**Example — 90° bend, 10 stations:**
| Station | t = i/N | Hermite | Angle |
|---------|---------|---------|-------|
| 1 | 0.1 | 0.028 | 2.5° |
| 2 | 0.2 | 0.104 | 9.4° |
| 3 | 0.3 | 0.216 | 19.4° |
| 4 | 0.4 | 0.352 | 31.7° |
| 5 | 0.5 | 0.500 | 45.0° |
| 6 | 0.6 | 0.648 | 58.3° |
| 7 | 0.7 | 0.784 | 70.6° |
| 8 | 0.8 | 0.896 | 80.6° |
| 9 | 0.9 | 0.972 | 87.5° |
| 10 | 1.0 | 1.000 | 90.0° |

**Design Rules:**
1. **Form return legs FIRST** — on C-channel, small leg before main leg
2. **Max angle per station:** GI 15°, CR 12°, SS 10°, HSLA 8°, Ti 5°
3. **Last 2-3 stations:** Calibration — full angle + springback compensation
4. **Springback at final station:** GI +3°, SS +10°, HSLA +15°
5. **Station count:** N ≥ Total_angle / max_per_station + 2-3 calibration
6. **Edge strain check:** ε = t/(2R) must be < 20% at any station`
  },

  {
    id: "springback",
    keywords: ["springback", "spring back", "overbend", "elastic recovery", "angular springback"],
    hindiKeywords: ["springback", "spring back", "overbend", "wapas aana"],
    patterns: [/springback|spring.*back|overbend|elastic.*recov/i],
    weight: 2,
    conciseResponse: "Springback: Ri/Rf = 1 - 3(UTS×Ri)/(E×t) + 4(UTS×Ri/(E×t))³. GI +3-5°, SS +8-12°, HSLA +12-18°. Overbend at LAST station only.",
    response: `**Springback Compensation — Complete Guide**

**Springback Ratio Formula (Ludwik):**
\`\`\`
Ri/Rf = 1 - (3×UTS×Ri)/(E×t) + 4×(UTS×Ri/(E×t))³
Ri = inside radius forming tool
Rf = final radius after springback
E = elastic modulus (GPa × 1000 = MPa)
\`\`\`

**Practical Springback Angles:**
| Material | Springback | Overbend (at 90°) | Final Station Setting |
|----------|-----------|-------------------|----------------------|
| GI Z120 | 3–5° | 92–95° | 93° for 90° final |
| Cold Rolled | 4–6° | 93–96° | 94° |
| MS (mild) | 3–5° | 93–95° | 93° |
| SS 304 | 8–12° | 97–102° | 100° for 90° final |
| SS 316 | 10–14° | 100–104° | 102° |
| Al 5052 | 6–10° | 96–100° | 98° |
| HSLA 350 | 12–18° | 102–108° | 105° |
| HSLA 550 | 18–25° | 108–115° | 112° |
| DP 600 | 20–28° | 110–118° | 115° |

**Key Rules:**
1. Overbend ONLY at calibration stations (last 2)
2. Do NOT overbend at forming stations (causes edge buckling)
3. For asymmetric sections: left/right stations may need different overbend
4. Temperature matters: cold forming (+20%) vs ambient
5. **Unfolding technique (end-flare control):**
   - Station N-2: Form to 88°
   - Station N-1: Unfold back to 86°
   - Station N: Re-form to 90° (eliminates residual end flare)`
  },

  {
    id: "station_count",
    keywords: ["station count", "number of stations", "how many stations", "pass count", "station number", "stations needed"],
    hindiKeywords: ["kitne station", "station count", "pass kitne", "station katnhe"],
    patterns: [/station.*count|number.*station|how.*many.*station|pass.*count/i],
    weight: 2,
    conciseResponse: "N = Σ(bend angles) / max_per_station + 2-3 calibration. GI 15°/station, SS 10°, HSLA 8°, Ti 5°.",
    response: `**Station Count Calculation — Halmos Method**

**Basic Formula:**
\`\`\`
N_forming = Σ(all bend angles) / angle_per_station
N_total = N_forming + 2 (entry guide) + 2–3 (calibration) + special stations
\`\`\`

**Max Angle Per Station by Material:**
| Material | Max°/station | Recommended | Notes |
|----------|-------------|-------------|-------|
| GI Z120–Z275 | 15° | 10–12° | Most forgiving |
| Mild Steel CR | 12° | 8–10° | Standard |
| Stainless 304 | 10° | 6–8° | High springback risk |
| Aluminium 5052 | 12° | 8–10° | Soft, easy |
| HSLA 350 | 10° | 7–9° | Strong, needs care |
| HSLA 550+ | 8° | 5–7° | High strength |
| DP600/780 | 8° | 5–6° | Very high springback |
| Titanium | 6° | 4–5° | Extreme springback |

**Profile-Specific Station Counts:**
| Profile | Angle Sum | GI Count | HSLA Count |
|---------|-----------|----------|-----------|
| Simple C 90°×2 | 180° | 10+2cal | 14+3cal |
| Z-Purlin 90°×4 | 360° | 14+2cal | 18+3cal |
| Hat Section 90°×4 | 360° | 12+2cal | 16+3cal |
| Square Tube 90°×4+seam | 360°+ | 18+4cal | 22+4cal |
| Omega 90°×6 | 540° | 18+3cal | 22+3cal |

**Example — C-Channel 75mm flange, GI 2mm:**
- 4 bends × 90° = 360° total
- 360° ÷ 10°/station = 36 forming stations... BUT use profiles method:
- Return leg: 3 stations (0→30→60→75°)
- Web: 2 transitions
- Main flange: 4 stations (0→25→50→75→90°)
- Calibration: 2 stations
- **Total: 12 stations (industry standard)**`
  },

  {
    id: "roll_od",
    keywords: ["roll od", "roll diameter", "roll size", "upper roll", "lower roll", "roll ood"],
    hindiKeywords: ["roll diameter", "roll OD", "roll size"],
    patterns: [/roll.*od|roll.*diameter|roll.*size|upper.*roll|lower.*roll/i],
    weight: 1.5,
    conciseResponse: "Roll OD: min = 5× profile height, min = 80mm. Standard sizes: 100-300mm. Upper OD typically = Lower OD - 2×thickness.",
    response: `**Roll OD Design — Complete Guidelines**

**Minimum OD Formula:**
\`\`\`
Roll OD_min = MAX(5 × profile_height, 3 × strip_width / 10, 80mm)
\`\`\`

**Standard Roll OD by Application:**
| Application | Material Thickness | Typical OD (mm) |
|------------|-------------------|----------------|
| Shutter / light panel | 0.4–0.8mm | 100–130mm |
| Standard purlin | 0.8–2.0mm | 130–165mm |
| Heavy purlin / structural | 2.0–4.0mm | 165–200mm |
| Guard rail / heavy structural | 3.0–6.0mm | 200–280mm |
| Tube mill (round) | 1.0–3.0mm | 150–200mm |

**Standard Roll OD Sizes (Industry):**
80, 90, 100, 110, 120, 130, 140, 150, 160, 165, 170, 180, 200, 220, 250, 280, 300mm

**Upper vs Lower Roll:**
- Flat section: Upper OD = Lower OD (same pitch line)
- Angled section: Adjust for bending geometry
- Gap = Material thickness × 1.05 to 1.10

**Roll Width (Face Width):**
\`\`\`
Face Width = Strip Width × 1.1 (10% extra)
Roll Width = Face Width + 2×(Bearing Width + 5mm clearance)
\`\`\`

**Surface Finish:** Ra 0.4–0.8µm (ground + polished for GI/PP)`
  },

  {
    id: "shaft_diameter",
    keywords: ["shaft diameter", "shaft size", "shaft design", "shaft calculation", "torque shaft", "shaft formula", "keyway", "locknut", "shaft material", "shaft tolerance"],
    hindiKeywords: ["shaft", "dhura", "shaft size", "shaft diameter", "keyway", "locknut"],
    patterns: [/shaft.*diameter|shaft.*size|shaft.*design|shaft.*calc|shaft.*dim|keyway.*din|locknut.*shaft/i],
    weight: 1.5,
    conciseResponse: "Shaft: d = ∛[16/(π×τ) × √((Kf×M)²+T²)]. Kf=1.6 (keyway), SF=2.5. Material: C45→42CrMo4 by load. h6/H7 fit. DIN 6885 keyway + DIN 981 locknut auto-selected.",
    response: `**Shaft Dimension Design — Roll Forming Engineering Standard**

**Formula (Shigley's MSS Theory + Keyway Kf):**
\`\`\`
d = ∛[ (16/(π × τ_allow)) × √((Kf×M)² + T²) ]

Kf = 1.6   (ASME end-milled keyway stress concentration)
M  = F × L / 4   (simply-supported shaft, central load)
T  = P(W) × 9.55 / RPM   (torque from motor)
τ_allow = σ_yield / (2 × SF)
SF = 2.5   (roll forming: shock + fatigue combined)
\`\`\`

**Material Selection by Load:**
| Combined Moment | Material | σ_yield | Use |
|-----------------|----------|---------|-----|
| < 50 N·m | C45 (EN8) Normalized | 400 MPa | Light duty |
| 50–200 N·m | C45 (EN8) Induction Hardened | 550 MPa | Standard |
| 200–600 N·m | 42CrMo4 (EN19) Q&T | 650 MPa | Heavy duty |
| > 600 N·m | 34CrNiMo6 (EN24) Q&T | 800 MPa | Extra heavy |

**Standard ISO Shaft Sizes:**
20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120mm

**DIN 6885-A Parallel Keyway (auto-selected by shaft dia):**
| Shaft Ø | b × h | t1 (shaft) | t2 (hub) |
|---------|-------|-----------|---------|
| 22–30mm | 8×7   | 4.0mm | 3.3mm |
| 30–38mm | 10×8  | 5.0mm | 3.3mm |
| 44–50mm | 14×9  | 5.5mm | 3.8mm |
| 50–58mm | 16×10 | 6.0mm | 4.3mm |
| 65–75mm | 20×12 | 7.5mm | 4.9mm |
| 75–85mm | 22×14 | 9.0mm | 5.4mm |
- Key length: 1.5× to 2.5× shaft diameter
- Key material: C45 (same as shaft)
- Width fit: N9/JS9 (interference/transition)

**DIN 981 Locknut + Tab Washer (auto-selected):**
| Shaft Ø | Thread | Locknut | Washer |
|---------|--------|---------|--------|
| 40mm | M40×1.5 | KM8 | MB8 |
| 50mm | M50×1.5 | KM10 | MB10 |
| 60mm | M60×2 | KM12 | MB12 |
| 80mm | M80×2 | KM16 | MB16 |

**ISO Tolerance Fits:**
- Shaft (bearing seat): h6  → Surface Ra 0.8µm (ground)
- Roll bore: H7           → Surface Ra 1.6µm (reamed)
- Shaft body: Ra 3.2µm (turned)
- Keyway slot: Ra 1.6µm (milled)

**Deflection Limit:**
- Max shaft deflection: L/1000 (ISO standard)
- Formula: δ = FL³/(48EI) — simply supported central load

**Shaft/Roll Ratio Rule:**
- Shaft = 25–40% of Roll OD (standard)
- Example: Roll OD 160mm → Shaft 40–65mm → Select 50mm`
  },

  {
    id: "bearing_l10",
    keywords: ["bearing l10", "l10 life", "bearing life", "bearing selection", "skf bearing", "fag bearing", "6205", "6208", "6210", "6212", "nu205", "nu208", "bearing calculation"],
    hindiKeywords: ["bearing", "bearing life", "bearing selection", "l10"],
    patterns: [/bearing.*l10|l10.*life|bearing.*life|bearing.*select|bearing.*calc/i],
    weight: 1.5,
    conciseResponse: "L10 = (C/P)³ × 10⁶/(60×n) for ball bearings. (C/P)^(10/3) for NU roller bearings. Target: L10 ≥ 20,000 hours.",
    response: `**Bearing L10 Life — ISO 281:2007**

**Ball Bearings (6200/6300 series):**
\`\`\`
L10 (hours) = (C/P)³ × 10⁶ / (60 × n)
C = dynamic load rating (kN) — from catalog
P = equivalent dynamic load (kN)
n = rotational speed (RPM)
\`\`\`

**Cylindrical Roller Bearings (NU series):**
\`\`\`
L10 (hours) = (C/P)^(10/3) × 10⁶ / (60 × n)
\`\`\`

**Standard Bearing Database (SKF/FAG):**
| Designation | Bore | OD | Width | C (kN) | C0 (kN) |
|-------------|------|----|-------|--------|---------|
| 6206-2RS | 30 | 62 | 16 | 19.5 | 11.2 |
| 6207-2RS | 35 | 72 | 17 | 25.5 | 15.3 |
| 6208-2RS | 40 | 80 | 18 | 29.0 | 17.8 |
| 6210-2RS | 50 | 90 | 20 | 35.0 | 23.2 |
| 6212-2RS | 60 | 110 | 22 | 52.0 | 37.5 |
| 6214-2RS | 70 | 125 | 24 | 61.8 | 47.5 |
| NU205 | 25 | 52 | 15 | 18.0 | 13.2 |
| NU208 | 40 | 80 | 18 | 38.0 | 29.5 |
| NU212 | 60 | 110 | 22 | 71.5 | 62.0 |

**L10 Example (6210, Roll Forming):**
C=35kN, P=5kN, n=200 RPM → L10 = (35/5)³×10⁶/(60×200) = 343×1000/12000 = **~28,583 hours ✓**

**Target: L10 ≥ 20,000 hours**
**Rules:** Always 2RS sealed | SKF LGMT2 grease | Regrease 500h | Shaft h6 | Housing H7`
  },

  {
    id: "roll_material",
    keywords: ["d2 steel", "h13 steel", "roll material", "tool steel", "roll hardness", "hrc", "heat treatment roll", "roll tooling material", "a2 steel", "en31"],
    hindiKeywords: ["roll material", "tool steel", "hardness", "heat treatment", "garmi dena"],
    patterns: [/roll.*material|tool.*steel|d2.*steel|h13.*steel|roll.*hard|heat.*treat.*roll/i],
    weight: 1.5,
    conciseResponse: "Roll material: D2 (HRC 58-62, GI/CR standard), H13 (HRC 44-50, SS/Ti/HSLA), A2 (HRC 57-62, easy machine), Carbide (HRC 70-78, max life).",
    response: `**Roll Tooling Material Selection**

| Material | HRC | Best For | Heat Treatment | Life |
|----------|-----|---------|----------------|------|
| D2 Tool Steel | 58–62 | GI, CR, HR, MS, PP, HSLA | 1010°C oil quench, 150–200°C temper (2×) | >500k parts |
| H13 Hot Work | 44–50 | SS, Ti, HSLA, high temp | 1020°C air cool, 550–600°C temper | >300k parts |
| A2 Tool Steel | 57–62 | Al, CR, HR, MS | 960°C air quench, 175°C temper | >200k parts |
| S7 Shock Resist | 54–56 | HR, HSLA (impact prone) | 940°C quench, 175–315°C temper | >150k parts |
| Cast Iron GG25 | 180–250 HB | GI/CR prototypes | Stress relief 550°C | <50k parts |
| Polyurethane 90A | 90 Shore | PP, Al (no scratch) | Cast to shape | <20k parts |
| Tungsten Carbide | 70–78 HRA | SS, Ti (max volume) | Sintered — no HT | >2M parts |

**D2 Heat Treatment (Complete):**
1. Normalize 870°C, air cool
2. Harden: heat to 1010°C, hold 30min/25mm thickness
3. Oil quench to 50–70°C
4. Temper 150–200°C (2× cycles), 2 hours each
5. Rough grind (0.1mm stock)
6. Sub-zero treat: -80°C for 4h (optional, dimensional stability)
7. Final temper 150°C, 2h
8. Finish grind to size: Ra 0.4–0.8µm

**Surface Coating (optional):**
- TiN (PVD): +30–50% life, gold color
- TiCN: +40–60% life, grey, for SS/Ti
- DLC: Ultra low friction, for PP/Al`
  },

  {
    id: "roll_blank_calc",
    keywords: ["roll blank", "raw od", "raw material roll", "blank od", "rough size", "blank size", "purchase size", "bar stock roll"],
    hindiKeywords: ["raw OD", "rough OD", "raf size", "kharcha"],
    patterns: [/roll.*blank|raw.*od|rough.*od|raw.*material.*roll|blank.*size.*roll/i],
    weight: 2,
    conciseResponse: "Raw OD = Final OD + machining allowance (Turn: +8mm, Turn+Grind: +12mm, Hard Turn: +9mm). Round UP to standard bar size. Raw Length = Face + Shaft×2 + facing stock, round to standard.",
    response: `**Roll Blank Size Calculation (Raw Material Purchase)**

**Machining Allowance by Process:**
| Process | Diameter Allowance | Length Allowance |
|---------|--------------------|-----------------|
| CNC Turn only | +8mm on OD | +6mm total |
| CNC Turn + Grind | +12mm on OD | +8mm total |
| CNC Turn + Hard Turn | +9mm on OD | +7mm total |

**Profile Complexity Side Margin:**
| Profile | Extra per Side |
|---------|---------------|
| Simple (L-angle, flat) | +3mm |
| Medium (C/Z/U channel) | +5mm |
| Complex (Hat, Omega) | +8mm |
| Closed/Tube | +12mm |

**Raw Length Formula:**
\`\`\`
Total Length = Face Width + 2×Shaft Length + Facing Stock
Facing Stock = 3–6mm (for truing each end)
Shaft Length = Bearing Width + Lock Nut + 15mm clearance per side
\`\`\`

**Standard Bar Stock OD (India/Asia):**
80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250, 280, 300, 350mm

**Weight Formula:**
\`\`\`
Weight (kg) = π/4 × (OD²- ID²) × Length × density / 10⁶
D2/H13 density = 7.85 g/cm³
\`\`\`

**Example — Upper Roll, Final OD 155mm, Face 80mm, Shaft 40mm each side, Turn+Grind:**
- Raw OD = 155 + 12 = 167mm → **Round to 180mm** (nearest standard)
- Total Length = 80 + 2×40 + 6 = **166mm** → Standard 200mm bar
- Weight = π/4 × 0.18² × 0.200 × 7850 = **3.99 kg per blank**`
  },

  {
    id: "forming_force",
    keywords: ["forming force", "bending force", "roll force", "motor power", "kw motor", "power calculation", "torque motor"],
    hindiKeywords: ["forming force", "bending force", "motor kw", "power"],
    patterns: [/forming.*force|bending.*force|motor.*power|power.*calc|karnezis/i],
    weight: 1.5,
    conciseResponse: "F = 1.5×UTS×t²×w/(2R). Power: P = F×v/η (η=0.85). Add 20% for motor selection. VFD recommended for all machines.",
    response: `**Forming Force & Motor Power — Karnezis Model**

**Forming Force:**
\`\`\`
F = 1.5 × UTS × t² × w / (2 × R)    [Newtons]
UTS = material tensile strength (MPa)
t = material thickness (mm)
w = strip width (mm)
R = bend radius (mm)
\`\`\`

**Motor Power Required:**
\`\`\`
P (kW) = F × v / (η × 1000 × 60)
v = line speed (m/min)
η = drivetrain efficiency = 0.80–0.85
\`\`\`

**Motor Selection Table:**
| Profile | Thickness | Material | Recommended kW |
|---------|-----------|----------|---------------|
| Shutter patti | 0.4–0.6mm | GI | 3.7–5.5 |
| Light purlin | 0.8–1.5mm | GI | 5.5–7.5 |
| Standard purlin | 1.5–2.5mm | GI/CR | 7.5–15 |
| Heavy structural | 2.5–4.0mm | MS/HR | 15–30 |
| HSLA structural | 2.0–3.5mm | HSLA | 22–37 |
| SS profile | 1.5–3.0mm | SS | 15–22 |
| Guard rail W-beam | 3.0–4.0mm | MS | 30–45 |
| Tube mill 50×50 | 1.5–2.0mm | CR | 22–37 |

**Torque Per Station:**
\`\`\`
T_station = P × 9550 / (RPM × N_stations)
\`\`\`

**VFD Size:** Motor_kW × 1.25 (derating). Braking resistor recommended.`
  },

  {
    id: "keyway_din",
    keywords: ["keyway", "key slot", "din 6885", "key size", "feather key", "woodruff key", "spline"],
    hindiKeywords: ["keyway", "key size", "key slot"],
    patterns: [/keyway|key.*slot|din.*6885|feather.*key/i],
    weight: 1.5,
    conciseResponse: "DIN 6885: 30mm shaft=10×8 key, 40mm=12×8, 50mm=14×9, 60mm=18×11, 70mm=20×12, 80mm=22×14. Shaft depth = h-t1.",
    response: `**Keyway Design — DIN 6885 (Part 1)**

| Shaft Ø (mm) | Key b×h | Shaft Depth (t) | Hub Depth (t1) |
|-------------|---------|-----------------|----------------|
| 22–30 | 8×7 | 4.0mm | 3.3mm |
| 30–38 | 10×8 | 5.0mm | 3.3mm |
| 38–44 | 12×8 | 5.0mm | 3.3mm |
| 44–50 | 14×9 | 5.5mm | 3.8mm |
| 50–58 | 16×10 | 6.0mm | 4.3mm |
| 58–65 | 18×11 | 7.0mm | 4.4mm |
| 65–75 | 20×12 | 7.5mm | 4.9mm |
| 75–85 | 22×14 | 9.0mm | 5.4mm |
| 85–95 | 25×14 | 9.0mm | 5.4mm |
| 95–110 | 28×16 | 10.0mm | 6.4mm |

**Key Material:** C45 (same as shaft material)
**Key Fit:**
- Width: JS9 (key) / N9 (shaft) / P9 (hub) = Interference fit
- Length: At least 1.5× shaft diameter
**Key Stress Check:** τ = F / (b × l_eff) ≤ 60 MPa (MS/EN8)
**For heavy duty (HSLA forming):** Use 42CrMo4 keys, check τ ≤ 100 MPa`
  },

  {
    id: "defect_diagnosis",
    keywords: ["defect", "bow", "twist", "camber", "edge wave", "oil can", "surface scratch", "flange crack", "roll wear", "strip break"],
    hindiKeywords: ["defect", "kharabi", "bow", "twist", "problem", "issue", "galti"],
    patterns: [/defect|bow|twist|camber|edge.*wave|oil.*can|scratch|crack.*flange|strip.*break/i],
    weight: 1.5,
    conciseResponse: "Bow=pass line align. Twist=roll symmetry/bearings. Camber=balance L/R forces. Edge wave=reduce speed. Oil can=add ribs. Scratch=polish rolls.",
    response: `**Roll Forming Defect Diagnosis & Correction**

| Defect | Root Causes | Immediate Correction | Permanent Fix |
|--------|-------------|---------------------|---------------|
| **Longitudinal Bow** | Pass line error, uneven pressure | Check roll gaps all stations | Laser align pass line ±0.05mm |
| **Profile Twist** | Roll asymmetry, bearing play | Check all roll positions | CMM check rolls, replace bearings |
| **Horizontal Camber** | Unequal L/R forces, material camber | Adjust side guides | Balance forming pressures |
| **Edge Wave/Flare** | Excessive edge strain, speed high | Reduce speed 10–15% | Add edge conditioning, pre-notch |
| **Oil Canning** | Web buckling, too thin | Add longitudinal rib | Increase gauge or add stiffener |
| **Surface Scratch** | Roll contamination, sharp edge | Clean + polish rolls | R0.5 edge break, proper lube |
| **Flange Crack** | >15° per station, low temp | Reduce angle per pass | More stations, increase r/t ratio |
| **Spring-back Variation** | Material inconsistency | Recalibrate K-factor | Adjust overbend compensation |
| **Roll Wear Pattern** | Wrong material, overload | Check roll gap | Upgrade to D2 or coating |
| **Strip Break** | Coil defect, sharp tool edge | Chamfer strip entry | Inspect coil cert, reduce speed |
| **Dimensional Drift** | Thermal expansion, roll wear | Measure + adjust gap | Check at operating temperature |

**Rapid Troubleshooting Protocol:**
1. Stop line, measure profile at last station
2. Walk back: find where defect STARTS (first station causing problem)
3. At that station: check gap, roll position, runout with dial gauge
4. Check material: width, hardness, thickness uniformity
5. Re-set roll gap with feeler gauge or dial indicator`
  },

  {
    id: "maintenance",
    keywords: ["maintenance", "schedule", "preventive", "pm", "service interval", "roll change", "bearing change"],
    hindiKeywords: ["maintenance", "service", "sevice", "PM", "dekhbhal"],
    patterns: [/maintenance|preventive.*maint|pm.*schedul|service.*interval/i],
    weight: 1.5,
    conciseResponse: "Daily: lube, clean, check noise. Weekly: roll gaps, alignment. Monthly: bearing inspection, roll wear. Annually: overhaul, oil change, laser align.",
    response: `**Preventive Maintenance Schedule**

**Daily (Every Shift Start):**
- Lubricate outboard bearings (if not auto-lube)
- Check gearbox oil level sight glass
- Inspect entry guides and exit guides
- Check for unusual vibration or noise
- Clean roll surfaces (debris, scale)
- Verify strip tracking (no edge rubbing)

**Weekly:**
- Check all roll gaps with feeler gauge (compare to setup sheet)
- Dial gauge check on roll concentricity (suspect stations)
- Side guide adjustment check
- VFD temperature and fault log check
- Lubrication lines and spray nozzles check

**Monthly:**
- Full bearing inspection: temperature (IR gun), noise (stethoscope)
- Roll wear measurement: compare OD to original drawing
- Shaft runout check (≤0.05mm TIR acceptable)
- Gearbox oil level + sample for metal particles
- Electrical connections tightness (VFD terminals, motor)
- Coil mandrel brake force check

**Annually:**
- Complete line teardown and inspection
- Replace all bearings scheduled by L10 calculation
- Regrind or replace worn rolls (>0.3mm wear)
- Gearbox oil change (ISO VG 220 worm, ISO VG 150 helical)
- Laser realignment of entire pass line
- Recalibrate encoder for length accuracy
- Update PM records and spare parts inventory`
  },

  {
    id: "surface_treatment",
    keywords: ["heat treatment", "hrc", "hardness", "d2 hardening", "tempering", "quenching", "tin coating", "pvd coating", "chrome coating", "surface finish roll"],
    hindiKeywords: ["heat treatment", "hardness", "sakhti dena", "hardening", "tempering"],
    patterns: [/heat.*treat|hard.*roll|harden.*roll|temper.*roll|tin.*coat|pvd.*coat|chrome.*roll/i],
    weight: 1.5,
    conciseResponse: "D2: 1010°C oil quench + 150°C temper × 2 = HRC 58-62. H13: 1020°C air + 550°C temper = HRC 44-50. TiN PVD coating +30% life.",
    response: `**Roll Tooling Heat Treatment & Surface Coatings**

**D2 Tool Steel (Standard Rolls):**
\`\`\`
1. Normalize: 870°C, air cool
2. Harden: 1010°C, oil quench
3. Temper: 150–200°C × 2 (2h each)
4. Result: HRC 58–62
5. Optional: -80°C sub-zero, 4h (before final temper)
\`\`\`

**H13 Hot Work Steel (SS/Ti Rolls):**
\`\`\`
1. Preheat: 450°C, then 750°C
2. Harden: 1020–1040°C, air or positive pressure gas quench
3. Temper: 550–600°C × 2 (2h each)
4. Result: HRC 44–50 (tougher, thermal resistant)
\`\`\`

**A2 Tool Steel (Easy Machining):**
\`\`\`
1. Harden: 960°C, air quench
2. Temper: 175°C × 2
3. Result: HRC 57–62 (slightly lower than D2)
\`\`\`

**Surface Coatings:**
| Coating | Process | Thickness | Life Improvement |
|---------|---------|-----------|-----------------|
| TiN | PVD at 480°C | 3–5µm | +30–50% |
| TiCN | PVD at 450°C | 3–5µm | +40–60% |
| CrN | PVD at 200°C | 3–8µm | Corrosion resist |
| Hard Chrome | Electroplating | 20–50µm | Low friction |
| DLC | CVD/PVD | 1–3µm | Very low friction |

**Final Grinding:**
- Before coating: Ra 0.4µm maximum
- After coating: Re-polish to Ra 0.2–0.4µm
- Roll edges: Break to R 0.3–0.5mm (no sharp corners)`
  },

  {
    id: "plc_electrical",
    keywords: ["plc", "electrical", "siemens plc", "mitsubishi plc", "delta plc", "hmi", "encoder", "vfd parameter", "vfd setting"],
    hindiKeywords: ["plc", "electrical", "hmi", "control panel"],
    patterns: [/plc|electrical.*system|siemens.*plc|delta.*plc|hmi.*touch|encoder.*count/i],
    weight: 1.5,
    conciseResponse: "PLC: Siemens S7-1200 or Delta DVP. VFD: 380V 3-phase, always VFD. HMI: 7-10 inch. Encoder: 1000 PPR for length control.",
    response: `**Electrical & PLC System — Roll Forming Machine**

**PLC Selection:**
| Brand | Model | I/O | Application |
|-------|-------|-----|-------------|
| Siemens | S7-1200 | 14DI/10DO | Standard automation |
| Siemens | S7-1500 | Modular | Large lines, >20 stations |
| Delta | DVP-14SS | 8DI/6DO | Budget/simple |
| Delta | DVP-32ES | 16DI/16DO | Medium automation |
| Mitsubishi | FX3U-48MT | 24DI/24DO | Standard (India common) |

**VFD (Variable Frequency Drive):**
- Rating: Motor kW × 1.25 (derating)
- Always use 380V 3-phase input
- V/f mode for simple, vector mode for torque control
- PID loop for line speed control from encoder feedback
- Braking resistor: ALWAYS for decel-heavy applications

**Critical VFD Parameters (Siemens G120):**
- P0100: 50Hz (Europe/India/Asia)
- P0304: Motor voltage (380V)
- P0305: Motor current (nameplate)
- P1082: Max speed (50Hz nominal)
- P1121: Ramp up time (typically 3–5 sec)
- P1122: Ramp down time (typically 3–5 sec)

**Encoder (Length Control):**
- Type: Rotary incremental, 1000 PPR (pulses per revolution)
- Mount on: Pinch roll or idler roll (not driven roll)
- Interface: PLC high-speed counter module
- Calibration: Measure 10m, compare count, set correction factor
- Length accuracy: ±0.5mm achievable with proper calibration`
  },

  {
    id: "quality_tolerance",
    keywords: ["tolerance", "quality", "din en 10162", "inspection", "cpk", "spc", "measurement", "accuracy"],
    hindiKeywords: ["tolerance", "quality", "accuracy", "maap"],
    patterns: [/toleranc|quality.*control|din.*10162|inspection.*roll|cpk|spc.*roll/i],
    weight: 1.5,
    conciseResponse: "DIN EN 10162: thickness ±0.05-0.15mm, profile height ±0.3mm, twist ≤1°/m, camber ≤2mm/m. First piece: check all 5 dimensions.",
    response: `**Quality Control & Tolerances — Roll Forming**

**DIN EN 10162 — Cold Rolled Steel Profiles:**
| Parameter | Standard Tolerance | Precision Grade |
|-----------|-------------------|----------------|
| Material thickness | ±0.10–0.15mm | ±0.05mm |
| Strip width (slit) | ±0.3mm | ±0.2mm |
| Profile height | ±0.5mm | ±0.3mm |
| Flange width | ±0.8mm | ±0.5mm |
| Lip length | ±0.8mm | ±0.5mm |
| Twist | ≤2°/1000mm | ≤1°/1000mm |
| Camber (horizontal) | ≤3mm/1000mm | ≤2mm/1000mm |
| Bow (vertical) | ≤2mm/1000mm | ≤1mm/1000mm |
| Cut length | ±3mm | ±1mm |
| Squareness (cut end) | ≤2mm | ≤1mm |

**Inspection Protocol:**
1. **First piece inspection:** All dimensions, 5+ measurement points
2. **In-process:** Every 50 pieces — height, width, twist
3. **Surface:** Visual every coil — scratches, coating damage
4. **Weight check:** Compare kg/m to theoretical (±5%)
5. **Document:** Measure against drawing, record in QC card

**SPC Target:**
- Cpk ≥ 1.33 = Standard production acceptable
- Cpk ≥ 1.67 = Automotive/precision grade
- Cp vs Cpk: Cp = process capability; Cpk = centered+capable`
  },

  {
    id: "gearbox",
    keywords: ["gearbox", "gear box", "gear ratio", "worm gear", "helical gear", "reducer", "gear selection"],
    hindiKeywords: ["gearbox", "gear box", "gear ratio", "speed reducer"],
    patterns: [/gearbox|gear.*box|gear.*ratio|worm.*gear|helical.*gear|reducer/i],
    weight: 1.5,
    conciseResponse: "Gearbox: T = F×R/(η×i). WPA-80 (3.7kW, 10:1) to WPA-200 (30kW, 50:1). Helical η=95%, worm η=75%. Use 1.5× service factor.",
    response: `**Gearbox Selection — Roll Forming Drive**

**Required Torque Formula:**
\`\`\`
T_output = (F × R) / (η × i)
F = forming force (N)
R = roll radius (m)
η = gearbox efficiency
i = gear ratio
\`\`\`

**Standard Gearbox Sizes (WPA/WPO Series — India):**
| Motor | Model | Ratio | Output RPM | Output Torque | η |
|-------|-------|-------|------------|---------------|---|
| 3.7 kW | WPA-80 | 10:1 | 140 | 252 Nm | 0.72 |
| 5.5 kW | WPA-100 | 15:1 | 93 | 564 Nm | 0.75 |
| 7.5 kW | WPA-120 | 20:1 | 70 | 1023 Nm | 0.75 |
| 11 kW | WPA-135 | 25:1 | 56 | 1874 Nm | 0.76 |
| 15 kW | WPA-155 | 30:1 | 47 | 3050 Nm | 0.77 |
| 22 kW | WPA-175 | 40:1 | 35 | 6000 Nm | 0.78 |
| 30 kW | WPA-200 | 50:1 | 28 | 10200 Nm | 0.78 |

**Helical Gearboxes (R/K/F series — SEW/Nord):**
- Efficiency: 95–97%
- Recommended: >5.5kW (save 15-20% energy vs worm)
- More expensive but better ROI for 3-shift production

**Gear Ratio Selection for Line Speed:**
\`\`\`
i = (Motor RPM × π × Roll OD) / (Line Speed × 1000)
Example: 1440 RPM, Ø160mm roll, 20 m/min:
i = (1440 × π × 0.160) / 20 = **36:1**
\`\`\`
Service factor: 1.5× minimum | Oil: ISO VG 220 (worm), VG 150 (helical)`
  },

  {
    id: "profile_types",
    keywords: ["c channel", "z purlin", "hat section", "u channel", "omega", "trapezoid", "tube roll", "box section", "angle section", "l angle"],
    hindiKeywords: ["c channel", "z purlin", "profile", "shape", "section"],
    patterns: [/c.*channel|z.*purlin|hat.*section|u.*channel|omega.*profile|trapez|tube.*roll|box.*section/i],
    weight: 1.5,
    conciseResponse: "C-Channel: 10-14 stations. Z-Purlin: 14-18 (asymmetric). Hat: 12-16. Tube/Box: 18-24 with fin pass. Calculate strip width first.",
    response: `**Profile Type Design Reference**

**C-Channel (Most Common):**
- Symmetrical, 4 bends (2×90° + 2×90° lip)
- Station count: 12–16 (GI), 16–20 (HSLA)
- Form: Return leg first, then main flanges
- Typical: 200×75×20×2mm GI → 12 stations, 7.5kW

**Z-Purlin (Roof Structure):**
- Asymmetrical — left ≠ right side
- 6 bends, 2 90° main flanges (opposite direction) + 4 lip bends
- Requires MIRROR image tooling for opposite hand
- Station count: 14–18, motor 11–15kW

**Hat Section (Decking/Flooring):**
- 4 bends × 90° = 360° total
- Wide web + narrow flanges + short lips
- Tip: Form web stiffener first if present
- Station count: 12–16

**Square/Rectangular Tube:**
- 4 bends × 90° + fin pass + HF weld
- Fin pass: closes section to <0.5mm gap for welding
- Motor: 22–37kW (includes weld generator)
- Station count: 18–26 (forming) + 3–6 fin pass

**Trapezoid Panel (Roof Cladding):**
- High-speed (25–40m/min), thin material 0.4–0.7mm GI
- Many shallow bends (5–15°), no 90° bends
- Station count: 20–30 (many partial bends)
- Motor: 5.5–7.5kW`
  },

  {
    id: "line_speed_production",
    keywords: ["line speed", "production rate", "output", "throughput", "pieces per hour", "m per min", "productivity"],
    hindiKeywords: ["line speed", "production", "output", "pieces", "throughput"],
    patterns: [/line.*speed|production.*rate|output.*calc|pieces.*hour|productivity/i],
    weight: 1.5,
    conciseResponse: "Production = 60 × line_speed / piece_length (pcs/hr). OEE 75-85%. GI panel 30-50 m/min, purlin 12-25 m/min, SS 8-15 m/min.",
    response: `**Line Speed & Production Rate Calculation**

**Production Formula:**
\`\`\`
Pieces/hour = (60 × line_speed_m_min) / piece_length_m
Output_kg/hr = line_speed × 60 × weight_per_meter
Effective = Theoretical × OEE_factor (0.75–0.85 typical)
\`\`\`

**Standard Line Speeds by Profile:**
| Profile | Material | Speed (m/min) | Notes |
|---------|----------|--------------|-------|
| Shutter patti | GI 0.5mm | 40–60 | Fastest |
| Trapezoid panel | GI 0.5mm | 25–45 | Pre-punched |
| Light C-purlin | GI 1.0mm | 20–35 | Standard |
| C/Z purlin 200mm | GI 1.5mm | 12–22 | Pre-punch slows |
| C/Z purlin 300mm | HSLA 2.5mm | 8–15 | Heavy forming |
| Guard rail | MS 3.0mm | 5–10 | Heavy |
| Tube 50×50 | CR 1.5mm | 15–25 | Weld speed limit |
| SS profile | SS 1.5mm | 8–15 | -30% vs GI |

**Example Calculation:**
Line speed: 18 m/min, piece length: 6m, GI 1.5mm, 4.5 kg/m
- Pieces/hr = 60×18/6 = **180 pcs/hr** (theoretical)
- With 80% OEE: **144 pcs/hr** (effective)
- Output: 18×60×4.5 = **4,860 kg/hr** (theoretical)
- Coil change 5 min every 20 min → add to OEE calculation`
  },

  {
    id: "coil_handling",
    keywords: ["decoiler", "coil", "uncoiler", "mandrel", "coil car", "straightener", "leveler", "looping pit"],
    hindiKeywords: ["decoiler", "coil", "mandrel", "straightener"],
    patterns: [/decoiler|coil.*handl|uncoiler|straightener|leveler/i],
    weight: 1.0,
    conciseResponse: "Decoiler: 3-10 ton capacity, 480-530mm mandrel. Straightener: 5-roll (≤1.5mm), 7-roll (≤2.5mm), 9-roll (≤4mm). Looping pit for speed buffer.",
    response: `**Coil Handling Equipment — Complete System**

**Decoiler (Uncoiler) Selection:**
| Capacity | Coil OD | Coil Width | Thickness Range |
|----------|---------|------------|-----------------|
| 3 tons | ≤1200mm | ≤600mm | 0.4–2.0mm |
| 5 tons | ≤1500mm | ≤1000mm | 0.5–3.0mm |
| 8 tons | ≤1800mm | ≤1250mm | 1.0–4.0mm |
| 10 tons | ≤2000mm | ≤1500mm | 1.5–6.0mm |

**Features needed:**
- Hydraulic mandrel expansion (4 or 6 segment)
- Motorized (1.5–5.5 kW) with regenerative brake
- Coil car for loading (hydraulic, same capacity as decoiler)
- Peel-off arm to start strip edge

**Straightener/Leveler:**
| Configuration | Thickness | Roll Ø | Motor |
|---------------|-----------|--------|-------|
| 5-roll | 0.4–1.5mm | 60mm | 1.5–2.2kW |
| 7-roll | 0.5–2.5mm | 75mm | 2.2–3.7kW |
| 9-roll | 1.0–4.0mm | 100mm | 3.7–7.5kW |

**Looping Pit:**
- Length: 5–8m (for coil change without stopping line)
- Sensor: photoelectric to control decoiler speed
- Required when: line speed >20 m/min or pre-punch station present`
  },

  {
    id: "roll_gap",
    keywords: ["roll gap", "gap setting", "gap adjustment", "clearance roll", "die gap"],
    hindiKeywords: ["roll gap", "gap setting", "clearance", "gap"],
    patterns: [/roll.*gap|gap.*sett|gap.*adjust|clearance.*roll/i],
    weight: 1.5,
    conciseResponse: "Roll gap = material thickness × 1.05 to 1.10 (5-10% extra). Use feeler gauge or dial indicator. First 5 pieces: measure and adjust.",
    response: `**Roll Gap Setting — Critical Setup Procedure**

**Roll Gap Formula:**
\`\`\`
Roll Gap = T × (1.05 to 1.10)
T = material thickness (mm)
\`\`\`

**Gap by Material:**
| Material | Gap Factor | Example (T=2.0mm) |
|----------|-----------|------------------|
| GI (soft) | T × 1.08 | 2.16mm |
| Cold Rolled | T × 1.06 | 2.12mm |
| SS 304 | T × 1.05 | 2.10mm (tighter) |
| Aluminium | T × 1.10 | 2.20mm (more) |
| HSLA | T × 1.05 | 2.10mm (tight) |

**Gap Setting Procedure:**
1. Calculate theoretical gap from above formula
2. Set all stations to theoretical gap using dial indicator
3. Run first piece at SLOW speed (30% of production)
4. Measure key dimensions at 3 points (start, mid, end)
5. Adjust problem stations: if too tight → increase gap; if loose → decrease
6. Run second piece, re-measure
7. Acceptable when all dimensions within ±0.3mm of drawing
8. Record final gap setting on setup sheet for repeat jobs

**Common Gap Problems:**
- Gap too tight: Roll marking, edge cracking, roll wear
- Gap too loose: Poor profile dimensions, springback worse
- Uneven gap L/R: Causes twist in profile
- ALWAYS use: same thickness feeler gauge as material gauge`
  },

  {
    id: "insert_selection",
    keywords: ["insert", "carbide insert", "cnc insert", "insert grade", "tool insert", "cutting insert", "tnmg", "cnmg", "dcmt", "vcgt", "insert for steel", "insert for ss"],
    hindiKeywords: ["insert", "tool", "cnc tool", "carbide"],
    patterns: [/insert.*grade|carbide.*insert|tool.*insert|turning.*insert|insert.*for/i],
    weight: 1.5,
    conciseResponse: "Steel: TNMG 160408 (grade P25). SS: DCMT 11T308 (PVD TiAlN). Al: CCGT 09T308 (sharp, uncoated). Grooving: N151.2-300. Threading: 16ER AG60.",
    response: `**Cutting Insert Selection Guide**

**By Material:**
| Material | Insert | Grade | Vc (m/min) | f (mm/rev) | Geometry |
|----------|--------|-------|-----------|-----------|----------|
| Mild Steel | TNMG 160408 | P25-P35 | 100–180 | 0.15–0.35 | -6° rake |
| CR/HR Steel | CNMG 120408 | P20-P30 | 120–200 | 0.15–0.30 | |
| SS 304 | DCMT 11T308 | M10-M20 | 80–130 | 0.10–0.20 | PVD TiAlN |
| SS 316 | VCMT 110304 | M05-M15 | 60–110 | 0.08–0.15 | High pos rake |
| Aluminium | CCGT 09T308 | K10 uncoated | 200–500 | 0.15–0.40 | Sharp edge |
| Cast Iron | CNMG 120408 | K15-K25 | 80–140 | 0.20–0.40 | Chamfer |
| D2 Tool Steel | VCMT 110304 | H10-H20 | 60–90 | 0.08–0.15 | PVD AlTiN |
| Titanium | VNMG 160404 | M10 ultra | 30–60 | 0.06–0.12 | Sharp |

**For Roll Forming Tooling:**
- **OD turning rolls:** TNMG 160408-PM P25 (Sandvik GC4325 or Iscar IC5005)
- **Boring roll bore:** CCMT 09T304-HM K20 (for H7 bore)
- **Grooving (snap ring):** N151.2-300-5E-GF GC1125 (3mm width)
- **Threading:** 16ER 1.5ISO AG60 (M-thread inserts)
- **Internal threading bore:** 16IR 2.0ISO AG60

**Insert Code Explanation (TNMG 160408):**
T=shape(triangle), N=clearance(neutral), M=tolerance, G=chip breaker, 16=size(16mm IC), 04=thickness(4mm), 08=nose radius(0.8mm)`
  },

  {
    id: "boring_setup",
    keywords: ["boring", "boring bar", "bore turning", "internal turning", "bore finish", "chatter boring"],
    hindiKeywords: ["boring", "bore", "andar turning"],
    patterns: [/boring.*bar|bore.*turn|internal.*turn|bore.*finish|chatter.*boring/i],
    weight: 1.5,
    conciseResponse: "Boring: L/D ratio ≤4 (rigid), ≤7 (anti-vibration bars). Vc same as OD turning. Reduce DOC to 0.5-1mm. f=0.08-0.15 mm/rev for finish. CCMT insert.",
    response: `**Boring Bar Setup — CNC Lathe**

**L/D Ratio Rules:**
| L/D Ratio | Recommendation |
|-----------|---------------|
| ≤ 3:1 | Standard bar, no issues |
| 3–4:1 | Check bar clamping tightness |
| 4–7:1 | Use anti-vibration (AVS) boring bar |
| > 7:1 | Not recommended — vibration severe |

**Typical Boring Parameters:**
| Operation | Vc (m/min) | f (mm/rev) | ap (mm) |
|-----------|-----------|-----------|---------|
| Rough boring | 80–120 | 0.15–0.25 | 1.0–2.0 |
| Semi-finish | 100–140 | 0.10–0.15 | 0.5–1.0 |
| Finish boring | 120–160 | 0.06–0.10 | 0.1–0.3 |

**Roll Bore Turning Procedure:**
1. Rough bore: leave 0.5mm on diameter
2. Measure bore with bore gauge (3-point micrometer)
3. Fine bore: target H7 tolerance
   - Example: Ø50H7 = 50.000 to +0.025mm
4. Final measurement with internal micrometer
5. If within tolerance: chamfer edges 1×45°

**Chatter Solutions:**
- Reduce overhang length (shorter bar)
- Use AVS bar (anti-vibration)
- Reduce feedrate 20–30%
- Increase Vc 10–15%
- Change insert geometry (more positive rake)
- Check workpiece clamping — must be rigid
- Try change tool orientation by 5–10°`
  },

  {
    id: "cnc_program_structure",
    keywords: ["program structure", "cnc program", "g-code structure", "program format", "cnc code", "how to write gcode", "gcode program"],
    hindiKeywords: ["program likhna", "cnc program", "code", "gcode likhna"],
    patterns: [/program.*structur|cnc.*program|how.*to.*write.*gcode|gcode.*format/i],
    weight: 1.5,
    conciseResponse: "Structure: O(number) → Home(G28) → Tool(T) → Spindle(G96/G97) → Approach(G00) → Cycle(G71/G70) → Home → M30.",
    response: `**CNC Lathe Program Structure — Roll Turning**

\`\`\`gcode
O1001                          (1. Program number)
(DESCRIPTION: UPPER ROLL ST1)  (2. Comment)

G28 U0. W0.                    (3. Home reference return)

T0101                          (4. Tool + offset call)
G96 S120 M03                   (5. CSS or RPM + spindle direction)
G92 S2500                      (6. Max RPM limit - FANUC)
G00 X[stock+5] Z2.0 M08        (7. Rapid approach + coolant ON)

G71 U2.0 R0.5                  (8. ROUGHING CYCLE line 1)
G71 P100 Q200 U0.4 W0.1 F0.28  (9. ROUGHING CYCLE line 2)
N100 [profile start]           (10. Profile definition start)
...
N200 [profile end]             (11. Profile definition end)

T0303 M09                      (12. Change to finishing tool)
G96 S160 M03                   (13. Higher speed for finish)
G92 S3000
G00 X[stock+5] Z3.0 M08
G70 P100 Q200 F0.10            (14. FINISHING CYCLE)

T0500                          (15. Threading/grooving tool if needed)
G97 S600 M03
G76 P020060 Q100 R0.1
G76 X[minor] Z[end] R0 P[depth] Q[1st_cut] F[pitch]

G28 U0. W0. M09 M05            (16. Return home + coolant off + spindle off)
M30                            (17. End + reset)
\`\`\`

**Tool Offset Structure (T XXXX):**
- T0101 = Tool 1, Offset 1
- T0303 = Tool 3, Offset 3
- T0100 = Tool 1, cancel offset
- ALWAYS cancel offset before G28 on old Fanuc controllers`
  },

  {
    id: "material_database",
    keywords: ["material properties", "material database", "steel grade", "tensile strength", "yield strength", "elongation", "material spec"],
    hindiKeywords: ["material", "dhatu", "loha", "tensile", "yield"],
    patterns: [/material.*prop|material.*db|steel.*grade|tensile.*strength|yield.*strength/i],
    weight: 1.0,
    conciseResponse: "GI: UTS 380MPa, Yield 280MPa. CR: UTS 440MPa, Yield 340MPa. SS304: UTS 620MPa, Yield 310MPa. D2 tool: UTS 2050MPa after HT.",  // FIX: GI yield 250→280 UTS 350→380; CR yield 280→340 UTS 400→440
    response: `**Material Properties Database — Roll Forming**

**Strip/Sheet Materials:**
| Material | UTS (MPa) | Yield (MPa) | Elongation (%) | Density | Mod. E |
|----------|-----------|-------------|----------------|---------|--------|
| GI Z120–Z275 | 270–380 | 220–320 | 20–30 | 7.85 | 210 GPa |
| CR ST12 | 280–400 | 220–340 | 25–35 | 7.85 | 210 GPa |
| HR S235 | 360–500 | 235–360 | 22–30 | 7.85 | 210 GPa |
| MS Grade 2 | 400–500 | 250–300 | 18–25 | 7.85 | 210 GPa |
| SS 304 | 520–620 | 210–310 | 40–50 | 7.93 | 193 GPa |
| SS 316 | 515–690 | 205–310 | 35–45 | 7.98 | 193 GPa |
| Al 5052 | 195–260 | 90–215 | 20–30 | 2.68 | 70 GPa |
| Al 6061-T6 | 290–310 | 240–276 | 8–15 | 2.70 | 69 GPa |
| HSLA S355 | 430–550 | 355–450 | 18–24 | 7.85 | 210 GPa |
| DP 600 | 590–700 | 340–420 | 20–28 | 7.85 | 207 GPa |
| Copper C110 | 220–300 | 70–250 | 20–40 | 8.96 | 117 GPa |
| Titanium Ti-6Al-4V | 950–1050 | 880–950 | 10–15 | 4.43 | 115 GPa |  // FIX: UTS 900-1000→950-1050, Yield 830-900→880-950, E 114→115 GPa (ASTM B265 Gr5)

**Tool Steel Properties (Post Heat Treatment):**
| Grade | HRC | UTS (MPa) | Yield (MPa) | Density |
|-------|-----|-----------|-------------|---------|
| D2 | 58–62 | 2050 | 1750 | 7.70 |
| H13 | 44–50 | 1800 | 1500 | 7.76 |
| A2 | 57–62 | 1950 | 1600 | 7.86 |
| S7 | 54–56 | 1760 | 1450 | 7.78 |`
  },

];

// ─── Advanced Scoring Engine ─────────────────────────────────────────────────
// TF-IDF style: score each KB entry, pick top 1-2 matching entries

function findBestMatches(query: string, topN = 2): KBEntry[] {
  const scored = KB.map(entry => ({
    entry,
    score: scoreEntry(query, entry),
  })).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map(s => s.entry);
}

// ─── Main Response Builder ────────────────────────────────────────────────────

export function buildOfflineResponse(message: string, style: string, language: string): string {
  const isConcise = style === "concise";
  const matches = findBestMatches(message, 2);

  if (matches.length === 0) {
    return buildDefaultResponse(message, isConcise);
  }

  // Single best match — use full response
  const primary = matches[0];
  const response = isConcise ? primary.conciseResponse : primary.response;

  // If second match is high quality and different topic — append brief hint
  if (!isConcise && matches.length > 1 && matches[1]) {
    const secondScore = scoreEntry(message, matches[1]);
    const firstScore = scoreEntry(message, matches[0]);
    if (secondScore > firstScore * 0.7) {
      return response + `\n\n---\n**Related:** ${matches[1].conciseResponse}`;
    }
  }

  return response;
}

// ─── Fallback for unknown topics ──────────────────────────────────────────────
function buildDefaultResponse(message: string, concise: boolean): string {
  const topics = [
    "G71/G70 roughing+finishing cycle", "G75 grooving", "G76 threading",
    "G96/G97 spindle speed", "Strip width calculation", "Flower pattern design",
    "Springback compensation", "Station count", "Roll OD design", "Shaft diameter",
    "Bearing L10 life (ISO 281)", "Roll blank raw size", "Roll material (D2/H13)",
    "Heat treatment", "Defect diagnosis", "Forming force & motor kW",
    "Keyway DIN 6885", "Gearbox selection", "Quality tolerances DIN EN 10162",
    "Maintenance schedule", "Line speed / production rate", "Delta CNC 2X",
    "Cutting parameters (RPM/MRR/Ra/Tc)", "Insert selection by material",
    "Boring bar setup", "CNC program structure",
  ];

  if (concise) {
    return `Topic not found in offline KB. Available topics: ${topics.slice(0, 8).join(", ")} + ${topics.length - 8} more. Go online for broader queries.`;
  }

  return `**SAI Rolotech AI — Offline Mode**

Aapka sawaal samajh mein nahi aaya ya topic offline KB mein nahi hai.

**Available Offline Topics (${topics.length}):**
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

**Try asking about:**
- "G71 cycle kaise likhte hain?" 
- "SS 304 ke liye springback kitna?"
- "C-channel ka strip width calculate karo 200×75×20mm t=2mm"
- "Roll OD kya hona chahiye?"
- "Bearing L10 life formula?"
- "D2 steel ka heat treatment?"

**For complex queries:** Switch to Online mode (internet required) for AI-powered detailed answers.`;
}
