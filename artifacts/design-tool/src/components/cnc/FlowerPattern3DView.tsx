import React, { useRef, useEffect, useState } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Play, Pause, SkipBack, ChevronLeft, ChevronRight, Info, Layers, RotateCcw } from "lucide-react";
import * as THREE from "three";

const PALETTE = ["#22c55e", "#06b6d4", "#f59e0b", "#a78bfa", "#f87171", "#34d399", "#60a5fa", "#fbbf24", "#e879f9", "#4ade80"];

function hexToThree(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function buildStationCrossSection(
  station: ReturnType<typeof useCncStore.getState>["stations"][number],
  color: THREE.Color,
  zOffset: number,
  thickness: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.z = zOffset;

  const segs = station.segments;
  const pts2D: Array<{ x: number; y: number }> = [];

  if (segs.length === 0) {
    const halfW = 60;
    const depth = Math.min(40, Math.abs(station.totalAngle) * 20);
    pts2D.push(
      { x: -halfW, y: 0 },
      { x: -halfW / 3, y: depth },
      { x: halfW / 3, y: depth },
      { x: halfW, y: 0 },
    );
  } else {
    segs.forEach(seg => {
      pts2D.push({ x: seg.startX * 0.8, y: seg.startY * 0.8 });
    });
    const lastSeg = segs[segs.length - 1];
    pts2D.push({ x: lastSeg.endX * 0.8, y: lastSeg.endY * 0.8 });
  }

  const mat = new THREE.MeshPhongMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.15,
    shininess: 90,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });

  // ── 1. Solid extruded strip cross-section ─────────────────────────────────
  // Build inner (top) and outer (bottom) contours offset by material thickness
  if (pts2D.length >= 2) {
    const shape = new THREE.Shape();
    // Outer edge (centerline + thickness/2 offset normal)
    const outerPts: Array<{ x: number; y: number }> = [];
    const innerPts: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < pts2D.length; i++) {
      const prev = pts2D[i - 1] ?? pts2D[i];
      const next = pts2D[i + 1] ?? pts2D[i];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny =  dx / len;
      const halfT = thickness * 0.5;
      outerPts.push({ x: pts2D[i].x + nx * halfT, y: pts2D[i].y + ny * halfT });
      innerPts.push({ x: pts2D[i].x - nx * halfT, y: pts2D[i].y - ny * halfT });
    }

    // Shape: outer contour forward, inner contour backward (closed loop)
    shape.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i].x, outerPts[i].y);
    for (let i = innerPts.length - 1; i >= 0; i--) shape.lineTo(innerPts[i].x, innerPts[i].y);
    shape.closePath();

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness * 0.8,
      bevelEnabled: false,
    });
    const solidMesh = new THREE.Mesh(extrudeGeo, mat);
    group.add(solidMesh);
  }

  // ── 2. Centerline wire highlight ──────────────────────────────────────────
  const wireMat = new THREE.MeshPhongMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.4,
    shininess: 120,
  });

  const points3D = pts2D.map(p => new THREE.Vector3(p.x, p.y, 0));
  for (let i = 0; i < points3D.length - 1; i++) {
    const start = points3D[i];
    const end   = points3D[i + 1];
    const dir   = new THREE.Vector3().subVectors(end, start);
    const len   = dir.length();
    if (len < 0.01) continue;

    const geo  = new THREE.CylinderGeometry(thickness * 0.35, thickness * 0.35, len, 6);
    const mesh = new THREE.Mesh(geo, wireMat);
    mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    group.add(mesh);
  }

  return group;
}

export function FlowerPattern3DView() {
  const { stations, materialThickness } = useCncStore();
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: 0.4, phi: 0.5, r: 400 });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAll, setShowAll] = useState(true);

  // Three.js scene setup
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 700;
    const height = mount.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x070710, 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x070710, 500, 1200);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 2000);
    camera.position.set(0, 80, 400);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 1.2);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x6366f1, 2, 600);
    pointLight.position.set(-100, 100, 200);
    scene.add(pointLight);

    // Grid
    const gridHelper = new THREE.GridHelper(600, 20, 0x1e1e3a, 0x1e1e3a);
    gridHelper.position.y = -60;
    scene.add(gridHelper);

    // Animate
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Mouse events for orbit
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      cameraAngleRef.current.theta += dx * 0.01;
      cameraAngleRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2, cameraAngleRef.current.phi + dy * 0.01));
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      updateCamera();
    };
    const onMouseUp = () => { isDraggingRef.current = false; };
    const onWheel = (e: WheelEvent) => {
      cameraAngleRef.current.r = Math.max(100, Math.min(900, cameraAngleRef.current.r + e.deltaY * 0.5));
      updateCamera();
    };

    const updateCamera = () => {
      const { theta, phi, r } = cameraAngleRef.current;
      if (cameraRef.current) {
        cameraRef.current.position.set(
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.cos(theta),
        );
        cameraRef.current.lookAt(0, 0, 0);
      }
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel);

    const handleResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // Rebuild scene when stations/currentIdx/showAll change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove all existing cross-section groups
    const toRemove = scene.children.filter(c => c.userData["isStation"]);
    toRemove.forEach(c => { scene.remove(c); });

    if (stations.length === 0) return;

    const thickness = Math.max(1, materialThickness * 3);
    const spacing = 28;
    const totalWidth = (stations.length - 1) * spacing;

    const indicesToShow = showAll ? stations.map((_, i) => i) : [currentIdx];

    indicesToShow.forEach(i => {
      const st = stations[i];
      const color = hexToThree(PALETTE[i % PALETTE.length]);
      const zOffset = i * spacing - totalWidth / 2;
      const grp = buildStationCrossSection(st, color, zOffset, thickness);
      grp.userData["isStation"] = true;
      grp.userData["stationIdx"] = i;

      // Highlight current station
      if (i === currentIdx) {
        grp.scale.set(1.08, 1.08, 1.08);
      }

      scene.add(grp);
    });
  }, [stations, currentIdx, showAll, materialThickness]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying || stations.length === 0) return;
    const t = setInterval(() => {
      setCurrentIdx(i => (i + 1) % stations.length);
    }, 800);
    return () => clearInterval(t);
  }, [isPlaying, stations.length]);

  const currentStation = stations[currentIdx];
  const avgThinning = currentStation && currentStation.bendAngles.length > 0
    ? Math.abs(currentStation.totalAngle) / Math.max(1, currentStation.bendAngles.length) * 0.005
    : 0;
  const thinningPct = currentStation ? (avgThinning * 100).toFixed(1) : "—";
  const springback = currentStation ? (currentStation.springbackCompensationAngle ?? 0).toFixed(2) : "—";
  const passZone = currentStation?.passZone ?? "—";

  return (
    <div className="flex flex-col h-full bg-[#070710] overflow-hidden">
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
          <Layers className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">3D Flower Pattern Visualization</div>
          <div className="text-[10px] text-zinc-500">Three.js real-time — drag to orbit, scroll to zoom</div>
        </div>
        <button
          onClick={() => { cameraAngleRef.current = { theta: 0.4, phi: 0.5, r: 400 }; if (cameraRef.current) { cameraRef.current.position.set(200, 180, 300); cameraRef.current.lookAt(0, 0, 0); } }}
          className="px-2 py-1 text-[10px] rounded-md bg-white/[0.05] text-zinc-400 border border-white/[0.07] hover:bg-white/[0.1]"
          title="Reset camera"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
        <button
          onClick={() => setShowAll(v => !v)}
          className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${showAll ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-300" : "bg-white/[0.05] border-white/[0.07] text-zinc-400"}`}
        >
          {showAll ? "All Stations" : "Single"}
        </button>
      </div>

      {stations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Layers className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No stations — generate a flower pattern first</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Three.js mount */}
          <div ref={mountRef} className="flex-1 min-h-0" style={{ cursor: "grab" }} />

          {/* Station metrics bar */}
          <div className="flex-shrink-0 bg-[#0a0a18] border-t border-white/[0.05] px-4 py-2 flex items-center gap-4 flex-wrap">
            <div className="text-[10px] text-zinc-400">
              Station <span className="text-white font-bold">{currentIdx + 1}/{stations.length}</span>
              {currentStation && <span className="ml-2 text-indigo-300">{currentStation.label}</span>}
            </div>
            <div className="flex items-center gap-3 ml-auto text-[10px]">
              <span className="text-zinc-500">Zone:</span>
              <span className={`font-semibold ${passZone === "Calibration" ? "text-emerald-400" : passZone === "Major Forming" ? "text-amber-400" : "text-blue-400"}`}>{passZone}</span>
              <span className="text-zinc-500">Thinning:</span>
              <span className="font-mono text-rose-400">{thinningPct}%</span>
              <span className="text-zinc-500">Springback:</span>
              <span className="font-mono text-cyan-400">{springback}°</span>
              {currentStation && (
                <span className="text-zinc-500">Angle: <span className="text-white font-bold">{(currentStation.totalAngle * 180 / Math.PI).toFixed(1)}°</span></span>
              )}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex-shrink-0 bg-[#070710] border-t border-white/[0.05] px-4 py-2 flex items-center gap-2">
            <button onClick={() => setCurrentIdx(0)} className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors">
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsPlaying(v => !v)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors ${isPlaying ? "bg-amber-600/20 border border-amber-600/30 text-amber-300" : "bg-indigo-600/20 border border-indigo-600/30 text-indigo-300"}`}
            >
              {isPlaying ? <><Pause className="w-3 h-3" />Pause</> : <><Play className="w-3 h-3" />Play</>}
            </button>
            <button onClick={() => setCurrentIdx(i => Math.min(stations.length - 1, i + 1))} className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Station pills */}
            <div className="flex-1 flex items-center gap-1 overflow-x-auto ml-3">
              {stations.map((st, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors"
                  style={{
                    background: i === currentIdx ? PALETTE[i % PALETTE.length] + "30" : "rgba(255,255,255,0.04)",
                    color: i === currentIdx ? PALETTE[i % PALETTE.length] : "#52525b",
                    border: `1px solid ${i === currentIdx ? PALETTE[i % PALETTE.length] + "60" : "rgba(255,255,255,0.06)"}`,
                  }}
                  title={st.label}
                >
                  S{i + 1}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-2 text-[10px] text-zinc-500">
              <Info className="w-3 h-3" />
              <span>Three.js WebGL</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
