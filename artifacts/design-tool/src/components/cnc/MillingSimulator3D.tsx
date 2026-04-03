import React, { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, Html, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";
import {
  Play, Pause, RotateCcw, SkipForward, SkipBack, AlertTriangle,
  Box, Eye, EyeOff, Layers, ChevronDown, ChevronRight,
  Gauge, Activity, Upload, Clock, Palette, Plus, Zap,
} from "lucide-react";
import {
  checkMillingCollision, runMillingPreFlightCheck,
  type MillingToolGeometry, type MillingStockGeometry,
  type FixtureZone, type MillingCollisionResult,
} from "./CollisionEngine3D";
import { MillingToolAssembly, type MillingToolType } from "./MillingToolAssembly";
import {
  getSurfaceFinishResult, SURFACE_FINISH_LEGEND,
  type SurfaceFinishParams,
} from "./SurfaceFinishOverlay";
import { parseSTEPFile, isSTEPFile, readSTEPFileFromBlob } from "./STEPImporter";
import { CuttingEffects } from "./CuttingEffects3D";

export interface MillingMove {
  x: number;
  y: number;
  z: number;
  type: "rapid" | "cut";
  feedRate?: number;
  spindleRpm?: number;
  toolType?: MillingToolType;
  operationId?: string;
}

export interface MillingOperation {
  id: string;
  name: string;
  toolType: MillingToolType;
  toolDiameter: number;
  moves: MillingMove[];
  feedRate: number;
  spindleRpm: number;
  stepover: number;
  depthOfCut: number;
  fluteCount: number;
}

export interface MachiningSetup {
  id: string;
  name: string;
  workOffset: string;
  originOffset: [number, number, number];
  rotation: [number, number, number];
  operations: MillingOperation[];
  fixtureZones: FixtureZone[];
}

export interface MillingSimulator3DProps {
  stockSizeX?: number;
  stockSizeY?: number;
  stockSizeZ?: number;
  setups?: MachiningSetup[];
  operations?: MillingOperation[];
}

const HM_RESOLUTION = 128;

function createHeightmap(stockSizeY: number): Float32Array {
  const hm = new Float32Array(HM_RESOLUTION * HM_RESOLUTION);
  hm.fill(stockSizeY);
  return hm;
}

function applyToolCut(
  heightmap: Float32Array,
  resolution: number,
  stock: MillingStockGeometry,
  toolPos: { x: number; y: number; z: number },
  toolRadius: number,
  toolType: MillingToolType
): void {
  const cellSizeX = stock.sizeX / (resolution - 1);
  const cellSizeZ = stock.sizeZ / (resolution - 1);
  const uCenter = (toolPos.x - stock.originX) / cellSizeX;
  const vCenter = (toolPos.z - stock.originZ) / cellSizeZ;
  const radiusCellsX = toolRadius / cellSizeX;
  const radiusCellsZ = toolRadius / cellSizeZ;

  const iMin = Math.max(0, Math.floor(uCenter - radiusCellsX - 1));
  const iMax = Math.min(resolution - 1, Math.ceil(uCenter + radiusCellsX + 1));
  const jMin = Math.max(0, Math.floor(vCenter - radiusCellsZ - 1));
  const jMax = Math.min(resolution - 1, Math.ceil(vCenter + radiusCellsZ + 1));

  for (let j = jMin; j <= jMax; j++) {
    for (let i = iMin; i <= iMax; i++) {
      const worldX = stock.originX + i * cellSizeX;
      const worldZ = stock.originZ + j * cellSizeZ;
      const dx = worldX - toolPos.x;
      const dz = worldZ - toolPos.z;
      const distWorld = Math.sqrt(dx * dx + dz * dz);

      if (distWorld <= toolRadius) {
        const idx = j * resolution + i;
        let cutDepth: number;

        if (toolType === "ball_nose") {
          const normalizedDist = distWorld / toolRadius;
          const sphereY = toolPos.y + toolRadius * (1 - Math.sqrt(Math.max(0, 1 - normalizedDist * normalizedDist)));
          cutDepth = sphereY;
        } else {
          cutDepth = toolPos.y;
        }

        if (cutDepth < heightmap[idx]) {
          heightmap[idx] = Math.max(cutDepth, stock.originY);
        }
      }
    }
  }
}

function interpolateMove(from: MillingMove, to: MillingMove, t: number): { x: number; y: number; z: number } {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

function HeightmapMesh({
  heightmap, resolution, stock, showFinish, surfaceFinishParams,
}: {
  heightmap: Float32Array;
  resolution: number;
  stock: MillingStockGeometry;
  showFinish: boolean;
  surfaceFinishParams: SurfaceFinishParams | null;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const finishResult = surfaceFinishParams ? getSurfaceFinishResult(surfaceFinishParams) : null;
    const finishColor = finishResult ? new THREE.Color(finishResult.color) : null;
    const stockColor = new THREE.Color(0x8a9ab0);

    for (let j = 0; j < resolution; j++) {
      for (let i = 0; i < resolution; i++) {
        const u = i / (resolution - 1);
        const v = j / (resolution - 1);
        const x = stock.originX + u * stock.sizeX;
        const z = stock.originZ + v * stock.sizeZ;
        const y = heightmap[j * resolution + i];

        vertices.push(x, y, z);
        normals.push(0, 1, 0);

        const isMachined = y < stock.originY + stock.sizeY - 0.01;
        if (showFinish && isMachined && finishColor) {
          colors.push(finishColor.r, finishColor.g, finishColor.b);
        } else if (isMachined) {
          colors.push(0.7, 0.75, 0.82);
        } else {
          colors.push(stockColor.r, stockColor.g, stockColor.b);
        }
      }
    }

    for (let j = 0; j < resolution - 1; j++) {
      for (let i = 0; i < resolution - 1; i++) {
        const a = j * resolution + i;
        const b = a + 1;
        const c = a + resolution;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    for (let j = 0; j < resolution - 1; j++) {
      for (let i = 0; i < resolution; i++) {
        const idx = j * resolution + i;
        const idxBelow = (j + 1) * resolution + i;

        let dx = 0, dz = 0;
        if (i > 0 && i < resolution - 1) {
          dx = heightmap[idx + 1] - heightmap[idx - 1];
        }
        if (j > 0 && j < resolution - 1) {
          dz = heightmap[idxBelow] - heightmap[(j - 1) * resolution + i];
        }
        const cellW = stock.sizeX / (resolution - 1);
        const cellD = stock.sizeZ / (resolution - 1);
        const nx = -dx / (2 * cellW);
        const nz = -dz / (2 * cellD);
        const len = Math.sqrt(nx * nx + 1 + nz * nz);
        normals[idx * 3] = nx / len;
        normals[idx * 3 + 1] = 1 / len;
        normals[idx * 3 + 2] = nz / len;
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);

    return geo;
  }, [heightmap, resolution, stock, showFinish, surfaceFinishParams]);

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        vertexColors
        metalness={0.7}
        roughness={0.25}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function StockSides({ stock, heightmap, resolution }: {
  stock: MillingStockGeometry;
  heightmap: Float32Array;
  resolution: number;
}) {
  const { sizeX, sizeY, sizeZ, originX, originY, originZ } = stock;

  return (
    <group>
      <mesh position={[originX + sizeX / 2, originY + sizeY / 2, originZ]} castShadow>
        <planeGeometry args={[sizeX, sizeY]} />
        <meshStandardMaterial color="#7a8a9a" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[originX + sizeX / 2, originY + sizeY / 2, originZ + sizeZ]} castShadow>
        <planeGeometry args={[sizeX, sizeY]} />
        <meshStandardMaterial color="#7a8a9a" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[originX, originY + sizeY / 2, originZ + sizeZ / 2]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <planeGeometry args={[sizeZ, sizeY]} />
        <meshStandardMaterial color="#7a8a9a" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[originX + sizeX, originY + sizeY / 2, originZ + sizeZ / 2]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <planeGeometry args={[sizeZ, sizeY]} />
        <meshStandardMaterial color="#7a8a9a" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[originX + sizeX / 2, originY, originZ + sizeZ / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sizeX, sizeZ]} />
        <meshStandardMaterial color="#6a7a8a" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function MillingToolpathLines({ moves, endIdx }: { moves: MillingMove[]; endIdx: number }) {
  const rapidPts = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 1; i <= endIdx && i < moves.length; i++) {
      if (moves[i].type === "rapid") {
        pts.push([moves[i - 1].x, moves[i - 1].y, moves[i - 1].z]);
        pts.push([moves[i].x, moves[i].y, moves[i].z]);
      }
    }
    return pts.length >= 2 ? pts : [[0, 0, 0] as [number, number, number], [0.001, 0, 0] as [number, number, number]];
  }, [moves, endIdx]);

  const cutPts = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 1; i <= endIdx && i < moves.length; i++) {
      if (moves[i].type === "cut") {
        pts.push([moves[i - 1].x, moves[i - 1].y, moves[i - 1].z]);
        pts.push([moves[i].x, moves[i].y, moves[i].z]);
      }
    }
    return pts.length >= 2 ? pts : [[0, 0, 0] as [number, number, number], [0.001, 0, 0] as [number, number, number]];
  }, [moves, endIdx]);

  return (
    <group>
      <Line points={rapidPts} color="#facc15" lineWidth={1} dashed dashScale={3} dashSize={2} gapSize={2} />
      <Line points={cutPts} color="#22d3ee" lineWidth={2} />
    </group>
  );
}

function MachineTable({ stock }: { stock: MillingStockGeometry }) {
  const tableW = stock.sizeX * 2;
  const tableD = stock.sizeZ * 2;
  const tableH = 15;
  const cx = stock.originX + stock.sizeX / 2;
  const cz = stock.originZ + stock.sizeZ / 2;

  return (
    <group>
      <mesh position={[cx, stock.originY - tableH / 2 - 1, cz]} receiveShadow>
        <boxGeometry args={[tableW, tableH, tableD]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[cx + side * (tableW / 2 - 5), stock.originY + 1, cz]} receiveShadow>
          <boxGeometry args={[10, 4, tableD - 20]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function FixtureVis({ zone }: { zone: FixtureZone }) {
  const sx = zone.maxX - zone.minX;
  const sy = zone.maxY - zone.minY;
  const sz = zone.maxZ - zone.minZ;
  const cx = (zone.minX + zone.maxX) / 2;
  const cy = (zone.minY + zone.maxY) / 2;
  const cz = (zone.minZ + zone.maxZ) / 2;

  return (
    <group position={[cx, cy, cz]}>
      <mesh>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} transparent opacity={0.6} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(sx, sy, sz)]} />
        <lineBasicMaterial color="#94a3b8" />
      </lineSegments>
      <Html position={[0, sy / 2 + 5, 0]} center>
        <div className="bg-zinc-800/80 text-zinc-300 text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap">
          {zone.label}
        </div>
      </Html>
    </group>
  );
}

function ImportedPartMesh({ geometry, visible }: { geometry: THREE.BufferGeometry; visible: boolean }) {
  if (!visible) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#44aa88"
        metalness={0.4}
        roughness={0.5}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CoordAxes({ size = 30 }: { size?: number }) {
  return (
    <group>
      <Line points={[[0, 0, 0], [size, 0, 0]]} color="#ef4444" lineWidth={3} />
      <Line points={[[0, 0, 0], [0, size, 0]]} color="#22c55e" lineWidth={3} />
      <Line points={[[0, 0, 0], [0, 0, size]]} color="#3b82f6" lineWidth={3} />
      <Html position={[size + 4, 0, 0]}><span className="text-red-400 text-[10px] font-bold">X</span></Html>
      <Html position={[0, size + 4, 0]}><span className="text-green-400 text-[10px] font-bold">Y</span></Html>
      <Html position={[0, 0, size + 6]}><span className="text-blue-400 text-[10px] font-bold">Z</span></Html>
    </group>
  );
}

function MillingScene({
  stock, heightmap, allMoves, endIdx, showToolpath, showMachine, showFinish,
  surfaceFinishParams, toolGeo, fixtures, collisionResult, importedGeometry,
  showImportedPart, isPlaying, showEffects,
}: {
  stock: MillingStockGeometry;
  heightmap: Float32Array;
  allMoves: MillingMove[];
  endIdx: number;
  showToolpath: boolean;
  showMachine: boolean;
  showFinish: boolean;
  surfaceFinishParams: SurfaceFinishParams | null;
  toolGeo: MillingToolGeometry;
  fixtures: FixtureZone[];
  collisionResult: MillingCollisionResult | null;
  importedGeometry: THREE.BufferGeometry | null;
  showImportedPart: boolean;
  isPlaying: boolean;
  showEffects: boolean;
}) {
  const currentMove = allMoves[Math.min(endIdx, allMoves.length - 1)];
  const isCollision = collisionResult?.hasCollision ?? false;
  const isCutting = currentMove?.type === "cut";
  const toolPos: [number, number, number] = currentMove
    ? [currentMove.x, currentMove.y, currentMove.z]
    : [stock.originX + stock.sizeX / 2, stock.originY + stock.sizeY + 30, stock.originZ + stock.sizeZ / 2];

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[150, 200, 100]} intensity={1.4} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[-100, 100, -50]} intensity={0.4} color="#6080ff" />
      <pointLight position={[100, -50, 80]} intensity={0.3} color="#ff8040" />

      <HeightmapMesh
        heightmap={heightmap}
        resolution={HM_RESOLUTION}
        stock={stock}
        showFinish={showFinish}
        surfaceFinishParams={surfaceFinishParams}
      />
      <StockSides stock={stock} heightmap={heightmap} resolution={HM_RESOLUTION} />

      {showToolpath && <MillingToolpathLines moves={allMoves} endIdx={endIdx} />}

      <MillingToolAssembly
        tool={{
          type: toolGeo.toolType,
          diameter: toolGeo.toolDiameter,
          fluteLength: toolGeo.fluteLength,
          overallLength: toolGeo.overallLength,
          holderDiameter: toolGeo.holderDiameter,
          holderLength: toolGeo.holderLength,
          shankDiameter: toolGeo.shankDiameter,
        }}
        position={toolPos}
        isCollision={isCollision}
        isCutting={isCutting}
      />

      {fixtures.map((f) => (
        <FixtureVis key={f.id} zone={f} />
      ))}

      {importedGeometry && (
        <ImportedPartMesh geometry={importedGeometry} visible={showImportedPart} />
      )}

      {showMachine && <MachineTable stock={stock} />}

      <CoordAxes size={Math.max(stock.sizeX, stock.sizeZ, 30)} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[stock.originX + stock.sizeX / 2, stock.originY - 20, stock.originZ + stock.sizeZ / 2]}
        receiveShadow
      >
        <planeGeometry args={[stock.sizeX * 4, stock.sizeZ * 4]} />
        <meshStandardMaterial color="#080810" roughness={0.95} />
      </mesh>

      <gridHelper
        args={[Math.max(stock.sizeX, stock.sizeZ) * 4, 40, "#1a1a30", "#111120"]}
        position={[stock.originX + stock.sizeX / 2, stock.originY - 20, stock.originZ + stock.sizeZ / 2]}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[stock.originX + stock.sizeX / 2, stock.originY + stock.sizeY / 2, stock.originZ + stock.sizeZ / 2]}
      />

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>

      {showEffects && (
        <CuttingEffects
          toolPosition={toolPos}
          isCutting={isCutting}
          isPlaying={isPlaying}
          mode="milling"
        />
      )}

      {isCollision && currentMove && (
        <Html position={[currentMove.x, currentMove.y + toolGeo.overallLength + 10, currentMove.z]}>
          <div className="bg-red-900/90 border border-red-500 rounded px-1.5 py-0.5 text-[9px] text-red-200 font-bold whitespace-nowrap animate-pulse">
            COLLISION!
          </div>
        </Html>
      )}
    </>
  );
}

function buildDemoMillingMoves(stockX: number, stockY: number, stockZ: number): MillingMove[] {
  const moves: MillingMove[] = [];
  const toolR = 5;
  const stepover = 6;
  const doc = 2;

  moves.push({ x: -10, y: stockY + 20, z: -10, type: "rapid" });
  moves.push({ x: 0, y: stockY + 5, z: 0, type: "rapid" });

  for (let layer = 0; layer < 3; layer++) {
    const cutY = stockY - (layer + 1) * doc;
    moves.push({ x: -toolR, y: cutY + doc + 5, z: -toolR, type: "rapid" });
    moves.push({ x: -toolR, y: cutY, z: -toolR, type: "cut", feedRate: 800, spindleRpm: 8000 });

    let dir = 1;
    for (let row = -toolR; row <= stockZ + toolR; row += stepover) {
      const z = Math.min(row, stockZ + toolR);
      if (dir > 0) {
        moves.push({ x: -toolR, y: cutY, z, type: "cut", feedRate: 800, spindleRpm: 8000 });
        moves.push({ x: stockX + toolR, y: cutY, z, type: "cut", feedRate: 800, spindleRpm: 8000 });
      } else {
        moves.push({ x: stockX + toolR, y: cutY, z, type: "cut", feedRate: 800, spindleRpm: 8000 });
        moves.push({ x: -toolR, y: cutY, z, type: "cut", feedRate: 800, spindleRpm: 8000 });
      }
      dir *= -1;
    }

    moves.push({ x: dir > 0 ? -toolR : stockX + toolR, y: cutY + 10, z: stockZ + toolR, type: "rapid" });
  }

  const pocketCx = stockX * 0.5;
  const pocketCz = stockZ * 0.5;
  const pocketW = stockX * 0.4;
  const pocketD = stockZ * 0.4;
  const pocketDepth = 4;
  const cutY = stockY - 3 * doc - pocketDepth;

  moves.push({ x: pocketCx, y: stockY, z: pocketCz, type: "rapid" });
  moves.push({ x: pocketCx - pocketW / 2, y: cutY, z: pocketCz - pocketD / 2, type: "cut", feedRate: 500, spindleRpm: 8000 });

  for (let r = 0; r < 3; r++) {
    const inset = r * stepover;
    const x0 = pocketCx - pocketW / 2 + inset;
    const x1 = pocketCx + pocketW / 2 - inset;
    const z0 = pocketCz - pocketD / 2 + inset;
    const z1 = pocketCz + pocketD / 2 - inset;
    if (x0 >= x1 || z0 >= z1) break;
    moves.push({ x: x0, y: cutY, z: z0, type: "cut", feedRate: 500, spindleRpm: 8000 });
    moves.push({ x: x1, y: cutY, z: z0, type: "cut", feedRate: 500, spindleRpm: 8000 });
    moves.push({ x: x1, y: cutY, z: z1, type: "cut", feedRate: 500, spindleRpm: 8000 });
    moves.push({ x: x0, y: cutY, z: z1, type: "cut", feedRate: 500, spindleRpm: 8000 });
    moves.push({ x: x0, y: cutY, z: z0, type: "cut", feedRate: 500, spindleRpm: 8000 });
  }

  moves.push({ x: pocketCx, y: stockY + 30, z: pocketCz, type: "rapid" });
  moves.push({ x: -10, y: stockY + 30, z: -10, type: "rapid" });

  return moves;
}

function computeCycleTime(moves: MillingMove[]): {
  cuttingTime: number;
  rapidTime: number;
  totalTime: number;
  cuttingDist: number;
  rapidDist: number;
} {
  const RAPID_RATE = 15000;
  let cuttingTime = 0;
  let rapidTime = 0;
  let cuttingDist = 0;
  let rapidDist = 0;

  for (let i = 1; i < moves.length; i++) {
    const dx = moves[i].x - moves[i - 1].x;
    const dy = moves[i].y - moves[i - 1].y;
    const dz = moves[i].z - moves[i - 1].z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (moves[i].type === "rapid") {
      rapidDist += dist;
      rapidTime += (dist / RAPID_RATE) * 60;
    } else {
      cuttingDist += dist;
      const feed = moves[i].feedRate || 500;
      cuttingTime += (dist / feed) * 60;
    }
  }

  return {
    cuttingTime,
    rapidTime,
    totalTime: cuttingTime + rapidTime,
    cuttingDist,
    rapidDist,
  };
}

function formatTime(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toFixed(0)}s`;
}

function DROPanel({
  currentMove, endIdx, totalMoves, progress, collisionResult,
}: {
  currentMove: MillingMove | null;
  endIdx: number;
  totalMoves: number;
  progress: number;
  collisionResult: MillingCollisionResult | null;
}) {
  const isRapid = currentMove?.type === "rapid";
  const isCollision = collisionResult?.hasCollision;

  return (
    <div className="absolute top-3 left-3 bg-black/70 border border-white/10 rounded-xl px-3.5 py-2.5
                    backdrop-blur-md text-[10px] font-mono space-y-1 min-w-[180px] select-none">
      <div className="text-[8px] uppercase tracking-widest text-blue-400/70 font-bold mb-1.5 flex items-center gap-1.5">
        <Gauge className="w-3 h-3" /> MILLING DRO
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div className="text-zinc-500">X</div>
        <div className="text-cyan-400 text-right tabular-nums">{currentMove?.x.toFixed(3) ?? "—"}</div>
        <div className="text-zinc-500">Y</div>
        <div className="text-cyan-400 text-right tabular-nums">{currentMove?.y.toFixed(3) ?? "—"}</div>
        <div className="text-zinc-500">Z</div>
        <div className="text-cyan-400 text-right tabular-nums">{currentMove?.z.toFixed(3) ?? "—"}</div>
      </div>

      <div className="border-t border-white/5 my-1" />

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div className="text-zinc-500">Feed</div>
        <div className="text-amber-400 text-right tabular-nums">{currentMove?.feedRate ? `${currentMove.feedRate} mm/min` : "—"}</div>
        <div className="text-zinc-500">RPM</div>
        <div className="text-amber-400 text-right tabular-nums">{currentMove?.spindleRpm || "—"}</div>
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
        <div className="text-white text-right">{Math.round(progress * 100)}%</div>
      </div>

      {isCollision && (
        <div className="mt-1.5 bg-red-900/60 border border-red-500/40 rounded px-2 py-1 text-[9px] text-red-300 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{collisionResult!.description.slice(0, 60)}</span>
        </div>
      )}
    </div>
  );
}

function SimResultsPanel({
  cycleData, operations, surfaceFinish, activeSetup,
}: {
  cycleData: { cuttingTime: number; rapidTime: number; totalTime: number; cuttingDist: number; rapidDist: number };
  operations: MillingOperation[];
  surfaceFinish: { ra: number; quality: string; label: string; color: string } | null;
  activeSetup: MachiningSetup | null;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="absolute top-3 right-3 bg-black/70 border border-white/10 rounded-xl
                    backdrop-blur-md w-[240px] max-h-[400px] overflow-hidden select-none">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-1.5 border-b border-white/5 text-[8px] uppercase tracking-widest
                   text-emerald-400/70 font-bold flex items-center gap-1.5 hover:bg-white/[0.03]"
      >
        <Activity className="w-3 h-3" /> SIMULATION RESULTS
        {expanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
      </button>

      {expanded && (
        <div className="px-3 py-2 space-y-2 overflow-y-auto max-h-[350px] text-[10px] font-mono">
          {activeSetup && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1">
              <span className="text-blue-300 font-bold">{activeSetup.name}</span>
              <span className="text-blue-400/60 ml-2">{activeSetup.workOffset}</span>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-zinc-500 text-[8px] uppercase tracking-wider">Cycle Time</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-zinc-400">Total</span>
              <span className="text-white text-right font-bold">{formatTime(cycleData.totalTime)}</span>
              <span className="text-zinc-400">Cutting</span>
              <span className="text-green-400 text-right">{formatTime(cycleData.cuttingTime)}</span>
              <span className="text-zinc-400">Rapid</span>
              <span className="text-yellow-400 text-right">{formatTime(cycleData.rapidTime)}</span>
            </div>
          </div>

          <div className="border-t border-white/5" />

          <div className="space-y-1">
            <div className="text-zinc-500 text-[8px] uppercase tracking-wider">Distances</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-zinc-400">Cutting</span>
              <span className="text-green-400 text-right">{cycleData.cuttingDist.toFixed(1)} mm</span>
              <span className="text-zinc-400">Rapid</span>
              <span className="text-yellow-400 text-right">{cycleData.rapidDist.toFixed(1)} mm</span>
            </div>
          </div>

          {surfaceFinish && (
            <>
              <div className="border-t border-white/5" />
              <div className="space-y-1">
                <div className="text-zinc-500 text-[8px] uppercase tracking-wider">Surface Finish</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: surfaceFinish.color }} />
                  <span className="text-zinc-300">{surfaceFinish.label}</span>
                </div>
              </div>
            </>
          )}

          {operations.length > 0 && (
            <>
              <div className="border-t border-white/5" />
              <div className="space-y-1">
                <div className="text-zinc-500 text-[8px] uppercase tracking-wider">Operations</div>
                {operations.map((op) => {
                  const opCycle = computeCycleTime(op.moves);
                  return (
                    <div key={op.id} className="bg-white/[0.03] rounded px-2 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-300 text-[9px]">{op.name}</span>
                        <span className="text-zinc-500 text-[8px]">{formatTime(opCycle.totalTime)}</span>
                      </div>
                      <div className="text-[8px] text-zinc-600">
                        {op.toolType} Ø{op.toolDiameter}mm · F{op.feedRate} · S{op.spindleRpm}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SurfaceFinishLegend() {
  return (
    <div className="absolute bottom-16 left-3 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5
                    backdrop-blur-sm select-none">
      <div className="text-[7px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Surface Finish (Ra)</div>
      {SURFACE_FINISH_LEGEND.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-[8px]">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          <span className="text-zinc-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function SetupPanel({
  setups, activeSetupId, onSelectSetup, onAddSetup, onRemoveSetup,
}: {
  setups: MachiningSetup[];
  activeSetupId: string;
  onSelectSetup: (id: string) => void;
  onAddSetup: () => void;
  onRemoveSetup: (id: string) => void;
}) {
  if (setups.length <= 1) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5
                    bg-black/70 border border-white/10 rounded-lg px-3 py-1.5
                    backdrop-blur-md text-[10px] select-none z-10">
      <Layers className="w-3 h-3 text-zinc-500" />
      {setups.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelectSetup(s.id)}
          className={`px-2 py-1 rounded text-[9px] font-medium transition-colors ${
            s.id === activeSetupId
              ? "bg-blue-500/20 border border-blue-500/30 text-blue-300"
              : "bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08]"
          }`}
        >
          {s.name}
          <span className="text-[7px] ml-1 text-zinc-600">{s.workOffset}</span>
        </button>
      ))}
      <button
        onClick={onAddSetup}
        className="p-1 rounded bg-white/[0.04] border border-white/[0.08] text-zinc-500 hover:text-white hover:bg-white/[0.08]"
        title="Add setup"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

const WORK_OFFSETS = ["G54", "G55", "G56", "G57", "G58", "G59"];

export function MillingSimulator3D(props: MillingSimulator3DProps) {
  const {
    stockSizeX = 100,
    stockSizeY = 30,
    stockSizeZ = 80,
  } = props;

  const [setups, setSetups] = useState<MachiningSetup[]>(() => {
    if (props.setups && props.setups.length > 0) return props.setups;

    const defaultOps: MillingOperation[] = props.operations || [];
    return [{
      id: "setup-1",
      name: "Setup 1",
      workOffset: "G54",
      originOffset: [0, 0, 0],
      rotation: [0, 0, 0],
      operations: defaultOps,
      fixtureZones: [],
    }];
  });

  const [activeSetupId, setActiveSetupId] = useState(setups[0]?.id || "setup-1");
  const activeSetup = setups.find((s) => s.id === activeSetupId) || setups[0];

  const stock: MillingStockGeometry = useMemo(() => ({
    sizeX: stockSizeX,
    sizeY: stockSizeY,
    sizeZ: stockSizeZ,
    originX: (activeSetup?.originOffset[0] || 0),
    originY: (activeSetup?.originOffset[1] || 0),
    originZ: (activeSetup?.originOffset[2] || 0),
  }), [stockSizeX, stockSizeY, stockSizeZ, activeSetup]);

  const allMoves = useMemo(() => {
    if (activeSetup?.operations.length) {
      return activeSetup.operations.flatMap((op) => op.moves);
    }
    return buildDemoMillingMoves(stockSizeX, stockSizeY, stockSizeZ);
  }, [activeSetup, stockSizeX, stockSizeY, stockSizeZ]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showToolpath, setShowToolpath] = useState(true);
  const [showMachine, setShowMachine] = useState(true);
  const [showFinish, setShowFinish] = useState(false);
  const [showEffects, setShowEffects] = useState(true);
  const [showImportedPart, setShowImportedPart] = useState(true);
  const [importedGeometry, setImportedGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [importedPartName, setImportedPartName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const endIdx = Math.min(Math.floor(progress * (allMoves.length - 1)), allMoves.length - 1);
  const currentMove = allMoves[endIdx] || null;

  const heightmap = useMemo(() => {
    const hm = createHeightmap(stock.originY + stock.sizeY);
    const currentToolType: MillingToolType = currentMove?.toolType || "end_mill";
    const toolR = 5;

    for (let i = 1; i <= endIdx && i < allMoves.length; i++) {
      const move = allMoves[i];
      if (move.type !== "cut") continue;

      const prev = allMoves[i - 1];
      const steps = Math.max(1, Math.ceil(
        Math.sqrt(
          (move.x - prev.x) ** 2 + (move.y - prev.y) ** 2 + (move.z - prev.z) ** 2
        ) / (toolR * 0.5)
      ));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const pos = interpolateMove(prev, move, t);
        applyToolCut(hm, HM_RESOLUTION, stock, pos, toolR, move.toolType || currentToolType);
      }
    }

    return hm;
  }, [allMoves, endIdx, stock]);

  const toolGeo: MillingToolGeometry = useMemo(() => {
    const firstCutOp = activeSetup?.operations[0];
    return {
      toolDiameter: firstCutOp?.toolDiameter || 10,
      fluteLength: 25,
      overallLength: 75,
      holderDiameter: 40,
      holderLength: 50,
      shankDiameter: firstCutOp?.toolDiameter || 10,
      toolType: firstCutOp?.toolType || "end_mill",
    };
  }, [activeSetup]);

  const collisionResult = useMemo(() => {
    if (!currentMove) return null;
    const prevMove = endIdx > 0 ? allMoves[endIdx - 1] : undefined;
    return checkMillingCollision(
      { x: currentMove.x, y: currentMove.y, z: currentMove.z },
      toolGeo,
      stock,
      heightmap,
      HM_RESOLUTION,
      activeSetup?.fixtureZones || [],
      currentMove.type === "rapid",
      prevMove ? { x: prevMove.x, y: prevMove.y, z: prevMove.z } : undefined
    );
  }, [currentMove, toolGeo, stock, heightmap, activeSetup, endIdx, allMoves]);

  const preFlightResults = useMemo(() => {
    return runMillingPreFlightCheck(
      allMoves.map((m) => ({ x: m.x, y: m.y, z: m.z, type: m.type })),
      toolGeo,
      stock,
      activeSetup?.fixtureZones || []
    );
  }, [allMoves, toolGeo, stock, activeSetup]);

  const cycleData = useMemo(() => computeCycleTime(allMoves), [allMoves]);

  const surfaceFinishParams: SurfaceFinishParams | null = useMemo(() => {
    const op = activeSetup?.operations[0];
    if (!op) return {
      feedRate: 800,
      spindleRpm: 8000,
      toolDiameter: 10,
      toolType: "end_mill" as const,
      stepover: 6,
      fluteCount: 4,
    };
    return {
      feedRate: op.feedRate,
      spindleRpm: op.spindleRpm,
      toolDiameter: op.toolDiameter,
      toolType: op.toolType,
      stepover: op.stepover,
      fluteCount: op.fluteCount,
    };
  }, [activeSetup]);

  const surfaceFinish = useMemo(
    () => surfaceFinishParams ? getSurfaceFinishResult(surfaceFinishParams) : null,
    [surfaceFinishParams]
  );

  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(animRef.current); return; }
    lastTimeRef.current = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      setProgress((prev) => {
        const next = prev + dt * 0.04 * speed;
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
    setProgress((prev) => Math.min(1, prev + 1 / Math.max(allMoves.length, 1)));
  };
  const stepBackward = () => {
    setIsPlaying(false);
    setProgress((prev) => Math.max(0, prev - 1 / Math.max(allMoves.length, 1)));
  };

  const handleSTEPImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    if (!isSTEPFile(file.name)) {
      setImportError("Please select a .step or .stp file");
      return;
    }

    try {
      const content = await readSTEPFileFromBlob(file);
      const result = parseSTEPFile(content);
      setImportedGeometry(result.geometry);
      setImportedPartName(result.name);
      setShowImportedPart(true);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import STEP file");
    }
  }, []);

  const handleAddSetup = useCallback(() => {
    const idx = setups.length + 1;
    const offset = WORK_OFFSETS[Math.min(idx - 1, WORK_OFFSETS.length - 1)];
    const newSetup: MachiningSetup = {
      id: `setup-${Date.now()}`,
      name: `Setup ${idx}`,
      workOffset: offset,
      originOffset: [0, 0, 0],
      rotation: idx % 2 === 0 ? [180, 0, 0] : [0, 0, 0],
      operations: [],
      fixtureZones: [],
    };
    setSetups((prev) => [...prev, newSetup]);
    setActiveSetupId(newSetup.id);
  }, [setups.length]);

  const handleRemoveSetup = useCallback((id: string) => {
    setSetups((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) return prev;
      return filtered;
    });
    if (activeSetupId === id) {
      setActiveSetupId(setups[0]?.id || "");
    }
  }, [activeSetupId, setups]);

  const critCount = preFlightResults.filter((r) => r.severity === "critical").length;
  const warnCount = preFlightResults.filter((r) => r.severity === "warning").length;

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full bg-[#06060f]">
      <div className="flex-1 relative min-h-0">
        <Canvas
          shadows
          camera={{
            position: [stockSizeX * 1.5, stockSizeY * 3, stockSizeZ * 1.5],
            fov: 45,
            near: 0.1,
            far: 50000,
          }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
          style={{ background: "radial-gradient(ellipse at 50% 30%, #0d1020 0%, #06060f 70%)" }}
        >
          <MillingScene
            stock={stock}
            heightmap={heightmap}
            allMoves={allMoves}
            endIdx={endIdx}
            showToolpath={showToolpath}
            showMachine={showMachine}
            showFinish={showFinish}
            surfaceFinishParams={surfaceFinishParams}
            toolGeo={toolGeo}
            fixtures={activeSetup?.fixtureZones || []}
            collisionResult={collisionResult}
            importedGeometry={importedGeometry}
            showImportedPart={showImportedPart}
            isPlaying={isPlaying}
            showEffects={showEffects}
          />
        </Canvas>

        <DROPanel
          currentMove={currentMove}
          endIdx={endIdx}
          totalMoves={allMoves.length}
          progress={progress}
          collisionResult={collisionResult}
        />

        <SimResultsPanel
          cycleData={cycleData}
          operations={activeSetup?.operations || []}
          surfaceFinish={surfaceFinish}
          activeSetup={activeSetup || null}
        />

        <SetupPanel
          setups={setups}
          activeSetupId={activeSetupId}
          onSelectSetup={setActiveSetupId}
          onAddSetup={handleAddSetup}
          onRemoveSetup={handleRemoveSetup}
        />

        {(critCount > 0 || warnCount > 0) && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-2
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

        {showFinish && <SurfaceFinishLegend />}

        <div className="absolute bottom-16 right-3 flex flex-col gap-1 select-none">
          <button onClick={() => setShowMachine((v) => !v)}
            className={`flex items-center gap-1.5 bg-black/50 border rounded px-2 py-1 text-[9px] backdrop-blur-sm transition-colors
              ${showMachine ? "border-emerald-500/30 text-emerald-400" : "border-white/10 text-zinc-500"}`}>
            <Box className="w-3 h-3" /> Machine
          </button>
          <button onClick={() => setShowToolpath((v) => !v)}
            className={`flex items-center gap-1.5 bg-black/50 border rounded px-2 py-1 text-[9px] backdrop-blur-sm transition-colors
              ${showToolpath ? "border-cyan-500/30 text-cyan-400" : "border-white/10 text-zinc-500"}`}>
            {showToolpath ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Toolpath
          </button>
          <button onClick={() => setShowFinish((v) => !v)}
            className={`flex items-center gap-1.5 bg-black/50 border rounded px-2 py-1 text-[9px] backdrop-blur-sm transition-colors
              ${showFinish ? "border-violet-500/30 text-violet-400" : "border-white/10 text-zinc-500"}`}>
            <Palette className="w-3 h-3" /> Finish
          </button>
          <button onClick={() => setShowEffects((v) => !v)}
            className={`flex items-center gap-1.5 bg-black/50 border rounded px-2 py-1 text-[9px] backdrop-blur-sm transition-colors
              ${showEffects ? "border-orange-500/30 text-orange-400" : "border-white/10 text-zinc-500"}`}>
            <Zap className="w-3 h-3" /> Effects
          </button>
          {importedGeometry && (
            <button onClick={() => setShowImportedPart((v) => !v)}
              className={`flex items-center gap-1.5 bg-black/50 border rounded px-2 py-1 text-[9px] backdrop-blur-sm transition-colors
                ${showImportedPart ? "border-teal-500/30 text-teal-400" : "border-white/10 text-zinc-500"}`}>
              <Layers className="w-3 h-3" /> CAD Part
            </button>
          )}
          <label className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded px-2 py-1 text-[9px]
                            text-zinc-400 hover:text-white hover:bg-white/[0.08] backdrop-blur-sm transition-colors cursor-pointer">
            <Upload className="w-3 h-3" /> Import STEP
            <input
              ref={fileInputRef}
              type="file"
              accept=".step,.stp"
              onChange={handleSTEPImport}
              className="hidden"
            />
          </label>
        </div>

        {importedPartName && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/60 border border-teal-500/20
                          rounded px-2 py-1 text-[9px] text-teal-400 backdrop-blur-sm select-none">
            CAD: {importedPartName}
          </div>
        )}

        {importError && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-500/30
                          rounded px-2 py-1 text-[9px] text-red-300 backdrop-blur-sm select-none">
            {importError}
          </div>
        )}
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
          onClick={() => { if (progress >= 1) handleReset(); setIsPlaying((p) => !p); }}
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
          className="flex-1 h-1.5 accent-blue-400 cursor-pointer"
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

        <div className="flex items-center gap-1 ml-1">
          <Clock className="w-3 h-3 text-zinc-600" />
          <span className="text-[10px] text-zinc-400 tabular-nums">{formatTime(cycleData.totalTime)}</span>
        </div>
      </div>
    </div>
  );
}

export default MillingSimulator3D;
