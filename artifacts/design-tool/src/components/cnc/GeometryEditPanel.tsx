import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  Plus, Trash2, Check, X, ChevronDown, ChevronRight,
  Move, RotateCw, Layers, Settings, AlertCircle, Eye,
} from "lucide-react";

export interface ProfilePoint {
  id: string;
  z: number;
  x: number;
  type: "line" | "arc" | "spline";
  cornerRadius?: number;
  tangent?: boolean;
}

interface ChainOptions {
  showChainOnWorkPlane: boolean;
  curve: boolean;
  upToEntity: boolean;
  tangentPropagation: boolean;
  constantZ: boolean;
  deltaZTolerance: number;
  curveCloseCorners: boolean;
  pointToPoint: boolean;
  pointByPoints: boolean;
  splineApprox: number;
}

const defaultChain: ChainOptions = {
  showChainOnWorkPlane: true,
  curve: true,
  upToEntity: true,
  tangentPropagation: true,
  constantZ: false,
  deltaZTolerance: 0,
  curveCloseCorners: false,
  pointToPoint: false,
  pointByPoints: false,
  splineApprox: 0.005,
};

const DEFAULT_POINTS: ProfilePoint[] = [
  { id: "p1", z: 0,    x: 25,  type: "line" },
  { id: "p2", z: -15,  x: 25,  type: "arc",  cornerRadius: 5, tangent: true },
  { id: "p3", z: -35,  x: 60,  type: "spline", tangent: true },
  { id: "p4", z: -60,  x: 75,  type: "arc",  cornerRadius: 8, tangent: true },
  { id: "p5", z: -90,  x: 70,  type: "line" },
  { id: "p6", z: -110, x: 45,  type: "arc",  cornerRadius: 4, tangent: true },
  { id: "p7", z: -130, x: 38,  type: "line" },
  { id: "p8", z: -150, x: 38,  type: "line" },
];

function buildLathePoints(points: ProfilePoint[]): THREE.Vector2[] {
  if (points.length < 2) return [];
  const result: THREE.Vector2[] = [];
  const sorted = [...points].sort((a, b) => b.z - a.z);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (i === 0) {
      result.push(new THREE.Vector2(p.x, p.z));
      continue;
    }
    const prev = sorted[i - 1];
    if (p.type === "arc" && p.cornerRadius && p.cornerRadius > 0) {
      const cr = p.cornerRadius;
      const dz = p.z - prev.z;
      const dx = p.x - prev.x;
      const arcSteps = 8;
      for (let s = 0; s <= arcSteps; s++) {
        const t = s / arcSteps;
        const ez = Math.sin(t * Math.PI * 0.5);
        const ix = prev.x + dx * ez;
        const iz = prev.z + dz * t;
        result.push(new THREE.Vector2(ix, iz));
      }
    } else if (p.type === "spline") {
      const splineSteps = 12;
      for (let s = 1; s <= splineSteps; s++) {
        const t = s / splineSteps;
        const t2 = t * t;
        const t3 = t2 * t;
        const iz = prev.z * (2 * t3 - 3 * t2 + 1) + p.z * (-2 * t3 + 3 * t2);
        const ix = prev.x * (2 * t3 - 3 * t2 + 1) + p.x * (-2 * t3 + 3 * t2);
        result.push(new THREE.Vector2(ix, iz));
      }
    } else {
      result.push(new THREE.Vector2(p.x, p.z));
    }
  }

  return result;
}

function SolidModel({
  points,
  selectedId,
  onSelectPoint,
}: {
  points: ProfilePoint[];
  selectedId: string | null;
  onSelectPoint: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
    }
  });

  const geometry = useMemo(() => {
    const pts = buildLathePoints(points);
    if (pts.length < 2) return new THREE.LatheGeometry([new THREE.Vector2(10, 0), new THREE.Vector2(10, -50)], 64);
    const geo = new THREE.LatheGeometry(pts, 80);
    geo.computeVertexNormals();
    return geo;
  }, [points]);

  const profileLine = useMemo(() => {
    const sorted = [...points].sort((a, b) => b.z - a.z);
    return sorted.map(p => [p.x, 0, p.z] as [number, number, number]);
  }, [points]);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#6a7a8a"
          metalness={0.82}
          roughness={0.22}
          envMapIntensity={1.0}
        />
      </mesh>

      <group>
        {points.map((p, i) => (
          <mesh
            key={p.id}
            position={[p.x, 0, p.z]}
            onClick={(e) => { e.stopPropagation(); onSelectPoint(p.id); }}
          >
            <sphereGeometry args={[selectedId === p.id ? 3.5 : 2.2, 12, 12]} />
            <meshStandardMaterial
              color={selectedId === p.id ? "#facc15" : "#3b82f6"}
              emissive={selectedId === p.id ? "#7c5c00" : "#1e3a7c"}
              emissiveIntensity={0.5}
            />
          </mesh>
        ))}
      </group>

      {profileLine.length >= 2 && (
        <Line points={profileLine} color="#facc15" lineWidth={2.5} />
      )}

      <mesh position={[0, 0, -75]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[12, 12, 160, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Scene({
  points,
  selectedId,
  onSelectPoint,
}: {
  points: ProfilePoint[];
  selectedId: string | null;
  onSelectPoint: (id: string) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[200, 300, 150]} intensity={1.5} castShadow />
      <pointLight position={[-150, 100, -80]} intensity={0.5} color="#8090ff" />
      <pointLight position={[150, -80, 100]} intensity={0.4} color="#ff8040" />

      <SolidModel points={points} selectedId={selectedId} onSelectPoint={onSelectPoint} />

      <Line points={[[0,0,0],[60,0,0]]} color="#ef4444" lineWidth={2} />
      <Line points={[[0,0,0],[0,60,0]]} color="#22c55e" lineWidth={2} />
      <Line points={[[0,0,0],[0,0,-60]]} color="#3b82f6" lineWidth={2} />
      <Html position={[64, 0, 0]}><span className="text-red-400 text-[9px] font-bold">X</span></Html>
      <Html position={[0, 64, 0]}><span className="text-green-400 text-[9px] font-bold">Y</span></Html>
      <Html position={[0, 0, -66]}><span className="text-blue-400 text-[9px] font-bold">Z</span></Html>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -90, -75]} receiveShadow>
        <planeGeometry args={[600, 400]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.95} />
      </mesh>
      <gridHelper args={[500, 25, "#111122", "#0d0d1e"]} position={[0, -90, -75]} />

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[30, 0, -75]} />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>
    </>
  );
}

const inputCls = "w-full bg-[#1a1a2e] border border-white/10 rounded px-2 py-1 text-[11px] text-zinc-200 focus:border-yellow-500/50 focus:outline-none";
const labelCls = "text-[10px] text-zinc-500 block mb-0.5";

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer py-0.5 hover:text-zinc-300">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-yellow-500 w-3 h-3" />
      {label}
    </label>
  );
}

export function GeometryEditPanel() {
  const [points, setPoints] = useState<ProfilePoint[]>(DEFAULT_POINTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chain, setChain] = useState<ChainOptions>(defaultChain);
  const [chainOpen, setChainOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [name, setName] = useState("contour1");
  const [activeConfig, setActiveConfig] = useState("config1");

  const selectedPoint = points.find(p => p.id === selectedId);

  const addPoint = useCallback(() => {
    const last = points[points.length - 1];
    const newZ = last ? last.z - 20 : -20;
    const newX = last ? last.x + 5 : 40;
    const id = `p${Date.now()}`;
    setPoints(prev => [...prev, { id, z: newZ, x: newX, type: "line" }]);
    setSelectedId(id);
  }, [points]);

  const removePoint = useCallback((id: string) => {
    setPoints(prev => prev.filter(p => p.id !== id));
    setSelectedId(null);
  }, []);

  const updatePoint = useCallback((id: string, updates: Partial<ProfilePoint>) => {
    setPoints(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const sorted = useMemo(() => [...points].sort((a, b) => b.z - a.z), [points]);

  const totalLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < sorted.length; i++) {
      const dz = sorted[i].z - sorted[i - 1].z;
      const dx = sorted[i].x - sorted[i - 1].x;
      len += Math.sqrt(dz * dz + dx * dx);
    }
    return len;
  }, [sorted]);

  const maxDia = useMemo(() => Math.max(...points.map(p => p.x)) * 2, [points]);

  return (
    <div className="flex h-full bg-[#09090f] text-zinc-300">
      <div className="w-[220px] flex-shrink-0 border-r border-white/[0.07] flex flex-col bg-[#0d0d1a] overflow-y-auto">
        <div className="px-3 pt-3 pb-2 border-b border-white/[0.07]">
          <div className="text-xs font-bold text-zinc-200 mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-yellow-500" />
            Geometry Edit
          </div>

          <div className="mb-2">
            <label className={labelCls}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>

          <div className="mb-2">
            <label className={labelCls}>Configurations</label>
            <select
              value={activeConfig}
              onChange={e => setActiveConfig(e.target.value)}
              className={inputCls}
            >
              <option value="config1">config1</option>
              <option value="config2">config2</option>
              <option value="config3">config3</option>
            </select>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-white/[0.07]">
          <div className="text-[10px] font-bold text-zinc-400 mb-1.5">Chain List</div>
          <div className="space-y-1 mb-2 max-h-36 overflow-y-auto">
            {sorted.map((p, i) => (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-[10px] transition-colors
                  ${selectedId === p.id
                    ? "bg-yellow-500/20 border border-yellow-500/40 text-yellow-300"
                    : "bg-white/[0.03] border border-white/[0.05] text-zinc-400 hover:bg-white/[0.06]"}`}
              >
                <span className="font-mono">P{i + 1} Z{p.z.toFixed(0)} X{p.x.toFixed(0)}</span>
                <span className={`text-[9px] px-1 rounded ${p.type === "arc" ? "text-blue-400" : p.type === "spline" ? "text-purple-400" : "text-zinc-500"}`}>
                  {p.type}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <button onClick={addPoint}
              className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px]
                         bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:bg-blue-600/30 transition-colors">
              <Plus className="w-3 h-3" /> Add
            </button>
            {selectedId && (
              <button onClick={() => removePoint(selectedId)}
                className="px-2 py-1 rounded text-[10px] bg-red-900/20 border border-red-700/30
                           text-red-400 hover:bg-red-900/30 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {selectedPoint && (
          <div className="px-3 py-2 border-b border-white/[0.07] bg-yellow-500/5">
            <div className="text-[10px] font-bold text-yellow-400 mb-1.5">Selected Point</div>
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              <div>
                <label className={labelCls}>Z (mm)</label>
                <input type="number" value={selectedPoint.z}
                  onChange={e => updatePoint(selectedPoint.id, { z: parseFloat(e.target.value) || 0 })}
                  step={0.5} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>X radius (mm)</label>
                <input type="number" value={selectedPoint.x}
                  onChange={e => updatePoint(selectedPoint.id, { x: parseFloat(e.target.value) || 0 })}
                  step={0.5} min={0} className={inputCls} />
              </div>
            </div>
            <div className="mb-1.5">
              <label className={labelCls}>Segment Type</label>
              <select value={selectedPoint.type}
                onChange={e => updatePoint(selectedPoint.id, { type: e.target.value as ProfilePoint["type"] })}
                className={inputCls}>
                <option value="line">Line</option>
                <option value="arc">Arc</option>
                <option value="spline">Spline</option>
              </select>
            </div>
            {selectedPoint.type === "arc" && (
              <div>
                <label className={labelCls}>Corner Radius (mm)</label>
                <input type="number" value={selectedPoint.cornerRadius ?? 2}
                  onChange={e => updatePoint(selectedPoint.id, { cornerRadius: parseFloat(e.target.value) || 0 })}
                  step={0.5} min={0} className={inputCls} />
              </div>
            )}
            <div className="mt-1">
              <CheckRow label="Tangent" checked={selectedPoint.tangent ?? false}
                onChange={v => updatePoint(selectedPoint.id, { tangent: v })} />
            </div>
          </div>
        )}

        <div className="px-3 py-2 border-b border-white/[0.07]">
          <button
            onClick={() => setChainOpen(v => !v)}
            className="flex items-center justify-between w-full text-[10px] font-bold text-zinc-400 mb-1"
          >
            <span>Chain</span>
            {chainOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {chainOpen && (
            <div className="space-y-0.5">
              <CheckRow label="Show Chain on Work Plane" checked={chain.showChainOnWorkPlane} onChange={v => setChain(c => ({ ...c, showChainOnWorkPlane: v }))} />
              <div className="pl-1 border-l border-white/5 ml-1">
                <CheckRow label="Curve" checked={chain.curve} onChange={v => setChain(c => ({ ...c, curve: v }))} />
                <CheckRow label="Up to entity" checked={chain.upToEntity} onChange={v => setChain(c => ({ ...c, upToEntity: v }))} />
                <CheckRow label="Tangent propagation" checked={chain.tangentPropagation} onChange={v => setChain(c => ({ ...c, tangentPropagation: v }))} />
                <CheckRow label="Constant Z" checked={chain.constantZ} onChange={v => setChain(c => ({ ...c, constantZ: v }))} />
                {chain.constantZ && (
                  <div className="ml-2 mt-1">
                    <label className={labelCls}>Delta Z tolerance</label>
                    <input type="number" value={chain.deltaZTolerance}
                      onChange={e => setChain(c => ({ ...c, deltaZTolerance: parseFloat(e.target.value) || 0 }))}
                      step={0.001} className={inputCls} />
                  </div>
                )}
              </div>
              <CheckRow label="Curve + close corners" checked={chain.curveCloseCorners} onChange={v => setChain(c => ({ ...c, curveCloseCorners: v }))} />
              <CheckRow label="Point to point" checked={chain.pointToPoint} onChange={v => setChain(c => ({ ...c, pointToPoint: v }))} />
              <CheckRow label="Point by points" checked={chain.pointByPoints} onChange={v => setChain(c => ({ ...c, pointByPoints: v }))} />
            </div>
          )}
        </div>

        <div className="px-3 py-2">
          <button
            onClick={() => setOptionsOpen(v => !v)}
            className="flex items-center justify-between w-full text-[10px] font-bold text-zinc-400 mb-1"
          >
            <span>Options</span>
            {optionsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {optionsOpen && (
            <div>
              <label className={labelCls}>Spline approx</label>
              <input type="number" value={chain.splineApprox}
                onChange={e => setChain(c => ({ ...c, splineApprox: parseFloat(e.target.value) || 0.005 }))}
                step={0.001} min={0.001} className={inputCls} />
            </div>
          )}
        </div>

        <div className="mt-auto px-3 py-2 border-t border-white/[0.07] space-y-1">
          <div className="text-[9px] text-zinc-600 space-y-0.5">
            <div>Profile length: <span className="text-zinc-400">{totalLength.toFixed(1)} mm</span></div>
            <div>Max diameter: <span className="text-zinc-400">Ø{maxDia.toFixed(1)} mm</span></div>
            <div>Points: <span className="text-zinc-400">{points.length}</span></div>
          </div>
          <div className="flex gap-1 mt-1">
            <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px]
                               bg-green-600/20 border border-green-600/30 text-green-400 hover:bg-green-600/30 transition-colors">
              <Check className="w-3 h-3" /> Apply
            </button>
            <button onClick={() => { setPoints(DEFAULT_POINTS); setSelectedId(null); }}
              className="px-2 py-1.5 rounded text-[10px] bg-zinc-800 border border-white/10 text-zinc-400 hover:bg-zinc-700 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#0b0b18]">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-zinc-300">3D Solid — Geometry Edit Mode</span>
            <span className="text-[10px] text-zinc-600">Click points on profile to select · Drag to orbit</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
              {points.length} chain points
            </span>
            <span className="text-zinc-500">Ø{maxDia.toFixed(0)} × {Math.abs(Math.min(...points.map(p => p.z))).toFixed(0)} mm</span>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <Canvas
            shadows
            camera={{ position: [180, 80, 60], fov: 40, near: 0.1, far: 10000 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
            style={{ background: "linear-gradient(135deg, #c8d4e0 0%, #dde6ef 50%, #c0cdd8 100%)" }}
          >
            <Scene points={points} selectedId={selectedId} onSelectPoint={setSelectedId} />
          </Canvas>

          <div className="absolute bottom-4 left-4 bg-black/50 border border-white/10 rounded-lg px-3 py-2
                          backdrop-blur-sm text-[10px] font-mono space-y-0.5">
            {selectedPoint ? (
              <>
                <div className="text-yellow-400 font-bold mb-0.5">Selected Point</div>
                <div className="text-zinc-300">Z: <span className="text-cyan-400">{selectedPoint.z.toFixed(2)}</span> mm</div>
                <div className="text-zinc-300">X radius: <span className="text-cyan-400">{selectedPoint.x.toFixed(2)}</span> mm</div>
                <div className="text-zinc-300">X⌀: <span className="text-cyan-400">{(selectedPoint.x * 2).toFixed(2)}</span> mm</div>
                <div className="text-zinc-300">Type: <span className="text-purple-400">{selectedPoint.type}</span></div>
              </>
            ) : (
              <div className="text-zinc-500">Click a point to select</div>
            )}
          </div>

          <div className="absolute bottom-4 right-4 text-[9px] text-zinc-500 bg-black/30 rounded px-2 py-1 backdrop-blur-sm">
            Radius:{" "}{selectedPoint ? `${selectedPoint.x.toFixed(2)}mm` : "—"}{" "}
            Center: {selectedPoint ? `${(selectedPoint.x * 2).toFixed(1)}mm, ${selectedPoint.z.toFixed(1)}mm` : "—"}{" "}
            | Fully Defined
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 border-t border-white/[0.06]
                        bg-[#0b0b18] text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Selected point
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Chain point
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-yellow-400 inline-block" /> Profile chain
          </span>
          <span className="ml-auto text-zinc-600">
            Radius: {selectedPoint?.x.toFixed(3) ?? "—"} | Center: {selectedPoint ? `${(selectedPoint.x*2).toFixed(2)}, ${selectedPoint.z.toFixed(2)}` : "—"} | Fully Defined | Editing Assembly
          </span>
        </div>
      </div>
    </div>
  );
}
