import React, { useRef, useMemo, useCallback, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { useAssemblyStore } from "../../store/useAssemblyStore";
import type { AssemblyPartInstance, InterferenceResult } from "../../store/useAssemblyStore";
import { getQualitySettings, isDedicatedGPU } from "../../lib/gpu-tier";

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>;

function PartMesh({
  part,
  isSelected,
  explosionOffset,
  sectionPlaneY,
  sectionEnabled,
}: {
  part: AssemblyPartInstance;
  isSelected: boolean;
  explosionOffset: [number, number, number];
  sectionPlaneY: number;
  sectionEnabled: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectPart, mateCreationMode, mateCreationStep, setMateCreationFace1, completeMateCreation } = useAssemblyStore();

  const position: [number, number, number] = [
    part.position[0] + explosionOffset[0],
    part.position[1] + explosionOffset[1],
    part.position[2] + explosionOffset[2],
  ];

  const { pendingMateValue } = useAssemblyStore();

  const handleClick = useCallback((e: THREE.Event & { stopPropagation: () => void; point: THREE.Vector3; face?: { normal: THREE.Vector3 } }) => {
    e.stopPropagation();
    if (mateCreationMode) {
      const faceNormal = e.face ? [e.face.normal.x, e.face.normal.y, e.face.normal.z] as [number, number, number] : [0, 1, 0] as [number, number, number];
      const localPoint: [number, number, number] = [
        e.point.x - part.position[0],
        e.point.y - part.position[1],
        e.point.z - part.position[2],
      ];
      const face = {
        partId: part.id,
        faceIndex: 0,
        point: localPoint,
        normal: faceNormal,
        axis: [0, 1, 0] as [number, number, number],
      };
      if (mateCreationStep === "select-face1") {
        setMateCreationFace1(face);
      } else if (mateCreationStep === "select-face2") {
        completeMateCreation(face, pendingMateValue);
      }
    } else {
      selectPart(part.id);
    }
  }, [part.id, mateCreationMode, mateCreationStep, selectPart, setMateCreationFace1, completeMateCreation, part.position, pendingMateValue]);

  const clippingPlanes = useMemo(() => {
    if (!sectionEnabled) return [];
    return [new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionPlaneY)];
  }, [sectionEnabled, sectionPlaneY]);

  const geometry = useMemo(() => {
    switch (part.primitiveType) {
      case "box": return <boxGeometry args={[part.scale[0], part.scale[1], part.scale[2]]} />;
      case "cylinder": return <cylinderGeometry args={[part.scale[0] / 2, part.scale[0] / 2, part.scale[1], 32]} />;
      case "sphere": return <sphereGeometry args={[part.scale[0] / 2, 32, 16]} />;
      case "cone": return <coneGeometry args={[part.scale[0] / 2, part.scale[1], 32]} />;
      default: return <boxGeometry args={[part.scale[0], part.scale[1], part.scale[2]]} />;
    }
  }, [part.primitiveType, part.scale]);

  return (
    <group position={position} rotation={part.rotation as unknown as THREE.Euler}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        castShadow
        receiveShadow
      >
        {geometry}
        <meshStandardMaterial
          color={part.color}
          emissive={isSelected ? "#2244aa" : "#000000"}
          emissiveIntensity={isSelected ? 0.4 : 0}
          roughness={0.35}
          metalness={0.5}
          transparent={part.locked ? true : false}
          opacity={part.locked ? 0.6 : 1}
          clippingPlanes={clippingPlanes}
          clipShadows
        />
      </mesh>
      {isSelected && (
        <>
          <mesh>
            {geometry}
            <meshBasicMaterial color="#4488ff" wireframe transparent opacity={0.25} />
          </mesh>
          <Html position={[0, part.scale[1] / 2 + 8, 0]} center>
            <div className="bg-blue-900/90 text-blue-200 text-[9px] font-mono px-2 py-1 rounded whitespace-nowrap border border-blue-700/50">
              {part.name} · {part.material}
            </div>
          </Html>
        </>
      )}
      {part.locked && (
        <Html position={[0, -part.scale[1] / 2 - 5, 0]} center>
          <div className="text-[8px] text-amber-400 font-bold">🔒</div>
        </Html>
      )}
    </group>
  );
}

function InterferenceHighlight({ interference, parts }: { interference: InterferenceResult; parts: AssemblyPartInstance[] }) {
  const p1 = parts.find(p => p.id === interference.partId1);
  const p2 = parts.find(p => p.id === interference.partId2);
  if (!p1 || !p2) return null;

  const size = Math.cbrt(interference.overlapVolume);

  return (
    <group position={interference.overlapCenter}>
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.35} />
      </mesh>
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshBasicMaterial color="#ff0000" wireframe />
      </mesh>
      <Html position={[0, size / 2 + 5, 0]} center>
        <div className="bg-red-900/90 text-red-200 text-[8px] font-mono px-1.5 py-0.5 rounded border border-red-600/50 whitespace-nowrap">
          ⚠ {interference.overlapVolume.toFixed(1)} mm³
        </div>
      </Html>
    </group>
  );
}

function SectionPlaneVisual({ y, enabled }: { y: number; enabled: boolean }) {
  if (!enabled) return null;
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial color="#22c55e" transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ExplosionLines({ parts, explosionOffsets }: { parts: AssemblyPartInstance[]; explosionOffsets: Map<string, [number, number, number]> }) {
  const lines: { from: [number, number, number]; to: [number, number, number] }[] = [];
  for (const part of parts) {
    const offset = explosionOffsets.get(part.id);
    if (!offset || (offset[0] === 0 && offset[1] === 0 && offset[2] === 0)) continue;
    lines.push({
      from: part.position,
      to: [
        part.position[0] + offset[0],
        part.position[1] + offset[1],
        part.position[2] + offset[2],
      ],
    });
  }
  return (
    <>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={[line.from, line.to]}
          color="#666666"
          lineWidth={1}
          dashed
          dashSize={5}
          gapSize={3}
        />
      ))}
    </>
  );
}

export function AssemblyViewport3D() {
  const {
    assembly,
    selectedPartId,
    viewMode,
    explosionDistance,
    sectionPlaneY,
    sectionPlaneEnabled,
    showInterference,
    interferences,
    selectPart,
  } = useAssemblyStore();

  const quality = useMemo(() => getQualitySettings(), []);
  const controlsRef = useRef<OrbitControlsRef | null>(null);

  const explosionOffsets = useMemo(() => {
    const offsets = new Map<string, [number, number, number]>();
    if (viewMode !== "exploded") {
      assembly.parts.forEach(p => offsets.set(p.id, [0, 0, 0]));
      return offsets;
    }
    const center: [number, number, number] = [0, 0, 0];
    if (assembly.parts.length > 0) {
      for (const p of assembly.parts) {
        center[0] += p.position[0];
        center[1] += p.position[1];
        center[2] += p.position[2];
      }
      center[0] /= assembly.parts.length;
      center[1] /= assembly.parts.length;
      center[2] /= assembly.parts.length;
    }
    for (const part of assembly.parts) {
      const dx = part.position[0] - center[0];
      const dy = part.position[1] - center[1];
      const dz = part.position[2] - center[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      offsets.set(part.id, [
        (dx / len) * explosionDistance,
        (dy / len) * explosionDistance,
        (dz / len) * explosionDistance,
      ]);
    }
    return offsets;
  }, [viewMode, explosionDistance, assembly.parts]);

  return (
    <div className="w-full h-full bg-[#0a0a16] relative">
      <Canvas
        shadows={quality.enableShadows}
        camera={{ position: [150, 120, 200], fov: 50, near: 0.1, far: 10000 }}
        gl={{
          antialias: quality.antialias,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: isDedicatedGPU() ? 1.2 : 1.0,
          localClippingEnabled: true,
          powerPreference: isDedicatedGPU() ? "high-performance" : "default",
          stencil: isDedicatedGPU(),
          depth: true,
          logarithmicDepthBuffer: isDedicatedGPU(),
        }}
        dpr={quality.pixelRatio}
        style={{ background: "#080812" }}
        onPointerMissed={() => selectPart(null)}
      >
        <color attach="background" args={["#080812"]} />
        <fog attach="fog" args={["#080812", 800, 4000]} />

        <ambientLight intensity={0.35} />
        <directionalLight
          position={[150, 200, 100]}
          intensity={1.2}
          castShadow={quality.enableShadows}
          shadow-mapSize-width={quality.shadowMapSize}
          shadow-mapSize-height={quality.shadowMapSize}
        />
        <pointLight position={[-80, 80, -80]} intensity={0.3} color="#4488ff" />

        {assembly.parts.map(part => (
          <PartMesh
            key={part.id}
            part={part}
            isSelected={selectedPartId === part.id}
            explosionOffset={explosionOffsets.get(part.id) || [0, 0, 0]}
            sectionPlaneY={sectionPlaneY}
            sectionEnabled={sectionPlaneEnabled && viewMode === "section"}
          />
        ))}

        {viewMode === "exploded" && (
          <ExplosionLines parts={assembly.parts} explosionOffsets={explosionOffsets} />
        )}

        <SectionPlaneVisual y={sectionPlaneY} enabled={sectionPlaneEnabled && viewMode === "section"} />

        {showInterference && interferences.map((inf, i) => (
          <InterferenceHighlight key={i} interference={inf} parts={assembly.parts} />
        ))}

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial color="#0d0d1a" roughness={1} metalness={0} />
        </mesh>

        <Grid
          args={[2000, 2000]}
          position={[0, 0.01, 0]}
          cellColor="#1a1a2e"
          sectionColor="#2a2a44"
          sectionSize={100}
          cellSize={10}
          fadeDistance={800}
          fadeStrength={1.5}
          infiniteGrid
        />

        <axesHelper args={[30]} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.05}
          panSpeed={0.8}
          zoomSpeed={1.2}
          rotateSpeed={0.7}
        />

        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport axisColors={["#ff4444", "#44ff44", "#4488ff"]} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      <div className="absolute bottom-3 left-3 text-[10px] text-zinc-600 font-mono bg-black/40 px-2 py-1 rounded pointer-events-none">
        {assembly.parts.length} part{assembly.parts.length !== 1 ? "s" : ""} · {assembly.mates.length} mate{assembly.mates.length !== 1 ? "s" : ""} · View: {viewMode}
        {viewMode === "exploded" && ` · Distance: ${explosionDistance}mm`}
        {showInterference && interferences.length > 0 && ` · ⚠ ${interferences.length} interference(s)`}
      </div>
    </div>
  );
}
