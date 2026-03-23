import { useState } from "react";

const DEMO_PROFILE = {
  name: "C-Channel 200×75×20×2.0",
  depth: 200, flange: 75, lip: 20, thickness: 2.0,
  material: "GI (IS 277, Z180 Coating)",
  yieldStrength: 250, uts: 370, kFactor: 0.38,
  bendRadius: 2.0, springback: "3-5°",
  stripWidth: 402,
};

const STATIONS = [
  { num: 1, name: "Entry Guide", angle: "0°", desc: "Flat strip entry — V-guide centering ±0.5mm", upperOD: 150, lowerOD: 170, gap: 2.1 },
  { num: 2, name: "Lip Pre-bend", angle: "30°", desc: "Top lip initial bend — gentle start (50% increment)", upperOD: 150, lowerOD: 170, gap: 2.1 },
  { num: 3, name: "Lip 60°", angle: "60°", desc: "Top lip to 60° — check edge strain <2%", upperOD: 150, lowerOD: 170, gap: 2.1 },
  { num: 4, name: "Lip 90° + Flange Start", angle: "90°+15°", desc: "Lip complete, flange starts at 15°", upperOD: 150, lowerOD: 170, gap: 2.1 },
  { num: 5, name: "Flange 30°", angle: "30°", desc: "Web-to-flange bend progressing", upperOD: 150, lowerOD: 170, gap: 2.1 },
  { num: 6, name: "Flange 45°", angle: "45°", desc: "Mid-forming — check strip tracking", upperOD: 150, lowerOD: 170, gap: 2.1 },
  { num: 7, name: "Flange 60°", angle: "60°", desc: "Heavy forming zone — max force here", upperOD: 150, lowerOD: 170, gap: 2.1 },
  { num: 8, name: "Flange 75°", angle: "75°", desc: "Approaching final angle", upperOD: 150, lowerOD: 170, gap: 2.1 },
  { num: 9, name: "Pre-springback", angle: "87°", desc: "2° short of target — prep for overbend", upperOD: 150, lowerOD: 170, gap: 2.05 },
  { num: 10, name: "Overbend", angle: "93°", desc: "3° overbend for springback compensation", upperOD: 150, lowerOD: 170, gap: 2.05 },
  { num: 11, name: "Calibration", angle: "90°", desc: "Ironing pass — 0.5-2° adjustment only", upperOD: 150, lowerOD: 170, gap: 2.03 },
  { num: 12, name: "Final Sizing + Exit", angle: "90°", desc: "Final profile sizing + exit guide support", upperOD: 150, lowerOD: 170, gap: 2.03 },
];

const MACHINE_SPECS = {
  motor: "7.5 kW, 4-pole, 1440 RPM, IE3",
  gearbox: "WPA-120, Ratio 20:1, Output 72 RPM, 995 Nm",
  vfd: "9 kW ABB ACS355 / Delta VFD-E",
  shaftDia: "Ø50mm EN24 (h6 tolerance, hardened & ground)",
  bearings: "6210-2RS (Ø50 bore, Ø90 OD, 20mm width, 35.1 kN load)",
  keyway: "14×9mm (DIN 6885), depth 5.5mm shaft / 3.8mm hub",
  rollMaterial: "EN31 HRC 58-62, surface Ra 0.4µm (ground + polished)",
  stationSpacing: "280mm center-to-center",
  passLine: "Constant ±0.05mm through all 12 stations",
  frame: "Closed frame, 65mm side plates, IS 2062 E250",
  decoiler: "Motorized, 5-ton capacity, 508mm mandrel, 3.7 kW",
  shear: "Hydraulic post-cut, 40 ton, D2 blades HRC 60",
  lineSpeed: "10-18 m/min (VFD controlled)",
  production: "60×15/6 = 150 pcs/hr (6m length), OEE 80% = 120 pcs/hr",
};

const BOM_ITEMS = [
  { item: "Upper Rolls (EN31)", qty: 12, unit: "nos", spec: "Ø150mm, bore Ø50H7, HRC 58-62" },
  { item: "Lower Rolls (EN31)", qty: 12, unit: "nos", spec: "Ø170mm, bore Ø50H7, HRC 58-62" },
  { item: "Spacers (MS)", qty: 48, unit: "nos", spec: "Ø50 bore, various widths" },
  { item: "Top Shafts (EN24)", qty: 12, unit: "nos", spec: "Ø50mm × 380mm, h6, hardened" },
  { item: "Bottom Shafts (EN24)", qty: 12, unit: "nos", spec: "Ø50mm × 380mm, h6, hardened" },
  { item: "Bearings (6210-2RS)", qty: 48, unit: "nos", spec: "SKF/NSK, Ø50×Ø90×20mm" },
  { item: "Pillow Blocks (UCP210)", qty: 24, unit: "nos", spec: "For outboard bearing support" },
  { item: "Keys (DIN 6885)", qty: 24, unit: "nos", spec: "14×9mm, EN8 material" },
  { item: "Side Plates (IS 2062)", qty: 24, unit: "nos", spec: "65mm thick, machined faces" },
  { item: "Base Frame", qty: 1, unit: "set", spec: "Fabricated, 20mm plate, leveled ±0.1mm" },
  { item: "Drive Motor (IE3)", qty: 1, unit: "nos", spec: "7.5 kW, 4-pole, 1440 RPM" },
  { item: "Gearbox (WPA-120)", qty: 1, unit: "nos", spec: "Ratio 20:1, 995 Nm output" },
  { item: "VFD", qty: 1, unit: "nos", spec: "9 kW, V/f mode, braking resistor" },
  { item: "Decoiler", qty: 1, unit: "set", spec: "5-ton motorized, 508mm mandrel" },
  { item: "Hydraulic Shear", qty: 1, unit: "set", spec: "40 ton, D2 blades, post-cut" },
  { item: "Run-out Table", qty: 1, unit: "set", spec: "6m roller conveyor, powered" },
  { item: "Control Panel", qty: 1, unit: "set", spec: "PLC S7-1200, 10\" HMI, sensors" },
  { item: "Entry Guide Assembly", qty: 1, unit: "set", spec: "Adjustable V-guide, hardened" },
  { item: "Straightener (7-roll)", qty: 1, unit: "set", spec: "Powered, for coil leveling" },
  { item: "Safety Guards", qty: 1, unit: "set", spec: "Full enclosure, interlocked" },
];

const STRIP_CALC = [
  { segment: "Bottom Lip", dim: 20, ba: null, length: 20.00 },
  { segment: "Bend 1 (90°)", dim: null, ba: "R=2, K=0.38", length: 3.98 },
  { segment: "Left Flange", dim: 75, ba: null, length: 75.00 },
  { segment: "Bend 2 (90°)", dim: null, ba: "R=2, K=0.38", length: 3.98 },
  { segment: "Web", dim: 200, ba: null, length: 200.00 },
  { segment: "Bend 3 (90°)", dim: null, ba: "R=2, K=0.38", length: 3.98 },
  { segment: "Right Flange", dim: 75, ba: null, length: 75.00 },
  { segment: "Bend 4 (90°)", dim: null, ba: "R=2, K=0.38", length: 3.98 },
  { segment: "Top Lip", dim: 20, ba: null, length: 20.00 },
];

type DemoTab = "overview" | "stations" | "machine" | "bom" | "strip" | "quality";

export function DemoCChannelPanel() {
  const [tab, setTab] = useState<DemoTab>("overview");

  const tabs: { id: DemoTab; label: string; icon: string }[] = [
    { id: "overview", label: "Profile Overview", icon: "📐" },
    { id: "stations", label: "12 Stations", icon: "⚙" },
    { id: "machine", label: "Machine Specs", icon: "🔧" },
    { id: "bom", label: "Full BOM", icon: "📦" },
    { id: "strip", label: "Strip Width Calc", icon: "📏" },
    { id: "quality", label: "QC & Tolerances", icon: "✅" },
  ];

  return (
    <div className="h-full overflow-auto bg-[#0a0b14] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/30 flex items-center justify-center">
            <span className="text-2xl">🏭</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Demo C-Channel — Complete Program
            </h2>
            <p className="text-zinc-500 text-sm">
              {DEMO_PROFILE.name} • {DEMO_PROFILE.material} • {DEMO_PROFILE.thickness}mm
            </p>
          </div>
          <div className="ml-auto px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <span className="text-green-400 text-sm font-bold">READY TO MANUFACTURE</span>
          </div>
        </div>

        <div className="flex gap-1 bg-[#12131f] p-1 rounded-xl border border-white/5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab />}
        {tab === "stations" && <StationsTab />}
        {tab === "machine" && <MachineTab />}
        {tab === "bom" && <BOMTab />}
        {tab === "strip" && <StripTab />}
        {tab === "quality" && <QualityTab />}
      </div>
    </div>
  );
}

function SectionCard({ title, children, icon }: { title: string; children: React.ReactNode; icon: string }) {
  return (
    <div className="bg-[#12131f] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <span>{icon}</span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="bg-[#12131f] border border-amber-500/20 rounded-xl p-6">
        <div className="flex items-start gap-8">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-amber-400 mb-4">C-Channel Cross Section</h3>
            <svg viewBox="0 0 400 300" className="w-full max-w-md">
              <rect x="50" y="20" width="4" height="40" fill="#f59e0b" opacity="0.8" />
              <rect x="50" y="56" width="150" height="4" fill="#f59e0b" opacity="0.8" />
              <rect x="196" y="56" width="4" height="188" fill="#f59e0b" opacity="0.8" />
              <rect x="50" y="240" width="150" height="4" fill="#f59e0b" opacity="0.8" />
              <rect x="50" y="240" width="4" height="40" fill="#f59e0b" opacity="0.8" />
              
              <line x1="30" y1="20" x2="30" y2="60" stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
              <text x="15" y="45" fill="#06b6d4" fontSize="10" textAnchor="middle">20</text>

              <line x1="50" y1="70" x2="200" y2="70" stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
              <text x="125" y="85" fill="#06b6d4" fontSize="10" textAnchor="middle">75</text>

              <line x1="210" y1="56" x2="210" y2="244" stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
              <text x="230" y="155" fill="#06b6d4" fontSize="10" textAnchor="middle">200</text>

              <line x1="50" y1="255" x2="200" y2="255" stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
              <text x="125" y="268" fill="#06b6d4" fontSize="10" textAnchor="middle">75</text>

              <line x1="30" y1="240" x2="30" y2="280" stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
              <text x="15" y="265" fill="#06b6d4" fontSize="10" textAnchor="middle">20</text>

              <text x="300" y="30" fill="#9ca3af" fontSize="11" fontWeight="bold">Dimensions (mm)</text>
              <text x="300" y="50" fill="#e5e7eb" fontSize="10">Depth: 200</text>
              <text x="300" y="68" fill="#e5e7eb" fontSize="10">Flange: 75</text>
              <text x="300" y="86" fill="#e5e7eb" fontSize="10">Lip: 20</text>
              <text x="300" y="104" fill="#e5e7eb" fontSize="10">Thickness: 2.0</text>
              <text x="300" y="122" fill="#e5e7eb" fontSize="10">Bend R: 2.0</text>
              <text x="300" y="150" fill="#f59e0b" fontSize="11" fontWeight="bold">Strip Width: 402mm</text>
              <text x="300" y="170" fill="#9ca3af" fontSize="10">4 bends × 90°</text>
              <text x="300" y="188" fill="#9ca3af" fontSize="10">K-factor: 0.38</text>
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Profile", value: DEMO_PROFILE.name, cls: "text-amber-400" },
          { label: "Material", value: "GI Z180 / IS 277", cls: "text-cyan-400" },
          { label: "Strip Width", value: "402 mm", cls: "text-green-400" },
          { label: "Stations", value: "12 nos", cls: "text-purple-400" },
        ].map((item, i) => (
          <div key={i} className="bg-[#12131f] border border-white/5 rounded-xl p-4 text-center">
            <p className="text-zinc-500 text-xs mb-1">{item.label}</p>
            <p className={`text-lg font-bold ${item.cls}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Material Properties" icon="🔬">
          <div className="space-y-2 text-sm">
            {[
              ["Material", DEMO_PROFILE.material],
              ["Yield Strength", `${DEMO_PROFILE.yieldStrength} MPa`],
              ["UTS", `${DEMO_PROFILE.uts} MPa`],
              ["K-Factor", `${DEMO_PROFILE.kFactor}`],
              ["Min Bend R/t", "1.0"],
              ["Springback", DEMO_PROFILE.springback],
            ].map(([k, v], i) => (
              <div key={i} className="flex justify-between">
                <span className="text-zinc-500">{k}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Forming Force Summary" icon="⚡">
          <div className="space-y-2 text-sm">
            {[
              ["Per-Station Force", "8-15 kN"],
              ["Total Force (12 stn)", "125 kN (× 1.3 SF)"],
              ["Motor Torque", "13.3 kNm (at roll)"],
              ["Via 20:1 Gearbox", "665 Nm (motor shaft)"],
              ["Motor Power", "7.5 kW (selected)"],
              ["Friction µ", "0.12 (GI lubricated)"],
            ].map(([k, v], i) => (
              <div key={i} className="flex justify-between">
                <span className="text-zinc-500">{k}</span>
                <span className="text-amber-400 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function StationsTab() {
  return (
    <SectionCard title="12-Station Forming Sequence" icon="⚙">
      <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg text-xs text-amber-300">
        Forming sequence: Lip-first method — lip bends complete before flange bending starts. Overbend at Station 10 compensates 3-5° springback.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs border-b border-white/5">
              <th className="text-left py-2 px-3 font-medium">Stn</th>
              <th className="text-left py-2 px-3 font-medium">Name</th>
              <th className="text-left py-2 px-3 font-medium">Angle</th>
              <th className="text-left py-2 px-3 font-medium">Upper OD</th>
              <th className="text-left py-2 px-3 font-medium">Lower OD</th>
              <th className="text-left py-2 px-3 font-medium">Gap</th>
              <th className="text-left py-2 px-3 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {STATIONS.map((s, i) => (
              <tr key={s.num} className={`border-b border-white/[0.03] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="py-2.5 px-3">
                  <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold flex items-center justify-center">
                    {s.num}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-white font-medium">{s.name}</td>
                <td className="py-2.5 px-3 text-cyan-400 font-mono">{s.angle}</td>
                <td className="py-2.5 px-3 text-zinc-300">Ø{s.upperOD}mm</td>
                <td className="py-2.5 px-3 text-zinc-300">Ø{s.lowerOD}mm</td>
                <td className="py-2.5 px-3 text-green-400 font-mono">{s.gap}mm</td>
                <td className="py-2.5 px-3 text-zinc-500 text-xs">{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="p-3 bg-white/[0.02] rounded-lg">
          <p className="text-zinc-500 text-xs">Roll Material</p>
          <p className="text-white text-sm font-medium">EN31 HRC 58-62</p>
        </div>
        <div className="p-3 bg-white/[0.02] rounded-lg">
          <p className="text-zinc-500 text-xs">Roll Surface</p>
          <p className="text-white text-sm font-medium">Ra 0.4µm (polished)</p>
        </div>
        <div className="p-3 bg-white/[0.02] rounded-lg">
          <p className="text-zinc-500 text-xs">Roll Bore</p>
          <p className="text-white text-sm font-medium">Ø50H7 + 14×9 keyway</p>
        </div>
      </div>
    </SectionCard>
  );
}

function MachineTab() {
  const specs = Object.entries(MACHINE_SPECS);
  const labels: Record<string, string> = {
    motor: "Drive Motor",
    gearbox: "Gearbox",
    vfd: "VFD / Inverter",
    shaftDia: "Forming Shafts",
    bearings: "Bearings",
    keyway: "Keyway",
    rollMaterial: "Roll Material & Finish",
    stationSpacing: "Station Spacing",
    passLine: "Pass Line",
    frame: "Machine Frame",
    decoiler: "Decoiler",
    shear: "Shear / Cut-Off",
    lineSpeed: "Line Speed Range",
    production: "Production Rate",
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Complete Machine Specifications" icon="🔧">
        <div className="space-y-3">
          {specs.map(([key, val]) => (
            <div key={key} className="flex items-start gap-4 p-3 bg-white/[0.02] rounded-lg">
              <div className="w-40 shrink-0">
                <span className="text-zinc-400 text-sm font-medium">{labels[key] || key}</span>
              </div>
              <span className="text-white text-sm">{val}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Electrical System" icon="⚡">
          <div className="space-y-2 text-sm">
            {[
              ["PLC", "Siemens S7-1200 (14DI/10DO)"],
              ["HMI", "10\" Weintek cMT3102X"],
              ["Control Voltage", "24V DC"],
              ["Main Power", "415V 3Φ 50Hz"],
              ["Strip Sensor", "Photoelectric (Sick/Omron)"],
              ["Length Encoder", "Rotary 2500 PPR"],
              ["E-Stop", "Category 3 safety relay"],
            ].map(([k, v], i) => (
              <div key={i} className="flex justify-between">
                <span className="text-zinc-500">{k}</span>
                <span className="text-cyan-400 font-medium text-xs">{v}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Lubrication & Maintenance" icon="🛢">
          <div className="space-y-2 text-sm">
            {[
              ["Forming Oil", "Light mineral (SAE 20), spray nozzle"],
              ["Bearing Grease", "SKF LGMT2, every 500 hrs"],
              ["Gearbox Oil", "ISO VG 220, change annually"],
              ["Hydraulic Oil", "ISO VG 46, filter quarterly"],
              ["PM Schedule", "Daily/Weekly/Monthly/Quarterly"],
              ["Roll Regrind", "Every 200-300 km production"],
              ["Spare Bearings", "2 full sets in stock"],
            ].map(([k, v], i) => (
              <div key={i} className="flex justify-between">
                <span className="text-zinc-500">{k}</span>
                <span className="text-green-400 font-medium text-xs">{v}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function BOMTab() {
  return (
    <SectionCard title="Bill of Materials — Complete Machine" icon="📦">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs border-b border-white/5">
              <th className="text-left py-2 px-3 font-medium">#</th>
              <th className="text-left py-2 px-3 font-medium">Item</th>
              <th className="text-center py-2 px-3 font-medium">Qty</th>
              <th className="text-left py-2 px-3 font-medium">Unit</th>
              <th className="text-left py-2 px-3 font-medium">Specification</th>
            </tr>
          </thead>
          <tbody>
            {BOM_ITEMS.map((b, i) => (
              <tr key={i} className={`border-b border-white/[0.03] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="py-2.5 px-3 text-zinc-600 text-xs">{i + 1}</td>
                <td className="py-2.5 px-3 text-white font-medium">{b.item}</td>
                <td className="py-2.5 px-3 text-center text-amber-400 font-bold">{b.qty}</td>
                <td className="py-2.5 px-3 text-zinc-400">{b.unit}</td>
                <td className="py-2.5 px-3 text-zinc-400 text-xs">{b.spec}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg flex justify-between items-center">
        <span className="text-amber-300 text-sm font-medium">Total BOM Items: {BOM_ITEMS.length}</span>
        <span className="text-zinc-500 text-xs">Estimated Machine Cost: ₹80-120 Lakhs (with tooling)</span>
      </div>
    </SectionCard>
  );
}

function StripTab() {
  const total = STRIP_CALC.reduce((s, c) => s + c.length, 0);
  return (
    <SectionCard title="Strip Width Calculation — BA Method" icon="📏">
      <div className="mb-4 p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-lg text-xs text-cyan-300">
        Formula: BA = π × (R + K × t) × (θ/180) = π × (2 + 0.38 × 2.0) × (90/180) = <strong>3.98mm</strong> per 90° bend
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-500 text-xs border-b border-white/5">
            <th className="text-left py-2 px-3 font-medium">Segment</th>
            <th className="text-center py-2 px-3 font-medium">Dimension (mm)</th>
            <th className="text-center py-2 px-3 font-medium">Bend Allowance</th>
            <th className="text-right py-2 px-3 font-medium">Length (mm)</th>
          </tr>
        </thead>
        <tbody>
          {STRIP_CALC.map((s, i) => (
            <tr key={i} className={`border-b border-white/[0.03] ${s.ba ? "bg-amber-500/[0.03]" : ""}`}>
              <td className="py-2 px-3 text-white font-medium">{s.segment}</td>
              <td className="py-2 px-3 text-center text-zinc-300">{s.dim ?? "—"}</td>
              <td className="py-2 px-3 text-center text-amber-400 text-xs">{s.ba ?? "—"}</td>
              <td className="py-2 px-3 text-right text-cyan-400 font-mono">{s.length.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-amber-500/30">
            <td className="py-3 px-3 text-amber-400 font-bold" colSpan={3}>TOTAL STRIP WIDTH</td>
            <td className="py-3 px-3 text-right text-amber-400 font-bold text-lg font-mono">{total.toFixed(2)}mm</td>
          </tr>
          <tr>
            <td className="py-2 px-3 text-green-400 font-medium" colSpan={3}>Rounded (order size)</td>
            <td className="py-2 px-3 text-right text-green-400 font-bold text-lg font-mono">402mm</td>
          </tr>
        </tfoot>
      </table>
    </SectionCard>
  );
}

function QualityTab() {
  return (
    <div className="space-y-4">
      <SectionCard title="Quality Control Checklist" icon="✅">
        <div className="space-y-3">
          {[
            { check: "Profile Depth (200mm)", tolerance: "±1.0mm", method: "Digital caliper", freq: "Every 50th piece" },
            { check: "Flange Width (75mm)", tolerance: "±1.0mm", method: "Digital caliper", freq: "Every 50th piece" },
            { check: "Lip Length (20mm)", tolerance: "±0.5mm", method: "Digital caliper", freq: "Every 50th piece" },
            { check: "Bend Angle (90°)", tolerance: "±1.0°", method: "Angle protractor", freq: "Every 50th piece" },
            { check: "Straightness", tolerance: "1mm/m max", method: "1m straight edge", freq: "Every 50th piece" },
            { check: "Twist", tolerance: "2°/m max", method: "Surface plate", freq: "Every 100th piece" },
            { check: "Profile Length", tolerance: "±2mm (6m)", method: "Tape measure", freq: "Every piece" },
            { check: "Web Flatness", tolerance: "3mm/m max", method: "Feeler gauge", freq: "Every 100th piece" },
            { check: "Hole Position", tolerance: "±0.5mm", method: "Caliper/template", freq: "First 5 + every 50th" },
            { check: "Surface Quality", tolerance: "No scratches, dents", method: "Visual inspection", freq: "Continuous" },
          ].map((q, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 p-2.5 bg-white/[0.02] rounded-lg text-xs">
              <span className="text-white font-medium">{q.check}</span>
              <span className="text-cyan-400">{q.tolerance}</span>
              <span className="text-zinc-400">{q.method}</span>
              <span className="text-zinc-500">{q.freq}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Standards Compliance" icon="📋">
        <div className="grid grid-cols-2 gap-3">
          {[
            "IS 811 — Cold formed light gauge sections",
            "EN 10162 — Cold-formed sections tolerances",
            "DIN 6935 — Cold bending of flat products",
            "ISO 12100 — Machine safety principles",
            "IEC 60204-1 — Electrical equipment of machines",
            "IS 277 — Galvanized steel sheets",
            "DIN 6885 — Parallel keys & keyways",
            "ISO 9001 — Quality management system",
          ].map((std, i) => (
            <div key={i} className="p-2.5 bg-white/[0.02] rounded-lg text-xs text-zinc-300 flex items-center gap-2">
              <span className="text-green-400">✓</span>
              {std}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
