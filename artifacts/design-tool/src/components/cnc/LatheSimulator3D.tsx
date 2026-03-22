import React, { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Html, GizmoHelper, GizmoViewport, Environment } from "@react-three/drei";
import * as THREE from "three";
import {
  Play, Pause, RotateCcw, SkipForward, SkipBack, AlertTriangle,
  Box, Eye, EyeOff, Maximize2, Camera, Crosshair, Layers,
  ChevronLeft, ChevronRight, Gauge, Zap, Activity,
} from "lucide-react";
import { check3DCollision, runFullPreFlightCheck, type CollisionResult, type ToolGeometry, type WorkpieceGeometry } from "./CollisionEngine3D";
import { CuttingEffects } from "./CuttingEffects3D";

export interface LatheToolMove {
  x: number;
  z: number;
  type: "rapid" | "cut";
  feedRate?: number;
  spindleRpm?: number;
  gcodeLine?: string;
}

export interface RollGroove {
  zCenter: number;
  depth: number;
  width: number;
  radius?: number;
}

interface LatheSimulator3DProps {
  moves: LatheToolMove[];
  stockDiameter: number;
  stockLength: number;
  chuckLength?: number;
  cycleTimeSec?: number;
  grooves?: RollGroove[];
  finishDiameter?: number;
  boreDiameter?: number;
  gcodeLines?: string[];
}

type ViewPreset = "iso" | "front" | "top" | "side" | "back";

function buildDemoMoves(stockRadius: number, stockLength: number, grooves: RollGroove[]): LatheToolMove[] {
  const moves: LatheToolMove[] = [];
  const finishRadius = stockRadius * 0.82;
  const roughSteps = 5;
  const zEnd = -stockLength * 0.92;

  moves.push({ x: stockRadius + 10, z: 8, type: "rapid", gcodeLine: "G00 X" + ((stockRadius + 10) * 2).toFixed(3) + " Z8.000" });

  for (let i = 0; i <= 4; i++) {
    const z = -i * 1.5;
    moves.push({ x: stockRadius + 2, z, type: i === 0 ? "rapid" : "cut", feedRate: 0.25, spindleRpm: 1200, gcodeLine: `G01 X${((stockRadius + 2) * 2).toFixed(3)} Z${z.toFixed(3)} F0.25` });
    moves.push({ x: 0, z, type: "cut", feedRate: 0.25, spindleRpm: 1200, gcodeLine: `G01 X0.000 Z${z.toFixed(3)} F0.25` });
    moves.push({ x: stockRadius + 2, z, type: "rapid", gcodeLine: `G00 X${((stockRadius + 2) * 2).toFixed(3)}` });
  }

  for (let p = 0; p < roughSteps; p++) {
    const r = stockRadius - p * (stockRadius - finishRadius) / roughSteps;
    moves.push({ x: r + 2, z: -6, type: "rapid", gcodeLine: `G00 X${((r + 2) * 2).toFixed(3)} Z-6.000` });
    moves.push({ x: r, z: -6, type: "cut", feedRate: 0.20, spindleRpm: 1000, gcodeLine: `G01 X${(r * 2).toFixed(3)} Z-6.000 F0.20` });
    moves.push({ x: r, z: zEnd, type: "cut", feedRate: 0.20, spindleRpm: 1000, gcodeLine: `G01 X${(r * 2).toFixed(3)} Z${zEnd.toFixed(3)} F0.20` });
    moves.push({ x: r + 2, z: zEnd, type: "rapid", gcodeLine: `G00 X${((r + 2) * 2).toFixed(3)}` });
  }

  moves.push({ x: finishRadius, z: -5, type: "rapid", gcodeLine: `G00 X${(finishRadius * 2).toFixed(3)} Z-5.000` });
  moves.push({ x: finishRadius, z: zEnd, type: "cut", feedRate: 0.10, spindleRpm: 1500, gcodeLine: `G01 X${(finishRadius * 2).toFixed(3)} Z${zEnd.toFixed(3)} F0.10` });

  for (const g of grooves) {
    const gZ = g.zCenter;
    moves.push({ x: finishRadius + 3, z: gZ + g.width / 2, type: "rapid", gcodeLine: `G00 X${((finishRadius + 3) * 2).toFixed(3)} Z${(gZ + g.width / 2).toFixed(3)}` });
    moves.push({ x: finishRadius + 1, z: gZ + g.width / 2, type: "cut", feedRate: 0.05, spindleRpm: 800, gcodeLine: `G75 R1.0 X${((finishRadius - g.depth) * 2).toFixed(3)}` });
    moves.push({ x: finishRadius - g.depth, z: gZ + g.width / 2, type: "cut", feedRate: 0.05, spindleRpm: 800 });
    moves.push({ x: finishRadius - g.depth, z: gZ - g.width / 2, type: "cut", feedRate: 0.05, spindleRpm: 800 });
    moves.push({ x: finishRadius + 1, z: gZ - g.width / 2, type: "cut", feedRate: 0.05, spindleRpm: 800 });
    moves.push({ x: finishRadius + 3, z: gZ - g.width / 2, type: "rapid" });
  }

  moves.push({ x: stockRadius + 10, z: 8, type: "rapid", gcodeLine: "G28 U0. W0. (Home)" });
  return moves;
}

const NUM_STOCK_SECTORS = 300;

function computeStockProfile(
  stockRadius: number,
  stockLength: number,
  boreDiameter: number,
  allMoves: LatheToolMove[],
  endIdx: number
): number[] {
  const stock = new Float64Array(NUM_STOCK_SECTORS).fill(stockRadius);
  const dZ = stockLength / NUM_STOCK_SECTORS;

  for (let i = 1; i <= endIdx && i < allMoves.length; i++) {
    const prev = allMoves[i - 1];
    const cur = allMoves[i];
    if (cur.type !== "cut") continue;

    const zStart = Math.min(prev.z, cur.z);
    const zEnd = Math.max(prev.z, cur.z);
    const xMin = Math.min(Math.abs(prev.x), Math.abs(cur.x));

    const sStart = Math.max(0, Math.floor(Math.abs(zStart) / dZ));
    const sEnd = Math.min(NUM_STOCK_SECTORS - 1, Math.ceil(Math.abs(zEnd) / dZ));

    for (let s = sStart; s <= sEnd; s++) {
      const sZ = -(s * dZ + dZ / 2);
      if (sZ >= zStart - dZ && sZ <= zEnd + dZ) {
        let xAtZ = xMin;
        if (Math.abs(zEnd - zStart) > 0.01) {
          const t = Math.max(0, Math.min(1, (sZ - prev.z) / (cur.z - prev.z)));
          xAtZ = Math.abs(prev.x + (cur.x - prev.x) * t);
        }
        stock[s] = Math.min(stock[s], Math.max(xAtZ, boreDiameter / 2));
      }
    }
  }

  return Array.from(stock);
}

function Workpiece({
  stockRadius, stockLength, boreDiameter, stock, sectionView, spindleSpeed,
}: {
  stockRadius: number; stockLength: number; boreDiameter: number;
  stock: number[]; sectionView: boolean; spindleSpeed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const boreR = boreDiameter / 2;

  const geometry = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const dZ = stockLength / NUM_STOCK_SECTORS;

    pts.push(new THREE.Vector2(boreR, 0));

    for (let i = 0; i < stock.length; i++) {
      const z = -(i * dZ);
      pts.push(new THREE.Vector2(Math.max(stock[i], boreR + 0.3), z));
    }

    pts.push(new THREE.Vector2(boreR, -stockLength));
    pts.push(new THREE.Vector2(boreR, 0));

    const phiLen = sectionView ? Math.PI : Math.PI * 2;
    const geo = new THREE.LatheGeometry(pts, 96, 0, phiLen);
    geo.computeVertexNormals();
    return geo;
  }, [stock, stockLength, boreR, sectionView]);

  useFrame((_, dt) => {
    if (meshRef.current && spindleSpeed > 0) {
      meshRef.current.rotation.y += dt * spindleSpeed * 0.01;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        color="#8a9ab0"
        metalness={0.88}
        roughness={0.15}
        envMapIntensity={1.4}
        side={sectionView ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}

function ToolpathLines({
  allMoves, endIdx,
}: {
  allMoves: LatheToolMove[]; endIdx: number;
}) {
  const rapidPts = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 1; i <= endIdx && i < allMoves.length; i++) {
      if (allMoves[i].type === "rapid") {
        pts.push([allMoves[i - 1].x, 0, allMoves[i - 1].z]);
        pts.push([allMoves[i].x, 0, allMoves[i].z]);
      }
    }
    return pts.length >= 2 ? pts : [[0, 0, 0] as [number, number, number], [0.001, 0, 0] as [number, number, number]];
  }, [allMoves, endIdx]);

  const cutPts = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 1; i <= endIdx && i < allMoves.length; i++) {
      if (allMoves[i].type === "cut") {
        pts.push([allMoves[i - 1].x, 0, allMoves[i - 1].z]);
        pts.push([allMoves[i].x, 0, allMoves[i].z]);
      }
    }
    return pts.length >= 2 ? pts : [[0, 0, 0] as [number, number, number], [0.001, 0, 0] as [number, number, number]];
  }, [allMoves, endIdx]);

  return (
    <group>
      <Line points={rapidPts} color="#facc15" lineWidth={1} dashed dashScale={3} dashSize={2} gapSize={2} />
      <Line points={cutPts} color="#22d3ee" lineWidth={2.5} />
    </group>
  );
}

function Chuck({ stockRadius, chuckLength, spindleSpeed }: { stockRadius: number; chuckLength: number; spindleSpeed: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (groupRef.current && spindleSpeed > 0) {
      groupRef.current.rotation.y += dt * spindleSpeed * 0.01;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, chuckLength / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[stockRadius + 16, stockRadius + 16, chuckLength, 6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[stockRadius + 2, stockRadius + 2, chuckLength + 2, 32]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.6} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[
          (stockRadius + 8) * Math.cos((i * 2 * Math.PI) / 3),
          (stockRadius + 8) * Math.sin((i * 2 * Math.PI) / 3),
          0
        ]} castShadow>
          <boxGeometry args={[10, 7, chuckLength * 0.85]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function Headstock({ stockRadius, chuckLength }: { stockRadius: number; chuckLength: number }) {
  const size = stockRadius + 30;
  return (
    <group position={[0, 0, chuckLength + size / 2]}>
      <mesh castShadow>
        <boxGeometry args={[size * 1.8, size * 2, size]} />
        <meshStandardMaterial color="#1a2332" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, size * 0.85, 0]}>
        <boxGeometry args={[size * 1.6, size * 0.3, size * 0.95]} />
        <meshStandardMaterial color="#0d1520" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, -size * 0.7, size * 0.3]}>
        <cylinderGeometry args={[6, 6, size * 0.6, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function MachineBed({ stockRadius, stockLength }: { stockRadius: number; stockLength: number }) {
  const bedLen = stockLength + stockRadius * 4;
  const bedW = stockRadius * 3;
  const bedH = stockRadius * 0.7;
  return (
    <group position={[0, -(stockRadius + 20 + bedH / 2), -stockLength / 3]}>
      <mesh receiveShadow>
        <boxGeometry args={[bedW, bedH, bedLen]} />
        <meshStandardMaterial color="#111827" metalness={0.5} roughness={0.7} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (bedW / 2 - 4), bedH / 2 + 1.5, 0]} receiveShadow>
          <boxGeometry args={[8, 3, bedLen - 10]} />
          <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.3} />
        </mesh>
      ))}
      {[-bedLen * 0.4, -bedLen * 0.1, bedLen * 0.2].map((zp, i) => (
        <mesh key={i} position={[0, -bedH / 2 - 8, zp]}>
          <boxGeometry args={[bedW + 10, 15, 20]} />
          <meshStandardMaterial color="#0a0f1a" metalness={0.4} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Tailstock({ stockRadius, stockLength }: { stockRadius: number; stockLength: number }) {
  const sz = stockRadius * 0.7;
  return (
    <group position={[0, 0, -(stockLength + sz + 10)]}>
      <mesh castShadow>
        <boxGeometry args={[sz * 2, sz * 2.5, sz * 2]} />
        <meshStandardMaterial color="#1a2332" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, sz + 5]} castShadow>
        <cylinderGeometry args={[3, 1.5, sz * 2, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Turret({ pos, toolCount }: { pos: [number, number, number]; toolCount: number }) {
  return (
    <group position={pos}>
      <mesh castShadow>
        <cylinderGeometry args={[18, 18, 15, toolCount < 8 ? 8 : 12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
      {Array.from({ length: toolCount }).map((_, i) => {
        const angle = (i * 2 * Math.PI) / toolCount;
        return (
          <mesh key={i}
            position={[20 * Math.cos(angle), 20 * Math.sin(angle), 0]}
            rotation={[0, 0, angle]}
            castShadow
          >
            <boxGeometry args={[6, 3, 12]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.25} />
          </mesh>
        );
      })}
    </group>
  );
}

function Carriage({
  allMoves, endIdx, stockRadius, collisionState,
}: {
  allMoves: LatheToolMove[]; endIdx: number; stockRadius: number;
  collisionState: CollisionResult | null;
}) {
  const idx = Math.min(endIdx, allMoves.length - 1);
  const pos = allMoves[idx] || { x: stockRadius + 20, z: 5 };
  const isCollision = collisionState?.hasCollision ?? false;
  const isCut = allMoves[idx]?.type === "cut";

  return (
    <group position={[pos.x + 10, 0, pos.z]}>
      <mesh castShadow>
        <boxGeometry args={[25, 18, 20]} />
        <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.35} />
      </mesh>

      <mesh position={[-12, 0, 0]} castShadow>
        <boxGeometry args={[14, 14, 45]} />
        <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[-19, 0, -3]}>
        <boxGeometry args={[4, 4, 5]} />
        <meshStandardMaterial
          color={isCollision ? "#ef4444" : (isCut ? "#f59e0b" : "#94a3b8")}
          metalness={0.5}
          roughness={0.1}
          emissive={isCollision ? "#ff0000" : (isCut ? "#7c5c00" : "#000000")}
          emissiveIntensity={isCollision ? 1.5 : (isCut ? 0.5 : 0)}
        />
      </mesh>

      {isCut && !isCollision && (
        <pointLight position={[-20, 0, -3]} color="#ff8800" intensity={0.6} distance={15} />
      )}

      {isCollision && (
        <>
          <pointLight position={[-19, 0, -3]} color="#ff0000" intensity={2} distance={30} />
          <Html position={[-19, 12, 0]}>
            <div className="bg-red-900/90 border border-red-500 rounded px-1.5 py-0.5 text-[9px] text-red-200 font-bold whitespace-nowrap animate-pulse">
              COLLISION!
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

function CollisionMarkers({ collisions }: { collisions: CollisionResult[] }) {
  const criticals = collisions.filter(c => c.severity === "critical" && c.position);
  return (
    <group>
      {criticals.slice(0, 10).map((c, i) => (
        <group key={i} position={[c.position!.x, c.position!.y, c.position!.z]}>
          <mesh>
            <sphereGeometry args={[2, 8, 8]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CoordAxes({ size = 30 }: { size?: number }) {
  return (
    <group>
      <Line points={[[0, 0, 0], [size, 0, 0]]} color="#ef4444" lineWidth={3} />
      <Line points={[[0, 0, 0], [0, size, 0]]} color="#22c55e" lineWidth={3} />
      <Line points={[[0, 0, 0], [0, 0, -size]]} color="#3b82f6" lineWidth={3} />
      <Html position={[size + 4, 0, 0]}><span className="text-red-400 text-[10px] font-bold">X</span></Html>
      <Html position={[0, size + 4, 0]}><span className="text-green-400 text-[10px] font-bold">Y</span></Html>
      <Html position={[0, 0, -size - 6]}><span className="text-blue-400 text-[10px] font-bold">Z</span></Html>
    </group>
  );
}

function CameraController({ preset, stockRadius, stockLength }: { preset: ViewPreset | null; stockRadius: number; stockLength: number }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!preset) return;
    const center = new THREE.Vector3(0, 0, -stockLength / 2);
    const dist = Math.max(stockRadius * 4, stockLength * 1.2);

    const positions: Record<ViewPreset, [number, number, number]> = {
      iso: [dist * 1.2, dist * 0.8, dist * 0.5],
      front: [0, 0, dist * 1.5],
      top: [0, dist * 1.5, -stockLength / 2],
      side: [dist * 1.5, 0, -stockLength / 2],
      back: [0, 0, -(stockLength + dist)],
    };

    const [px, py, pz] = positions[preset];
    camera.position.set(px, py, pz);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [preset, camera, stockRadius, stockLength]);

  return null;
}

function Scene({
  moves, stockDiameter, stockLength, chuckLength, grooves, finishDiameter, boreDiameter,
  endIdx, sectionView, showToolpath, showMachine, spindleSpeed, collisionResult, preFlightResults, viewPreset,
  isPlaying, showEffects,
}: LatheSimulator3DProps & {
  endIdx: number; sectionView: boolean; showToolpath: boolean;
  showMachine: boolean; spindleSpeed: number; collisionResult: CollisionResult | null;
  preFlightResults: CollisionResult[]; viewPreset: ViewPreset | null;
  isPlaying: boolean; showEffects: boolean;
}) {
  const stockRadius = stockDiameter / 2;
  const boreR = boreDiameter ?? stockRadius * 0.35;
  const chuck = chuckLength ?? 50;
  const allGrooves: RollGroove[] = grooves ?? [
    { zCenter: -30, depth: 8, width: 10, radius: 2 },
    { zCenter: -55, depth: 12, width: 14, radius: 3 },
    { zCenter: -80, depth: 8, width: 10, radius: 2 },
  ];
  const allMoves = moves.length > 1 ? moves : buildDemoMoves(stockRadius, stockLength, allGrooves);

  const stock = useMemo(
    () => computeStockProfile(stockRadius, stockLength, boreR, allMoves, endIdx),
    [stockRadius, stockLength, boreR, allMoves, endIdx]
  );

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[150, 200, 100]} intensity={1.6} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[-100, 100, -50]} intensity={0.5} color="#6080ff" />
      <pointLight position={[100, -80, 80]} intensity={0.4} color="#ff8040" />
      <spotLight position={[0, 250, 0]} angle={0.3} penumbra={0.5} intensity={0.7} castShadow />

      <group rotation={[Math.PI / 2, 0, 0]}>
        <Workpiece
          stockRadius={stockRadius}
          stockLength={stockLength}
          boreDiameter={boreR}
          stock={stock}
          sectionView={sectionView}
          spindleSpeed={spindleSpeed}
        />
        <Chuck stockRadius={stockRadius} chuckLength={chuck} spindleSpeed={spindleSpeed} />
        {showToolpath && <ToolpathLines allMoves={allMoves} endIdx={endIdx} />}
        <Carriage allMoves={allMoves} endIdx={endIdx} stockRadius={stockRadius} collisionState={collisionResult} />
        <CollisionMarkers collisions={preFlightResults} />
        {showEffects && (() => {
          const idx = Math.min(endIdx, allMoves.length - 1);
          const m = allMoves[idx] || { x: stockRadius + 20, z: 5 };
          const isCut = allMoves[idx]?.type === "cut";
          return (
            <CuttingEffects
              toolPosition={[m.x + 10, 0, m.z]}
              isCutting={isCut}
              isPlaying={isPlaying}
              mode="lathe"
            />
          );
        })()}
      </group>

      {showMachine && (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <Headstock stockRadius={stockRadius} chuckLength={chuck} />
          <MachineBed stockRadius={stockRadius} stockLength={stockLength} />
          <Tailstock stockRadius={stockRadius} stockLength={stockLength} />
          <Turret pos={[stockRadius + 55, 0, -stockLength * 0.3]} toolCount={8} />
        </group>
      )}

      <CoordAxes size={Math.max(stockRadius, 30)} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -stockRadius - 35, -stockLength / 2]} receiveShadow>
        <planeGeometry args={[stockLength * 3.5, stockLength * 2.5]} />
        <meshStandardMaterial color="#080810" roughness={0.95} />
      </mesh>

      <gridHelper args={[stockLength * 3.5, 40, "#1a1a30", "#111120"]}
        position={[0, -stockRadius - 35, -stockLength / 2]} />

      <OrbitControls makeDefault enableDamping dampingFactor={0.08}
        target={[0, 0, -stockLength / 2]} />

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>

      <CameraController preset={viewPreset} stockRadius={stockRadius} stockLength={stockLength} />
    </>
  );
}

function DROPanel({ currentMove, endIdx, totalMoves, elapsedPct, collisionResult }: {
  currentMove: LatheToolMove | null; endIdx: number; totalMoves: number;
  elapsedPct: number; collisionResult: CollisionResult | null;
}) {
  const rpm = currentMove?.spindleRpm ?? 0;
  const feed = currentMove?.feedRate ?? 0;
  const isRapid = currentMove?.type === "rapid";
  const isCollision = collisionResult?.hasCollision;

  return (
    <div className="absolute top-3 left-3 bg-black/70 border border-white/10 rounded-xl px-3.5 py-2.5
                    backdrop-blur-md text-[10px] font-mono space-y-1 min-w-[180px] select-none">
      <div className="text-[8px] uppercase tracking-widest text-amber-400/70 font-bold mb-1.5 flex items-center gap-1.5">
        <Gauge className="w-3 h-3" /> DIGITAL READOUT
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div className="text-zinc-500">Z</div>
        <div className="text-cyan-400 text-right tabular-nums">{currentMove?.z.toFixed(3) ?? "—"} mm</div>
        <div className="text-zinc-500">X⌀</div>
        <div className="text-cyan-400 text-right tabular-nums">{((currentMove?.x ?? 0) * 2).toFixed(3)} mm</div>
      </div>

      <div className="border-t border-white/5 my-1" />

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div className="text-zinc-500">RPM</div>
        <div className="text-amber-400 text-right tabular-nums">{rpm || "—"}</div>
        <div className="text-zinc-500">Feed</div>
        <div className="text-amber-400 text-right tabular-nums">{feed ? `${feed} mm/rev` : "—"}</div>
        <div className="text-zinc-500">Mode</div>
        <div className={`text-right font-bold ${isRapid ? "text-yellow-400" : "text-green-400"}`}>
          {isRapid ? "G00 RAPID" : "G01 CUT"}
        </div>
      </div>

      <div className="border-t border-white/5 my-1" />

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div className="text-zinc-500">Move</div>
        <div className="text-white text-right">{endIdx + 1} / {totalMoves}</div>
        <div className="text-zinc-500">Progress</div>
        <div className="text-white text-right">{Math.round(elapsedPct * 100)}%</div>
      </div>

      {isCollision && (
        <div className="mt-1.5 bg-red-900/60 border border-red-500/40 rounded px-2 py-1 text-[9px] text-red-300 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{collisionResult!.description.slice(0, 50)}</span>
        </div>
      )}
    </div>
  );
}

function GCodePanel({ gcodeLines, endIdx }: { gcodeLines: string[]; endIdx: number }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(".gcode-active");
      activeEl?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [endIdx]);

  if (!gcodeLines || gcodeLines.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 bg-black/70 border border-white/10 rounded-xl
                    backdrop-blur-md w-[220px] max-h-[280px] overflow-hidden select-none">
      <div className="px-3 py-1.5 border-b border-white/5 text-[8px] uppercase tracking-widest text-emerald-400/70 font-bold flex items-center gap-1.5">
        <Activity className="w-3 h-3" /> G-CODE TRACE
      </div>
      <div ref={listRef} className="overflow-y-auto max-h-[240px] text-[9px] font-mono">
        {gcodeLines.slice(Math.max(0, endIdx - 8), endIdx + 8).map((line, i) => {
          const realIdx = Math.max(0, endIdx - 8) + i;
          const isActive = realIdx === endIdx;
          const isPast = realIdx < endIdx;
          return (
            <div key={realIdx}
              className={`px-3 py-0.5 flex gap-2 ${isActive ? "gcode-active bg-emerald-500/20 text-emerald-300 font-bold" : isPast ? "text-zinc-600" : "text-zinc-500"}`}
            >
              <span className="text-zinc-700 w-5 text-right flex-shrink-0">{realIdx + 1}</span>
              <span className="truncate">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ViewPresetButtons({ onSelect }: { onSelect: (v: ViewPreset) => void }) {
  const presets: { id: ViewPreset; label: string }[] = [
    { id: "iso", label: "ISO" },
    { id: "front", label: "Front" },
    { id: "top", label: "Top" },
    { id: "side", label: "Side" },
  ];
  return (
    <div className="absolute bottom-16 left-3 flex gap-1 select-none">
      {presets.map(p => (
        <button key={p.id} onClick={() => onSelect(p.id)}
          className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[9px]
                     text-zinc-400 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm">
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function LatheSimulator3D(props: LatheSimulator3DProps) {
  const { moves, stockDiameter, stockLength, cycleTimeSec, gcodeLines } = props;
  const stockRadius = stockDiameter / 2;
  const boreR = props.boreDiameter ?? stockRadius * 0.35;
  const chuck = props.chuckLength ?? 50;
  const allGrooves: RollGroove[] = props.grooves ?? [
    { zCenter: -stockLength * 0.25, depth: stockRadius * 0.08, width: stockRadius * 0.10, radius: 2 },
    { zCenter: -stockLength * 0.50, depth: stockRadius * 0.12, width: stockRadius * 0.13, radius: 3 },
    { zCenter: -stockLength * 0.75, depth: stockRadius * 0.08, width: stockRadius * 0.10, radius: 2 },
  ];
  const allMoves = moves.length > 1 ? moves : buildDemoMoves(stockRadius, stockLength, allGrooves);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [sectionView, setSectionView] = useState(false);
  const [showToolpath, setShowToolpath] = useState(true);
  const [showMachine, setShowMachine] = useState(true);
  const [showEffects, setShowEffects] = useState(true);
  const [viewPreset, setViewPreset] = useState<ViewPreset | null>(null);

  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const endIdx = Math.min(Math.floor(progress * (allMoves.length - 1)), allMoves.length - 1);
  const currentMove = allMoves[endIdx] || null;

  const spindleSpeed = useMemo(() => {
    if (!isPlaying) return 0;
    return currentMove?.spindleRpm ? Math.min(currentMove.spindleRpm / 200, 8) : 2;
  }, [isPlaying, currentMove?.spindleRpm]);

  const toolGeo: ToolGeometry = useMemo(() => ({
    holderWidth: 12, holderHeight: 12, holderLength: 40,
    insertNoseRadius: 0.8, insertLength: 16, insertAngleDeg: 55,
  }), []);

  const workpiece: WorkpieceGeometry = useMemo(() => ({
    stockRadius, stockLength, boreDiameter: boreR,
    chuckLength: chuck, finishRadius: props.finishDiameter ? props.finishDiameter / 2 : stockRadius * 0.82,
    grooves: allGrooves,
  }), [stockRadius, stockLength, boreR, chuck, props.finishDiameter, allGrooves]);

  const collisionResult = useMemo(() => {
    if (!currentMove) return null;
    return check3DCollision(
      { x: currentMove.x, y: 0, z: currentMove.z },
      toolGeo, workpiece, currentMove.type === "rapid"
    );
  }, [currentMove, toolGeo, workpiece]);

  const preFlightResults = useMemo(() => {
    return runFullPreFlightCheck(
      allMoves.map(m => ({ x: m.x, z: m.z, type: m.type })),
      toolGeo, workpiece
    );
  }, [allMoves, toolGeo, workpiece]);

  const resolvedGcodeLines = useMemo(() => {
    if (gcodeLines && gcodeLines.length > 0) return gcodeLines;
    return allMoves.map((m, i) => m.gcodeLine || `${m.type === "rapid" ? "G00" : "G01"} X${(m.x * 2).toFixed(3)} Z${m.z.toFixed(3)}${m.feedRate ? ` F${m.feedRate}` : ""}`);
  }, [gcodeLines, allMoves]);

  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(animRef.current); return; }
    lastTimeRef.current = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      setProgress(prev => {
        const next = prev + dt * 0.03 * speed;
        if (next >= 1) { setIsPlaying(false); return 1; }
        return next;
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, speed]);

  const handleReset = () => { setIsPlaying(false); setProgress(0); };
  const stepForward = () => {
    setIsPlaying(false);
    setProgress(prev => Math.min(1, prev + 1 / Math.max(allMoves.length, 1)));
  };
  const stepBackward = () => {
    setIsPlaying(false);
    setProgress(prev => Math.max(0, prev - 1 / Math.max(allMoves.length, 1)));
  };

  const critCount = preFlightResults.filter(r => r.severity === "critical").length;
  const warnCount = preFlightResults.filter(r => r.severity === "warning").length;

  return (
    <div className="flex flex-col h-full bg-[#06060f]">
      <div className="flex-1 relative min-h-0">
        <Canvas
          shadows
          camera={{ position: [stockRadius * 3, stockRadius * 2, stockLength * 0.5], fov: 45, near: 0.1, far: 50000 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
          style={{ background: "radial-gradient(ellipse at 50% 30%, #0d1020 0%, #06060f 70%)" }}
        >
          <Scene
            {...props}
            grooves={allGrooves}
            endIdx={endIdx}
            sectionView={sectionView}
            showToolpath={showToolpath}
            showMachine={showMachine}
            spindleSpeed={spindleSpeed}
            collisionResult={collisionResult}
            preFlightResults={preFlightResults}
            viewPreset={viewPreset}
            isPlaying={isPlaying}
            showEffects={showEffects}
          />
        </Canvas>

        <DROPanel
          currentMove={currentMove}
          endIdx={endIdx}
          totalMoves={allMoves.length}
          elapsedPct={progress}
          collisionResult={collisionResult}
        />

        <GCodePanel gcodeLines={resolvedGcodeLines} endIdx={endIdx} />

        <ViewPresetButtons onSelect={(v) => setViewPreset(v)} />

        {(critCount > 0 || warnCount > 0) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2
                          bg-black/70 border border-white/10 rounded-lg px-3 py-1.5
                          backdrop-blur-md text-[10px] select-none">
            {critCount > 0 && (
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <AlertTriangle className="w-3 h-3" /> {critCount} collision{critCount > 1 ? "s" : ""}
              </span>
            )}
            {warnCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="w-3 h-3" /> {warnCount} warning{warnCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        <div className="absolute bottom-16 right-3 flex flex-col gap-1 select-none">
          <button onClick={() => setShowMachine(v => !v)}
            className={`flex items-center gap-1.5 bg-black/50 border rounded px-2 py-1 text-[9px] backdrop-blur-sm transition-colors
              ${showMachine ? "border-emerald-500/30 text-emerald-400" : "border-white/10 text-zinc-500"}`}>
            <Box className="w-3 h-3" /> Machine
          </button>
          <button onClick={() => setShowToolpath(v => !v)}
            className={`flex items-center gap-1.5 bg-black/50 border rounded px-2 py-1 text-[9px] backdrop-blur-sm transition-colors
              ${showToolpath ? "border-cyan-500/30 text-cyan-400" : "border-white/10 text-zinc-500"}`}>
            {showToolpath ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Toolpath
          </button>
          <button onClick={() => setSectionView(v => !v)}
            className={`flex items-center gap-1.5 bg-black/50 border rounded px-2 py-1 text-[9px] backdrop-blur-sm transition-colors
              ${sectionView ? "border-violet-500/30 text-violet-400" : "border-white/10 text-zinc-500"}`}>
            <Layers className="w-3 h-3" /> Section
          </button>
          <button onClick={() => setShowEffects(v => !v)}
            className={`flex items-center gap-1.5 bg-black/50 border rounded px-2 py-1 text-[9px] backdrop-blur-sm transition-colors
              ${showEffects ? "border-orange-500/30 text-orange-400" : "border-white/10 text-zinc-500"}`}>
            <Zap className="w-3 h-3" /> Effects
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2
                      bg-[#0a0a18] border-t border-white/[0.07]">
        <button onClick={stepBackward}
          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                     text-zinc-400 hover:bg-white/[0.08] transition-colors"
          title="Step backward">
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => { if (progress >= 1) handleReset(); setIsPlaying(p => !p); }}
          className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25
                     text-blue-400 hover:bg-blue-500/25 transition-colors"
          title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button onClick={stepForward}
          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                     text-zinc-400 hover:bg-white/[0.08] transition-colors"
          title="Step forward">
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <button onClick={handleReset}
          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                     text-zinc-400 hover:bg-white/[0.08] transition-colors"
          title="Reset">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <input
          type="range" min={0} max={1} step={0.001} value={progress}
          onChange={(e) => { setProgress(parseFloat(e.target.value)); setIsPlaying(false); }}
          className="flex-1 h-1.5 accent-amber-400 cursor-pointer"
        />

        <span className="text-[9px] text-zinc-500 tabular-nums w-8 text-right">{Math.round(progress * 100)}%</span>

        <select
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="bg-[#0d0d1e] border border-white/[0.08] rounded px-1.5 py-0.5
                     text-xs text-zinc-300"
        >
          <option value={0.1}>0.1×</option>
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={5}>5×</option>
          <option value={10}>10×</option>
        </select>

        {cycleTimeSec !== undefined && progress >= 1 && (
          <span className="text-[11px] font-semibold text-amber-400 ml-1">
            Cycle: {cycleTimeSec.toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}
