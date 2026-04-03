import React, { useState } from "react";
import { useCncStore, type Segment, type BendPoint, type ProfileGeometry, type GuardrailProfileMetadata } from "../../store/useCncStore";
import { GuardrailReportGenerator } from "./GuardrailReportGenerator";

type ProfileMetadata = GuardrailProfileMetadata;

interface PresetProfile {
  id: string;
  name: string;
  category: string;
  description: string;
  width: number;
  height: number;
  bends: number;
  icon: string;
  metadata?: ProfileMetadata;
  build: () => ProfileGeometry;
}

function makeLine(x1: number, y1: number, x2: number, y2: number): Segment {
  return { type: "line", startX: x1, startY: y1, endX: x2, endY: y2 };
}

function boundingBox(segs: Segment[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of segs) {
    minX = Math.min(minX, s.startX, s.endX);
    maxX = Math.max(maxX, s.startX, s.endX);
    minY = Math.min(minY, s.startY, s.endY);
    maxY = Math.max(maxY, s.startY, s.endY);
  }
  return { minX, maxX, minY, maxY };
}

function makeBP(x: number, y: number, angle: number, segIdx: number): BendPoint {
  return { x, y, angle, radius: 1.5, segmentIndex: segIdx };
}

const PRESET_PROFILES: PresetProfile[] = [
  {
    id: "c_channel_82",
    name: "C-Channel 82mm",
    category: "Shutter / Roofing",
    description: "Shutter patti 82mm width, 15mm leg height, 2 bends",
    width: 82, height: 15, bends: 2, icon: "⊏",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 15, 0, 0),
        makeLine(0, 0, 82, 0),
        makeLine(82, 0, 82, 15),
      ];
      const bp: BendPoint[] = [
        makeBP(0, 0, 90, 0),
        makeBP(82, 0, -90, 1),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "c_channel_100",
    name: "C-Channel 100mm",
    category: "Shutter / Roofing",
    description: "Wide shutter patti 100mm width, 20mm leg height, 2 bends",
    width: 100, height: 20, bends: 2, icon: "⊏",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 20, 0, 0),
        makeLine(0, 0, 100, 0),
        makeLine(100, 0, 100, 20),
      ];
      const bp: BendPoint[] = [
        makeBP(0, 0, 90, 0),
        makeBP(100, 0, -90, 1),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "u_channel_80",
    name: "U-Channel 80mm",
    category: "Structural",
    description: "U-channel 80mm web, 40mm flanges — heavy duty",
    width: 80, height: 40, bends: 2, icon: "∪",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 40, 0, 0),
        makeLine(0, 0, 80, 0),
        makeLine(80, 0, 80, 40),
      ];
      const bp: BendPoint[] = [
        makeBP(0, 0, 90, 0),
        makeBP(80, 0, -90, 1),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "hat_section_50",
    name: "Hat Section 50mm",
    category: "Roofing / Deck",
    description: "Omega/Hat profile, 50mm crown, 30mm height, 4 bends",
    width: 90, height: 30, bends: 4, icon: "⋂",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 0, 20, 0),
        makeLine(20, 0, 20, 30),
        makeLine(20, 30, 70, 30),
        makeLine(70, 30, 70, 0),
        makeLine(70, 0, 90, 0),
      ];
      const bp: BendPoint[] = [
        makeBP(20, 0, 90, 0),
        makeBP(20, 30, -90, 1),
        makeBP(70, 30, 90, 2),
        makeBP(70, 0, -90, 3),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "z_purlin_150",
    name: "Z-Purlin 150mm",
    category: "Structural",
    description: "Z-purlin 150mm web, 65mm top flange, 20mm lips, 4 bends",
    width: 150, height: 65, bends: 4, icon: "Z",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 0, 0, 20),
        makeLine(0, 20, 65, 20),
        makeLine(65, 20, 65, 170),
        makeLine(65, 170, 130, 170),
        makeLine(130, 170, 130, 150),
      ];
      const bp: BendPoint[] = [
        makeBP(0, 20, 90, 0),
        makeBP(65, 20, -90, 1),
        makeBP(65, 170, 90, 2),
        makeBP(130, 170, -90, 3),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "angle_50x50",
    name: "Angle 50×50mm",
    category: "Structural",
    description: "Equal angle section 50×50mm, 1 bend at 90°",
    width: 50, height: 50, bends: 1, icon: "∟",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 50, 0, 0),
        makeLine(0, 0, 50, 0),
      ];
      const bp: BendPoint[] = [makeBP(0, 0, 90, 0)];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "box_40x40",
    name: "Box Section 40×40mm",
    category: "Structural",
    description: "Square hollow section 40×40mm, 3 forming bends",
    width: 40, height: 40, bends: 3, icon: "□",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 40, 0, 0),
        makeLine(0, 0, 40, 0),
        makeLine(40, 0, 40, 40),
        makeLine(40, 40, 0, 40),
      ];
      const bp: BendPoint[] = [
        makeBP(0, 0, 90, 0),
        makeBP(40, 0, -90, 1),
        makeBP(40, 40, -90, 2),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "lipped_c_100",
    name: "Lipped C-Section 100mm",
    category: "Structural / Purlin",
    description: "C-section with 15mm lips, 100mm web, 50mm flanges, 4 bends",
    width: 100, height: 50, bends: 4, icon: "⊑",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 15, 0, 0),
        makeLine(0, 0, 50, 0),
        makeLine(50, 0, 50, 100),
        makeLine(50, 100, 0, 100),
        makeLine(0, 100, 0, 85),
      ];
      const bp: BendPoint[] = [
        makeBP(0, 0, 90, 0),
        makeBP(50, 0, -90, 1),
        makeBP(50, 100, 90, 2),
        makeBP(0, 100, -90, 3),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "corrugated_76",
    name: "Corrugated Sheet 76mm",
    category: "Roofing",
    description: "Standard corrugated roofing sheet, 76mm pitch, 18mm depth",
    width: 76, height: 18, bends: 4, icon: "〰",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 0, 14, 0),
        makeLine(14, 0, 24, 18),
        makeLine(24, 18, 52, 18),
        makeLine(52, 18, 62, 0),
        makeLine(62, 0, 76, 0),
      ];
      const bp: BendPoint[] = [
        makeBP(14, 0, 40, 0),
        makeBP(24, 18, -40, 1),
        makeBP(52, 18, 40, 2),
        makeBP(62, 0, -40, 3),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "t_section_80",
    name: "T-Section 80mm",
    category: "Structural",
    description: "T-section, 80mm flange, 50mm web, 2 bends",
    width: 80, height: 50, bends: 2, icon: "⊤",
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 0, 80, 0),
        makeLine(40, 0, 40, -50),
      ];
      const bp: BendPoint[] = [
        makeBP(40, 0, 90, 0),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "guardrail_cr310",
    name: "CR-310 Guardrail",
    category: "Guardrail",
    description: "Corrugated highway guardrail, 310mm cover width, 193mm pitch, 83mm wave height, 3.0mm thickness",
    width: 310, height: 83, bends: 6, icon: "〰",
    metadata: {
      model: "CR-310",
      coilWidth: 482,
      coverWidth: 310,
      thickness: 3.0,
      usage: "Guardrail",
      pitch: 193,
      waveHeight: 83,
      referenceImage: "guardrail-profiles-reference.jpeg",
    },
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 0, 28, 83),
        makeLine(28, 83, 89, 83),
        makeLine(89, 83, 117, 0),
        makeLine(117, 0, 193, 0),
        makeLine(193, 0, 221, 83),
        makeLine(221, 83, 282, 83),
        makeLine(282, 83, 310, 0),
      ];
      const bp: BendPoint[] = [
        makeBP(28, 83, -55, 0),
        makeBP(89, 83, 55, 1),
        makeBP(117, 0, -55, 2),
        makeBP(193, 0, 55, 3),
        makeBP(221, 83, -55, 4),
        makeBP(282, 83, 55, 5),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
  {
    id: "guardrail_cr194",
    name: "CR-194 Guardrail",
    category: "Guardrail",
    description: "Corrugated highway guardrail, 506mm cover width, 194mm pitch, 83mm wave height, 3.0mm thickness",
    width: 506, height: 83, bends: 10, icon: "〰",
    metadata: {
      model: "CR-194",
      coilWidth: 748,
      coverWidth: 506,
      thickness: 3.0,
      usage: "Guardrail",
      pitch: 194,
      waveHeight: 83,
      referenceImage: "guardrail-profiles-reference.jpeg",
    },
    build: () => {
      const segs: Segment[] = [
        makeLine(0, 0, 29, 83),
        makeLine(29, 83, 89, 83),
        makeLine(89, 83, 118, 0),
        makeLine(118, 0, 194, 0),
        makeLine(194, 0, 223, 83),
        makeLine(223, 83, 283, 83),
        makeLine(283, 83, 312, 0),
        makeLine(312, 0, 388, 0),
        makeLine(388, 0, 417, 83),
        makeLine(417, 83, 477, 83),
        makeLine(477, 83, 506, 0),
      ];
      const bp: BendPoint[] = [
        makeBP(29, 83, -55, 0),
        makeBP(89, 83, 55, 1),
        makeBP(118, 0, -55, 2),
        makeBP(194, 0, 55, 3),
        makeBP(223, 83, -55, 4),
        makeBP(283, 83, 55, 5),
        makeBP(312, 0, -55, 6),
        makeBP(388, 0, 55, 7),
        makeBP(417, 83, -55, 8),
        makeBP(477, 83, 55, 9),
      ];
      return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
    },
  },
];

function makeScrollArcSegs(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number, steps: number): Segment[] {
  const segs: Segment[] = [];
  const step = sweepDeg / steps;
  for (let i = 0; i < steps; i++) {
    const a1 = ((startDeg + i * step) * Math.PI) / 180;
    const a2 = ((startDeg + (i + 1) * step) * Math.PI) / 180;
    segs.push(
      makeLine(
        cx + r * Math.cos(a1), cy + r * Math.sin(a1),
        cx + r * Math.cos(a2), cy + r * Math.sin(a2)
      )
    );
  }
  return segs;
}

PRESET_PROFILES.push({
  id: "profile_l_pressure_115",
  name: "Profile L Pressure 115mm",
  category: "Decorative / Pressure",
  description: "Profile L Pressure Parts, 115mm strip, decorative scroll curl ends, 10.1mm/8.4mm heights, 11 bends — Sai Rolotech Smart Engines",
  width: 115, height: 10.1, bends: 11, icon: "⌇",
  build: () => {
    const segs: Segment[] = [];

    const lR = 2.7, lCx = -2.3, lCy = 7.4;
    const leftScroll = makeScrollArcSegs(lCx, lCy, lR, 270, -300, 12);
    segs.push(...leftScroll);

    const lEntryX = lCx + lR * Math.cos((330 * Math.PI) / 180);
    const lEntryY = lCy + lR * Math.sin((330 * Math.PI) / 180);
    segs.push(makeLine(lEntryX, lEntryY, 0, 0));

    const cw = 78.1;
    const arch: [number, number][] = [
      [0, 0], [13, 0.6], [26, 1.1], [39.05, 1.3], [52, 1.1], [65, 0.6], [cw, 0],
    ];
    for (let i = 0; i < arch.length - 1; i++) {
      segs.push(makeLine(arch[i][0], arch[i][1], arch[i + 1][0], arch[i + 1][1]));
    }

    const rR = 2.25, rCx = 80.0, rCy = 6.175;
    const rEntryX = rCx + rR * Math.cos((210 * Math.PI) / 180);
    const rEntryY = rCy + rR * Math.sin((210 * Math.PI) / 180);
    segs.push(makeLine(cw, 0, rEntryX, rEntryY));

    const rightScroll = makeScrollArcSegs(rCx, rCy, rR, 210, -300, 12);
    segs.push(...rightScroll);

    const bp: BendPoint[] = [
      makeBP(lCx, lCy - lR, 30, 0),
      makeBP(lCx - lR * 0.985, lCy + lR * 0.174, 22, 3),
      makeBP(lEntryX, lEntryY, 22, 11),
      makeBP(0, 0, 90, 12),
      makeBP(26, 1.1, 5, 14),
      makeBP(39.05, 1.3, 3, 15),
      makeBP(52, 1.1, -5, 16),
      makeBP(cw, 0, -90, 18),
      makeBP(rEntryX, rEntryY, -22, 19),
      makeBP(rCx + rR * 0.985, rCy + rR * 0.174, -22, 27),
      makeBP(rCx, rCy - rR, -30, 31),
    ];

    return { segments: segs, boundingBox: boundingBox(segs), bendPoints: bp };
  },
});

const CATEGORIES = [...new Set(PRESET_PROFILES.map((p) => p.category))];

// Mini SVG preview of profile shape
function ProfilePreview({ geo }: { geo: ProfileGeometry }) {
  const { minX, maxX, minY, maxY } = geo.boundingBox;
  const W = 80, H = 50;
  const pw = maxX - minX || 1, ph = maxY - minY || 1;
  const scale = Math.min((W - 10) / pw, (H - 10) / ph) * 0.9;
  const ox = (W - pw * scale) / 2 - minX * scale;
  const oy = (H - ph * scale) / 2 - minY * scale;

  const toX = (x: number) => x * scale + ox;
  const toY = (y: number) => H - (y * scale + oy);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill="#0f172a" rx={3} />
      {geo.segments.map((seg, i) => (
        <line key={i}
          x1={toX(seg.startX)} y1={toY(seg.startY)}
          x2={toX(seg.endX)} y2={toY(seg.endY)}
          stroke="#3b82f6" strokeWidth={1.8} strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function ProfileLibrary({ onClose }: { onClose?: () => void }) {
  const { setGeometry, setFileName, setStations, setGcodeOutputs, setRollTooling, setProfileMetadata } = useCncStore();
  const [selectedCat, setSelectedCat] = useState("All");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);

  const [showRefImage, setShowRefImage] = useState<string | null>(null);
  const [showGuardrailReport, setShowGuardrailReport] = useState(false);

  const filtered = PRESET_PROFILES.filter((p) =>
    (selectedCat === "All" || p.category === selectedCat) &&
    (search === "" || p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      (p.metadata?.model && p.metadata.model.toLowerCase().includes(search.toLowerCase())))
  );

  const handleLoad = (preset: PresetProfile) => {
    const geo = preset.build();
    setGeometry(geo);
    setFileName(`${preset.name}.dxf`);
    setProfileMetadata(preset.metadata ?? null);
    setStations([]);
    setGcodeOutputs([]);
    setRollTooling([]);
    setLoaded(preset.id);
    if (onClose) setTimeout(onClose, 600);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex-shrink-0 px-5 py-3 bg-zinc-900 border-b border-zinc-700 flex items-center gap-3">
        <div>
          <div className="text-sm font-bold text-zinc-100">Profile Library</div>
          <div className="text-xs text-zinc-400">{PRESET_PROFILES.length} standard roll forming profiles</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs">✕ Close</button>
        )}
      </div>

      <div className="flex-shrink-0 px-5 py-2 border-b border-zinc-800 flex items-center gap-2">
        <input
          type="text"
          placeholder="Search profiles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex-shrink-0 px-5 py-2 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto">
        {["All", ...CATEGORIES].map((cat) => (
          <button key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${selectedCat === cat ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((preset) => {
            const geo = preset.build();
            const isLoaded = loaded === preset.id;
            return (
              <div key={preset.id}
                className={`bg-zinc-900 border rounded-lg p-3 flex flex-col gap-2 transition-all ${isLoaded ? "border-green-600 bg-green-950/20" : "border-zinc-700 hover:border-zinc-500"}`}>
                <div className="flex items-start gap-2">
                  <span className="text-2xl flex-shrink-0">{preset.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-100 truncate">{preset.name}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{preset.category}</div>
                    <div className="text-[10px] text-zinc-400 mt-1">{preset.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ProfilePreview geo={geo} />
                  <div className="flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
                    <span>W: {preset.width}mm</span>
                    <span>H: {preset.height}mm</span>
                    <span>Bends: {preset.bends}</span>
                    <span>Segs: {geo.segments.length}</span>
                  </div>
                </div>

                {preset.metadata && (
                  <div className="border border-zinc-700 rounded-md p-2 bg-zinc-800/50 space-y-1">
                    <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">SAI Sai Rolotech Smart Engines Engine Data</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                      <span className="text-zinc-500">Model</span>
                      <span className="text-zinc-200 font-mono">{preset.metadata.model}</span>
                      <span className="text-zinc-500">Coil Width</span>
                      <span className="text-zinc-200 font-mono">{preset.metadata.coilWidth}mm</span>
                      <span className="text-zinc-500">Cover Width</span>
                      <span className="text-zinc-200 font-mono">{preset.metadata.coverWidth}mm</span>
                      <span className="text-zinc-500">Thickness</span>
                      <span className="text-zinc-200 font-mono">{preset.metadata.thickness}mm</span>
                      <span className="text-zinc-500">Usage</span>
                      <span className="text-zinc-200 font-mono">{preset.metadata.usage}</span>
                      {preset.metadata.pitch && (
                        <>
                          <span className="text-zinc-500">Pitch</span>
                          <span className="text-zinc-200 font-mono">{preset.metadata.pitch}mm</span>
                        </>
                      )}
                      {preset.metadata.waveHeight && (
                        <>
                          <span className="text-zinc-500">Wave Height</span>
                          <span className="text-zinc-200 font-mono">{preset.metadata.waveHeight}mm</span>
                        </>
                      )}
                    </div>
                    {preset.metadata.referenceImage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowRefImage(preset.metadata!.referenceImage!); }}
                        className="mt-1 w-full py-1 rounded text-[10px] font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
                      >
                        View Reference Drawing
                      </button>
                    )}
                    {preset.category === "Guardrail" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowGuardrailReport(true); }}
                        className="mt-1 w-full py-1.5 rounded text-[10px] font-bold bg-gradient-to-r from-orange-700 to-amber-700 hover:from-orange-600 hover:to-amber-600 text-white transition-colors"
                      >
                        Sai Rolotech Smart Engines Engine — Download PDF Report
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleLoad(preset)}
                  className={`w-full py-1.5 rounded text-xs font-semibold transition-colors ${isLoaded ? "bg-green-700 text-white" : "bg-blue-700 hover:bg-blue-600 text-white"}`}
                >
                  {isLoaded ? "✓ Loaded!" : "Load Profile"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-2 bg-zinc-900/50 border-t border-zinc-800 text-xs text-zinc-500 text-center">
        Select a profile and click Load — then generate power pattern and roll tooling
      </div>

      {showGuardrailReport && (
        <GuardrailReportGenerator onClose={() => setShowGuardrailReport(false)} />
      )}

      {showRefImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowRefImage(null)}>
          <div className="relative bg-zinc-900 border border-zinc-600 rounded-xl p-4 max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-zinc-100">Guardrail Profile Reference Drawing</div>
              <button onClick={() => setShowRefImage(null)} className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs">✕ Close</button>
            </div>
            <img src={`${import.meta.env.BASE_URL}${showRefImage}`} alt="Guardrail profile reference drawing" className="w-full rounded-lg border border-zinc-700" />
            <div className="mt-2 text-[10px] text-zinc-500 text-center">SAI Sai Rolotech Smart Engines Engine — Corrugated Guardrail Profile Specifications</div>
          </div>
        </div>
      )}
    </div>
  );
}
