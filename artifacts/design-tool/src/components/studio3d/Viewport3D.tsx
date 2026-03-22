import React, { useRef, Suspense, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Line, Html } from "@react-three/drei";
import { EffectComposer, Bloom, SSAO, ToneMapping } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { use3DStudioStore } from "./use3DStudioStore";
import type { SceneObject } from "./use3DStudioStore";
import { getQualitySettings, isDedicatedGPU } from "../../lib/gpu-tier";
import {
  type EngineeringScale,
  ENGINEERING_SCALES,
  getScaleFactor,
  formatMM,
  getCameraPresets,
  type CameraPreset,
} from "../../lib/engineering-scale";
import {
  geometryToSTL,
  geometryToSTEP,
} from "./SolidModelingEngine";

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>;

function createPrimitiveGeometry(obj: SceneObject): THREE.BufferGeometry {
  switch (obj.type) {
    case "box":
    case "extrude":
      return new THREE.BoxGeometry(obj.scale[0], obj.scale[1], obj.scale[2]);
    case "cylinder":
      return new THREE.CylinderGeometry(0.5 * obj.scale[0], 0.5 * obj.scale[0], obj.scale[1], 32);
    case "sphere":
      return new THREE.SphereGeometry(0.5 * obj.scale[0], 32, 16);
    case "cone":
      return new THREE.ConeGeometry(0.5 * obj.scale[0], obj.scale[1], 32);
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

function SceneObjectMesh({ obj }: { obj: SceneObject }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectedObjectId, selectObject, secondarySelectionId, setSecondarySelection } = use3DStudioStore();
  const isSelected = selectedObjectId === obj.id;
  const isSecondary = secondarySelectionId === obj.id;

  useFrame(() => {
    if (meshRef.current && isSelected) {
    }
  });

  const color = obj.color;
  const emissive = isSelected ? "#2244aa" : isSecondary ? "#44aa22" : "#000000";

  const geometry = useMemo(() => {
    if (obj.customGeometry) {
      return obj.customGeometry;
    }
    return createPrimitiveGeometry(obj);
  }, [obj.customGeometry, obj.type, obj.scale[0], obj.scale[1], obj.scale[2]]);

  const handleClick = useCallback((e: THREE.Event & { stopPropagation: () => void }) => {
    e.stopPropagation();
    const native = (e as unknown as { nativeEvent?: MouseEvent }).nativeEvent;
    if (native && native.shiftKey) {
      setSecondarySelection(obj.id);
    } else {
      selectObject(obj.id);
    }
  }, [obj.id, selectObject, setSecondarySelection]);

  const hasCustomGeo = !!obj.customGeometry;

  return (
    <group position={hasCustomGeo ? [0, 0, 0] : obj.position} rotation={hasCustomGeo ? [0, 0, 0] : (obj.rotation as unknown as THREE.Euler)}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        castShadow
        receiveShadow
        geometry={geometry}
      >
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isSelected ? 0.3 : isSecondary ? 0.2 : 0}
          roughness={0.4}
          metalness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      {(isSelected || isSecondary) && (
        <>
          <mesh geometry={geometry}>
            <meshBasicMaterial
              color={isSelected ? "#4488ff" : "#44ff44"}
              wireframe
              transparent
              opacity={0.3}
            />
          </mesh>
          {isSelected && (
            <Html position={[0, (obj.scale[1] || 1) / 2 + 2, 0]} center>
              <div className="bg-blue-900/80 text-blue-200 text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap">
                {obj.type === "csg_result" || obj.type === "revolve" || obj.type === "sweep" || obj.type === "loft" || obj.type === "shell" || obj.type === "fillet" || obj.type === "chamfer"
                  ? `${obj.type}: ${obj.name}`
                  : `${formatMM(obj.scale[0])} × ${formatMM(obj.scale[1])} × ${formatMM(obj.scale[2])} mm`
                }
              </div>
            </Html>
          )}
          {isSecondary && (
            <Html position={[0, (obj.scale[1] || 1) / 2 + 2, 0]} center>
              <div className="bg-green-900/80 text-green-200 text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap">
                Secondary: {obj.name}
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}

function ToolpathLines({ objectId }: { objectId: string | null }) {
  const { objects, camSettings } = use3DStudioStore();
  const obj = objectId ? objects.find(o => o.id === objectId) : objects[0];
  if (!obj) return null;

  const sx = obj.scale[0];
  const sz = obj.scale[2];
  const cx = obj.position[0];
  const cz = obj.position[2];
  const depth = camSettings.cutDepth;
  const passes = Math.min(3, Math.ceil(camSettings.cutDepth / 1));

  const allPoints: [number, number, number][] = [];
  for (let p = 0; p < passes; p++) {
    const y = obj.position[1] - p * (depth / passes);
    allPoints.push([cx - sx / 2, y, cz - sz / 2]);
    allPoints.push([cx + sx / 2, y, cz - sz / 2]);
    allPoints.push([cx + sx / 2, y, cz + sz / 2]);
    allPoints.push([cx - sx / 2, y, cz + sz / 2]);
    allPoints.push([cx - sx / 2, y, cz - sz / 2]);
  }

  return (
    <Line points={allPoints} color="#ffaa00" lineWidth={2} />
  );
}

function MeasurementLine({ points }: { points: THREE.Vector3[] }) {
  if (points.length < 2) return null;
  const p1 = points[points.length - 2];
  const p2 = points[points.length - 1];
  const mid = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
  const dist = p1.distanceTo(p2);

  return (
    <group>
      <Line
        points={[[p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]]}
        color="#ff6b6b"
        lineWidth={2}
        dashed
        dashSize={2}
        gapSize={1}
      />
      <mesh position={[p1.x, p1.y, p1.z]}>
        <sphereGeometry args={[0.8, 8, 8]} />
        <meshBasicMaterial color="#ff6b6b" />
      </mesh>
      <mesh position={[p2.x, p2.y, p2.z]}>
        <sphereGeometry args={[0.8, 8, 8]} />
        <meshBasicMaterial color="#ff6b6b" />
      </mesh>
      <Html position={[mid.x, mid.y + 3, mid.z]} center>
        <div className="bg-red-900/90 text-red-200 text-[10px] font-mono font-bold px-2 py-1 rounded border border-red-700/50 whitespace-nowrap">
          {formatMM(dist)}mm
        </div>
      </Html>
    </group>
  );
}

function ScaleZoomApplier({
  scaleFactor,
  controlsRef,
}: {
  scaleFactor: number;
  controlsRef: React.RefObject<OrbitControlsRef | null>;
}) {
  const { camera } = useThree();
  const prevScaleRef = useRef(scaleFactor);

  useEffect(() => {
    if (prevScaleRef.current === scaleFactor) return;
    const ratio = prevScaleRef.current / scaleFactor;
    const controls = controlsRef.current;
    const target = controls && "target" in controls
      ? (controls.target as THREE.Vector3).clone()
      : new THREE.Vector3(0, 0, 0);
    const offset = camera.position.clone().sub(target);
    offset.multiplyScalar(ratio);
    camera.position.copy(target.clone().add(offset));
    if (controls && "update" in controls) {
      (controls as { update: () => void }).update();
    }
    prevScaleRef.current = scaleFactor;
  }, [scaleFactor, camera, controlsRef]);

  return null;
}

function CameraPresetsInScene({
  presets,
  controlsRef,
}: {
  presets: CameraPreset[];
  controlsRef: React.RefObject<OrbitControlsRef | null>;
}) {
  const { camera } = useThree();

  const setPreset = useCallback((preset: CameraPreset) => {
    camera.position.set(...preset.position);
    const controls = controlsRef.current;
    if (controls && "target" in controls && "update" in controls) {
      (controls.target as THREE.Vector3).set(...preset.target);
      (controls as { update: () => void }).update();
    }
  }, [camera, controlsRef]);

  return (
    <Html position={[0, 0, 0]} style={{ pointerEvents: "none" }} zIndexRange={[100, 0]}>
      <div style={{ position: "fixed", top: 8, right: 100, pointerEvents: "auto" }}>
        <div className="flex gap-1">
          {presets.map((p) => (
            <button key={p.key} onClick={() => setPreset(p)}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[9px] font-mono px-2 py-1 rounded border border-zinc-600/50"
              title={p.name}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </Html>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function PostProcessingEffects({ quality }: { quality: ReturnType<typeof getQualitySettings> }) {
  if (quality.tier === "low") return null;
  return (
    <EffectComposer multisampling={quality.tier === "ultra" ? 8 : 4}>
      <Bloom
        intensity={quality.tier === "ultra" ? 0.4 : 0.2}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      {quality.tier === "ultra" ? (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={32}
          radius={5}
          intensity={15}
        />
      ) : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

interface Viewport3DProps {
  showToolpath: boolean;
}

export function Viewport3D({ showToolpath }: Viewport3DProps) {
  const { objects, selectObject, selectedObjectId } = use3DStudioStore();
  const quality = useMemo(() => getQualitySettings(), []);
  const controlsRef = useRef<OrbitControlsRef | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [engineeringScale, setEngineeringScale] = useState<EngineeringScale>("1:1");
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);

  const scaleFactor = useMemo(() => getScaleFactor(engineeringScale), [engineeringScale]);

  const cameraPresets = useMemo(() => getCameraPresets(0, 0, 0, 60), []);

  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `studio3d-viewport-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    link.click();
  }, []);

  const handleExportSTL = useCallback(() => {
    const selected = objects.find((o) => o.id === selectedObjectId);
    const obj = selected || objects[0];
    if (!obj) return;

    let geo: THREE.BufferGeometry;
    if (obj.customGeometry) {
      geo = obj.customGeometry;
    } else {
      geo = createPrimitiveGeometry(obj);
    }

    const stl = geometryToSTL(geo, obj.name);
    downloadFile(stl, `${obj.name}.stl`, "application/sla");
  }, [objects, selectedObjectId]);

  const handleExportSTEP = useCallback(() => {
    const selected = objects.find((o) => o.id === selectedObjectId);
    const obj = selected || objects[0];
    if (!obj) return;

    let geo: THREE.BufferGeometry;
    if (obj.customGeometry) {
      geo = obj.customGeometry;
    } else {
      geo = createPrimitiveGeometry(obj);
    }

    const step = geometryToSTEP(geo, obj.name);
    downloadFile(step, `${obj.name}.step`, "application/step");
  }, [objects, selectedObjectId]);

  return (
    <div className="w-full h-full bg-[#0a0a16] relative">
      <Canvas
        ref={canvasRef}
        shadows={quality.enableShadows}
        camera={{ position: [60, 50, 80], fov: 50, near: 0.1, far: 10000 }}
        gl={{
          antialias: quality.antialias,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: isDedicatedGPU() ? 1.2 : 1.0,
          preserveDrawingBuffer: true,
          powerPreference: isDedicatedGPU() ? "high-performance" : "default",
          stencil: isDedicatedGPU(),
          depth: true,
          logarithmicDepthBuffer: isDedicatedGPU(),
        }}
        dpr={quality.pixelRatio}
        style={{ background: "#080812" }}
        onPointerMissed={() => selectObject(null)}
      >
        <color attach="background" args={["#080812"]} />
        <fog attach="fog" args={["#080812", 500, 3000]} />

        <ambientLight intensity={0.3} />
        <directionalLight
          position={[100, 150, 80]}
          intensity={1.2}
          castShadow={quality.enableShadows}
          shadow-mapSize-width={quality.shadowMapSize}
          shadow-mapSize-height={quality.shadowMapSize}
          shadow-camera-far={500}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />
        <pointLight position={[-50, 50, -50]} intensity={0.4} color="#4488ff" />
        {quality.maxLights >= 3 && <pointLight position={[50, 20, 50]} intensity={0.2} color="#ff8844" />}

        <Suspense fallback={null}>
          {objects.filter((obj) => obj.visible !== false).map((obj) => (
            <SceneObjectMesh key={obj.id} obj={obj} />
          ))}
          {showToolpath && <ToolpathLines objectId={selectedObjectId} />}
        </Suspense>

        {measurePoints.length >= 2 && <MeasurementLine points={measurePoints} />}

        <ScaleZoomApplier scaleFactor={scaleFactor} controlsRef={controlsRef} />
        <CameraPresetsInScene presets={cameraPresets} controlsRef={controlsRef} />

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
          onClick={measureMode ? (e) => {
            e.stopPropagation();
            setMeasurePoints(prev => prev.length >= 2 ? [e.point.clone()] : [...prev, e.point.clone()]);
          } : undefined}
        >
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

        <axesHelper args={[20]} />

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

        <PostProcessingEffects quality={quality} />
      </Canvas>

      <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 font-mono">Scale:</span>
            <select
              value={engineeringScale}
              onChange={(e) => setEngineeringScale(e.target.value as EngineeringScale)}
              className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-[10px] font-mono rounded px-1.5 py-0.5"
            >
              {ENGINEERING_SCALES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setMeasureMode(!measureMode); if (!measureMode) setMeasurePoints([]); }}
            className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
              measureMode ? "bg-red-500/20 border-red-500/30 text-red-300" : "bg-zinc-800/80 border-zinc-600/50 text-zinc-400"
            }`}
          >
            Measure
          </button>
          <button onClick={handleExportPNG}
            className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono px-2 py-1 rounded border border-zinc-600/50"
          >
            PNG
          </button>
          <button onClick={handleExportSTL}
            disabled={objects.length === 0}
            className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono px-2 py-1 rounded border border-zinc-600/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            STL
          </button>
          <button onClick={handleExportSTEP}
            disabled={objects.length === 0}
            title="Export STEP (approximate BREP representation)"
            className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono px-2 py-1 rounded border border-zinc-600/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            STEP
          </button>
        </div>
        <div className="text-[10px] text-zinc-600 font-mono bg-black/40 px-2 py-1 rounded pointer-events-none">
          {objects.length} object{objects.length !== 1 ? "s" : ""} · Scale: {engineeringScale} · 1 unit = 1mm · Quality: {quality.tier}
        </div>
        <div className="text-[10px] text-zinc-600 font-mono bg-black/40 px-2 py-1 rounded pointer-events-none">
          Orbit: LMB | Pan: RMB | Zoom: Scroll | Shift+Click: 2nd select{measureMode ? " | Click to measure" : ""} · Grid: 10mm/100mm
        </div>
        {measurePoints.length === 2 && (
          <div className="text-[10px] text-red-400 font-mono bg-black/60 px-2 py-1 rounded pointer-events-none">
            Distance: {formatMM(measurePoints[0].distanceTo(measurePoints[1]))}mm
          </div>
        )}
      </div>
    </div>
  );
}
