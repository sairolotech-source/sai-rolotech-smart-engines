import React, { useState, useCallback } from "react";
import { Download, Printer, ZoomIn, ZoomOut, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface ProfileParams {
  profileName: string;
  material: string;
  thickness: number;
  flangeA: number;
  flangeB: number;
  stripWidth: number;
  stations: number;
  rollOD: number;
  shaftOD: number;
  lineSpeed: number;
  springback: number;
}

interface StationData {
  no: number;
  angle: number;
}

function computeStations(totalAngle: number, count: number): StationData[] {
  const stations: StationData[] = [];
  // Non-linear progression — more gradual at start, steeper at middle, then finish
  const angles = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count;
    // Ease-in-out curve
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    angles.push(Math.round(eased * totalAngle));
  }
  // Make sure last station = totalAngle
  angles[count - 1] = totalAngle;
  for (let i = 0; i < count; i++) {
    stations.push({ no: i + 1, angle: angles[i] });
  }
  return stations;
}

// FIX: default kFactor was 0.33 (old ANSI press-brake standard) — for roll forming, DIN 6935 GI=0.44
function computeBendAllowance(t: number, angle: number, kFactor = 0.44): number {
  const R = t; // 1×t inner radius
  return (Math.PI / 180) * (R + kFactor * t) * angle;
}

function RollStationSVG({
  station,
  flangeA,
  flangeB,
  t,
  maxAngle,
}: {
  station: StationData;
  flangeA: number;
  flangeB: number;
  t: number;
  maxAngle: number;
}) {
  const SCALE = 2.8;
  const tPx = t * SCALE;
  const flA = flangeA * SCALE;
  const flB = flangeB * SCALE;
  const rad = (station.angle * Math.PI) / 180;
  const rollH = 55;
  const gap = 6;
  const isSymmetric = Math.abs(flangeA - flangeB) < 0.5;

  // Upper roll points
  const uy = -gap / 2;
  const angX = flB * Math.sin(rad);
  const angY = -flB * Math.cos(rad);

  const upperPts = [
    [0, uy],
    [-flA, uy],
    [-flA, uy - rollH],
    [angX + 6, uy - rollH],
    [angX, angY + uy],
  ]
    .map((p) => p.join(","))
    .join(" ");

  const lowerPts = [
    [0, gap / 2],
    [-flA, gap / 2],
    [-flA, gap / 2 + rollH],
    [angX + 6, gap / 2 + rollH],
    [angX, gap / 2 + flB * Math.cos(rad)],
  ]
    .map((p) => p.join(","))
    .join(" ");

  // Strip horizontal flange
  const stripH = [
    [0, -tPx / 2],
    [-flA, -tPx / 2],
    [-flA, tPx / 2],
    [0, tPx / 2],
  ]
    .map((p) => p.join(","))
    .join(" ");

  // Strip vertical flange
  const sinA = Math.sin(rad);
  const cosA = Math.cos(rad);
  const sx1 = -(tPx / 2) * sinA;
  const sy1 = -(tPx / 2) * cosA;
  const sx2 = (tPx / 2) * sinA;
  const sy2 = (tPx / 2) * cosA;
  const stripV = [
    [sx1, sy1],
    [angX + sx1, angY + sy1],
    [angX + sx2, angY + sy2],
    [sx2, sy2],
  ]
    .map((p) => p.join(","))
    .join(" ");

  const arcR = 22;
  const arcX2 = arcR * Math.sin(rad);
  const arcY2 = -arcR * Math.cos(rad);

  return (
    <svg
      viewBox={`${-flA - 20} ${-rollH - 45} ${flA + angX + 50} ${rollH * 2 + 90}`}
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`upper-${station.no}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b6fd4" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <linearGradient id={`lower-${station.no}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#1e2d5e" />
        </linearGradient>
      </defs>

      {/* Upper roll */}
      <polygon
        points={upperPts}
        fill={`url(#upper-${station.no})`}
        stroke="#60a5fa"
        strokeWidth="1.2"
      />
      {/* Upper roll hatching lines */}
      {[-flA + 8, -flA + 18, -flA + 28, -flA + 38].map((hx, hi) =>
        hx < -5 ? (
          <line
            key={hi}
            x1={hx}
            y1={uy}
            x2={hx + 8}
            y2={uy - 12}
            stroke="#2563eb"
            strokeWidth="0.6"
            opacity="0.4"
          />
        ) : null
      )}

      {/* Lower roll */}
      <polygon
        points={lowerPts}
        fill={`url(#lower-${station.no})`}
        stroke="#60a5fa"
        strokeWidth="1.2"
      />

      {/* Strip material - horizontal */}
      <polygon points={stripH} fill="#f59e0b" stroke="#d97706" strokeWidth="0.7" />
      {/* Strip material - vertical flange */}
      <polygon points={stripV} fill="#fbbf24" stroke="#d97706" strokeWidth="0.7" />

      {/* Center gap dashed line */}
      <line
        x1={-flA - 5}
        y1={0}
        x2={angX + 10}
        y2={0}
        stroke="#475569"
        strokeWidth="0.5"
        strokeDasharray="4,3"
      />

      {/* Angle arc */}
      <path
        d={`M ${arcR},0 A ${arcR},${arcR} 0 0,1 ${arcX2.toFixed(1)},${arcY2.toFixed(1)}`}
        stroke="#f43f5e"
        strokeWidth="1.2"
        fill="none"
        strokeDasharray="3,2"
      />
      <text
        x={arcX2 + 4}
        y={arcY2 - 2}
        fontSize="10"
        fill="#f43f5e"
        fontWeight="bold"
      >
        {station.angle}°
      </text>

      {/* Station label */}
      <text
        x={-flA / 2}
        y={-rollH - 28}
        fontSize="12"
        fill="#94a3b8"
        textAnchor="middle"
        fontWeight="bold"
      >
        STN {station.no}
      </text>
      <text
        x={-flA / 2}
        y={-rollH - 14}
        fontSize="15"
        fill="#f59e0b"
        textAnchor="middle"
        fontWeight="bold"
      >
        {station.angle}°
      </text>

      {/* Flange dimension */}
      <line
        x1={-flA}
        y1={rollH + 14}
        x2={0}
        y2={rollH + 14}
        stroke="#64748b"
        strokeWidth="0.7"
      />
      <line x1={-flA} y1={rollH + 8} x2={-flA} y2={rollH + 20} stroke="#64748b" strokeWidth="0.7" />
      <line x1={0} y1={rollH + 8} x2={0} y2={rollH + 20} stroke="#64748b" strokeWidth="0.7" />
      <text
        x={-flA / 2}
        y={rollH + 26}
        fontSize="9"
        fill="#64748b"
        textAnchor="middle"
      >
        {flangeA}mm
      </text>

      {/* Bend radius indicator */}
      <circle cx={0} cy={0} r={3} fill="#f43f5e" opacity="0.8" />
    </svg>
  );
}

const DEFAULT_PARAMS: ProfileParams = {
  profileName: "Equal Angle 30×30×0.8 GP",
  material: "G.P (Galvanized Plain)",
  thickness: 0.8,
  flangeA: 30,
  flangeB: 30,
  stripWidth: 63.34,
  stations: 6,
  rollOD: 120,
  shaftOD: 50,
  lineSpeed: 55,
  springback: 2.5,
};

export default function RollToolingDrawingView() {
  const [params, setParams] = useState<ProfileParams>(DEFAULT_PARAMS);
  const [zoom, setZoom] = useState(1);
  const [showParams, setShowParams] = useState(true);

  const ba = computeBendAllowance(params.thickness, 90);
  const calculatedStrip = params.flangeA + params.flangeB + 2 * ba;
  const stations = computeStations(90, params.stations);

  const handleChange = useCallback(
    (field: keyof ProfileParams, val: string | number) => {
      setParams((prev) => {
        const updated = { ...prev, [field]: typeof val === "string" ? parseFloat(val) || val : val };
        if (
          field === "flangeA" ||
          field === "flangeB" ||
          field === "thickness"
        ) {
          const newBa = computeBendAllowance(
            field === "thickness" ? (updated.thickness as number) : prev.thickness,
            90
          );
          const newFa = field === "flangeA" ? (updated.flangeA as number) : prev.flangeA;
          const newFb = field === "flangeB" ? (updated.flangeB as number) : prev.flangeB;
          updated.stripWidth = parseFloat((newFa + newFb + 2 * newBa).toFixed(2));
        }
        return updated;
      });
    },
    []
  );

  const downloadSVG = () => {
    const svgEl = document.getElementById("roll-drawing-main");
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SAI-Roll-Drawing-${params.profileName.replace(/[^a-z0-9]/gi, "-")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printDrawing = () => {
    const svgEl = document.getElementById("roll-drawing-main");
    if (!svgEl) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>${params.profileName} — Roll Drawing</title>
      <style>body{margin:0;background:#0f172a;} svg{max-width:100%;}</style>
      </head><body>${svgEl.outerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div
      style={{
        background: "#0a0f1e",
        minHeight: "100%",
        color: "#e2e8f0",
        fontFamily: "monospace",
        padding: "0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          background: "#0f1f3d",
          borderBottom: "1px solid #1e3a5f",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 14 }}>
          🔩 Roll Tooling Drawing
        </span>
        <span style={{ color: "#475569", fontSize: 12 }}>
          {params.profileName}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowParams((v) => !v)}
          style={{
            background: "#1e3a5f",
            border: "1px solid #2563eb",
            borderRadius: 6,
            color: "#93c5fd",
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {showParams ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Parameters
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 4,
            color: "#94a3b8",
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 4,
            color: "#94a3b8",
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={() => setZoom(1)}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 4,
            color: "#94a3b8",
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} />
        </button>
        <button
          onClick={downloadSVG}
          style={{
            background: "#1e3a5f",
            border: "1px solid #2563eb",
            borderRadius: 6,
            color: "#93c5fd",
            padding: "4px 12px",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Download size={13} /> SVG
        </button>
        <button
          onClick={printDrawing}
          style={{
            background: "#1e3a5f",
            border: "1px solid #2563eb",
            borderRadius: 6,
            color: "#93c5fd",
            padding: "4px 12px",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Printer size={13} /> Print
        </button>
      </div>

      {/* Parameters Panel */}
      {showParams && (
        <div
          style={{
            background: "#0c1a2e",
            borderBottom: "1px solid #1e3a5f",
            padding: "12px 16px",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          {[
            { label: "Profile Name", field: "profileName", type: "text", unit: "" },
            { label: "Thickness (mm)", field: "thickness", type: "number", unit: "mm" },
            { label: "Flange A (mm)", field: "flangeA", type: "number", unit: "mm" },
            { label: "Flange B (mm)", field: "flangeB", type: "number", unit: "mm" },
            { label: "Stations", field: "stations", type: "number", unit: "" },
            { label: "Roll OD (mm)", field: "rollOD", type: "number", unit: "mm" },
            { label: "Shaft OD (mm)", field: "shaftOD", type: "number", unit: "mm" },
            { label: "Line Speed", field: "lineSpeed", type: "number", unit: "m/min" },
            { label: "Springback", field: "springback", type: "number", unit: "°" },
          ].map(({ label, field, type, unit }) => (
            <div key={field} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <label style={{ fontSize: 10, color: "#64748b" }}>{label}</label>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type={type}
                  value={params[field as keyof ProfileParams] as string | number}
                  onChange={(e) =>
                    handleChange(
                      field as keyof ProfileParams,
                      type === "number" ? parseFloat(e.target.value) : e.target.value
                    )
                  }
                  step={type === "number" ? "0.1" : undefined}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #1e3a5f",
                    borderRadius: 4,
                    color: "#f59e0b",
                    padding: "4px 6px",
                    fontSize: 12,
                    width: field === "profileName" ? 180 : 70,
                    fontFamily: "monospace",
                  }}
                />
                {unit && (
                  <span style={{ fontSize: 10, color: "#475569" }}>{unit}</span>
                )}
              </div>
            </div>
          ))}

          {/* Calculated strip width display */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={{ fontSize: 10, color: "#64748b" }}>
              Strip Width (calculated)
            </label>
            <div
              style={{
                background: "#0f2d1a",
                border: "1px solid #16a34a",
                borderRadius: 4,
                color: "#4ade80",
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: "bold",
              }}
            >
              {calculatedStrip.toFixed(2)} mm
            </div>
          </div>
        </div>
      )}

      {/* Main Drawing */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <svg
          id="roll-drawing-main"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: `${100 * zoom}%`,
            background: "#0a0f1e",
            borderRadius: 8,
            border: "1px solid #1e3a5f",
            display: "block",
          }}
          viewBox={`0 0 1100 ${160 + Math.ceil(stations.length / 3) * 260 + 220}`}
        >
          <defs>
            <pattern
              id="bg-grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="#1e293b"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg-grid)" />
          <rect
            x="5"
            y="5"
            width="1090"
            height={148 + Math.ceil(stations.length / 3) * 260 + 215}
            fill="none"
            stroke="#1e3a5f"
            strokeWidth="1.5"
          />

          {/* Title Block */}
          <rect x="5" y="5" width="1090" height="70" fill="#0f1f3d" stroke="#1e40af" strokeWidth="1" />
          <text x="550" y="30" fontSize="20" fill="#f59e0b" textAnchor="middle" fontWeight="bold">
            SAI ROLOTECH SMART ENGINES
          </text>
          <text x="550" y="50" fontSize="13" fill="#e2e8f0" textAnchor="middle">
            ROLL TOOLING DRAWING — {params.profileName.toUpperCase()} | {params.material}
          </text>
          <text x="550" y="65" fontSize="9" fill="#64748b" textAnchor="middle">
            DWG: SAI-RT-{params.thickness.toString().replace(".","")}-{params.flangeA}x{params.flangeB} | Rev: A | Mar 2026 | Units: mm | Stations: {params.stations}
          </text>

          {/* Title block right panel */}
          <rect x="890" y="5" width="205" height="70" fill="#0c1228" stroke="#334155" strokeWidth="0.8" />
          <text x="992" y="22" fontSize="9" fill="#64748b" textAnchor="middle">SPECIFICATION</text>
          <text x="992" y="35" fontSize="10" fill="#e2e8f0" textAnchor="middle">t = {params.thickness} mm | Roll OD = {params.rollOD} mm</text>
          <text x="992" y="48" fontSize="10" fill="#f59e0b" textAnchor="middle" fontWeight="bold">Strip: {calculatedStrip.toFixed(2)} mm</text>
          <text x="992" y="60" fontSize="9" fill="#94a3b8" textAnchor="middle">Speed: {params.lineSpeed} m/min | Sback: {params.springback}°</text>

          {/* Station drawings grid */}
          {stations.map((stn, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const cx = 60 + col * 360 + 155;
            const cy = 75 + 20 + row * 260 + 120;
            const cellX = 60 + col * 360;
            const cellY = 75 + 20 + row * 260;
            const cellW = 340;
            const cellH = 250;

            const SCALE = 2.8;
            const flA = params.flangeA * SCALE;
            const flB = params.flangeB * SCALE;
            const tPx = params.thickness * SCALE;
            const rad = (stn.angle * Math.PI) / 180;
            const rollH = 55;
            const gap = 6;

            const angX = flB * Math.sin(rad);
            const angY = -flB * Math.cos(rad);

            const upperPts = [
              [cx, cy - gap / 2],
              [cx - flA, cy - gap / 2],
              [cx - flA, cy - gap / 2 - rollH],
              [cx + angX + 6, cy - gap / 2 - rollH],
              [cx + angX, cy + angY - gap / 2],
            ]
              .map((p) => p.join(","))
              .join(" ");

            const lowerPts = [
              [cx, cy + gap / 2],
              [cx - flA, cy + gap / 2],
              [cx - flA, cy + gap / 2 + rollH],
              [cx + angX + 6, cy + gap / 2 + rollH],
              [cx + angX, cy + gap / 2 + flB * Math.cos(rad)],
            ]
              .map((p) => p.join(","))
              .join(" ");

            const stripH = [
              [cx, cy - tPx / 2],
              [cx - flA, cy - tPx / 2],
              [cx - flA, cy + tPx / 2],
              [cx, cy + tPx / 2],
            ]
              .map((p) => p.join(","))
              .join(" ");

            const sinA = Math.sin(rad);
            const cosA = Math.cos(rad);
            const sx1 = -(tPx / 2) * sinA;
            const sy1 = -(tPx / 2) * cosA;
            const sx2 = (tPx / 2) * sinA;
            const sy2 = (tPx / 2) * cosA;
            const stripV = [
              [cx + sx1, cy + sy1],
              [cx + angX + sx1, cy + angY + sy1],
              [cx + angX + sx2, cy + angY + sy2],
              [cx + sx2, cy + sy2],
            ]
              .map((p) => p.join(","))
              .join(" ");

            const arcR = 22;
            const arcX2 = cx + arcR * Math.sin(rad);
            const arcY2 = cy - arcR * Math.cos(rad);

            return (
              <g key={stn.no}>
                {/* Cell background */}
                <rect
                  x={cellX}
                  y={cellY}
                  width={cellW}
                  height={cellH}
                  fill="#0c1a2e"
                  stroke="#1e3a5f"
                  strokeWidth="1"
                />

                {/* Upper roll */}
                <polygon
                  points={upperPts}
                  fill="#1e3a8a"
                  stroke="#60a5fa"
                  strokeWidth="1.2"
                />
                {/* Hatching */}
                {[-flA + 10, -flA + 22, -flA + 34, -flA + 46].map((hx, hi) =>
                  hx < -8 ? (
                    <line
                      key={hi}
                      x1={cx + hx}
                      y1={cy - gap / 2}
                      x2={cx + hx + 10}
                      y2={cy - gap / 2 - 14}
                      stroke="#2563eb"
                      strokeWidth="0.6"
                      opacity="0.35"
                    />
                  ) : null
                )}

                {/* Lower roll */}
                <polygon
                  points={lowerPts}
                  fill="#162d6e"
                  stroke="#60a5fa"
                  strokeWidth="1.2"
                />

                {/* Strip */}
                <polygon
                  points={stripH}
                  fill="#f59e0b"
                  stroke="#d97706"
                  strokeWidth="0.8"
                />
                <polygon
                  points={stripV}
                  fill="#fbbf24"
                  stroke="#d97706"
                  strokeWidth="0.8"
                />

                {/* Center line */}
                <line
                  x1={cx - flA - 5}
                  y1={cy}
                  x2={cx + angX + 12}
                  y2={cy}
                  stroke="#334155"
                  strokeWidth="0.5"
                  strokeDasharray="4,3"
                />

                {/* Angle arc + label */}
                <path
                  d={`M ${cx + arcR},${cy} A ${arcR},${arcR} 0 0,1 ${arcX2.toFixed(1)},${arcY2.toFixed(1)}`}
                  stroke="#f43f5e"
                  strokeWidth="1.2"
                  fill="none"
                  strokeDasharray="3,2"
                />
                <text
                  x={arcX2 + 4}
                  y={arcY2 - 2}
                  fontSize="10"
                  fill="#f43f5e"
                  fontWeight="bold"
                >
                  {stn.angle}°
                </text>

                {/* Station header */}
                <text
                  x={cellX + cellW / 2}
                  y={cellY + 16}
                  fontSize="11"
                  fill="#94a3b8"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  STATION {stn.no}
                </text>
                <text
                  x={cellX + cellW / 2}
                  y={cellY + 30}
                  fontSize="16"
                  fill="#f59e0b"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {stn.angle}°
                  {stn.no === params.stations ? ` (+${params.springback}° sback)` : ""}
                </text>

                {/* Flange dim */}
                <line
                  x1={cx - flA}
                  y1={cy + rollH + 16}
                  x2={cx}
                  y2={cy + rollH + 16}
                  stroke="#475569"
                  strokeWidth="0.8"
                />
                <line x1={cx - flA} y1={cy + rollH + 10} x2={cx - flA} y2={cy + rollH + 22} stroke="#475569" strokeWidth="0.8" />
                <line x1={cx} y1={cy + rollH + 10} x2={cx} y2={cy + rollH + 22} stroke="#475569" strokeWidth="0.8" />
                <text
                  x={cx - flA / 2}
                  y={cy + rollH + 30}
                  fontSize="9"
                  fill="#64748b"
                  textAnchor="middle"
                >
                  {params.flangeA}mm
                </text>

                {/* Legend */}
                <rect x={cellX + 4} y={cellY + cellH - 20} width={8} height={8} fill="#1e3a8a" stroke="#60a5fa" strokeWidth="0.6" />
                <text x={cellX + 15} y={cellY + cellH - 13} fontSize="8" fill="#475569">Upper/Lower Roll (EN31)</text>
                <rect x={cellX + 120} y={cellY + cellH - 20} width={8} height={8} fill="#f59e0b" />
                <text x={cellX + 131} y={cellY + cellH - 13} fontSize="8" fill="#475569">Strip ({params.material})</text>
              </g>
            );
          })}

          {/* BOM Section */}
          {(() => {
            const bomY = 75 + 20 + Math.ceil(stations.length / 3) * 260 + 10;
            const bomH = 200;
            const rows = [
              ["1", `Upper Forming Roll Set (${params.stations} pcs)`, "EN31 Steel, HRC 58-62", `OD: ${params.rollOD}mm, ID: ${params.shaftOD}mm`, "Per Stn"],
              ["2", `Lower Forming Roll Set (${params.stations} pcs)`, "EN31 Steel, HRC 58-62", `OD: ${params.rollOD}mm, ID: ${params.shaftOD}mm`, "Per Stn"],
              ["3", "Drive Shaft Set (2 pcs)", "EN36 Steel, Case Hardened", `Ø${params.shaftOD}mm × 800mm L`, "Top + Bot"],
              ["4", "Side Guide Roll Set", "SS304", "OD: 60mm, ID: 25mm", "Inlet+Outlet"],
              ["5", "Entry Straightener", "MS + Rollers, 4-Roll", "Adjustable", "1 Set"],
              ["6", `Strip Material (${params.material})`, "IS:513/IS:10748 GP Coil", `${params.thickness}mm × ${calculatedStrip.toFixed(2)}mm wide`, "Input Coil"],
            ];
            const cols2 = [80, 200, 480, 700, 920, 1010];
            const hdrs = ["S.No", "Description", "Material / Spec", "Dimensions", "Qty", "Remarks"];
            return (
              <g>
                <rect x="60" y={bomY} width="980" height={bomH} fill="#0c1a2e" stroke="#1e3a5f" strokeWidth="1" />
                <rect x="60" y={bomY} width="980" height="22" fill="#0f1f3d" stroke="#1e40af" strokeWidth="0.8" />
                <text x="75" y={bomY + 15} fontSize="12" fill="#f59e0b" fontWeight="bold">
                  BILL OF MATERIALS / SPECIFICATIONS
                </text>
                <line x1="60" y1={bomY + 36} x2="1040" y2={bomY + 36} stroke="#1e40af" strokeWidth="0.6" />
                {hdrs.map((h, hi) => (
                  <text key={hi} x={cols2[hi]} y={bomY + 32} fontSize="9" fill="#94a3b8" fontWeight="bold">{h}</text>
                ))}
                {rows.map((row, ri) => (
                  <g key={ri}>
                    <rect x="60" y={bomY + 38 + ri * 22} width="980" height="22"
                      fill={ri % 2 === 0 ? "#0f1f3d" : "#0c1a2e"} opacity="0.5" />
                    {row.map((cell, ci) => (
                      <text key={ci} x={cols2[ci]} y={bomY + 52 + ri * 22} fontSize="9"
                        fill={ci === 1 ? "#e2e8f0" : ci === 3 ? "#f59e0b" : ci === 2 ? "#7dd3fc" : "#94a3b8"}>
                        {cell}
                      </text>
                    ))}
                  </g>
                ))}
                {/* Notes */}
                <text x="75" y={bomY + 175} fontSize="9" fill="#475569">
                  NOTES: 1) All dims mm | 2) Roll clearance = 1.05 × t = {(params.thickness * 1.05).toFixed(2)}mm | 3) Springback compensation +{params.springback}° at final station | 4) K-factor = 0.44 (GI/CR, DIN 6935) | 5) Min bend R = {params.thickness}mm
                </text>

                {/* Profile cross-section inset */}
                {(() => {
                  const ps = 3.5;
                  const fl = params.flangeA * ps;
                  const ts = params.thickness * ps;
                  const px2 = 920;
                  const py2 = bomY + 40;
                  return (
                    <g>
                      <text x={px2} y={py2 - 4} fontSize="9" fill="#64748b" fontWeight="bold">FINAL PROFILE:</text>
                      <polyline
                        points={`${px2},${py2 + fl} ${px2},${py2} ${px2 + fl},${py2}`}
                        fill="none" stroke="#f59e0b"
                        strokeWidth={ts.toFixed(1)}
                        strokeLinecap="round" strokeLinejoin="round"
                      />
                      <text x={px2 + fl / 2} y={py2 + fl + 16} fontSize="8" fill="#64748b" textAnchor="middle">
                        {params.flangeA}×{params.flangeB}×{params.thickness}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })()}

          {/* Footer */}
          <rect x="5" y={148 + Math.ceil(stations.length / 3) * 260 + 210} width="1090" height="14" fill="#0f1228" />
          <text
            x="550"
            y={148 + Math.ceil(stations.length / 3) * 260 + 221}
            fontSize="8" fill="#334155" textAnchor="middle"
          >
            © SAI Rolotech Smart Engines v2.2.x — Roll Tooling Drawing — CONFIDENTIAL — Generated by AI Engineering Suite
          </text>
        </svg>
      </div>
    </div>
  );
}
