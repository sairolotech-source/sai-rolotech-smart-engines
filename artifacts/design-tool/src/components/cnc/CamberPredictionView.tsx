import React, { useState, useRef, useEffect, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { ArrowLeftRight, AlertTriangle, CheckCircle2 } from "lucide-react";

interface CamberData {
  stationNumber: number;
  leftEdgeDelta: number;
  rightEdgeDelta: number;
  camberPerMeter: number;
  totalCamber: number;
  severity: "ok" | "warning" | "critical";
}

const MATERIAL_CAMBER: Record<string, { asymFactor: number; decayRate: number }> = {
  GI: { asymFactor: 0.012, decayRate: 0.5 },
  CR: { asymFactor: 0.010, decayRate: 0.45 },
  HR: { asymFactor: 0.018, decayRate: 0.6 },
  SS: { asymFactor: 0.025, decayRate: 0.55 },
  AL: { asymFactor: 0.015, decayRate: 0.4 },
  MS: { asymFactor: 0.013, decayRate: 0.5 },
  CU: { asymFactor: 0.008, decayRate: 0.35 },
  TI: { asymFactor: 0.030, decayRate: 0.65 },
  PP: { asymFactor: 0.040, decayRate: 0.3 },
  HSLA: { asymFactor: 0.022, decayRate: 0.6 },
};

export function CamberPredictionView() {
  const { stations, materialType, materialThickness: thickness, geometry: rawGeometry } = useCncStore();
  const geometry = rawGeometry ?? { segments: [], bendPoints: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  const [pieceLength, setPieceLength] = useState(3000);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safeThickness = Math.max(thickness, 0.1);
  const allX = geometry.segments.flatMap(s => [s.startX, s.endX]);
  const profileWidth = allX.length > 1 ? Math.max(...allX) - Math.min(...allX) : 100;
  const profileCenter = allX.length > 1 ? (Math.max(...allX) + Math.min(...allX)) / 2 : 50;
  const halfWidth = Math.max(profileWidth / 2, 1);

  const YIELD_MAP: Record<string, number> = { GI: 280, CR: 250, HR: 350, SS: 520, AL: 110, MS: 300, CU: 200, TI: 880, PP: 35, HSLA: 550 };
  const E_MAP: Record<string, number> = { GI: 200000, CR: 200000, HR: 200000, SS: 193000, AL: 69000, MS: 200000, CU: 117000, TI: 116000, PP: 1500, HSLA: 200000 };
  const sigmaY = YIELD_MAP[materialType] ?? 280;
  const E_mod = E_MAP[materialType] ?? 200000;
  const I_strip = (profileWidth * safeThickness ** 3) / 12;

  const camberData: CamberData[] = useMemo(() => stations.map((st, idx) => {
    let leftStrain = 0;
    let rightStrain = 0;
    let totalMoment = 0;
    const stBendAngles = st.bendAngles || [];
    const nSamples = 60;
    const sampleDx = profileWidth / nSamples;
    const strainArr = new Array(nSamples + 1).fill(0);

    geometry.bendPoints.forEach((bp, bpi) => {
      const stationBendAngle = Math.abs(stBendAngles[bpi] ?? bp.angle);
      const angleRad = (stationBendAngle * Math.PI) / 180;
      const radius = Math.max(bp.radius || safeThickness * 2, safeThickness);
      const epsBend = safeThickness / (2 * radius + safeThickness) * angleRad;
      const lambda = Math.sqrt(radius * Math.max(safeThickness, 0.3)) * 1.5;
      const F_bend = sigmaY * safeThickness * safeThickness * angleRad / (4 * radius);
      const leverArm = bp.x - profileCenter;
      totalMoment += F_bend * leverArm;
      const xMin = profileCenter - halfWidth;
      for (let si = 0; si <= nSamples; si++) {
        const x = xMin + si * sampleDx;
        const dist = Math.abs(x - bp.x);
        strainArr[si] += epsBend * Math.exp(-dist / lambda);
      }
    });

    const midIdx = Math.floor(nSamples / 2);
    for (let si = 0; si < midIdx; si++) leftStrain += (strainArr[si] + strainArr[si + 1]) / 2 * sampleDx;
    for (let si = midIdx; si < nSamples; si++) rightStrain += (strainArr[si] + strainArr[si + 1]) / 2 * sampleDx;

    const kappa = totalMoment / (E_mod * Math.max(I_strip, 0.001));
    const camberFromMoment = kappa * 1e6 / 2;
    const strainDiff = rightStrain - leftStrain;
    const camberFromStrain = (strainDiff / Math.max(profileWidth, 10)) * 1000;
    const camberPerMeter = camberFromMoment * 0.6 + camberFromStrain * 0.4;
    const totalCamber = camberPerMeter * (pieceLength / 1000);
    const absCamberPerM = Math.abs(camberPerMeter);
    const severity: CamberData["severity"] = absCamberPerM > 3 ? "critical" : absCamberPerM > 1 ? "warning" : "ok";

    return { stationNumber: idx + 1, leftEdgeDelta: leftStrain * 1000, rightEdgeDelta: rightStrain * 1000, camberPerMeter, totalCamber, severity };
  }), [stations, geometry, safeThickness, profileWidth, profileCenter, halfWidth, sigmaY, E_mod, I_strip, pieceLength]);

  const finalCamber = camberData[camberData.length - 1] ?? {
    stationNumber: 0, leftEdgeDelta: 0, rightEdgeDelta: 0, camberPerMeter: 0, totalCamber: 0, severity: "ok" as const,
  };

  const w = dims.w;
  const h = dims.h;
  const stripX = 60;
  const stripEndX = w - 120;
  const stripW = stripEndX - stripX;
  const stripCY = h / 2;
  const stripH = 50;
  const maxCamberPx = 80;
  const maxCamberVal = Math.max(...camberData.map(c => Math.abs(c.totalCamber)), 1);

  const camberLine = camberData.map((cd, i) => {
    const x = stripX + (i / Math.max(camberData.length - 1, 1)) * stripW;
    const yOffset = (cd.totalCamber / maxCamberVal) * maxCamberPx;
    return `${x},${stripCY - yOffset}`;
  }).join(" ");

  const camberFill = `${stripX},${stripCY} ${camberLine} ${stripEndX},${stripCY}`;

  const chartY = h - 120;
  const chartH = 80;
  const chartX = 60;
  const chartW = w - 180;
  const maxCPM = Math.max(...camberData.map(c => Math.abs(c.camberPerMeter)), 0.1);

  const cpmLine = camberData.map((cd, i) => {
    const x = chartX + (i / Math.max(camberData.length - 1, 1)) * chartW;
    const yNorm = Math.abs(cd.camberPerMeter) / maxCPM;
    const y = chartY + chartH - yNorm * chartH;
    return `${x},${y}`;
  }).join(" ");

  const finalYOff = (finalCamber.totalCamber / maxCamberVal) * maxCamberPx;
  const arrowX = stripEndX + 15;

  return (
    <div className="flex flex-col h-full bg-[#070710]">
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.07] flex items-center gap-3">
        <ArrowLeftRight className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Camber Prediction</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">SVG Pro</span>
        <div className="flex-1" />
        <div className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full ${
          finalCamber.severity === "ok" ? "bg-emerald-500/10 text-emerald-400" :
          finalCamber.severity === "warning" ? "bg-amber-500/10 text-amber-400" :
          "bg-red-500/10 text-red-400"
        }`}>
          {finalCamber.severity === "ok" ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {Math.abs(finalCamber.totalCamber).toFixed(2)} mm camber
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1 relative">
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#0a0a1a" }}>
            {Array.from({ length: Math.floor(w / 30) }, (_, i) => (
              <line key={`gv${i}`} x1={i * 30} y1={0} x2={i * 30} y2={h} stroke="rgba(255,255,255,0.03)" />
            ))}
            {Array.from({ length: Math.floor(h / 30) }, (_, i) => (
              <line key={`gh${i}`} x1={0} y1={i * 30} x2={w} y2={i * 30} stroke="rgba(255,255,255,0.03)" />
            ))}

            {!stations.length ? (
              <text x={w / 2} y={h / 2} fill="#555" fontSize="14" fontFamily="sans-serif" textAnchor="middle">Generate Power Pattern to predict camber</text>
            ) : (
              <>
                <text x={15} y={25} fill="#fff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">Plan View — Strip Camber (Bow)</text>
                <text x={15} y={42} fill="#777" fontSize="10" fontFamily="sans-serif">{materialType} {thickness}mm · Length: {pieceLength}mm · Width: {profileWidth.toFixed(1)}mm</text>

                <rect x={stripX} y={stripCY - stripH / 2} width={stripW} height={stripH} fill="rgba(59,130,246,0.06)" stroke="rgba(59,130,246,0.2)" />
                <line x1={stripX} y1={stripCY} x2={stripEndX} y2={stripCY} stroke="rgba(255,255,255,0.1)" strokeDasharray="4,4" />

                <polygon points={camberFill} fill="rgba(239,68,68,0.08)" />
                <polyline points={camberLine} fill="none" stroke="#ef4444" strokeWidth={2.5} />

                {camberData.map((cd, i) => {
                  const x = stripX + (i / Math.max(camberData.length - 1, 1)) * stripW;
                  const yOff = (cd.totalCamber / maxCamberVal) * maxCamberPx;
                  const col = cd.severity === "critical" ? "#ef4444" : cd.severity === "warning" ? "#f59e0b" : "#22c55e";
                  return <circle key={i} cx={x} cy={stripCY - yOff} r={3} fill={col} />;
                })}

                <line x1={arrowX} y1={stripCY} x2={arrowX} y2={stripCY - finalYOff} stroke="#ef4444" strokeWidth={1.5} />
                <polyline points={`${arrowX - 4},${stripCY - finalYOff + (finalYOff > 0 ? 6 : -6)} ${arrowX},${stripCY - finalYOff} ${arrowX + 4},${stripCY - finalYOff + (finalYOff > 0 ? 6 : -6)}`} fill="none" stroke="#ef4444" strokeWidth={1.5} />
                <text x={arrowX + 8} y={stripCY - finalYOff / 2} fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="sans-serif">{finalCamber.totalCamber.toFixed(2)} mm</text>

                <rect x={chartX} y={chartY} width={chartW} height={chartH} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
                <text x={chartX - 4} y={chartY + 10} fill="#666" fontSize="9" fontFamily="sans-serif" textAnchor="end">Camber/m</text>
                <polyline points={cpmLine} fill="none" stroke="#8b5cf6" strokeWidth={2} />
                <text x={chartX} y={chartY + chartH + 12} fill="#666" fontSize="8" fontFamily="sans-serif" textAnchor="middle">Station 1</text>
                <text x={chartX + chartW} y={chartY + chartH + 12} fill="#666" fontSize="8" fontFamily="sans-serif" textAnchor="middle">Station {camberData.length}</text>
              </>
            )}
          </svg>
        </div>

        <div className="w-56 flex-shrink-0 border-l border-white/[0.07] bg-[#0c0c1a] p-3 space-y-3 overflow-y-auto">
          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Piece Length (mm)</div>
            <input type="number" value={pieceLength} onChange={e => setPieceLength(parseInt(e.target.value) || 1000)} min={100} step={100} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300" />
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Final Camber</div>
            <div className="space-y-1.5">
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[9px] text-zinc-500">Left Edge Δ</span>
                <span className="text-[10px] text-blue-300">{finalCamber.leftEdgeDelta.toFixed(4)} mm</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[9px] text-zinc-500">Right Edge Δ</span>
                <span className="text-[10px] text-purple-300">{finalCamber.rightEdgeDelta.toFixed(4)} mm</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[9px] text-zinc-500">Camber/m</span>
                <span className="text-[10px] text-amber-300">{finalCamber.camberPerMeter.toFixed(3)} mm/m</span>
              </div>
              <div className={`rounded-lg p-2 flex justify-between border ${
                finalCamber.severity === "ok" ? "bg-emerald-500/10 border-emerald-500/20" :
                finalCamber.severity === "warning" ? "bg-amber-500/10 border-amber-500/20" :
                "bg-red-500/10 border-red-500/20"
              }`}>
                <span className="text-[9px] text-zinc-400">Total Bow</span>
                <span className={`text-sm font-bold ${
                  finalCamber.severity === "ok" ? "text-emerald-300" :
                  finalCamber.severity === "warning" ? "text-amber-300" : "text-red-300"
                }`}>{Math.abs(finalCamber.totalCamber).toFixed(2)} mm</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Station Progression</div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {camberData.map((cd) => (
                <div key={cd.stationNumber} className="flex items-center gap-2 text-[9px] px-2 py-1 bg-white/[0.02] rounded">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    cd.severity === "ok" ? "bg-emerald-400" : cd.severity === "warning" ? "bg-amber-400" : "bg-red-400"
                  }`} />
                  <span className="text-zinc-500 w-8">St {cd.stationNumber}</span>
                  <span className="flex-1 text-right text-zinc-400">{cd.camberPerMeter.toFixed(3)} mm/m</span>
                  <span className={`w-14 text-right font-mono ${
                    cd.severity === "ok" ? "text-emerald-400" : cd.severity === "warning" ? "text-amber-400" : "text-red-400"
                  }`}>{cd.totalCamber.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Tolerances</div>
            <div className="bg-white/[0.03] rounded-lg p-2 space-y-1 text-[9px]">
              <div className="flex justify-between"><span className="text-zinc-500">DIN EN 10162</span><span className="text-zinc-400">≤ 3mm/m</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Automotive</span><span className="text-zinc-400">≤ 1mm/m</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Precision</span><span className="text-zinc-400">≤ 0.5mm/m</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Your Profile</span>
                <span className={finalCamber.severity === "ok" ? "text-emerald-400" : finalCamber.severity === "warning" ? "text-amber-400" : "text-red-400"}>
                  {Math.abs(finalCamber.camberPerMeter).toFixed(3)} mm/m
                </span>
              </div>
            </div>
          </div>

          {finalCamber.severity !== "ok" && (
            <div className={`rounded-lg p-2 border ${
              finalCamber.severity === "warning" ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"
            }`}>
              <span className={`text-[9px] font-bold ${finalCamber.severity === "warning" ? "text-amber-400" : "text-red-400"}`}>
                {finalCamber.severity === "warning" ? "CAMBER WARNING" : "EXCESSIVE CAMBER"}
              </span>
              <p className={`text-[8px] mt-0.5 ${finalCamber.severity === "warning" ? "text-amber-400/70" : "text-red-400/70"}`}>
                {finalCamber.severity === "warning"
                  ? "Camber exceeds standard tolerance. Check bend symmetry and material edge alignment."
                  : "Severe bow detected. Profile bends may be asymmetric. Add pre-camber correction rolls."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
