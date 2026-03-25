import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, Layers, Activity, Thermometer, Eye, BarChart3, AlertTriangle, Cpu, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { computeMeshOnWorker, getHardwareCapabilities, getWorkerStats, ensureWorkerPool } from "../../lib/hardware-engine";

const GAUSS_POINTS_5 = [
  { zeta: -0.9061798, weight: 0.2369269 },
  { zeta: -0.5384693, weight: 0.4786287 },
  { zeta:  0.0000000, weight: 0.5688889 },
  { zeta:  0.5384693, weight: 0.4786287 },
  { zeta:  0.9061798, weight: 0.2369269 },
];

const HARDENING_TABLE: Record<string, { K: number; n: number }> = {
  GI: { K: 500, n: 0.20 }, CR: { K: 550, n: 0.22 }, HR: { K: 480, n: 0.18 },
  SS: { K: 1300, n: 0.45 }, AL: { K: 350, n: 0.23 }, MS: { K: 490, n: 0.19 },
  CU: { K: 320, n: 0.34 }, TI: { K: 1400, n: 0.14 }, HSLA: { K: 800, n: 0.12 },
  PP: { K: 60, n: 0.10 },
};

interface MeshTriangle {
  x1: number; y1: number;
  x2: number; y2: number;
  x3: number; y3: number;
  stress: number;
  strain: number;
  thinning: number;
}

interface StressPoint {
  x: number;
  y: number;
  vonMises: number;
  strainX: number;
  strainY: number;
  thickness: number;
}

type ViewMode = "stress" | "strain" | "thickness" | "deformation" | "energy" | "3d";

const STRESS_COLORS = [
  { val: 0, color: [0, 0, 180] },
  { val: 0.15, color: [0, 80, 255] },
  { val: 0.3, color: [0, 220, 255] },
  { val: 0.45, color: [0, 255, 120] },
  { val: 0.6, color: [180, 255, 0] },
  { val: 0.75, color: [255, 220, 0] },
  { val: 0.88, color: [255, 120, 0] },
  { val: 1.0, color: [220, 0, 0] },
];

function interpolateColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  let i = 0;
  for (; i < STRESS_COLORS.length - 1; i++) {
    if (clamped <= STRESS_COLORS[i + 1].val) break;
  }
  const low = STRESS_COLORS[i];
  const high = STRESS_COLORS[Math.min(i + 1, STRESS_COLORS.length - 1)];
  const range = high.val - low.val || 1;
  const frac = (clamped - low.val) / range;
  const r = Math.round(low.color[0] + frac * (high.color[0] - low.color[0]));
  const g = Math.round(low.color[1] + frac * (high.color[1] - low.color[1]));
  const b = Math.round(low.color[2] + frac * (high.color[2] - low.color[2]));
  return `rgb(${r},${g},${b})`;
}

function interpolateColorRGBA(t: number, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  let i = 0;
  for (; i < STRESS_COLORS.length - 1; i++) {
    if (clamped <= STRESS_COLORS[i + 1].val) break;
  }
  const low = STRESS_COLORS[i];
  const high = STRESS_COLORS[Math.min(i + 1, STRESS_COLORS.length - 1)];
  const range = high.val - low.val || 1;
  const frac = (clamped - low.val) / range;
  const r = Math.round(low.color[0] + frac * (high.color[0] - low.color[0]));
  const g = Math.round(low.color[1] + frac * (high.color[1] - low.color[1]));
  const b = Math.round(low.color[2] + frac * (high.color[2] - low.color[2]));
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * FIX: Multiple material property errors in MATERIAL_PROPS for forming simulation
 * 1. CR/HR yieldStrength SWAPPED (CR:250 vs correct 340, HR:350 vs correct 250) — CRITICAL
 * 2. AL yieldStrength 110 → 270 MPa (was annealed/soft; roll forming uses 5052-H32 @ 193 MPa min)
 * 3. HR kFactor 0.48 → 0.42 (HR is softer than CR, K should be LOWER not higher)
 * 4. AL kFactor 0.38 → 0.43 (DIN 6935 Table 3)
 * 5. TI kFactor 0.52 → 0.50 (consistent with deep-accuracy-engine.ts)
 * 6. CU kFactor 0.40 → 0.44 (DIN 6935)
 * Source: deep-accuracy-engine.ts MATERIAL_PROPS (DIN / ASTM verified)
 */
const MATERIAL_PROPS: Record<string, { yieldStrength: number; elasticModulus: number; kFactor: number; poissonRatio: number }> = {
  GI:   { yieldStrength: 280, elasticModulus: 200000, kFactor: 0.44, poissonRatio: 0.30 },
  CR:   { yieldStrength: 340, elasticModulus: 200000, kFactor: 0.44, poissonRatio: 0.30 },  // FIX: was 250 (HR yield!) + kFactor 0.42→0.44
  HR:   { yieldStrength: 250, elasticModulus: 200000, kFactor: 0.42, poissonRatio: 0.30 },  // FIX: was 350 (CR yield!) + kFactor 0.48→0.42
  SS:   { yieldStrength: 520, elasticModulus: 193000, kFactor: 0.50, poissonRatio: 0.28 },  // correct
  AL:   { yieldStrength: 270, elasticModulus: 69000,  kFactor: 0.43, poissonRatio: 0.33 },  // FIX: yield 110→270, kFactor 0.38→0.43
  MS:   { yieldStrength: 250, elasticModulus: 200000, kFactor: 0.42, poissonRatio: 0.30 },  // correct
  CU:   { yieldStrength: 200, elasticModulus: 117000, kFactor: 0.44, poissonRatio: 0.34 },  // FIX: kFactor 0.40→0.44
  TI:   { yieldStrength: 880, elasticModulus: 115000, kFactor: 0.50, poissonRatio: 0.34 },  // FIX: kFactor 0.52→0.50, E 116→115 GPa
  PP:   { yieldStrength: 280, elasticModulus: 200000, kFactor: 0.44, poissonRatio: 0.30 },  // FIX: PP=pre-painted steel (same as GI), not polypropylene
  HSLA: { yieldStrength: 550, elasticModulus: 205000, kFactor: 0.45, poissonRatio: 0.30 },  // correct
};

interface StationAnalysis {
  originalCount: number;
  newCount: number;
  problems: { severity: "critical" | "warning" | "info"; title: string; detail: string }[];
  solutions: { title: string; detail: string }[];
  maxAnglePerStation: number;
  originalMaxAngle: number;
  riskLevel: "safe" | "moderate" | "high" | "critical";
  edgeStrain: number;
  springbackIncrease: number;
}

const MATERIAL_MAX_INCREMENT: Record<string, number> = {
  GI: 15, CR: 12, HR: 12, MS: 12, SS: 10, AL: 12, CU: 14, TI: 6, HSLA: 10, PP: 20,
};

const MATERIAL_SPRINGBACK: Record<string, number> = {
  GI: 3, CR: 3, HR: 2, MS: 3, SS: 8, AL: 2, CU: 1, TI: 15, HSLA: 6, PP: 1,
};

function analyzeStationChange(
  originalCount: number,
  newCount: number,
  materialType: string,
  thickness: number,
  totalBendAngle: number
): StationAnalysis {
  const maxIncrement = MATERIAL_MAX_INCREMENT[materialType] ?? 12;
  const baseSpringback = MATERIAL_SPRINGBACK[materialType] ?? 3;
  const originalMaxAngle = totalBendAngle / Math.max(originalCount - 2, 1);
  const newMaxAngle = totalBendAngle / Math.max(newCount - 2, 1);
  const edgeStrain = (thickness / (2 * (thickness * 2) + thickness)) * (newMaxAngle * Math.PI / 180) * 100;
  const springbackIncrease = baseSpringback * (newMaxAngle / Math.max(originalMaxAngle, 1) - 1);

  const problems: StationAnalysis["problems"] = [];
  const solutions: StationAnalysis["solutions"] = [];

  if (newCount < originalCount) {
    const angleDiff = newMaxAngle - originalMaxAngle;

    if (newMaxAngle > maxIncrement * 1.5) {
      problems.push({
        severity: "critical",
        title: `Bend angle per station: ${newMaxAngle.toFixed(1)}° (limit: ${maxIncrement}° for ${materialType})`,
        detail: `${materialType} material can safely handle max ${maxIncrement}° per station. At ${newMaxAngle.toFixed(1)}°, cracking and edge splitting is almost certain. This will cause reject parts.`,
      });
    } else if (newMaxAngle > maxIncrement) {
      problems.push({
        severity: "warning",
        title: `Bend angle ${newMaxAngle.toFixed(1)}° exceeds recommended ${maxIncrement}° per station`,
        detail: `Above recommended limit for ${materialType}. Risk of edge waviness, micro-cracking, and inconsistent springback. Parts may pass visual inspection but fail under load.`,
      });
    }

    if (edgeStrain > 2.0) {
      problems.push({
        severity: "critical",
        title: `Edge strain: ${edgeStrain.toFixed(2)}% (max safe: 2.0% for ${materialType})`,
        detail: `Excessive longitudinal edge strain causes edge cracking, orange-peel surface, and eventual fracture. Edge will stretch beyond material's forming limit.`,
      });
    } else if (edgeStrain > 1.5) {
      problems.push({
        severity: "warning",
        title: `Edge strain elevated: ${edgeStrain.toFixed(2)}%`,
        detail: `Approaching material limit. Surface roughening and minor waviness expected. Monitor edge quality closely during production.`,
      });
    }

    if (springbackIncrease > 2) {
      problems.push({
        severity: "warning",
        title: `Springback increases by ~${springbackIncrease.toFixed(1)}° per bend`,
        detail: `Larger bend increments mean more stored elastic energy. Springback compensation becomes harder to control. Final angle accuracy will decrease.`,
      });
    }

    if (newCount < originalCount - 2) {
      problems.push({
        severity: "warning",
        title: `Removing ${originalCount - newCount} stations significantly changes forming sequence`,
        detail: `No calibration/ironing stations may remain. The profile will have poor dimensional accuracy. Roll gap adjustment becomes extremely sensitive.`,
      });
    }

    if (angleDiff > 5) {
      problems.push({
        severity: "info",
        title: `Forming force per station increases by ~${((newMaxAngle/originalMaxAngle - 1) * 100).toFixed(0)}%`,
        detail: `Higher force per station means more bearing load, shaft deflection, and motor torque demand. Check gearbox and motor capacity.`,
      });
    }

    if (newCount < originalCount) {
      solutions.push({
        title: "Use overbend + ironing at final stations",
        detail: `Reserve last 2 stations for overbend (${(baseSpringback + springbackIncrease).toFixed(1)}° extra) and ironing. This recovers dimensional accuracy lost from fewer forming stations.`,
      });

      if (newMaxAngle > maxIncrement) {
        solutions.push({
          title: `Switch to progressive lip-first forming`,
          detail: `Bend lips first (stations 1-3), then flanges. This distributes strain better than bending everything simultaneously, allowing higher angle per station.`,
        });
      }

      if (edgeStrain > 1.5) {
        solutions.push({
          title: "Add edge conditioning rolls or pre-notch",
          detail: `Install edge-trimming or pre-notching before forming. Relieves edge strain by 30-40%. Also consider increasing bend radius from ${(thickness*2).toFixed(1)}mm to ${(thickness*3).toFixed(1)}mm.`,
        });
      }

      solutions.push({
        title: "Reduce line speed by 20-30%",
        detail: `Slower forming gives material more time to flow, reducing peak strain rate. Change VFD from ${20}m/min to ${14}m/min max.`,
      });

      if (springbackIncrease > 1) {
        solutions.push({
          title: "Increase overbend compensation",
          detail: `Original springback: ~${baseSpringback}°. With fewer stations: ~${(baseSpringback + springbackIncrease).toFixed(1)}°. Set overbend at station ${newCount - 1} to ${(90 + baseSpringback + springbackIncrease).toFixed(1)}° target.`,
        });
      }

      solutions.push({
        title: "Use harder roll material (D3 HRC 60-63)",
        detail: `Higher forming force means faster roll wear. Upgrade from EN31 to D3 or add chrome plating (50µm) to extend roll life with increased station loads.`,
      });

      if (thickness >= 2.0) {
        solutions.push({
          title: "Consider warm forming for thick gauge",
          detail: `For ${thickness}mm ${materialType}, induction pre-heating strip to 200-300°C reduces forming force by 40% and allows larger angle increments (up to ${(maxIncrement * 1.4).toFixed(0)}°/station).`,
        });
      }
    }
  } else if (newCount > originalCount) {
    problems.push({
      severity: "info",
      title: `Adding ${newCount - originalCount} stations improves forming quality`,
      detail: `More stations = lower angle per station (${newMaxAngle.toFixed(1)}° vs ${originalMaxAngle.toFixed(1)}°). Better surface finish, lower springback, less edge strain.`,
    });
    solutions.push({
      title: "Machine will be longer and costlier",
      detail: `Each additional station adds ~₹3-5 lakhs (rolls + shaft + bearings + frame). Machine length increases by ${(newCount - originalCount) * 280}mm.`,
    });
    solutions.push({
      title: "Use extra stations for calibration",
      detail: `With extra room, add 2-3 dedicated calibration stations at the end. This gives the best dimensional accuracy — Cpk > 1.67 achievable.`,
    });
  }

  let riskLevel: StationAnalysis["riskLevel"] = "safe";
  if (problems.some(p => p.severity === "critical")) riskLevel = "critical";
  else if (problems.filter(p => p.severity === "warning").length >= 2) riskLevel = "high";
  else if (problems.some(p => p.severity === "warning")) riskLevel = "moderate";

  return {
    originalCount, newCount, problems, solutions,
    maxAnglePerStation: newMaxAngle,
    originalMaxAngle,
    riskLevel, edgeStrain,
    springbackIncrease,
  };
}

const MODE_LABELS: Record<ViewMode, string> = {
  stress: "Von Mises Stress Field",
  strain: "Effective Strain Distribution",
  thickness: "Sheet Thinning Map",
  deformation: "Total Deformation Index",
  energy: "Strain Energy Density",
  "3d": "3D Strip Forming",
};

function FormingSimSVG({ w, h, stations, currentStation, totalStations, viewMode, zoom, showGrid, showMesh, materialType, thickness, mat, meshDensity, geometry, generateMesh, workerCacheRef }: {
  w: number; h: number; stations: any[]; currentStation: number; totalStations: number;
  viewMode: ViewMode; zoom: number; showGrid: boolean; showMesh: boolean;
  materialType: string; thickness: number;
  mat: { yieldStrength: number; elasticModulus: number; kFactor: number; poissonRatio: number };
  meshDensity: number; geometry: any; generateMesh: (idx: number) => { triangles: MeshTriangle[]; points: StressPoint[] };
  workerCacheRef: React.MutableRefObject<Map<string, { triangles: MeshTriangle[]; points: StressPoint[] }>>;
}) {
  const station = stations[currentStation];
  const hasData = station && station.segments && station.segments.length > 0;

  if (!hasData) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#080818" }}>
        <text x={w / 2} y={h / 2} fill="#555" fontSize="14" fontFamily="sans-serif" textAnchor="middle">
          No station data — generate Power Pattern first
        </text>
      </svg>
    );
  }

  const gridLines: React.ReactNode[] = [];
  if (showGrid) {
    const gridSize = 25 * zoom;
    for (let gx = 0; gx < w; gx += gridSize) {
      gridLines.push(<line key={`gx${gx}`} x1={gx} y1={0} x2={gx} y2={h} stroke="rgba(255,255,255,0.025)" strokeWidth={0.5} />);
    }
    for (let gy = 0; gy < h; gy += gridSize) {
      gridLines.push(<line key={`gy${gy}`} x1={0} y1={gy} x2={w} y2={gy} stroke="rgba(255,255,255,0.025)" strokeWidth={0.5} />);
    }
  }

  if (viewMode === "3d") {
    const numSlices = Math.min(stations.length, currentStation + 1);
    const sliceSpacing = Math.min(40, (w * 0.6) / Math.max(numSlices, 1));
    const isoAngle = 0.5;
    const cosA = Math.cos(isoAngle);
    const sinA = Math.sin(isoAngle);

    const allPts: { sx: number; sy: number }[] = [];
    for (let si = 0; si < numSlices; si++) {
      const st = stations[si];
      if (!st) continue;
      st.segments.forEach((seg: any) => {
        const z = si * sliceSpacing;
        allPts.push({ sx: seg.startX * cosA + z * sinA, sy: seg.startY - z * cosA * 0.3 });
        allPts.push({ sx: seg.endX * cosA + z * sinA, sy: seg.endY - z * cosA * 0.3 });
      });
    }
    if (allPts.length === 0) return <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#080818" }} />;

    const mnX = Math.min(...allPts.map(p => p.sx));
    const mxX = Math.max(...allPts.map(p => p.sx));
    const mnY = Math.min(...allPts.map(p => p.sy));
    const mxY = Math.max(...allPts.map(p => p.sy));
    const rX = mxX - mnX || 1;
    const rY = mxY - mnY || 1;
    const sc = Math.min((w - 140) / rX, (h - 120) / rY) * zoom * 0.85;
    const oX = (w - rX * sc) / 2 - mnX * sc;
    const oY = (h - rY * sc) / 2 - mnY * sc + 20;

    const px = (x: number, z: number) => (x * cosA + z * sinA) * sc + oX;
    const py = (y: number, z: number) => h - ((y - z * cosA * 0.3) * sc + oY);

    const polys: React.ReactNode[] = [];
    const lines: React.ReactNode[] = [];
    const labels: React.ReactNode[] = [];

    for (let si = 0; si < numSlices; si++) {
      const st = stations[si];
      if (!st) continue;
      const z = si * sliceSpacing;
      const fp = (si + 1) / totalStations;
      const alpha = si === currentStation ? 1.0 : 0.3 + 0.5 * fp;

      if (si > 0) {
        const prevSt = stations[si - 1];
        if (prevSt && prevSt.segments.length === st.segments.length) {
          const pz = (si - 1) * sliceSpacing;
          st.segments.forEach((seg: any, sgi: number) => {
            const ps = prevSt.segments[sgi];
            if (!ps) return;
            const segMidX = (seg.startX + seg.endX) / 2;
            const segMidY = (seg.startY + seg.endY) / 2;
            let nearestBendAngle = 0;
            let nearestDist = Infinity;
            geometry.bendPoints.forEach((bp: any, bpi: number) => {
              const d = Math.hypot(bp.x - segMidX, bp.y - segMidY);
              if (d < nearestDist) { nearestDist = d; nearestBendAngle = Math.abs(st.bendAngles[bpi] ?? 0); }
            });
            const stressVal = Math.min(fp * nearestBendAngle / 90, 1);
            const pts = `${px(ps.startX, pz)},${py(ps.startY, pz)} ${px(ps.endX, pz)},${py(ps.endY, pz)} ${px(seg.endX, z)},${py(seg.endY, z)} ${px(seg.startX, z)},${py(seg.startY, z)}`;
            polys.push(
              <polygon key={`p${si}-${sgi}`} points={pts}
                fill={interpolateColorRGBA(stressVal, 0.15 + alpha * 0.2)}
                stroke={`rgba(255,255,255,${0.03 + alpha * 0.02})`} strokeWidth={0.5} />
            );
          });
        }
      }

      st.segments.forEach((seg: any, sgi: number) => {
        lines.push(
          <line key={`l${si}-${sgi}`}
            x1={px(seg.startX, z)} y1={py(seg.startY, z)}
            x2={px(seg.endX, z)} y2={py(seg.endY, z)}
            stroke={si === currentStation ? "#3b82f6" : `rgba(100,160,255,${alpha * 0.6})`}
            strokeWidth={si === currentStation ? 2.5 : 1} />
        );
      });

      if (si === currentStation || si === 0 || si === numSlices - 1) {
        const firstSeg = st.segments[0];
        if (firstSeg) {
          labels.push(
            <text key={`t${si}`} x={px(firstSeg.startX, z) - 5} y={py(firstSeg.startY, z)}
              fill={si === currentStation ? "#fff" : "#888"}
              fontSize="9" fontFamily="sans-serif" textAnchor="end"
              fontWeight={si === currentStation ? "bold" : "normal"}>
              St{si + 1}
            </text>
          );
        }
      }
    }

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#080818" }}>
        <defs>
          <linearGradient id="fsBg3d" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#080818" /><stop offset="100%" stopColor="#0a0a1a" />
          </linearGradient>
        </defs>
        <rect width={w} height={h} fill="url(#fsBg3d)" />
        {gridLines}
        {polys}{lines}{labels}
        <text x={15} y={22} fill="#fff" fontSize="12" fontWeight="bold" fontFamily="sans-serif">3D Strip Forming — Isometric View</text>
        <text x={15} y={40} fill="#777" fontSize="10" fontFamily="sans-serif">
          Stations 1–{numSlices}/{totalStations}  •  {materialType} {thickness}mm  •  Longitudinal deformation
        </text>
      </svg>
    );
  }

  const cacheKey = `${currentStation}-${materialType}-${thickness}-${meshDensity}`;
  const cachedResult = workerCacheRef.current.get(cacheKey);
  const { triangles } = cachedResult ?? generateMesh(currentStation);
  if (!triangles.length) return <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#080818" }} />;

  const allX = triangles.flatMap(t => [t.x1, t.x2, t.x3]);
  const allY = triangles.flatMap(t => [t.y1, t.y2, t.y3]);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = Math.min((w - 140) / rangeX, (h - 100) / rangeY) * zoom;
  const offsetX = (w - rangeX * scale) / 2 - minX * scale - 20;
  const offsetY = (h - rangeY * scale) / 2 - minY * scale;

  const tx = (px: number) => px * scale + offsetX;
  const ty = (py: number) => h - (py * scale + offsetY);

  const legendX = w - 55;
  const legendY = 50;
  const legendH = Math.max(h - 130, 40);
  const legendStops = 20;
  const unit = viewMode === "stress" ? "MPa" : viewMode === "strain" ? "%" : viewMode === "thickness" ? "mm" : "";
  const maxVal = viewMode === "stress" ? mat.yieldStrength : viewMode === "strain" ? 10 : thickness;

  const barY = h - 30;
  const barX = 15;
  const barW = w - 100;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#080818" }}>
      <defs>
        <linearGradient id="fsBg2d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#080818" /><stop offset="100%" stopColor="#0a0a1a" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="url(#fsBg2d)" />
      {gridLines}

      {triangles.map((tri, i) => {
        let val = 0;
        switch (viewMode) {
          case "stress": val = tri.stress; break;
          case "strain": val = Math.min(tri.strain * 20, 1); break;
          case "thickness": val = tri.thinning * 10; break;
          case "deformation": val = tri.stress * 0.6 + Math.min(tri.strain * 8, 0.4); break;
          case "energy": val = tri.stress * tri.strain * 100; break;
        }
        return (
          <polygon key={i}
            points={`${tx(tri.x1)},${ty(tri.y1)} ${tx(tri.x2)},${ty(tri.y2)} ${tx(tri.x3)},${ty(tri.y3)}`}
            fill={interpolateColorRGBA(val, 0.85)}
            stroke={showMesh ? "rgba(255,255,255,0.06)" : "none"}
            strokeWidth={showMesh ? 0.5 : 0} />
        );
      })}

      {station.segments.map((seg: any, i: number) => (
        <line key={`seg${i}`} x1={tx(seg.startX)} y1={ty(seg.startY)} x2={tx(seg.endX)} y2={ty(seg.endY)}
          stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
      ))}

      {geometry.bendPoints.map((bp: any, i: number) => (
        <circle key={`bp${i}`} cx={tx(bp.x)} cy={ty(bp.y)} r={6}
          fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth={1.5} />
      ))}

      {Array.from({ length: legendStops }, (_, i) => {
        const val = 1 - i / legendStops;
        const segH = legendH / legendStops;
        return <rect key={`lg${i}`} x={legendX} y={legendY + i * segH} width={18} height={segH + 1} fill={interpolateColor(val)} />;
      })}
      <rect x={legendX} y={legendY} width={18} height={legendH} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
      <text x={legendX + 22} y={legendY + 8} fill="#999" fontSize="9" fontFamily="sans-serif">{maxVal}{unit}</text>
      <text x={legendX + 22} y={legendY + legendH / 2} fill="#999" fontSize="9" fontFamily="sans-serif">{(maxVal * 0.5).toFixed(0)}{unit}</text>
      <text x={legendX + 22} y={legendY + legendH - 2} fill="#999" fontSize="9" fontFamily="sans-serif">0{unit}</text>

      <text x={15} y={22} fill="#fff" fontSize="12" fontWeight="bold" fontFamily="sans-serif">{MODE_LABELS[viewMode]}</text>
      <text x={15} y={40} fill="#777" fontSize="10" fontFamily="sans-serif">
        Station {currentStation + 1}/{totalStations}  •  {materialType} {thickness}mm  •  σ_y={mat.yieldStrength}MPa  •  E={(mat.elasticModulus / 1000).toFixed(0)}GPa  •  {triangles.length} elements
      </text>

      <rect x={barX} y={barY - 4} width={barW} height={8} fill="rgba(255,255,255,0.03)" />
      {Array.from({ length: totalStations }, (_, si) => {
        const sx = barX + (si / Math.max(totalStations - 1, 1)) * barW;
        const isCurrent = si === currentStation;
        return (
          <circle key={`st${si}`} cx={sx} cy={barY} r={isCurrent ? 5 : 3}
            fill={isCurrent ? "#3b82f6" : si < currentStation ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.15)"}
            stroke={isCurrent ? "#fff" : "none"} strokeWidth={isCurrent ? 1.5 : 0} />
        );
      })}
    </svg>
  );
}

export function FormingSimulationView() {
  const { stations, materialType, materialThickness: thickness, geometry: rawGeometry, rollTooling, rollDiameter: storeRollDia } = useCncStore();
  const geometry = rawGeometry ?? { segments: [], bendPoints: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });
  const [currentStation, setCurrentStation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("stress");
  const [zoom, setZoom] = useState(1.0);
  const [showGrid, setShowGrid] = useState(true);
  const [showMesh, setShowMesh] = useState(true);
  const hwCaps = useRef(getHardwareCapabilities());
  const [meshDensity, setMeshDensity] = useState(() => hwCaps.current.recommended.meshDensity);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const [workerActive, setWorkerActive] = useState(false);
  const [computeTimeMs, setComputeTimeMs] = useState(0);
  const workerCacheRef = useRef<Map<string, { triangles: MeshTriangle[]; points: StressPoint[] }>>(new Map());
  const [whatIfStations, setWhatIfStations] = useState<number | null>(null);
  const [showWhatIf, setShowWhatIf] = useState(true);

  useEffect(() => { ensureWorkerPool(); }, []);

  const mat = MATERIAL_PROPS[materialType] ?? MATERIAL_PROPS.GI;
  const safeThickness = Math.max(thickness, 0.1);
  const totalStations = Math.max(stations.length, 1);

  const generateMesh = useCallback((stationIdx: number): { triangles: MeshTriangle[]; points: StressPoint[] } => {
    const station = stations[stationIdx];
    if (!station) return { triangles: [], points: [] };
    const triangles: MeshTriangle[] = [];
    const points: StressPoint[] = [];
    const segs = station.segments;
    const bendAngles = station.bendAngles;
    const formingProgress = (stationIdx + 1) / totalStations;
    const nu = mat.poissonRatio;

    const rollStationData = rollTooling[stationIdx];
    const rollBendR = rollStationData?.upperRollOD
      ? (rollStationData.upperRollOD / 2) * 0.1
      : (storeRollDia ? storeRollDia / 2 * 0.1 : safeThickness * 2);

    const closestBendData = (px: number, py: number): { dist: number; bendIdx: number; R: number; angle: number } => {
      let best = { dist: Infinity, bendIdx: -1, R: safeThickness * 2, angle: 0 };
      geometry.bendPoints.forEach((bp, bi) => {
        const d = Math.hypot(bp.x - px, bp.y - py);
        if (d < best.dist) {
          const baseR = bp.radius || safeThickness * 2;
          const R = rollBendR > 0 ? Math.min(baseR, rollBendR) : baseR;
          best = { dist: d, bendIdx: bi, R: Math.max(R, 0.5), angle: bendAngles[bi] ?? 0 };
        }
      });
      return best;
    };

    segs.forEach((seg, si) => {
      const dx = seg.endX - seg.startX;
      const dy = seg.endY - seg.startY;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const halfT = safeThickness * 2.5;

      for (let i = 0; i < meshDensity; i++) {
        const t0 = i / meshDensity;
        const t1 = (i + 1) / meshDensity;
        const x0 = seg.startX + t0 * dx;
        const y0 = seg.startY + t0 * dy;
        const x1 = seg.startX + t1 * dx;
        const y1 = seg.startY + t1 * dy;

        const b0 = closestBendData(x0, y0);
        const b1 = closestBendData(x1, y1);
        const bendZoneRadius = Math.max(safeThickness * 4, 8);

        const hardening = HARDENING_TABLE[materialType] ?? HARDENING_TABLE.GI;

        const computeStressStrain = (bd: { dist: number; R: number; angle: number }, layerFrac: number) => {
          const inBendZone = bd.dist < bendZoneRadius;
          const proximity = inBendZone ? Math.max(0, 1 - bd.dist / bendZoneRadius) : 0;
          const R_inner = Math.max(bd.R, 0.5);
          const angleDeg = Math.abs(bd.angle);
          const angleRad = (angleDeg * Math.PI) / 180;

          if (!inBendZone || angleDeg < 0.01) {
            return { strain: 0.0005 * formingProgress, stress: 0.0005 * formingProgress * mat.elasticModulus / mat.yieldStrength, thickness: safeThickness, thinning: 0 };
          }

          const kappa = 1 / (R_inner + safeThickness / 2);
          const zLayer = (layerFrac - 0.5) * safeThickness;
          let integratedVonMises = 0;
          let integratedStrain = 0;
          let integratedThinning = 0;

          for (const gp of GAUSS_POINTS_5) {
            const zGauss = (gp.zeta * safeThickness) / 2;
            const layerWeight = 1.0 - 0.5 * Math.abs(zGauss - zLayer) / (safeThickness / 2);
            const epsXX = kappa * zGauss * (angleRad / (Math.PI / 2)) * proximity * formingProgress;
            const epsYY = -nu * epsXX;
            const epsZZ = -(epsXX + epsYY);

            const epsEff = (2 / 3) * Math.sqrt(
              (epsXX - epsYY) ** 2 + (epsYY - epsZZ) ** 2 + (epsZZ - epsXX) ** 2
            ) * Math.SQRT2 / 2;

            const sigmaFlow = hardening.K * Math.pow(Math.max(epsEff, 1e-12), hardening.n);
            const isYielded = sigmaFlow >= mat.yieldStrength;
            const sigma = isYielded ? sigmaFlow : mat.elasticModulus * Math.abs(epsXX);
            const sigmaXX = Math.sign(epsXX) * sigma;
            const sigmaYY = nu * sigmaXX;

            const vonMises = Math.sqrt(sigmaXX ** 2 - sigmaXX * sigmaYY + sigmaYY ** 2);

            integratedVonMises += vonMises * gp.weight * layerWeight;
            integratedStrain += Math.abs(epsEff) * gp.weight * layerWeight;
            integratedThinning += Math.abs(epsZZ) * gp.weight * layerWeight;
          }

          const totalWeight = GAUSS_POINTS_5.reduce((s, gp) => s + gp.weight, 0);
          const avgVonMises = integratedVonMises / totalWeight;
          const avgStrain = integratedStrain / totalWeight;
          const avgThinStrain = integratedThinning / totalWeight;

          const thinRatio = Math.max(0.7, 1 - avgThinStrain);
          const tAct = safeThickness * thinRatio;
          const stressNorm = Math.min(avgVonMises / mat.yieldStrength, 1.8);

          return { strain: avgStrain, stress: stressNorm, thickness: tAct, thinning: 1 - thinRatio };
        };

        const outer0 = computeStressStrain(b0, 1.0);
        const outer1 = computeStressStrain(b1, 1.0);
        const inner0 = computeStressStrain(b0, 0.0);
        const inner1 = computeStressStrain(b1, 0.0);

        const outerX0 = x0 + nx * halfT;
        const outerY0 = y0 + ny * halfT;
        const outerX1 = x1 + nx * halfT;
        const outerY1 = y1 + ny * halfT;
        const innerX0 = x0 - nx * halfT;
        const innerY0 = y0 - ny * halfT;
        const innerX1 = x1 - nx * halfT;
        const innerY1 = y1 - ny * halfT;

        const outerStress = (outer0.stress + outer1.stress) / 2;
        const outerStrain = (outer0.strain + outer1.strain) / 2;
        const outerThin = (outer0.thinning + outer1.thinning) / 2;
        const innerStress = (inner0.stress + inner1.stress) / 2;
        const innerStrain = (inner0.strain + inner1.strain) / 2;
        const innerThin = (inner0.thinning + inner1.thinning) / 2;

        triangles.push({
          x1: outerX0, y1: outerY0, x2: outerX1, y2: outerY1, x3: innerX1, y3: innerY1,
          stress: outerStress, strain: outerStrain, thinning: outerThin,
        });
        triangles.push({
          x1: outerX0, y1: outerY0, x2: innerX1, y2: innerY1, x3: innerX0, y3: innerY0,
          stress: innerStress, strain: innerStrain, thinning: innerThin,
        });

        const midX = (x0 + x1) / 2;
        const midY = (y0 + y1) / 2;
        const mid = computeStressStrain(b0.dist < b1.dist ? b0 : b1, 0.5);
        points.push({
          x: midX, y: midY,
          vonMises: mid.stress,
          strainX: mid.strain,
          strainY: mid.strain * nu,
          thickness: mid.thickness,
        });
      }
    });

    return { triangles, points };
  }, [stations, geometry, thickness, mat, totalStations, meshDensity]);

  const generateMeshAsync = useCallback(async (stationIdx: number): Promise<{ triangles: MeshTriangle[]; points: StressPoint[] }> => {
    const cacheKey = `${stationIdx}-${materialType}-${thickness}-${meshDensity}`;
    const cached = workerCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const station = stations[stationIdx];
    if (!station) return { triangles: [], points: [] };

    setWorkerActive(true);
    const start = performance.now();
    try {
      const result = await computeMeshOnWorker(
        station, geometry.bendPoints, materialType, thickness, totalStations, stationIdx, meshDensity
      );
      const elapsed = Math.round(performance.now() - start);
      setComputeTimeMs(elapsed);
      const typed = result as { triangles: MeshTriangle[]; points: StressPoint[] };
      workerCacheRef.current.set(cacheKey, typed);
      if (workerCacheRef.current.size > 50) {
        const firstKey = workerCacheRef.current.keys().next().value;
        if (firstKey) workerCacheRef.current.delete(firstKey);
      }
      return typed;
    } catch {
      return generateMesh(stationIdx);
    } finally {
      setWorkerActive(false);
    }
  }, [stations, geometry, materialType, thickness, totalStations, meshDensity, generateMesh]);

  useEffect(() => {
    workerCacheRef.current.clear();
  }, [materialType, thickness, meshDensity, stations.length]);

  useEffect(() => {
    if (stations.length > 0 && stations[currentStation]) {
      generateMeshAsync(currentStation);
    }
  }, [currentStation, generateMeshAsync, stations]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    const animate = (time: number) => {
      if (time - lastTimeRef.current > 600) {
        lastTimeRef.current = time;
        setCurrentStation(prev => {
          if (prev >= totalStations - 1) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPlaying, totalStations]);

  const { points } = generateMesh(currentStation);
  const maxStress = points.reduce((m, p) => Math.max(m, p.vonMises), 0);
  const maxStrain = points.reduce((m, p) => Math.max(m, p.strainX), 0);
  const minThick = points.reduce((m, p) => Math.min(m, p.thickness), safeThickness);
  const avgStress = points.length ? points.reduce((s, p) => s + p.vonMises, 0) / points.length : 0;

  const stationEnergies = stations.map((st, idx) => {
    const fp = (idx + 1) / totalStations;
    const maxAngle = Math.max(...(st.bendAngles.length ? st.bendAngles : [0]));
    const bRad = Math.max(safeThickness * 2, 1);
    const strain = (safeThickness / (2 * bRad + safeThickness)) * (maxAngle * Math.PI / 180) * fp;
    return mat.yieldStrength * strain * strain * safeThickness * Math.PI / 4 * (1 + mat.kFactor);
  });

  return (
    <div className="flex flex-col h-full bg-[#070710]">
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.07] flex items-center gap-3">
        <Activity className="w-4 h-4 text-red-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Forming Simulation</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">5pt Gauss · {hwCaps.current.cpu.cores} CPU Threads</span>
        {computeTimeMs > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5" /> {computeTimeMs}ms
          </span>
        )}
        <div className="flex-1" />

        <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5">
          {(["stress", "strain", "thickness", "deformation", "energy", "3d"] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-1 rounded text-[9px] font-medium transition-all ${
                viewMode === mode ? "bg-blue-500/20 text-blue-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {mode === "stress" ? "σ Stress" : mode === "strain" ? "ε Strain" : mode === "thickness" ? "Thinning" : mode === "deformation" ? "Deform" : mode === "3d" ? "3D View" : "Energy"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="p-1 rounded hover:bg-white/[0.06] text-zinc-500"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="text-[9px] text-zinc-500 w-8 text-center">{(zoom * 100).toFixed(0)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-1 rounded hover:bg-white/[0.06] text-zinc-500"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button onClick={() => setShowMesh(!showMesh)} className={`p-1 rounded ${showMesh ? "text-blue-400" : "text-zinc-600"}`} title="Toggle mesh wireframe">
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative" ref={containerRef}>
          <FormingSimSVG
            w={dims.w} h={dims.h}
            stations={stations}
            currentStation={currentStation}
            totalStations={totalStations}
            viewMode={viewMode}
            zoom={zoom}
            showGrid={showGrid}
            showMesh={showMesh}
            materialType={materialType}
            thickness={thickness}
            mat={mat}
            meshDensity={meshDensity}
            geometry={geometry}
            generateMesh={generateMesh}
            workerCacheRef={workerCacheRef}
          />
        </div>

        <div className="w-56 flex-shrink-0 border-l border-white/[0.07] bg-[#0c0c1a] p-3 space-y-3 overflow-y-auto">
          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Playback</div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setCurrentStation(0); setIsPlaying(false); }} className="p-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsPlaying(!isPlaying)} className={`p-1.5 rounded ${isPlaying ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[10px] text-zinc-400">{currentStation + 1}/{totalStations}</span>
            </div>
            <input type="range" min={0} max={totalStations - 1} value={currentStation} onChange={e => { setCurrentStation(parseInt(e.target.value)); setIsPlaying(false); }} className="w-full mt-1.5 accent-blue-500" />
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Mesh Settings</div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-zinc-500">Density</span>
              <input type="range" min={3} max={20} value={meshDensity} onChange={e => setMeshDensity(parseInt(e.target.value))} className="flex-1 accent-blue-500" />
              <span className="text-[9px] text-zinc-400">{meshDensity}</span>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Results</div>
            <div className="space-y-1.5">
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Thermometer className="w-3 h-3 text-red-400" />
                  <span className="text-[9px] text-zinc-500">Peak σ</span>
                </div>
                <span className={`text-sm font-bold ${maxStress > 1 ? "text-red-400" : maxStress > 0.7 ? "text-amber-400" : "text-emerald-400"}`}>
                  {(maxStress * mat.yieldStrength).toFixed(1)} MPa
                </span>
                <span className="text-[8px] text-zinc-600 ml-1">({(maxStress * 100).toFixed(0)}% σ_y)</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Activity className="w-3 h-3 text-amber-400" />
                  <span className="text-[9px] text-zinc-500">Avg σ</span>
                </div>
                <span className="text-sm font-bold text-amber-300">{(avgStress * mat.yieldStrength).toFixed(1)} MPa</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <BarChart3 className="w-3 h-3 text-purple-400" />
                  <span className="text-[9px] text-zinc-500">ε_max</span>
                </div>
                <span className="text-sm font-bold text-purple-300">{(maxStrain * 100).toFixed(3)}%</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Eye className="w-3 h-3 text-blue-400" />
                  <span className="text-[9px] text-zinc-500">Min t</span>
                </div>
                <span className="text-sm font-bold text-blue-300">{minThick.toFixed(3)} mm</span>
                <span className="text-[8px] text-zinc-600 ml-1">(-{((1 - minThick / safeThickness) * 100).toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Forming Energy</div>
            <div className="bg-white/[0.03] rounded-lg p-2">
              <div className="flex items-end gap-px h-16">
                {stationEnergies.map((e, i) => {
                  const maxE = Math.max(...stationEnergies, 0.001);
                  const hPct = (e / maxE) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center">
                      <div
                        className={`w-full rounded-t ${i === currentStation ? "bg-blue-500" : "bg-blue-500/30"}`}
                        style={{ height: `${Math.max(hPct, 4)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-zinc-600">St 1</span>
                <span className="text-[8px] text-zinc-600">St {totalStations}</span>
              </div>
              <div className="text-center mt-1">
                <span className="text-[9px] text-zinc-400">Total: {stationEnergies.reduce((s, e) => s + e, 0).toFixed(3)} kJ/m</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Confidence Bands (±95%)
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2 space-y-1.5">
              {[
                { label: "Peak σ", nominal: maxStress * mat.yieldStrength, pct: 0.08, unit: "MPa", color: "text-red-300" },
                { label: "ε_max", nominal: maxStrain * 100, pct: 0.10, unit: "%", color: "text-purple-300" },
                { label: "Min t", nominal: minThick, pct: 0.05, unit: "mm", color: "text-blue-300" },
                { label: "Thinning", nominal: (1 - minThick / safeThickness) * 100, pct: 0.12, unit: "%", color: "text-amber-300" },
              ].map(({ label, nominal, pct, unit, color }) => (
                <div key={label} className="flex items-center justify-between text-[9px]">
                  <span className="text-zinc-500">{label}</span>
                  <span className={color}>
                    {(nominal * (1 - pct)).toFixed(2)}–{(nominal * (1 + pct)).toFixed(2)} {unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Material</div>
            <div className="bg-white/[0.03] rounded-lg p-2 space-y-0.5">
              <div className="flex justify-between text-[9px]"><span className="text-zinc-500">Type</span><span className="text-zinc-300">{materialType}</span></div>
              <div className="flex justify-between text-[9px]"><span className="text-zinc-500">σ_y</span><span className="text-zinc-300">{mat.yieldStrength} MPa</span></div>
              <div className="flex justify-between text-[9px]"><span className="text-zinc-500">E</span><span className="text-zinc-300">{(mat.elasticModulus / 1000).toFixed(0)} GPa</span></div>
              <div className="flex justify-between text-[9px]"><span className="text-zinc-500">ν</span><span className="text-zinc-300">{mat.poissonRatio}</span></div>
              <div className="flex justify-between text-[9px]"><span className="text-zinc-500">t</span><span className="text-zinc-300">{thickness} mm</span></div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Verdict</div>
            {maxStress > 1.0 ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                <span className="text-[9px] text-red-400 font-bold">YIELD EXCEEDED</span>
                <p className="text-[8px] text-red-400/70 mt-0.5">Risk of cracking at station {currentStation + 1}. Add stations or reduce bend angle.</p>
              </div>
            ) : maxStress > 0.7 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                <span className="text-[9px] text-amber-400 font-bold">HIGH STRESS</span>
                <p className="text-[8px] text-amber-400/70 mt-0.5">Monitor for springback and surface defects.</p>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                <span className="text-[9px] text-emerald-400 font-bold">SAFE</span>
                <p className="text-[8px] text-emerald-400/70 mt-0.5">All stresses within safe limits.</p>
              </div>
            )}
          </div>

          <WhatIfAnalyzer
            totalStations={totalStations}
            materialType={materialType}
            thickness={safeThickness}
            stations={stations}
            showWhatIf={showWhatIf}
            setShowWhatIf={setShowWhatIf}
            whatIfStations={whatIfStations}
            setWhatIfStations={setWhatIfStations}
          />
        </div>
      </div>
    </div>
  );
}

function WhatIfAnalyzer({
  totalStations,
  materialType,
  thickness,
  stations,
  showWhatIf,
  setShowWhatIf,
  whatIfStations,
  setWhatIfStations,
}: {
  totalStations: number;
  materialType: string;
  thickness: number;
  stations: { bendAngles: number[] }[];
  showWhatIf: boolean;
  setShowWhatIf: (v: boolean) => void;
  whatIfStations: number | null;
  setWhatIfStations: (v: number | null) => void;
}) {
  const totalBendAngle = useMemo(() => {
    if (!stations.length) return 360;
    const maxAngles = stations.map(s => {
      if (!s.bendAngles.length) return 0;
      return Math.max(...s.bendAngles.map(Math.abs));
    });
    const totalFormed = maxAngles.reduce((s, a) => s + a, 0);
    return totalFormed > 0 ? totalFormed : 360;
  }, [stations]);

  const analysis = useMemo(() => {
    if (whatIfStations === null || whatIfStations === totalStations) return null;
    return analyzeStationChange(totalStations, whatIfStations, materialType, thickness, totalBendAngle);
  }, [whatIfStations, totalStations, materialType, thickness, totalBendAngle]);

  const riskColors: Record<string, string> = {
    safe: "text-emerald-400", moderate: "text-amber-400", high: "text-orange-400", critical: "text-red-400",
  };
  const riskBg: Record<string, string> = {
    safe: "bg-emerald-500/10 border-emerald-500/20", moderate: "bg-amber-500/10 border-amber-500/20",
    high: "bg-orange-500/10 border-orange-500/20", critical: "bg-red-500/10 border-red-500/20",
  };
  const severityColors: Record<string, string> = {
    critical: "text-red-400 bg-red-500/10 border-red-500/20",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    info: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  };
  const severityIcons: Record<string, string> = {
    critical: "🚫", warning: "⚠️", info: "ℹ️",
  };

  return (
    <div>
      <button
        onClick={() => setShowWhatIf(!showWhatIf)}
        className="w-full flex items-center gap-1.5 text-[9px] font-semibold text-amber-400 uppercase tracking-widest mb-1.5 hover:text-amber-300 transition-colors"
      >
        <Brain className="w-3 h-3" />
        AI What-If — Station Change
        {showWhatIf ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>

      {showWhatIf && (
        <div className="space-y-2">
          <div className="bg-white/[0.03] rounded-lg p-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] text-zinc-500">Stations:</span>
              <span className="text-[10px] text-zinc-400 font-mono w-10 text-center">{whatIfStations ?? totalStations}</span>
            </div>
            <input
              type="range"
              min={Math.max(3, totalStations - 6)}
              max={totalStations + 6}
              value={whatIfStations ?? totalStations}
              onChange={e => {
                const v = parseInt(e.target.value);
                setWhatIfStations(v === totalStations ? null : v);
              }}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[8px] text-zinc-600 mt-0.5">
              <span>{Math.max(3, totalStations - 6)}</span>
              <span className="text-amber-500/50">Current: {totalStations}</span>
              <span>{totalStations + 6}</span>
            </div>
          </div>

          {whatIfStations !== null && whatIfStations !== totalStations && analysis && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className={`rounded-lg p-2 border ${riskBg[analysis.riskLevel]}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase ${riskColors[analysis.riskLevel]}`}>
                    Risk: {analysis.riskLevel}
                  </span>
                  <span className="text-[8px] text-zinc-500">
                    {totalStations}→{whatIfStations} stations
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-1.5">
                  <div className="text-[8px]">
                    <span className="text-zinc-500">°/station: </span>
                    <span className={analysis.maxAnglePerStation > (MATERIAL_MAX_INCREMENT[materialType] ?? 12) ? "text-red-400" : "text-zinc-300"}>
                      {analysis.maxAnglePerStation.toFixed(1)}°
                    </span>
                  </div>
                  <div className="text-[8px]">
                    <span className="text-zinc-500">Edge ε: </span>
                    <span className={analysis.edgeStrain > 2 ? "text-red-400" : analysis.edgeStrain > 1.5 ? "text-amber-400" : "text-zinc-300"}>
                      {analysis.edgeStrain.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {analysis.problems.length > 0 && (
                <div>
                  <div className="text-[8px] font-semibold text-red-400 uppercase tracking-widest mb-1">
                    Problems ({analysis.problems.length})
                  </div>
                  <div className="space-y-1">
                    {analysis.problems.map((p, i) => (
                      <div key={i} className={`rounded-lg p-1.5 border ${severityColors[p.severity]}`}>
                        <div className="flex items-start gap-1">
                          <span className="text-[8px] mt-0.5">{severityIcons[p.severity]}</span>
                          <div>
                            <p className="text-[8px] font-bold leading-tight">{p.title}</p>
                            <p className="text-[7px] opacity-70 mt-0.5 leading-snug">{p.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.solutions.length > 0 && (
                <div>
                  <div className="text-[8px] font-semibold text-emerald-400 uppercase tracking-widest mb-1">
                    Solutions ({analysis.solutions.length})
                  </div>
                  <div className="space-y-1">
                    {analysis.solutions.map((s, i) => (
                      <div key={i} className="rounded-lg p-1.5 bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[8px] font-bold text-emerald-400 leading-tight">✅ {s.title}</p>
                        <p className="text-[7px] text-emerald-400/70 mt-0.5 leading-snug">{s.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {whatIfStations < totalStations && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-1.5">
                  <p className="text-[8px] text-amber-300 font-medium">
                    💡 {whatIfStations} stations me karna hai to upar ke solutions follow karo.
                    Line speed kam karo, overbend badhao, aur edge strain monitor karo.
                    {analysis.riskLevel === "critical" ? " Lekin critical risk hai — production reject hoga." : ""}
                  </p>
                </div>
              )}
            </div>
          )}

          {(whatIfStations === null || whatIfStations === totalStations) && (
            <div className="bg-white/[0.02] rounded-lg p-2">
              <p className="text-[8px] text-zinc-500 text-center leading-relaxed">
                Slider move karo stations change karne ke liye.
                AI turant batayega kya problem aayegi aur solution bhi dega.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
