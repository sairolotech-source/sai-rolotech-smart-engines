import React, { useRef, useEffect, useState, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Monitor, FileCode2, Wrench, CheckCircle2, Clock, XCircle, Loader2,
  X, Code2, BarChart3, FolderOpen, Download, File, Box,
} from "lucide-react";

type NodeStatus = "pending" | "in-progress" | "validated" | "approved" | "error";

interface PipelineNode {
  id: string;
  label: string;
  subLabel: string;
  status: NodeStatus;
  stationNumber?: number;
  gcodePreview?: string;
  validationScore?: number;
  cadNote?: string;
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  pending: "#3f3f46",
  "in-progress": "#f59e0b",
  validated: "#06b6d4",
  approved: "#22c55e",
  error: "#ef4444",
};

const STATUS_LABELS: Record<NodeStatus, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  validated: "Validated",
  approved: "Approved",
  error: "Error",
};

function generateRollDxf(tooling: { rollProfile: { rollDiameter: number; shaftDiameter: number; rollWidth: number; gap: number; grooveDepth: number; kFactor: number } }, stationNumber: number): string {
  const rp = tooling.rollProfile;
  // Numeric guards — ensure all values are positive and sensible
  const rollDiameter = Math.max(rp.rollDiameter, 10);
  const shaftDiameter = Math.min(Math.max(rp.shaftDiameter, 5), rollDiameter * 0.8);
  const rollWidth = Math.max(rp.rollWidth, 1);
  const gap = Math.max(rp.gap, 0);
  const grooveDepth = Math.min(Math.max(rp.grooveDepth, 0), rollDiameter * 0.4); // clamp to 40% of radius

  const outerR = rollDiameter / 2;
  const shaftR = shaftDiameter / 2;
  const cx = 0, cy = 0;
  const grooveR = Math.max(outerR - grooveDepth, 0.1); // must be positive

  // Build proper AutoCAD DXF R12 format (AC1009) with real geometry
  const lines: string[] = [];
  const ent = (type: string, pairs: [number, string | number][]) => {
    lines.push("  0", type);
    pairs.forEach(([code, val]) => {
      lines.push(`  ${code}`, typeof val === "number" ? val.toFixed(6) : val);
    });
  };

  lines.push("  0", "SECTION", "  2", "HEADER");
  lines.push("  9", "$ACADVER", "  1", "AC1009");
  lines.push("  9", "$EXTMIN", " 10", String((cx - outerR - 10).toFixed(3)), " 20", String((cy - outerR - 10).toFixed(3)), " 30", "0.0");
  lines.push("  9", "$EXTMAX", " 10", String((cx + outerR + 10).toFixed(3)), " 20", String((cy + outerR + 10).toFixed(3)), " 30", "0.0");
  lines.push("  0", "ENDSEC");

  lines.push("  0", "SECTION", "  2", "ENTITIES");

  // Outer roll circle
  ent("CIRCLE", [[8, "ROLL_OUTER"], [10, cx], [20, cy], [30, 0], [40, outerR]]);
  // Shaft bore circle
  ent("CIRCLE", [[8, "SHAFT_BORE"], [10, cx], [20, cy], [30, 0], [40, shaftR]]);
  // Groove arc — only draw if groove has meaningful depth
  if (grooveDepth > 0.01) {
    ent("ARC", [[8, "GROOVE"], [10, cx], [20, cy], [30, 0], [40, grooveR], [50, 60], [51, 120]]);
  }

  // Roll width cross-section profile lines
  const halfW = rollWidth / 2;
  ent("LINE", [[8, "PROFILE"], [10, -halfW], [20, shaftR], [30, 0], [11, -halfW], [21, outerR], [31, 0]]);
  ent("LINE", [[8, "PROFILE"], [10, halfW], [20, shaftR], [30, 0], [11, halfW], [21, outerR], [31, 0]]);
  ent("LINE", [[8, "PROFILE"], [10, -halfW], [20, shaftR], [30, 0], [11, halfW], [21, shaftR], [31, 0]]);
  ent("LINE", [[8, "PROFILE"], [10, -halfW], [20, outerR], [30, 0], [11, halfW], [21, outerR], [31, 0]]);

  // Center lines (continuous linetype — no linetype table reference needed for R12)
  ent("LINE", [[8, "CENTERLINE"], [10, cx - outerR - 8], [20, cy], [30, 0], [11, cx + outerR + 8], [21, cy], [31, 0]]);
  ent("LINE", [[8, "CENTERLINE"], [10, cx], [20, cy - outerR - 8], [30, 0], [11, cx], [21, cy + outerR + 8], [31, 0]]);

  // Text annotations — ASCII-only for R12 compatibility (use D- prefix instead of unicode diameter symbol)
  ent("TEXT", [[8, "DIMENSIONS"], [10, cx + outerR + 2], [20, cy + 2], [30, 0], [40, 2.5], [1, `ST${stationNumber} D${rollDiameter}mm OD`]]);
  ent("TEXT", [[8, "DIMENSIONS"], [10, cx + 2], [20, cy + shaftR + 2], [30, 0], [40, 2.0], [1, `BORE D${shaftDiameter}mm`]]);
  ent("TEXT", [[8, "DIMENSIONS"], [10, cx - halfW - 2], [20, cy + outerR + 3], [30, 0], [40, 2.0], [1, `W=${rollWidth.toFixed(1)}mm`]]);
  ent("TEXT", [[8, "DIMENSIONS"], [10, cx + 1], [20, cy - outerR + 2], [30, 0], [40, 1.8], [1, `GAP=${gap.toFixed(3)}mm K=${rp.kFactor.toFixed(4)}`]]);

  lines.push("  0", "ENDSEC");
  lines.push("  0", "EOF");
  return lines.join("\n");
}

function NodeStatusIcon({ status }: { status: NodeStatus }) {
  if (status === "approved") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === "validated") return <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />;
  if (status === "in-progress") return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
  if (status === "error") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  return <Clock className="w-3.5 h-3.5 text-zinc-600" />;
}

function buildPipelineNodes(store: ReturnType<typeof useCncStore.getState>): PipelineNode[] {
  const { stations, rollTooling, gcodeOutputs, geometry, validationResults, validationApproved, sectionModel } = store;
  const nodes: PipelineNode[] = [];

  // Section model selection node
  nodes.push({
    id: "section-model",
    label: "Section Model",
    subLabel: sectionModel ? (sectionModel === "open" ? "Open Section AI" : "Closed Section AI") : "Not set",
    status: sectionModel ? "approved" : "pending",
    cadNote: sectionModel ? `AI Model ${sectionModel === "open" ? "A (Open)" : "B (Closed)"} selected` : "Select a section model to start",
  });

  // Design node
  nodes.push({
    id: "design",
    label: "Profile Design",
    subLabel: geometry ? `${geometry.segments.length} segments` : "No profile",
    status: geometry ? "approved" : "pending",
    cadNote: geometry ? `Bounding box: ${(geometry.boundingBox.maxX - geometry.boundingBox.minX).toFixed(1)}×${(geometry.boundingBox.maxY - geometry.boundingBox.minY).toFixed(1)}mm` : undefined,
  });

  // Validation pipeline node — driven by real validation store state
  const valOverall = validationResults.length > 0
    ? Math.round(validationResults.reduce((s, r) => s + r.score, 0) / validationResults.length)
    : undefined;
  nodes.push({
    id: "validation",
    label: "Validation Pipeline",
    subLabel: validationApproved ? "All 5 layers passed" : validationResults.length > 0 ? `${validationResults.filter(r => r.status === "pass").length}/5 layers passed` : "Not run",
    status: validationApproved ? "approved" : validationResults.length > 0 ? (validationResults.some(r => r.status === "fail") ? "error" : "in-progress") : "pending",
    validationScore: valOverall,
    cadNote: validationResults.length > 0
      ? validationResults.map(r => `L${r.layerId}: ${r.score}%`).join(" | ")
      : "Run Validation Pipeline to see scores",
  });

  // Flower stations
  stations.forEach((st) => {
    const hasTooling = rollTooling.some(rt => rt.stationNumber === st.stationNumber);
    const hasGcode = gcodeOutputs.some(go => go.stationNumber === st.stationNumber);
    const status: NodeStatus = hasGcode ? "approved" : hasTooling ? "validated" : "in-progress";
    // Use real validation scores from the L3/L4 layers if available
    const toolingScore = validationResults.find(r => r.layerId === 3)?.score;
    const gcodeScore = validationResults.find(r => r.layerId === 4)?.score;
    const effectiveScore = hasGcode && gcodeScore !== undefined ? gcodeScore : hasTooling && toolingScore !== undefined ? toolingScore : undefined;
    nodes.push({
      id: `station-${st.stationNumber}`,
      label: `Station ${st.label}`,
      subLabel: `${(Math.abs(st.totalAngle) * 180 / Math.PI).toFixed(1)}° | ${st.bendAngles.length} bends`,
      status,
      stationNumber: st.stationNumber,
      validationScore: effectiveScore,
      gcodePreview: hasGcode ? gcodeOutputs.find(g => g.stationNumber === st.stationNumber)?.gcode?.slice(0, 200) : undefined,
      cadNote: `Bends: ${st.bendAngles.length} | Zone: ${st.passZone || "—"} | Angle: ${(Math.abs(st.totalAngle) * 180 / Math.PI).toFixed(1)}°`,
    });
  });

  // Final approval — only approved if validation pipeline fully passed
  nodes.push({
    id: "final",
    label: "Final Approval",
    subLabel: validationApproved ? "Validation approved — ready" : stations.length > 0 && gcodeOutputs.length >= stations.length ? "Awaiting validation" : "Pending",
    status: validationApproved ? "approved" : "pending",
  });

  return nodes;
}

function AnimatedCanvas({ nodes, selectedId }: { nodes: PipelineNode[]; selectedId: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 200 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = dims.w;
  const H = dims.h;

  if (nodes.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full">
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "#04040e" }}>
          <text x={W / 2} y={H / 2} fill="rgba(255,255,255,0.15)" fontSize="12" fontFamily="system-ui" textAnchor="middle">
            No pipeline data — generate flower pattern and tooling
          </text>
        </svg>
      </div>
    );
  }

  const padding = 40;
  const nodeRadius = 20;
  const totalWidth = W - padding * 2;
  const step = totalWidth / Math.max(1, nodes.length - 1);
  const cy = H / 2;

  return (
    <div ref={containerRef} className="w-full h-full cursor-crosshair">
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "#04040e" }}>
        <defs>
          {nodes.map((_, i) => {
            if (i >= nodes.length - 1) return null;
            const col1 = STATUS_COLORS[nodes[i].status];
            const col2 = STATUS_COLORS[nodes[i + 1].status];
            return (
              <linearGradient key={`lg${i}`} id={`conn${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={col1} stopOpacity={0.53} />
                <stop offset="100%" stopColor={col2} stopOpacity={0.53} />
              </linearGradient>
            );
          })}
          {nodes.map((node, i) => {
            if (node.status === "pending") return null;
            const color = STATUS_COLORS[node.status];
            return (
              <filter key={`glow${i}`} id={`glow${i}`}>
                <feDropShadow dx="0" dy="0" stdDeviation={node.id === selectedId ? "6" : "3"} floodColor={color} floodOpacity="0.7" />
              </filter>
            );
          })}
        </defs>

        {nodes.map((_, i) => {
          if (i >= nodes.length - 1) return null;
          const x1 = padding + i * step;
          const x2 = padding + (i + 1) * step;
          const isActive = nodes[i].status !== "pending" && nodes[i + 1].status !== "pending";
          return (
            <g key={`c${i}`}>
              <line x1={x1 + nodeRadius} y1={cy} x2={x2 - nodeRadius} y2={cy}
                stroke={`url(#conn${i})`} strokeWidth={isActive ? 2.5 : 1}
                strokeDasharray={isActive ? undefined : "6,4"} />
              {isActive && (
                <circle r={3} fill={STATUS_COLORS[nodes[i].status]}>
                  <animateMotion dur="2s" repeatCount="indefinite"
                    path={`M${x1 + nodeRadius},${cy} L${x2 - nodeRadius},${cy}`} />
                </circle>
              )}
            </g>
          );
        })}

        {nodes.map((node, i) => {
          const x = padding + i * step;
          const color = STATUS_COLORS[node.status];
          const isSelected = node.id === selectedId;
          const r = nodeRadius;

          return (
            <g key={node.id} filter={node.status !== "pending" ? `url(#glow${i})` : undefined}>
              <circle cx={x} cy={cy} r={r} fill={`${color}25`} stroke={color}
                strokeWidth={isSelected ? 3 : 2}>
                {isSelected && (
                  <animate attributeName="r" values={`${r};${r * 1.1};${r}`} dur="0.6s" repeatCount="indefinite" />
                )}
              </circle>
              {node.status !== "pending" && (
                <circle cx={x} cy={cy} r={6} fill={color} />
              )}
              <text x={x} y={cy + r + 14} fill="rgba(255,255,255,0.8)" fontSize="10" fontWeight="bold"
                fontFamily="system-ui" textAnchor="middle">{node.label}</text>
              <text x={x} y={cy + r + 25} fill={`${color}cc`} fontSize="9"
                fontFamily="system-ui" textAnchor="middle">{STATUS_LABELS[node.status]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FileLibraryPanel() {
  const { stations, rollTooling, gcodeOutputs } = useCncStore();

  if (stations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-zinc-600">
        <FolderOpen className="w-6 h-6" />
        <span className="text-[11px]">No assets yet — generate flower pattern &amp; tooling</span>
      </div>
    );
  }

  function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <FolderOpen className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-bold text-zinc-200">Per-Roll File Library</span>
        <span className="text-[10px] text-zinc-600 ml-auto">{stations.length} stations</span>
      </div>
      {/* Info row about full CAM ZIP */}
      {rollTooling.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2.5">
          <Box className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span className="text-[10px] text-indigo-300">Full CAM ZIP (Copra/SolidWorks/SolidCAM) is available from the Roll Export tab</span>
        </div>
      )}
      {/* Per-station roll tooling and G-code files */}
      <div className="space-y-2">
        {stations.map(st => {
          const tooling = rollTooling.find(rt => rt.stationNumber === st.stationNumber);
          const gcode = gcodeOutputs.find(g => g.stationNumber === st.stationNumber);
          return (
            <div key={st.stationNumber}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold"
                  style={{ background: tooling && gcode ? "#22c55e18" : "#f59e0b18", color: tooling && gcode ? "#22c55e" : "#f59e0b", border: `1px solid ${tooling && gcode ? "#22c55e35" : "#f59e0b35"}` }}>
                  {st.stationNumber}
                </div>
                <span className="text-[11px] font-semibold text-zinc-300">{st.label || `Station ${st.stationNumber}`}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">
                  {(Math.abs(st.totalAngle) * 180 / Math.PI).toFixed(1)}° | {st.bendAngles.length} bends
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Roll tooling DXF — proper AutoCAD DXF R12 geometry */}
                {tooling ? (
                  <button
                    onClick={() => downloadText(
                      generateRollDxf(tooling, st.stationNumber),
                      `station_${st.stationNumber}_roll_tooling.dxf`
                    )}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/15 transition-colors"
                  >
                    <File className="w-3 h-3" />Roll DXF
                  </button>
                ) : (
                  <span className="text-[10px] text-zinc-700 flex items-center gap-1"><File className="w-3 h-3" />No tooling</span>
                )}
                {/* G-code file */}
                {gcode ? (
                  <button
                    onClick={() => downloadText(gcode.gcode, `station_${st.stationNumber}.nc`)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15 transition-colors"
                  >
                    <FileCode2 className="w-3 h-3" />G-Code (.nc)
                  </button>
                ) : (
                  <span className="text-[10px] text-zinc-700 flex items-center gap-1"><FileCode2 className="w-3 h-3" />No G-code</span>
                )}
                {/* Flower profile annotation */}
                <button
                  onClick={() => downloadText(
                    `; Flower Pattern — Station ${st.stationNumber}\n; Bend angles: ${st.bendAngles.map(a => (a * 180 / Math.PI).toFixed(2) + "°").join(", ")}\n; Total angle: ${(Math.abs(st.totalAngle) * 180 / Math.PI).toFixed(2)}°\n; Pass zone: ${st.passZone || "N/A"}\n`,
                    `station_${st.stationNumber}_flower.txt`
                  )}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/15 transition-colors"
                >
                  <Box className="w-3 h-3" />Flower
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminDashboard3D() {
  const store = useCncStore();
  const nodes = buildPipelineNodes(store);
  const [selectedNode, setSelectedNode] = useState<PipelineNode | null>(null);
  const [view, setView] = useState<"pipeline" | "files">("pipeline");

  const approved = nodes.filter(n => n.status === "approved").length;
  const total = nodes.length;

  return (
    <div className="flex flex-col h-full bg-[#070710] overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.07] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
          <Monitor className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">Admin — Live Pipeline Dashboard</div>
          <div className="text-[10px] text-zinc-500">3D animated workflow status — click any station node to inspect</div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          {approved}/{total} approved
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-white/[0.07] flex">
        <button
          onClick={() => setView("pipeline")}
          className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors border-b-2 ${view === "pipeline" ? "text-white border-violet-500" : "text-zinc-600 border-transparent hover:text-zinc-400"}`}
        >
          <Monitor className="w-3.5 h-3.5" />Pipeline
        </button>
        <button
          onClick={() => setView("files")}
          className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors border-b-2 ${view === "files" ? "text-white border-indigo-500" : "text-zinc-600 border-transparent hover:text-zinc-400"}`}
        >
          <FolderOpen className="w-3.5 h-3.5" />File Library
        </button>
      </div>

      {/* File Library view */}
      {view === "files" && (
        <div className="flex-1 overflow-y-auto">
          <FileLibraryPanel />
        </div>
      )}

      {/* Pipeline view */}
      <div className={`flex-1 flex flex-col overflow-hidden ${view !== "pipeline" ? "hidden" : ""}`}>
        {/* 3D Canvas Pipeline */}
        <div className="h-48 flex-shrink-0 relative" style={{ minHeight: "160px" }}>
          <AnimatedCanvas nodes={nodes} selectedId={selectedNode?.id ?? null} />
          {/* Click-to-select overlay */}
          <div className="absolute inset-0 flex items-center pointer-events-none">
            {nodes.map((node, i) => {
              const padding = 40;
              const leftPct = nodes.length === 1 ? 50 : padding / nodes.length + i * (100 - 2 * padding / nodes.length) / (nodes.length - 1);
              return (
                <div
                  key={node.id}
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{ left: `${leftPct}%`, top: "50%", transform: "translate(-50%,-50%)", width: 44, height: 44 }}
                  onClick={() => setSelectedNode(prev => prev?.id === node.id ? null : node)}
                />
              );
            })}
          </div>
        </div>

        {/* Status legend */}
        <div className="flex-shrink-0 px-4 py-2 border-y border-white/[0.06] flex items-center gap-4">
          {(Object.entries(STATUS_LABELS) as [NodeStatus, string][]).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
              <span className="text-[10px] text-zinc-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Node list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {nodes.map(node => (
            <button
              key={node.id}
              onClick={() => setSelectedNode(prev => prev?.id === node.id ? null : node)}
              className="w-full text-left rounded-xl border p-3.5 transition-all hover:scale-[1.01]"
              style={{
                background: selectedNode?.id === node.id ? `${STATUS_COLORS[node.status]}12` : "rgba(255,255,255,0.02)",
                border: `1px solid ${selectedNode?.id === node.id ? STATUS_COLORS[node.status] + "50" : "rgba(255,255,255,0.07)"}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${STATUS_COLORS[node.status]}18`, border: `1px solid ${STATUS_COLORS[node.status]}35` }}>
                  <NodeStatusIcon status={node.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-200">{node.label}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: `${STATUS_COLORS[node.status]}18`, color: STATUS_COLORS[node.status], border: `1px solid ${STATUS_COLORS[node.status]}30` }}>
                      {STATUS_LABELS[node.status]}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">{node.subLabel}</div>
                </div>
                {node.validationScore !== undefined && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <BarChart3 className="w-3 h-3 text-zinc-600" />
                    <span className="text-xs font-bold" style={{ color: node.validationScore === 100 ? "#22c55e" : "#f59e0b" }}>
                      {node.validationScore}%
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Side panel for selected node */}
      {selectedNode && (
        <div className="flex-shrink-0 border-t border-white/[0.08] p-4 bg-white/[0.02] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <NodeStatusIcon status={selectedNode.status} />
              <span className="text-xs font-bold text-white">{selectedNode.label} — Inspection</span>
            </div>
            <button onClick={() => setSelectedNode(null)} className="p-1 rounded hover:bg-white/[0.08] transition-colors">
              <X className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>
          {selectedNode.cadNote && (
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <Wrench className="w-3 h-3 text-zinc-600" />
              <span>{selectedNode.cadNote}</span>
            </div>
          )}
          {selectedNode.gcodePreview && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Code2 className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">G-Code Preview</span>
              </div>
              <pre className="text-[9px] text-zinc-500 font-mono bg-black/30 rounded-lg p-2.5 overflow-x-auto max-h-24 leading-relaxed">
                {selectedNode.gcodePreview}
              </pre>
            </div>
          )}
          {selectedNode.validationScore !== undefined && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${selectedNode.validationScore}%`,
                    background: selectedNode.validationScore === 100 ? "#22c55e" : "#f59e0b",
                  }}
                />
              </div>
              <span className="text-xs font-bold" style={{ color: selectedNode.validationScore === 100 ? "#22c55e" : "#f59e0b" }}>
                {selectedNode.validationScore}%
              </span>
              <span className="text-[10px] text-zinc-600">validation score</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
