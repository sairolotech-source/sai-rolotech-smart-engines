export interface KBEntry {
  patterns: RegExp[];
  keywords: string[];
  response: string;
}

export const EXPANDED_KB: KBEntry[] = [
  {
    patterns: [/bearing|skf|nsk|timken|6205|6206|6305|6308|pillow\s*block/i],
    keywords: ["bearing", "skf", "nsk", "timken", "pillow block", "6205", "6206", "6305", "6308"],
    response: `**Bearing Selection — Roll Forming Machines**

**Standard Bearing Table (by Shaft Diameter):**
| Shaft Ø | Bearing | Bore | OD | Width | Load (kN) | Speed (RPM) |
|---------|---------|------|----|----|-----------|-------------|
| 30mm | 6206-2RS | 30 | 62 | 16 | 19.5 | 11,000 |
| 35mm | 6207-2RS | 35 | 72 | 17 | 25.5 | 9,500 |
| 40mm | 6208-2RS | 40 | 80 | 18 | 29.0 | 8,500 |
| 45mm | 6209-2RS | 45 | 85 | 19 | 33.2 | 7,500 |
| 50mm | 6210-2RS | 50 | 90 | 20 | 35.1 | 6,700 |
| 55mm | 6211-2RS | 55 | 100 | 21 | 43.6 | 6,000 |
| 60mm | 6212-2RS | 60 | 110 | 22 | 52.0 | 5,600 |
| 70mm | 6214-2RS | 70 | 125 | 24 | 61.8 | 4,800 |
| 80mm | 6216-2RS | 80 | 140 | 26 | 72.0 | 4,300 |

**Heavy Duty (4-row tapered for high thrust):**
| Shaft Ø | Bearing | Type | Load (kN) |
|---------|---------|------|-----------|
| 40mm | 32208 | Tapered | 62.0 |
| 50mm | 32210 | Tapered | 82.0 |
| 60mm | 32212 | Tapered | 100.0 |

**Rules:**
- ALWAYS use 2RS (sealed) for roll forming — prevents lubricant contamination
- Min life: L10 = 20,000 hours for production machines
- Lubrication: SKF LGMT2 grease, re-grease every 500 operating hours
- Pillow block (UCP series) for outboard supports
- Temperature limit: 80°C continuous, 120°C peak
- Shaft tolerance: h6, Housing bore: H7`
  },
  {
    patterns: [/gearbox|gear\s*box|worm\s*gear|ratio|reducer|helical\s*gear|bevel/i],
    keywords: ["gearbox", "gear box", "worm gear", "ratio", "reducer", "helical", "bevel", "gear ratio"],
    response: `**Gearbox Selection — Roll Forming Lines**

**Gearbox Sizing Formula:**
- Required torque: T = (F × R) / (η × i)
- F = forming force (N), R = roll radius (m), η = efficiency, i = gear ratio

**Standard Gearbox Sizes:**
| Motor (kW) | Gearbox | Ratio | Output RPM | Output Torque (Nm) |
|-----------|---------|-------|------------|-------------------|
| 3.7 | WPA-80 | 10:1 | 140 | 252 |
| 5.5 | WPA-100 | 15:1 | 93 | 564 |
| 7.5 | WPA-120 | 20:1 | 70 | 1023 |
| 11 | WPA-135 | 25:1 | 56 | 1874 |
| 15 | WPA-155 | 30:1 | 47 | 3050 |
| 22 | WPA-175 | 40:1 | 35 | 6000 |
| 30 | WPA-200 | 50:1 | 28 | 10200 |

**Type Selection:**
- **Worm gear** (WPA/NMRV): Most common, self-locking, 60-90% efficiency
- **Helical** (R/K/S/F series): Higher efficiency (95-97%), longer life
- **Bevel-helical**: For right-angle drives, high torque applications

**Gear Ratio Guidelines:**
- Light forming (GI ≤1mm): 10-15:1
- Medium (MS 1-2mm): 15-25:1
- Heavy (SS/AHSS 2-4mm): 25-50:1
- Purlin lines (HSLA 1.5-3mm): 20-40:1

**CRITICAL:** Always select gearbox with 1.5× service factor minimum`
  },
  {
    patterns: [/motor|vfd|inverter|kw|horsepower|drive|servo|frequency/i],
    keywords: ["motor", "vfd", "inverter", "kw", "horsepower", "drive", "servo", "frequency"],
    response: `**Motor & VFD Selection — Roll Forming Machines**

**Motor Power Calculation:**
P (kW) = (F × v) / (1000 × η)
- F = total forming force (N), v = line speed (m/min), η = overall efficiency (0.7-0.85)

**Standard Motor Sizes:**
| Application | Motor kW | Pole | RPM | Current (A) |
|------------|---------|------|-----|-------------|
| Small C-purlin (100mm) | 5.5 | 4 | 1440 | 11.5 |
| Medium C-purlin (200mm) | 7.5-11 | 4 | 1440 | 15-22 |
| Large Z-purlin (300mm) | 15-22 | 4 | 1440 | 30-43 |
| Trapez panel (0.5mm GI) | 5.5-7.5 | 4 | 1440 | 11-15 |
| Guard rail (W-beam) | 22-37 | 4 | 1440 | 43-70 |
| Heavy structural | 37-55 | 4 | 1440 | 70-105 |

**VFD Sizing:**
- VFD rating = Motor kW × 1.2 (derating factor)
- Braking resistor: ALWAYS for decel-heavy applications
- V/f mode for simple, Vector mode for torque control
- Carrier frequency: 4-8 kHz (higher = quieter but more heat)

**Servo Drives (for punch/shear):**
- Punch servo: 2-5 kW, 3000 RPM, encoder feedback
- Flying shear: 5-15 kW servo with position sync to line speed

**Cable:** Use shielded VFD cable, max 50m motor-to-VFD without output reactor`
  },
  {
    patterns: [/station\s*count|number\s*of\s*stations|how\s*many\s*stations|pass\s*count/i],
    keywords: ["station count", "number of stations", "how many stations", "pass count", "stations needed"],
    response: `**Station Count Design Guide — Complete Reference**

**Calculation Method:**
N_min = Σ(bend angles) / (max increment per station)
N_actual = N_min + 2 (entry guide) + 2-3 (calibration/ironing)

**Material-Based Max Increment:**
| Material | Max °/Station | Recommended | Notes |
|----------|--------------|-------------|-------|
| GI (Z120-Z275) | 15° | 10-12° | Most forgiving |
| MS (CR/HR) | 12° | 8-10° | Standard |
| SS 304/316 | 10° | 6-8° | High springback |
| AL 6061/5052 | 12° | 8-10° | Soft, low springback |
| HSLA 350-550 | 10° | 7-9° | Stronger than MS |
| DP 600/780 | 8° | 5-7° | Very high springback |
| TRIP 780 | 8° | 5-6° | Non-linear behavior |
| Titanium | 6° | 4-5° | Extreme springback |

**Profile-Based Station Count:**
| Profile | Typical Range | Example |
|---------|--------------|---------|
| C-Channel (90° flanges) | 10-16 | 100mm depth: 12 stations |
| Z-Purlin (90° flanges + lips) | 14-20 | 200mm: 16 stations |
| Hat Section (2×90°) | 12-18 | 150mm: 14 stations |
| U-Channel (2×90°) | 8-12 | Simple 80mm: 10 stations |
| Box Section (4×90°) | 16-24 | With weld: 20 stations |
| Guard Rail (W-beam) | 18-26 | Complex: 22 stations |
| Standing Seam (360°) | 8-12 | Double-lock: 10 stations |

**Station Spacing:**
- Standard: 200-300mm (light duty)
- Heavy duty: 300-400mm
- High-speed lines: 250mm (closer = less strip sag)`
  },
  {
    patterns: [/station\s*gap|station\s*spacing|distance\s*between|roll\s*pitch/i],
    keywords: ["station gap", "station spacing", "distance between stations", "roll pitch"],
    response: `**Station Spacing (Gap) Design**

**Standard Spacing by Application:**
| Machine Type | Spacing (mm) | Reason |
|-------------|-------------|--------|
| Light purlin/panel | 200-250 | Low force, thin material |
| Medium purlin (≤200mm) | 250-300 | Standard production |
| Heavy purlin (≤300mm) | 300-400 | Higher forming forces |
| Guard rail / structural | 350-450 | Very high forces |
| Tube mill (round) | 200-250 | Continuous forming |
| High-speed panel (>30m/min) | 200-250 | Reduce strip sag |

**Shaft Center Distance:**
- Top shaft to bottom shaft center = Roll OD_upper + Roll OD_lower + material thickness + clearance (0.1mm)
- Example: Ø150 upper + Ø150 lower + 2mm material + 0.1mm = 302.1mm shaft center

**Frame Design:**
- Pillar type: C-frame or closed frame
- C-frame: quick roll change, max 30kN forming force
- Closed frame: 50-200kN, better rigidity
- Frame material: IS 2062 Grade E250 or equivalent

**Critical Rule:** ALL stations must have IDENTICAL center height (pass line) ±0.05mm`
  },
  {
    patterns: [/roll\s*diameter|roll\s*od|roll\s*size|upper\s*roll|lower\s*roll/i],
    keywords: ["roll diameter", "roll od", "roll size", "upper roll", "lower roll", "roll od"],
    response: `**Roll Diameter Design Guide**

**Standard Roll OD by Application:**
| Application | Upper OD (mm) | Lower OD (mm) | Material |
|------------|--------------|--------------|----------|
| Light panel (≤1mm) | 100-120 | 120-140 | EN31 HRC 58-62 |
| Medium purlin (1-2mm) | 130-160 | 150-180 | EN31 HRC 58-62 |
| Heavy purlin (2-3mm) | 160-200 | 180-220 | D3 HRC 60-63 |
| Structural (3-6mm) | 200-280 | 220-300 | D3 HRC 60-63 |
| Guard rail | 200-250 | 220-280 | EN31 HRC 58-62 |
| Tube mill | 150-200 | 150-200 | D3/D6 HRC 60-63 |

**Rules:**
- Min OD = 10 × shaft diameter (rigidity rule)
- Max face width = 3 × OD (deflection limit)
- Upper OD typically 10-20mm smaller than lower OD
- Surface finish: Ra 0.4-0.8µm (ground + polished)
- Roll bore tolerance: H7 (Ø50H7, Ø60H7, Ø70H7)
- Shaft tolerance: h6 (Ø50h6)

**Roll Bore Selection:**
| Shaft Ø | Bore (H7) | Keyway (DIN 6885) |
|---------|-----------|-------------------|
| 30mm | 30H7 | 8×7mm |
| 40mm | 40H7 | 12×8mm |
| 50mm | 50H7 | 14×9mm |
| 60mm | 60H7 | 18×11mm |
| 70mm | 70H7 | 20×12mm |
| 80mm | 80H7 | 22×14mm |

**Hardening:** Full through-hardening or induction hardened to 3mm depth`
  },
  {
    patterns: [/machine\s*frame|pillar|housings|base\s*frame|side\s*plate/i],
    keywords: ["machine frame", "pillar", "housing", "base frame", "side plate", "structure"],
    response: `**Machine Frame & Structure Design**

**Frame Types:**
| Type | Max Force (kN) | Use Case |
|------|---------------|----------|
| C-Frame (open) | 20-30 | Light panels, quick roll change |
| Closed Frame | 50-200 | Medium-heavy forming |
| Monoblock | 100-500 | Heavy structural, high precision |
| Rafted Design | 200+ | Largest machines, tube mills |

**Standard Side Plate Dimensions:**
| Machine Class | Plate Thick (mm) | Width (mm) | Height (mm) |
|-------------|-----------------|-----------|-------------|
| Light | 30-40 | 200-250 | 300-400 |
| Medium | 50-65 | 250-350 | 400-550 |
| Heavy | 70-100 | 350-500 | 550-800 |

**Material:** IS 2062 E250 (mild steel plate), stress-relieved after welding
**Base:** CI casting or fabricated from 20-30mm plate, leveled to ±0.1mm

**Shaft Support:**
- Bearings in pillow blocks (UCP series) or housed units
- Inboard + outboard support per shaft
- Adjustable eccentric for gap setting (upper shaft)

**Surface Treatment:** Epoxy primer + polyurethane topcoat (RAL 5015 or 7035)`
  },
  {
    patterns: [/line\s*speed|production\s*speed|m\/min|meters?\s*per\s*minute|throughput/i],
    keywords: ["line speed", "production speed", "m/min", "meters per minute", "throughput", "feed rate"],
    response: `**Line Speed & Production Rate Guide**

**Typical Line Speeds:**
| Profile | Material | Speed (m/min) | Notes |
|---------|----------|--------------|-------|
| Trapezoidal panel | GI 0.5mm | 25-40 | Fastest profile type |
| Standing seam | GI 0.6mm | 15-25 | Lock forming slows it |
| C-Purlin 100mm | GI 1.5mm | 12-20 | Pre-punch slows line |
| C-Purlin 200mm | HSLA 2mm | 8-15 | Heavier forming |
| Z-Purlin 300mm | HSLA 2.5mm | 6-12 | Complex profile |
| Guard rail | MS 3mm | 5-10 | Very heavy forming |
| Tube mill (Ø50) | CR 1.5mm | 15-30 | Welding speed limit |
| Structural (box) | MS 4mm | 3-8 | Heavy gauge |

**Speed Limiting Factors:**
1. Forming force (heavier = slower)
2. Pre-punch/notch cycle time
3. Flying shear cut speed
4. Coil unwind speed
5. Run-out table / stacker speed

**Production Calculation:**
Pieces/hour = (60 × line_speed) / piece_length
Example: 15 m/min, 6m pieces = 60×15/6 = **150 pieces/hour**
With 80% OEE: 150×0.8 = **120 pieces/hour** effective`
  },
  {
    patterns: [/coil|decoiler|uncoiler|mandrel|coil\s*width|coil\s*weight/i],
    keywords: ["coil", "decoiler", "uncoiler", "mandrel", "coil width", "coil weight"],
    response: `**Coil Handling & Decoiler Design**

**Standard Coil Sizes (India/Asia):**
| Material | Width (mm) | Thickness (mm) | Coil ID (mm) | Coil OD (mm) | Weight (kg) |
|----------|-----------|---------------|-------------|-------------|-------------|
| GI | 900-1250 | 0.35-1.0 | 508-610 | 1200-1500 | 3000-8000 |
| MS CR | 600-1500 | 0.5-3.0 | 508-610 | 1200-1800 | 5000-15000 |
| HSLA | 600-1500 | 1.5-4.0 | 508-610 | 1200-1500 | 5000-12000 |
| SS 304 | 600-1500 | 0.5-3.0 | 508-610 | 1200-1500 | 3000-8000 |

**Decoiler Types:**
| Type | Capacity (kg) | Coil Width | Motor |
|------|-------------|-----------|-------|
| Manual (light) | 1000-3000 | 300-600mm | None |
| Motorized single | 3000-7000 | 500-1250mm | 2.2-5.5 kW |
| Motorized double | 5000-10000 | 500-1500mm | 5.5-11 kW |
| Hydraulic heavy | 10000-20000 | 600-1500mm | 15-30 kW |

**Mandrel Expansion:** Hydraulic or mechanical, 4 or 6 segment
**Coil Car:** Hydraulic, capacity = coil weight + 20%
**Straightener/Leveler:** 7 or 9 roll, powered, before roll former`
  },
  {
    patterns: [/shear|cut\s*off|flying\s*cut|guillotine|hydraulic\s*shear|punch/i],
    keywords: ["shear", "cut off", "flying cut", "guillotine", "hydraulic shear", "punch", "die cut"],
    response: `**Shear & Cut-Off Systems**

**Types:**
| Type | Speed | Accuracy | Use |
|------|-------|----------|-----|
| Stop & cut (hydraulic) | Low | ±0.5mm | Simple profiles |
| Flying shear (servo) | High | ±0.3mm | High-speed lines |
| Rotary die cut | Very high | ±0.2mm | Panel lines |
| Post-cut (stationary) | Medium | ±0.5mm | Heavy profiles |

**Flying Shear Design:**
- Servo motor: 5-15 kW
- Acceleration: track line speed in 50-100ms
- Blade material: D2/SKD11 HRC 58-62
- Blade clearance: 5-10% of material thickness per side
- Cut cycle time: 0.3-1.0 sec depending on profile

**Pre-Punch System:**
- Hydraulic press: 20-60 ton
- Servo position: ±0.1mm repeatability
- Die material: SKD11/D2 HRC 58-62
- Standard holes: service holes, connection holes, slot holes

**Shear Force Calculation:**
F = 0.7 × L × t × σ_UTS
L = cut perimeter (mm), t = thickness (mm), σ_UTS in MPa
Example: C-purlin 200mm, t=2mm, UTS=450: F = 0.7×640×2×450 = **403 kN (41 ton)**`
  },
  {
    patterns: [/lubrication|lubricant|oil|grease|coolant|forming\s*oil/i],
    keywords: ["lubrication", "lubricant", "oil", "grease", "coolant", "forming oil"],
    response: `**Lubrication & Forming Fluids**

**Roll Forming Lubricants:**
| Material | Lubricant Type | Application | Notes |
|----------|---------------|-------------|-------|
| GI/PPGI | Dry / light oil | Spray nozzle | Avoid stripping zinc |
| MS | Mineral oil SAE 20 | Drip/spray | Standard forming |
| SS 304/316 | Chlorinated oil | Brush/flood | Prevents galling |
| Aluminium | Light mineral oil | Mist spray | Avoid staining |
| Copper | Mineral oil | Drip | Prevents oxidation |
| Titanium | Extreme pressure (EP) | Brush | Must use EP additives |

**Bearing Grease:**
- SKF LGMT2 (lithium complex, -30 to +120°C)
- Re-grease interval: every 500 operating hours
- Amount: Volume = D × B × 0.005 (ml) where D=bore, B=width

**Gearbox Oil:**
- ISO VG 220 (worm gear) or ISO VG 150 (helical)
- Change interval: 5000 hours or annually
- Level check: weekly

**CRITICAL:** NEVER use silicone-based lubricants on rolls — contaminates paint/coating
**GI Rule:** Minimal lubricant to preserve zinc coating integrity`
  },
  {
    patterns: [/tolerance|dimension|accuracy|inspection|quality\s*control|qc|cpk|spc/i],
    keywords: ["tolerance", "dimension", "accuracy", "inspection", "quality control", "qc", "cpk", "spc"],
    response: `**Quality Control & Tolerances**

**Dimensional Tolerances (per DIN EN 10162):**
| Dimension | Tolerance |
|-----------|----------|
| Profile height | ±1.0mm (≤100mm), ±1% (>100mm) |
| Flange width | ±1.0mm |
| Lip length | ±0.5mm |
| Bend angle | ±1.0° |
| Straightness | 1mm per meter max |
| Twist | 2° per meter max |
| Profile length | ±2mm (≤6m), ±3mm (>6m) |
| Web flatness | 3mm per meter max |
| Hole position | ±0.5mm |

**SPC Targets:**
- Cpk ≥ 1.33 for critical dimensions
- Cpk ≥ 1.67 for safety-critical (automotive)
- Measurement: digital caliper, profile projector, CMM

**Inspection Frequency:**
- First piece: 100% measurement
- Production: every 50th piece or every 15 minutes
- Coil change: first 3 pieces 100%
- After roll change: first 5 pieces 100%

**Common Measurement Tools:**
- Digital caliper (±0.01mm)
- Angle protractor (±0.5°)
- Straightness gauge (1m reference)
- Profile projector (for complex cross-sections)`
  },
  {
    patterns: [/weld|tig|mig|erw|hf\s*weld|seam\s*weld|spot\s*weld/i],
    keywords: ["weld", "tig", "mig", "erw", "hf weld", "seam weld", "spot weld", "welding"],
    response: `**Welding in Roll Forming / Tube Mills**

**ERW (Electric Resistance Welding) — Tube Mills:**
| Parameter | Value | Notes |
|-----------|-------|-------|
| Frequency | 200-400 kHz (HF) | Higher = shallower HAZ |
| Power | 50-200 kW | Based on thickness & speed |
| Squeeze pressure | 3-6% OD | Forge rolls compress joint |
| V-angle | 3-7° | Angle at weld point |
| Weld speed | 10-60 m/min | Matched to forming speed |

**Weld Bead Removal:**
- OD scarfing: carbide insert tool
- ID scarfing: internal mandrel-mounted tool
- Scarfing allowance: 0.2-0.5mm above parent surface

**Post-Weld Treatment:**
| Treatment | Temperature | Purpose |
|-----------|-------------|---------|
| Normalizing | 900-950°C | Grain refinement |
| Stress relief | 550-650°C | Remove residual stress |
| Seam annealing | 700-800°C (induction) | Soften HAZ |

**Spot/Stitch Welding (for assemblies):**
- Spot weld: 2-4 kA, 8-12 cycles
- Electrode: Class II (CrCu), Ø6-8mm tip
- Nugget diameter = 4√t (t in mm)

**Weld Testing:** Flattening test, reverse bend, metallographic section, ultrasonic`
  },
  {
    patterns: [/surface\s*finish|coating|galvan|ppgi|paint|powder\s*coat|anodiz/i],
    keywords: ["surface finish", "coating", "galvanized", "ppgi", "paint", "powder coat", "anodize"],
    response: `**Surface Finish & Coatings**

**Galvanized Coating (GI):**
| Grade | Coating (g/m²) | Thickness (µm) | Application |
|-------|---------------|----------------|-------------|
| Z100 | 100 | 7 | Indoor, dry |
| Z120 | 120 | 8.5 | Standard indoor |
| Z180 | 180 | 12.5 | Mild outdoor |
| Z275 | 275 | 19.5 | Heavy outdoor, coastal |
| Z450 | 450 | 32 | Severe marine |

**Pre-painted (PPGI/PPGL):**
- Topcoat: 20-25µm polyester (standard) or 35µm PVDF (premium)
- Backing coat: 5-7µm
- Color: RAL system, custom colors available
- Minimum bend radius: 2T for polyester, 3T for PVDF

**Roll Surface Finish Impact:**
| Roll Ra (µm) | Effect |
|-------------|--------|
| 0.2-0.4 | Mirror finish, coating-safe |
| 0.4-0.8 | Standard production |
| 0.8-1.6 | Acceptable, may mark soft materials |
| >1.6 | Too rough — will damage GI/PPGI |

**Rules:** Polish rolls to Ra 0.4µm for coated materials. Chrome-plated rolls last 5× longer.`
  },
  {
    patterns: [/maintenance|preventive|pm|breakdown|troubleshoot\s*machine|machine\s*problem/i],
    keywords: ["maintenance", "preventive", "pm", "breakdown", "troubleshoot machine", "machine problem"],
    response: `**Machine Maintenance Schedule**

**Daily (every shift):**
- Check roll gaps with feeler gauge
- Inspect lubrication points (oil level/drip rate)
- Listen for unusual bearing noise
- Check strip tracking (centering)
- Verify shear blade condition

**Weekly:**
- Grease all bearing points
- Check hydraulic oil level
- Inspect electrical connections
- Clean accumulated debris/chips
- Verify emergency stops

**Monthly:**
- Check shaft alignment (±0.05mm/m)
- Inspect keyways for wear
- Measure roll runout (max 0.02mm TIR)
- Check gearbox oil level
- Inspect V-belts/chain tension
- Test all safety guards

**Quarterly:**
- Full bearing inspection (temperature, noise, play)
- Gearbox oil sample (metal particle analysis)
- Hydraulic system filter change
- Motor insulation test (Megger)
- Re-calibrate all sensors

**Annually:**
- Full machine alignment check
- Replace all filters (oil, air, hydraulic)
- Gearbox oil change
- Bearing replacement (if L10 life exceeded)
- Roll regrind/replacement schedule review

**Critical Spare Parts (always in stock):**
Bearings (2 sets), shear blades (1 set), hydraulic seals, drive belts, encoder`
  },
  {
    patterns: [/cost|price|estimate|budget|roi|payback|investment/i],
    keywords: ["cost", "price", "estimate", "budget", "roi", "payback", "investment"],
    response: `**Cost Estimation & ROI**

**Machine Cost Estimates (India, 2024-25):**
| Machine Type | Stations | Approx Cost (₹ Lakhs) |
|-------------|----------|----------------------|
| Manual panel line | 8-12 | 15-30 |
| Auto trapez panel | 14-18 | 40-80 |
| C-Purlin (basic) | 12-16 | 50-90 |
| C-Purlin (auto) | 14-18 | 80-150 |
| Z-Purlin (auto) | 16-22 | 90-180 |
| C+Z Interchange | 18-24 | 120-250 |
| Guard rail | 20-26 | 150-300 |
| Tube mill (ERW) | 20-30 | 200-500 |

**Roll Tooling Cost:**
- Light profile: ₹3-8 lakhs per set
- Medium profile: ₹8-15 lakhs per set
- Heavy profile: ₹15-30 lakhs per set
- CNC machined: add 20-30% premium

**ROI Calculation:**
- Revenue/month = pieces × selling_price
- Profit/month = Revenue - (material + power + labor + maintenance)
- ROI months = Total investment / monthly profit
- Typical ROI: 12-24 months for panel lines, 18-36 months for purlin lines

**Operating Costs (typical):**
- Power: ₹8-15/hour (11-22 kW motor)
- Labor: 2-3 operators per shift
- Maintenance: 3-5% of machine cost per year
- Rolls: regrind every 200-500 km of production`
  },
  {
    patterns: [/standard|din|iso|astm|is\s*\d|en\s*\d|jis|bis/i],
    keywords: ["standard", "din", "iso", "astm", "is 1079", "en 10162", "jis", "bis", "specification"],
    response: `**Relevant Standards for Roll Forming**

**Material Standards:**
| Standard | Scope |
|----------|-------|
| IS 1079 | CR steel sheets/strips (India) |
| IS 277 | GI sheets (India) |
| EN 10346 | Continuously hot-dip coated steel (EU) |
| ASTM A653 | Hot-dip zinc-coated steel (US) |
| EN 10149-2 | HSLA steel (EU) |
| JIS G3302 | Hot-dip galvanized (Japan) |

**Product Standards:**
| Standard | Scope |
|----------|-------|
| EN 10162 | Cold-formed steel sections — tolerances |
| IS 811 | Cold-formed light gauge steel sections |
| AS/NZS 1397 | Steel sheet — metallic coated |
| AISI S100 | Cold-formed steel design (North America) |
| EN 1993-1-3 | Eurocode 3: Cold-formed members |

**Machine Standards:**
| Standard | Scope |
|----------|-------|
| DIN 6935 | Cold bending of flat products |
| ISO 12100 | Machine safety — general principles |
| IEC 60204-1 | Electrical equipment of machines |
| EN 13031 | Roll forming machine safety |
| ISO 1101 | Geometrical tolerancing |

**Testing Standards:**
| Standard | Scope |
|----------|-------|
| IS 1599 | Bend test for metallic materials |
| ASTM E8 | Tensile testing |
| ISO 6892 | Metallic materials — tensile test |
| EN 10002-1 | Tensile testing of metallic materials |`
  },
  {
    patterns: [/electrical|plc|hmi|sensor|encoder|proximity|limit\s*switch|control\s*panel/i],
    keywords: ["electrical", "plc", "hmi", "sensor", "encoder", "proximity", "limit switch", "control panel"],
    response: `**Electrical & Control Systems**

**PLC Selection:**
| Brand | Model | I/O | Use |
|-------|-------|-----|-----|
| Siemens | S7-1200 | 14DI/10DO | Small-medium lines |
| Siemens | S7-1500 | 32DI/32DO | Large/complex lines |
| Mitsubishi | FX5U | 16DI/16DO | Cost-effective |
| Allen Bradley | CompactLogix | Scalable | Export machines |
| Delta | DVP-ES2 | 16DI/16DO | Budget lines |

**HMI:** 7" or 10" color touchscreen (Siemens KTP/Weintek)
- Recipe management for profile changeover
- Production counters, alarm history
- Diagnostic screens

**Sensors Required:**
| Sensor | Type | Purpose |
|--------|------|---------|
| Strip detector | Photoelectric | Material presence |
| Length encoder | Rotary (2500 PPR) | Piece length measurement |
| Home sensor | Proximity (inductive) | Shear position |
| Strip edge | Photoelectric | Centering check |
| Motor overload | Thermal relay | Motor protection |
| E-stop | Safety relay | Emergency stop (Cat. 3) |
| Guard interlock | Safety switch | Door/guard monitoring |

**Wiring Standard:** IEC 60204-1
- Control voltage: 24V DC
- Main power: 415V 3-phase 50Hz (India) / 380V 60Hz (export)
- Cable: flame-retardant (FRLS), shielded for VFD`
  },
  {
    patterns: [/c.?channel|c.?profile|c.?section|c.?purlin\s*design|lip\s*channel/i],
    keywords: ["c-channel", "c profile", "c section", "c-purlin design", "lip channel", "c channel"],
    response: `**C-Channel / C-Purlin — Complete Design Reference**

**Standard C-Channel Sizes (IS 811 / EN 10162):**
| Depth (mm) | Flange (mm) | Lip (mm) | Thickness (mm) | Weight (kg/m) |
|-----------|-----------|---------|---------------|--------------|
| 75 | 40 | 12 | 1.6 | 1.74 |
| 100 | 50 | 15 | 1.6 | 2.32 |
| 100 | 50 | 15 | 2.0 | 2.87 |
| 125 | 50 | 15 | 2.0 | 3.18 |
| 150 | 65 | 15 | 2.0 | 3.95 |
| 150 | 65 | 20 | 2.5 | 5.12 |
| 200 | 75 | 20 | 2.0 | 5.02 |
| 200 | 75 | 20 | 2.5 | 6.22 |
| 200 | 75 | 25 | 3.0 | 7.86 |
| 250 | 75 | 25 | 2.5 | 7.37 |
| 250 | 80 | 25 | 3.0 | 9.14 |
| 300 | 80 | 25 | 3.0 | 10.04 |

**Forming Sequence (12-station example for 200×75×20×2.0):**
Station 1: Entry guide, 0° (flat strip)
Station 2: Top lip pre-bend 30°
Station 3: Top lip 60°
Station 4: Top lip 90° + flange start 15°
Station 5: Flange 30°
Station 6: Flange 45°
Station 7: Flange 60°
Station 8: Flange 75°
Station 9: Flange 87° (pre-springback)
Station 10: Flange 93° (overbend for springback)
Station 11: Calibration (iron to 90°)
Station 12: Final sizing + exit guide

**Machine Specs for 200mm C-Purlin:**
- Motor: 7.5-11 kW
- Stations: 12-16
- Line speed: 10-18 m/min
- Roll material: EN31 HRC 58-62
- Roll OD: 150mm upper / 170mm lower
- Shaft: Ø50mm (EN24, hardened & ground)
- Bearings: 6210-2RS (Ø50 bore)
- Gearbox: 20:1 ratio, helical
- Station spacing: 280mm`
  },
  {
    patterns: [/strip\s*width\s*calc|bend\s*allowance|bend\s*deduction|flat\s*pattern|k.?factor\s*calc/i],
    keywords: ["strip width calculation", "bend allowance", "bend deduction", "flat pattern", "k-factor calculation"],
    response: `**Strip Width / Flat Pattern Calculation — Complete**

**Master Formula:**
Strip Width = Σ(flat segments) + Σ(bend allowances)

**Bend Allowance (BA):**
BA = π × (R + K × t) × (θ / 180)
R = inside bend radius, K = K-factor, t = thickness, θ = bend angle (degrees)

**Bend Deduction (BD):**
BD = 2 × (R + t) × tan(θ/2) - BA
This is what you subtract from the outside dimensions.

**K-Factor Table (DIN 6935, extended):**
| R/t Ratio | MS | SS | AL | Copper | Titanium |
|-----------|------|------|------|--------|----------|
| 0.5 | 0.33 | 0.36 | 0.38 | 0.40 | 0.30 |
| 1.0 | 0.35 | 0.38 | 0.40 | 0.42 | 0.32 |
| 1.5 | 0.37 | 0.40 | 0.42 | 0.43 | 0.34 |
| 2.0 | 0.38 | 0.42 | 0.44 | 0.44 | 0.36 |
| 3.0 | 0.40 | 0.43 | 0.45 | 0.45 | 0.38 |
| 5.0 | 0.42 | 0.44 | 0.46 | 0.46 | 0.40 |
| 8.0 | 0.44 | 0.46 | 0.47 | 0.47 | 0.42 |
| ≥10 | 0.46 | 0.47 | 0.48 | 0.48 | 0.44 |

**Example — C-Channel 200×75×20×2.0mm (GI):**
| Segment | Dimension | Bend? | Length |
|---------|-----------|-------|--------|
| Bottom lip | 20mm | — | 20.00 |
| Bend 1 (90°) | R=2, K=0.38 | BA | 3.98 |
| Left flange | 75mm | — | 75.00 |
| Bend 2 (90°) | R=2, K=0.38 | BA | 3.98 |
| Web | 200mm | — | 200.00 |
| Bend 3 (90°) | R=2, K=0.38 | BA | 3.98 |
| Right flange | 75mm | — | 75.00 |
| Bend 4 (90°) | R=2, K=0.38 | BA | 3.98 |
| Top lip | 20mm | — | 20.00 |
| **TOTAL** | | | **401.92mm** |

Strip width = **402mm** (rounded to nearest mm)`
  },
  {
    patterns: [/forming\s*force|bend\s*force|tonnage|press\s*force|forming\s*load/i],
    keywords: ["forming force", "bend force", "tonnage", "press force", "forming load"],
    response: `**Forming Force Calculation — Complete Reference**

**Karnezis Model (most accurate for roll forming):**
F = (σ_y × t² × w) / (2 × R) × (1 + µ × L_c/t)
- σ_y = yield strength (MPa)
- t = thickness (mm)
- w = forming width (mm)
- R = bend radius (mm)
- µ = friction coefficient (0.10-0.15)
- L_c = contact arc length = √(R × t × Δε)

**Per-Station Force Table:**
| Material | t (mm) | 90° bend | Force/station (kN) |
|----------|--------|----------|-------------------|
| GI | 0.5 | Single flange | 0.8-1.5 |
| GI | 1.0 | Single flange | 3-6 |
| MS | 1.5 | Single flange | 8-15 |
| MS | 2.0 | Single flange | 15-25 |
| SS 304 | 1.5 | Single flange | 12-22 |
| SS 304 | 2.0 | Single flange | 22-38 |
| HSLA 450 | 2.5 | Single flange | 30-50 |
| HSLA 550 | 3.0 | Single flange | 45-75 |

**Total Machine Force:**
F_total = Σ(station forces) × 1.3 (safety factor)

**Motor Torque from Force:**
T = F × R_roll / (1000 × η)
P = T × ω = T × 2π × n / 60

**Example — C-Purlin 200×75×2.0 GI (12 stations):**
Per station ≈ 8kN, Total ≈ 12×8×1.3 = **125 kN**
Motor: T = 125000×0.085/0.8 = 13.3 kNm → via 20:1 gear → **7.5 kW motor**`
  },
  {
    patterns: [/heat\s*treat|hardness|hrc|tempering|quench|carburiz|nitrid|case\s*hard/i],
    keywords: ["heat treatment", "hardness", "hrc", "tempering", "quench", "carburize", "nitride", "case harden"],
    response: `**Heat Treatment for Roll Forming Tooling**

**Roll Materials & Hardness:**
| Material | Hardness | Application |
|----------|----------|-------------|
| EN31 (52100) | HRC 58-62 | Standard forming rolls |
| D3 (AISI D3) | HRC 60-64 | Heavy duty, abrasive materials |
| D2 (AISI D2) | HRC 58-62 | Shear blades, punch dies |
| SKD11 (D2 variant) | HRC 58-62 | Japanese equivalent |
| M2 HSS | HRC 62-65 | High-speed, extreme wear |
| WC-Co (carbide) | HRA 88-92 | Titanium, Inconel forming |

**Heat Treatment Cycle (EN31):**
1. Preheat: 650°C, hold 30 min
2. Austenitize: 840°C, hold 30 min
3. Quench: oil (60-80°C)
4. Temper 1: 180°C × 2 hours → HRC 62
5. Temper 2: 200°C × 2 hours → HRC 60 (tougher)

**Surface Treatments:**
| Treatment | Depth | Hardness | Life Increase |
|-----------|-------|----------|--------------|
| Chrome plating | 20-50µm | 70 HRC | 3-5× |
| Nitriding | 0.2-0.5mm | 1000 HV | 2-3× |
| PVD TiN | 2-5µm | 2200 HV | 5-10× |
| PVD TiAlN | 2-5µm | 3300 HV | 8-15× |
| TD (Toyota Diffusion) | 5-15µm | 3500 HV | 10-20× |

**Chrome Plating:** Best ROI for GI/PPGI forming (prevents zinc pickup)`
  },
  {
    patterns: [/shaft|key|keyway|coupling|spline|drive\s*shaft/i],
    keywords: ["shaft", "key", "keyway", "coupling", "spline", "drive shaft"],
    response: `**Shaft & Drive Design**

**Standard Shaft Sizes:**
| Application | Shaft Ø (mm) | Material | Tolerance |
|------------|-------------|----------|-----------|
| Light panel | 30-40 | EN8 | h6 |
| Medium purlin | 40-55 | EN24 | h6 |
| Heavy purlin | 55-70 | EN24 | h6 |
| Structural/tube | 70-100 | EN24/EN36 | h6 |

**Keyway Standards (DIN 6885):**
| Shaft Ø | Key W×H | Keyway Depth (shaft) | Keyway Depth (hub) |
|---------|---------|---------------------|-------------------|
| 30 | 8×7 | 4.0 | 3.3 |
| 40 | 12×8 | 5.0 | 3.3 |
| 50 | 14×9 | 5.5 | 3.8 |
| 60 | 18×11 | 7.0 | 4.4 |
| 70 | 20×12 | 7.5 | 4.9 |
| 80 | 22×14 | 9.0 | 5.4 |

**Shaft Material Properties:**
- EN8: Yield 350 MPa, UTS 550 MPa — light duty
- EN24 (4340): Yield 680 MPa, UTS 850 MPa — standard
- EN36 (3310): Case hardened to HRC 60 — heavy duty

**Coupling Types:**
| Type | Misalignment | Torque | Use |
|------|-------------|--------|-----|
| Jaw (Lovejoy) | ±1° angular | Low-medium | Motor to gearbox |
| Gear coupling | ±0.5° | High | Gearbox to roll shaft |
| Chain coupling | ±1° | Medium | Drive chain |
| Universal joint | ±15° | Medium | Angled drives |

**Drive Chain:** Duplex roller chain (08B-2 / 10B-2), lubricated, chain guard mandatory`
  },
  {
    patterns: [/entry\s*guide|exit\s*guide|strip\s*guide|feeding|coil\s*feed|straighten/i],
    keywords: ["entry guide", "exit guide", "strip guide", "feeding", "coil feed", "straightener"],
    response: `**Entry/Exit Guide & Material Handling**

**Entry Section (in order):**
1. Decoiler (motorized, with brake)
2. Coil car (hydraulic, for loading)
3. Pinch rolls (2-roll, powered)
4. Straightener/leveler (7 or 9 roll)
5. Edge guide (adjustable V-guides)
6. Pre-punch press (if required)
7. Servo feeder (encoder-controlled)
8. Entry funnel guide → first forming station

**Entry Guide Design:**
- Funnel shape: 10-15mm wider than strip at entry, narrowing to strip width + 0.5mm
- Material: hardened EN31 or bronze (for coated materials)
- Adjustable laterally ±20mm for centering
- Spring-loaded top guide to accommodate thickness variation

**Exit Section:**
1. Flying shear or post-cut
2. Run-out table (roller conveyor, 3-6m)
3. Length measurement (encoder wheel)
4. Stacker/bundler (auto or manual)

**Exit Guide:**
- Support the formed profile immediately after last station
- Prevent twist, bow, or flare during cutting
- Roller support every 500mm for long profiles

**Straightener Settings:**
- Roll overlap: 2-5mm more than material thickness
- For GI 0.5mm: overlap 3mm
- For MS 2.0mm: overlap 5mm
- For HSLA 3.0mm: overlap 7mm`
  },
  {
    patterns: [/iso\s*9001|quality\s*system|documentation|traceability|audit/i],
    keywords: ["iso 9001", "quality system", "documentation", "traceability", "audit"],
    response: `**Quality Management System (ISO 9001)**

**Required Documentation for Roll Forming:**
1. **Incoming Material Certificate** — Mill test certificate (EN 10204 3.1)
2. **First Article Inspection Report (FAIR)** — All dimensions vs drawing
3. **In-Process Inspection** — Station setup sheet, gap measurements
4. **Final Inspection Report** — Profile dimensions, length, straightness
5. **Packing & Dispatch** — Bundle weight, qty, loading photos

**Traceability Chain:**
Coil Heat No → Strip Width/Thickness → Machine/Line No → Operator → Shift → Piece Serial

**Process Control Documents:**
- Setup sheet (per profile): roll gaps, station sequence, speeds
- Maintenance log: PM schedule, breakdown history
- Calibration records: measuring instruments, annual calibration

**Key Quality Records:**
- Control plan
- FMEA (Failure Mode & Effects Analysis)
- SPC charts (X-bar R, individual moving range)
- Corrective action reports (8D format)
- Customer complaint register

**Audit Checklist (annual):**
- Instrument calibration status ✓
- Roll condition records ✓
- Operator training records ✓
- Non-conformance handling ✓
- Customer feedback review ✓`
  },

  {
    patterns: [/springback\s*kya|spring\s*back\s*kya|springback\s*ko\s*kaise|springback\s*control|spring\s*wapas/i],
    keywords: ["springback kya", "spring back", "springback control", "spring wapas", "elastic recovery"],
    response: `**Springback — Roll Forming Mein Kya Hota Hai**

Springback woh phenomenon hai jab metal bend hone ke baad thoda seedha ho jaata hai — elastic recovery ki wajah se.

**Kyun hota hai:**
- Har metal mein elastic zone hota hai
- Plastic deformation ke baad, elastic energy release hoti hai
- Metal apni original shape mein thoda wapas aata hai

**Springback Formula:**
\`\`\`
Springback Angle = Bend Angle × (1 - σy/(E × k))
σy = Yield Strength
E  = Young's Modulus
k  = bending factor
\`\`\`

**Material ke hisaab se Springback:**
| Material | Springback |
|----------|-----------|
| Mild Steel (GI) | 2-5° |
| Stainless Steel | 8-15° |
| Aluminium | 10-20° |
| High Strength Steel | 15-25° |

**Control karne ke tarike:**
1. Over-bend karo (target se zyada)
2. Overbending compensation add karo G-code mein
3. Station count badhao
4. Pass line height adjust karo`
  },

  {
    patterns: [/roll\s*gap\s*kya|roll\s*ka\s*gap|gap\s*kaise\s*set|roll\s*gap\s*adjust|nip\s*gap/i],
    keywords: ["roll gap kya", "roll ka gap", "gap kaise set karein", "nip gap", "roll gap adjust"],
    response: `**Roll Gap — Kya Hai Aur Kaise Set Karein**

Roll gap = upper roll aur lower roll ke beech ki distance.

**Sahi Roll Gap Formula:**
\`\`\`
Roll Gap = Material Thickness + Clearance
Clearance = 5-15% of thickness (material ke hisaab se)
\`\`\`

**Material ke hisaab se Gap:**
| Material | Thickness | Recommended Gap |
|----------|-----------|-----------------|
| GI Sheet | 0.5mm | 0.55-0.57mm |
| GI Sheet | 1.0mm | 1.07-1.12mm |
| GI Sheet | 1.5mm | 1.60-1.68mm |
| SS Sheet | 1.0mm | 1.10-1.15mm |
| SS Sheet | 2.0mm | 2.12-2.20mm |

**Problem aaye to:**
- Gap zyada → Profile loose, dimensions galat
- Gap kam → Material pe pressure zyada, roll wear zyada
- Ideal gap mein material smoothly pass kare bina force ke`
  },

  {
    patterns: [/material\s*kaun\s*sa|konsa\s*material|material\s*select|gi\s*vs\s*ss|galvanized\s*vs/i],
    keywords: ["konsa material", "material select", "gi vs ss", "galvanized vs stainless", "material kaisa"],
    response: `**Roll Forming ke liye Material Selection Guide**

**GI Sheet (Galvanized Iron) — Sabse Common:**
- Cost: Kam
- Corrosion resistance: Achha (zinc coating ki wajah se)
- Formability: Bahut achha
- Use: Roofing, purlins, channels, C-sections
- Thickness: 0.3mm to 2.0mm

**Stainless Steel (SS 304/316):**
- Cost: 3-5x zyada GI se
- Corrosion resistance: Bahut zyada
- Formability: Thoda mushkil (springback zyada)
- Use: Food industry, chemical plants, coastal areas
- Thickness: 0.5mm to 3.0mm

**Pre-painted (PPGI):**
- GI pe colour coating
- Roofing panels ke liye
- Roll forming ke baad paint scratch nahi hona chahiye

**High Strength Steel (HSS):**
- Structural applications
- Station count zyada chahiye
- Tooling wear zyada

**Meri Recommendation:**
- Normal construction → GI (cost-effective)
- Coastal/chemical → SS 316
- Coloured roofing → PPGI`
  },

  {
    patterns: [/flower\s*diagram\s*kya|flower\s*pattern\s*kya|roll\s*flower|flower\s*kaise\s*banate/i],
    keywords: ["flower diagram kya", "flower pattern", "roll flower", "flower kaise banate"],
    response: `**Flower Diagram — Roll Forming Mein Kya Hai**

Flower diagram = ek visual representation jisme dikhta hai material har station pe kaise bend hota hai.

**Kaise Kaam Karta Hai:**
1. Final profile ka cross-section dekho
2. Har station pe bending angle calculate karo
3. Station 1 = flat material
4. Last station = final profile shape
5. Beech mein gradually bend badhta hai

**Flower Diagram Mein Kya Dikhta Hai:**
- Har station ka cross-section
- Bending angles (gradually badhte hain)
- Strip width at each station
- Roll contact points

**SAI Rolotech Software Mein:**
- Profile → Station count daalo
- Software automatically flower generate karta hai
- 3D view mein dekh sakte ho
- G-code bhi isi se generate hota hai

**Rule of Thumb:**
- Simple profile (C-channel) = 4-6 stations
- Complex profile (Z-purlin) = 8-12 stations
- Each bend = minimum 2 stations`
  },

  {
    patterns: [/gcode\s*kya|g-code\s*kya|cnc\s*code\s*kya|gcode\s*kaise\s*banate|g\s*code\s*generate/i],
    keywords: ["gcode kya", "g-code kya", "cnc code", "gcode kaise", "g code generate"],
    response: `**G-Code — Roll Forming Machine ke liye**

G-Code = CNC machine ko instructions dene ki language.

**Basic G-Code Commands:**
\`\`\`
G00 - Rapid move (tez chalao)
G01 - Linear move (feed rate pe chalao)
G02 - Clockwise arc
G03 - Counter-clockwise arc
M03 - Spindle/roll start
M05 - Stop
M30 - Program end
\`\`\`

**Roll Forming G-Code mein hota hai:**
- Station positions
- Roll gap values
- Feed speed
- Cutoff length
- Pass line height

**SAI Rolotech Software se G-Code:**
1. Profile banao
2. Material select karo (GI/SS/etc)
3. Machine parameters daalo
4. "Generate G-Code" click karo
5. Download karke machine mein load karo

**Format:** '.nc' ya '.gcode' file — seedha machine pe load hoti hai`
  },

  {
    patterns: [/station\s*kitne|kitne\s*station|station\s*count\s*kaise|stations\s*ka\s*number|pass\s*kitne/i],
    keywords: ["station kitne", "kitne station chahiye", "station count", "passes kitne", "station number"],
    response: `**Stations Ka Number Kaise Decide Karein**

**Basic Rule:**
\`\`\`
Stations = Total Bending Angle ÷ Angle Per Station
Angle per station = 15-20° for mild steel
                  = 10-15° for SS/HSS
\`\`\`

**Profile ke hisaab se:**
| Profile | Minimum Stations | Recommended |
|---------|-----------------|-------------|
| C-Channel | 4 | 6-7 |
| Z-Purlin | 6 | 8-10 |
| Hat Section | 5 | 7-8 |
| Box Profile | 8 | 10-12 |
| Complex Rib | 10 | 14-16 |

**Zyada stations ke fayde:**
- Better shape accuracy
- Less springback
- Less tooling wear

**Kam stations ke fayde:**
- Kam machine cost
- Choti machine
- Jaldi production

**Software mein:** Profile daalo → software recommend karta hai minimum stations`
  },

  {
    patterns: [/machine\s*speed|roll\s*forming\s*speed|production\s*speed|meter\s*per\s*minute|mpm/i],
    keywords: ["machine speed", "roll forming speed", "production speed", "meter per minute", "mpm"],
    response: `**Roll Forming Machine Speed Guide**

**Standard Speeds:**
| Application | Speed (m/min) |
|-------------|--------------|
| Simple profiles | 15-25 m/min |
| Complex profiles | 8-15 m/min |
| Heavy gauge (3mm+) | 5-10 m/min |
| Precision profiles | 3-8 m/min |
| High speed lines | 30-60 m/min |

**Speed affect karne wale factors:**
1. Profile complexity
2. Material thickness
3. Material type (SS = slow, GI = fast)
4. Number of stations
5. Cutoff mechanism type

**Speed formula:**
\`\`\`
Production (m/hr) = Speed (m/min) × 60 × Efficiency%
Efficiency typical = 70-85%
\`\`\`

**Recommendation:**
- Naya machine → 15-20 m/min se shuru karo
- Quality check karo → phir speed badhao
- Zyada speed → zyada wear, zyada noise`
  },

  {
    patterns: [/roll\s*material|tooling\s*material|roll\s*konse\s*material|d2\s*steel|en31/i],
    keywords: ["roll material", "tooling material", "d2 steel", "en31", "roll kis material ka"],
    response: `**Roll Tooling Material — Kaun Sa Sabse Achha**

**Most Common: D2 Tool Steel (Best Choice)**
- Hardness: 58-62 HRC
- Wear resistance: Excellent
- Cost: Medium
- Life: 2-5 million meters
- Use: GI, PPGI, mild steel

**EN31 (Cheaper Alternative):**
- Hardness: 55-60 HRC
- Wear resistance: Good
- Cost: Kam
- Life: 0.5-1.5 million meters
- Use: Light gauge GI

**For Stainless Steel:**
- M2 HSS ya D2 with coating
- TiN coating (gold colour) — wear resistance badhata hai
- Life 3x zyada ho jaata hai

**Chrome Plating:**
- Surface hardness badhata hai
- Corrosion se bachata hai
- Surface finish better hoti hai

**Maintenance:**
- Rolls regular check karo
- Nick ya damage → regrind karwao
- Storage: oil coat karke raho`
  },

  {
    patterns: [/shaft\s*diameter|shaft\s*size|shaft\s*konsa|shaft\s*kya\s*hona\s*chahiye/i],
    keywords: ["shaft diameter", "shaft size", "shaft konsa", "shaft kya hona chahiye", "arbor size"],
    response: `**Shaft Diameter Selection — Roll Forming**

**Standard Shaft Sizes:**
| Machine Type | Shaft Dia | Material |
|-------------|-----------|---------|
| Light duty | 30-38mm | EN8/EN24 |
| Medium duty | 40-50mm | EN24/EN31 |
| Heavy duty | 55-75mm | EN24 hardened |
| Extra heavy | 80-100mm | Alloy steel |

**Selection Rule:**
\`\`\`
Shaft Dia = Roll OD ÷ 3 (minimum)
For 200mm roll → minimum 65mm shaft
\`\`\`

**Deflection check:**
- Max deflection = 0.05mm at center
- Agar zyada → shaft dia badhao

**Bearing selection:**
- Shaft 40mm → 6208 bearing
- Shaft 50mm → 6210 bearing
- Shaft 60mm → 6212 bearing

**SAI Rolotech Software mein:**
- Shaft diameter input field mein daalo
- Software automatically roll ID calculate karta hai`
  },

  {
    patterns: [/problem\s*aa\s*rahi|defect\s*kyon|profile\s*twist|warping\s*kyon|bow\s*kyon/i],
    keywords: ["problem aa rahi", "defect kyon", "profile twist", "warping", "bow defect", "profile galat"],
    response: `**Common Roll Forming Defects — Kyon Aate Hain**

**1. Twist (Profile Mura Hua)**
- Cause: Asymmetric loading, roll misalignment
- Fix: Rolls realign karo, guide tools check karo

**2. Bow (Upar/Neeche Muda)**
- Cause: Horizontal bow = pass line height galat
- Fix: Pass line height adjust karo

**3. Flare (End pe flare)**
- Cause: Strip edge stress imbalance
- Fix: Edge rolls ya side rolls add karo

**4. Wave Edge**
- Cause: Excess edge tension
- Fix: Strip width check karo, rolls tight mat rakho

**5. Camber (Side mein muda)**
- Cause: Uneven roll pressure
- Fix: Both sides ka gap equal set karo

**6. Cracking**
- Cause: Radius too tight, material too hard
- Fix: Bend radius badhao, heat treatment check karo

**Diagnosis Steps:**
1. Kaun sa defect hai identify karo
2. Kahan se start hota hai (station number)
3. Woh station check karo
4. Fix karo, test karo`
  },

  {
    patterns: [/power\s*kitna|motor\s*power|kW\s*kitna|horsepower|HP\s*kitna/i],
    keywords: ["power kitna", "motor power", "kW kitna", "horsepower", "motor HP"],
    response: `**Roll Forming Machine Motor Power Calculation**

**Basic Formula:**
\`\`\`
Power (kW) = Forming Force × Speed ÷ (1000 × Efficiency)
Forming Force = depends on material + thickness
\`\`\`

**Practical Guide:**
| Material Thickness | Profile Complexity | Motor Power |
|-------------------|-------------------|-------------|
| 0.4-0.8mm | Simple | 5-11 kW |
| 0.8-1.5mm | Medium | 11-22 kW |
| 1.5-3.0mm | Medium | 22-37 kW |
| 3.0-5.0mm | Heavy | 37-75 kW |

**Stations ke hisaab se:**
\`\`\`
Power per station = 0.5-2.0 kW (average)
Total = Stations × Power per station
\`\`\`

**Motor Type:**
- Standard: 3-phase induction motor
- VFD (Variable Frequency Drive) must → speed control ke liye
- Star-delta starter use karo (soft start)

**SAI Rolotech:** Forming force calculator se exact power milti hai`
  },

  {
    patterns: [/maintenance\s*kaise|machine\s*maintenance|service\s*kab|lubrication|grease\s*kab/i],
    keywords: ["maintenance kaise", "machine maintenance", "service kab", "lubrication", "grease kab"],
    response: `**Roll Forming Machine Maintenance Schedule**

**Rooz (Daily):**
- Roll surfaces clean karo
- Lubrication check karo (oil level)
- Unusual noise sun'no
- Gaps check karo

**Hafta (Weekly):**
- Bearings grease karo
- Chain/gear drive lubricate karo
- Roll condition visually inspect karo
- Fasteners tight hain check karo

**Mahina (Monthly):**
- Shaft alignment check karo
- Roll gap calibrate karo
- Electrical connections check karo
- Belt/chain tension adjust karo

**3 Mahine (Quarterly):**
- Bearing replacement check
- Roll surface condition measure karo
- Alignment full check
- Motor brushes (if DC)

**Saal (Annual):**
- Overhaul
- All bearings replace (preventive)
- Roll regrind if needed
- Machine level set karo

**Lubrication:**
- Bearings: Grease (Mobilux EP2 ya equivalent)
- Gearbox: EP80/90 gear oil
- Chains: Chain lube spray
- Rolls: Thin oil coat (rust prevention when idle)`
  },
];
