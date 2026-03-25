import { detectGpuTier, getGpuInfo, getQualitySettings, isDedicatedGPU, getEstimatedVRAM, type GpuInfo, type GpuTier } from "./gpu-tier";

export interface HardwareCapabilities {
  cpu: {
    cores: number;
    logicalProcessors: number;
    estimatedSpeed: "fast" | "medium" | "slow";
  };
  gpu: {
    renderer: string;
    vendor: string;
    tier: "ultra" | "high" | "medium" | "low";
    maxTextureSize: number;
    webgl2: boolean;
    webgpu: boolean;
    maxDrawBuffers: number;
    maxVertexAttribs: number;
    floatTextures: boolean;
    instancing: boolean;
    isDedicated: boolean;
    estimatedVRAM_GB: number;
    brand: string;
    model: string;
  };
  memory: {
    deviceMemoryGB: number;
    jsHeapLimitMB: number;
    jsHeapUsedMB: number;
    jsHeapTotalMB: number;
    availablePercent: number;
  };
  workers: {
    maxWorkers: number;
    activeWorkers: number;
    supportsSharedArrayBuffer: boolean;
    supportsOffscreenCanvas: boolean;
    supportsTransferable: boolean;
  };
  performance: {
    connectionType: string;
    saveData: boolean;
    hardwareConcurrency: number;
    touchDevice: boolean;
    pixelRatio: number;
  };
  recommended: {
    workerPoolSize: number;
    meshDensity: number;
    maxTriangles: number;
    useOffscreen: boolean;
    batchSize: number;
    simulationQuality: "ultra" | "high" | "medium" | "low";
  };
}

interface WorkerTask {
  id: string;
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

let cachedCapabilities: HardwareCapabilities | null = null;
let workerPool: Worker[] = [];
let workerBusy: boolean[] = [];
let taskQueue: WorkerTask[] = [];
let activeWorkerCount = 0;
let totalTasksProcessed = 0;
let totalComputeTimeMs = 0;

const WORKER_CODE = `
const GAUSS_5 = [
  { z: -0.9061798, w: 0.2369269 },
  { z: -0.5384693, w: 0.4786287 },
  { z:  0.0000000, w: 0.5688889 },
  { z:  0.5384693, w: 0.4786287 },
  { z:  0.9061798, w: 0.2369269 },
];

const HARDENING = {
  GI: { K: 500, n: 0.20 }, CR: { K: 550, n: 0.22 }, HR: { K: 480, n: 0.18 },
  SS: { K: 1300, n: 0.45 }, AL: { K: 350, n: 0.23 }, MS: { K: 490, n: 0.19 },
  CU: { K: 320, n: 0.34 }, TI: { K: 1400, n: 0.14 }, HSLA: { K: 800, n: 0.12 },
  PP: { K: 60, n: 0.10 }, DP600: { K: 1000, n: 0.17 }, DP780: { K: 1200, n: 0.14 },
  TRIP780: { K: 1100, n: 0.22 }, DUPLEX: { K: 900, n: 0.30 }, INCONEL: { K: 1500, n: 0.40 },
  BRASS: { K: 530, n: 0.35 }, SPRING: { K: 1600, n: 0.08 }, NI200: { K: 600, n: 0.38 },
};

/**
 * FIX: MAT_PROPS corrections (DIN 6935 / ASTM):
 * - CR/HR yield strengths were SWAPPED (CR:250 should be 340, HR:350 should be 250) — CRITICAL
 * - AL yield 110→270 MPa (5052-H32 design value), kf 0.38→0.43
 * - TI kf 0.52→0.50, E 116→115 GPa
 * - CU kf 0.40→0.44
 * - PP ys 35/E 1500 (polypropylene) → 280/200000 (pre-painted steel in roll forming context)
 * - HSLA kf 0.50→0.45 (consistent with deep-accuracy-engine.ts)
 */
const MAT_PROPS = {
  GI:     { ys: 280, E: 200000, kf: 0.44, nu: 0.30 },
  CR:     { ys: 340, E: 200000, kf: 0.44, nu: 0.30 },  // FIX: was 250 (swapped with HR)
  HR:     { ys: 250, E: 200000, kf: 0.42, nu: 0.30 },  // FIX: was 350 (swapped with CR), kf 0.48→0.42
  SS:     { ys: 520, E: 193000, kf: 0.50, nu: 0.28 },
  AL:     { ys: 270, E: 69000,  kf: 0.43, nu: 0.33 },  // FIX: yield 110→270, kf 0.38→0.43
  MS:     { ys: 250, E: 200000, kf: 0.42, nu: 0.30 },
  CU:     { ys: 200, E: 117000, kf: 0.44, nu: 0.34 },  // FIX: kf 0.40→0.44
  TI:     { ys: 880, E: 115000, kf: 0.50, nu: 0.34 },  // FIX: kf 0.52→0.50, E 116→115
  PP:     { ys: 280, E: 200000, kf: 0.44, nu: 0.30 },  // FIX: PP=pre-painted steel, not polypropylene
  HSLA:   { ys: 550, E: 205000, kf: 0.45, nu: 0.30 },  // FIX: kf 0.50→0.45, E+5 GPa
  DP600:  { ys: 380, E: 210000, kf: 0.33, nu: 0.30 },
  DP780: { ys: 500, E: 210000, kf: 0.31, nu: 0.30 },
  TRIP780: { ys: 500, E: 210000, kf: 0.32, nu: 0.30 },
  DUPLEX: { ys: 500, E: 200000, kf: 0.38, nu: 0.30 },
  INCONEL: { ys: 500, E: 205000, kf: 0.34, nu: 0.31 },
  BRASS: { ys: 150, E: 110000, kf: 0.44, nu: 0.34 },
  SPRING: { ys: 1200, E: 210000, kf: 0.28, nu: 0.29 },
  NI200: { ys: 150, E: 207000, kf: 0.40, nu: 0.31 },
};

const MAT_SB = {
  GI: { r: 0.03, rv: 1.2, nv: 0.20 },
  CR: { r: 0.025, rv: 1.0, nv: 0.22 },
  HR: { r: 0.04, rv: 0.9, nv: 0.18 },
  SS: { r: 0.06, rv: 1.0, nv: 0.45 },
  AL: { r: 0.035, rv: 0.7, nv: 0.30 },
  MS: { r: 0.03, rv: 1.1, nv: 0.20 },
  CU: { r: 0.02, rv: 0.8, nv: 0.35 },
  TI: { r: 0.08, rv: 1.5, nv: 0.10 },
  PP: { r: 0.15, rv: 0.5, nv: 0.40 },
  HSLA: { r: 0.055, rv: 1.3, nv: 0.15 },
  DP600: { r: 0.065, rv: 0.9, nv: 0.17 },
  DP780: { r: 0.08, rv: 0.85, nv: 0.14 },
  TRIP780: { r: 0.07, rv: 0.95, nv: 0.22 },
  DUPLEX: { r: 0.065, rv: 1.1, nv: 0.30 },
  INCONEL: { r: 0.09, rv: 1.2, nv: 0.40 },
  BRASS: { r: 0.02, rv: 0.8, nv: 0.35 },
  SPRING: { r: 0.12, rv: 1.6, nv: 0.08 },
  NI200: { r: 0.04, rv: 0.9, nv: 0.38 },
};

function computeStressStrain(bd, mat, hardening, thickness, formingProgress, nu, layerFrac, bendZoneRadius) {
  const inBendZone = bd.dist < bendZoneRadius;
  const proximity = inBendZone ? Math.max(0, 1 - bd.dist / bendZoneRadius) : 0;
  const R_inner = Math.max(bd.R, 0.5);
  const angleDeg = Math.abs(bd.angle);
  const angleRad = (angleDeg * Math.PI) / 180;
  if (!inBendZone || angleDeg < 0.01) {
    return { strain: 0.0005 * formingProgress, stress: 0.0005 * formingProgress * mat.E / mat.ys, thickness: thickness, thinning: 0 };
  }
  const kappa = 1 / (R_inner + thickness / 2);
  const zLayer = (layerFrac - 0.5) * thickness;
  let iVM = 0, iStr = 0, iThin = 0;
  for (const gp of GAUSS_5) {
    const zG = (gp.z * thickness) / 2;
    const lw = 1.0 - 0.5 * Math.abs(zG - zLayer) / (thickness / 2);
    const exx = kappa * zG * (angleRad / (Math.PI / 2)) * proximity * formingProgress;
    const eyy = -nu * exx;
    const ezz = -(exx + eyy);
    const eEff = (2 / 3) * Math.sqrt((exx - eyy) ** 2 + (eyy - ezz) ** 2 + (ezz - exx) ** 2) * Math.SQRT2 / 2;
    const sf = hardening.K * Math.pow(Math.max(eEff, 1e-12), hardening.n);
    const yielded = sf >= mat.ys;
    const sigma = yielded ? sf : mat.E * Math.abs(exx);
    const sxx = Math.sign(exx) * sigma;
    const syy = nu * sxx;
    const vm = Math.sqrt(sxx ** 2 - sxx * syy + syy ** 2);
    iVM += vm * gp.w * lw;
    iStr += Math.abs(eEff) * gp.w * lw;
    iThin += Math.abs(ezz) * gp.w * lw;
  }
  const tw = GAUSS_5.reduce((s, gp) => s + gp.w, 0);
  const avgVM = iVM / tw;
  const avgStr = iStr / tw;
  const avgThin = iThin / tw;
  const thinRatio = Math.max(0.7, 1 - avgThin);
  return { strain: avgStr, stress: Math.min(avgVM / mat.ys, 1.8), thickness: thickness * thinRatio, thinning: 1 - thinRatio };
}

function generateMeshWorker(data) {
  const { station, bendPoints, materialType, thickness, totalStations, stationIdx, meshDensity } = data;
  if (!station || !station.segments) return { triangles: [], points: [] };
  const mat = MAT_PROPS[materialType] || MAT_PROPS.GI;
  const hardening = HARDENING[materialType] || HARDENING.GI;
  const safeT = Math.max(thickness, 0.1);
  const nu = mat.nu;
  const formingProgress = (stationIdx + 1) / totalStations;
  const triangles = [];
  const points = [];
  const segs = station.segments;
  const bendAngles = station.bendAngles || [];
  const bendZoneRadius = Math.max(safeT * 4, 8);
  const halfT = safeT * 2.5;
  const density = meshDensity || 6;
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si];
    const dx = seg.endX - seg.startX;
    const dy = seg.endY - seg.startY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 0; i < density; i++) {
      const t0 = i / density;
      const t1 = (i + 1) / density;
      const x0 = seg.startX + t0 * dx;
      const y0 = seg.startY + t0 * dy;
      const x1 = seg.startX + t1 * dx;
      const y1 = seg.startY + t1 * dy;
      const closestBend = (px, py) => {
        let best = { dist: Infinity, R: safeT * 2, angle: 0 };
        if (bendPoints) {
          for (let bi = 0; bi < bendPoints.length; bi++) {
            const bp = bendPoints[bi];
            const d = Math.hypot(bp.x - px, bp.y - py);
            if (d < best.dist) best = { dist: d, R: Math.max(bp.radius || safeT * 2, 0.5), angle: bendAngles[bi] || 0 };
          }
        }
        return best;
      };
      const b0 = closestBend(x0, y0);
      const b1 = closestBend(x1, y1);
      const o0 = computeStressStrain(b0, mat, hardening, safeT, formingProgress, nu, 1.0, bendZoneRadius);
      const o1 = computeStressStrain(b1, mat, hardening, safeT, formingProgress, nu, 1.0, bendZoneRadius);
      const i0 = computeStressStrain(b0, mat, hardening, safeT, formingProgress, nu, 0.0, bendZoneRadius);
      const i1 = computeStressStrain(b1, mat, hardening, safeT, formingProgress, nu, 0.0, bendZoneRadius);
      triangles.push(
        { x1: x0 + nx * halfT, y1: y0 + ny * halfT, x2: x1 + nx * halfT, y2: y1 + ny * halfT, x3: x1 - nx * halfT, y3: y1 - ny * halfT, stress: (o0.stress + o1.stress) / 2, strain: (o0.strain + o1.strain) / 2, thinning: (o0.thinning + o1.thinning) / 2 },
        { x1: x0 + nx * halfT, y1: y0 + ny * halfT, x2: x1 - nx * halfT, y2: y1 - ny * halfT, x3: x0 - nx * halfT, y3: y0 - ny * halfT, stress: (i0.stress + i1.stress) / 2, strain: (i0.strain + i1.strain) / 2, thinning: (i0.thinning + i1.thinning) / 2 }
      );
      const mid = computeStressStrain(b0.dist < b1.dist ? b0 : b1, mat, hardening, safeT, formingProgress, nu, 0.5, bendZoneRadius);
      points.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, vonMises: mid.stress, strainX: mid.strain, strainY: mid.strain * nu, thickness: mid.thickness });
    }
  }
  return { triangles, points };
}

function computeSpringbackWorker(data) {
  const { stations, materialType, thickness, bendRadius } = data;
  const mat = MAT_SB[materialType] || MAT_SB.GI;
  return stations.map((st, idx) => {
    const maxAngle = Math.max(...(st.bendAngles && st.bendAngles.length ? st.bendAngles : [0]));
    const rOverT = bendRadius / Math.max(thickness, 0.1);
    const effectiveRatio = mat.r * (1 + (rOverT - 2) * 0.01) * (1 + (1 - thickness) * 0.05) * (1 + (mat.rv - 1) * 0.02) * (1 - mat.nv * 0.1);
    const springbackAngle = maxAngle * effectiveRatio;
    return { stationNumber: idx + 1, originalAngle: maxAngle, springbackAngle, compensatedAngle: maxAngle + springbackAngle, springbackRatio: effectiveRatio };
  });
}

function computeFormingForceWorker(data) {
  const { segments, materialType, thickness, rollDiameter } = data;
  const mat = MAT_PROPS[materialType] || MAT_PROPS.GI;
  const safeT = Math.max(thickness, 0.1);
  const totalWidth = segments.reduce((sum, seg) => sum + Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY), 0);
  const R = (rollDiameter || 150) / 2;
  const mu = 0.12;
  const contactArc = Math.sqrt(R * safeT * 0.01);
  const force = (mat.ys * safeT * safeT * totalWidth) / (2 * Math.max(R, 1)) * (1 + mu * contactArc / safeT);
  const torque = force * R / 1000;
  const power = (force * 2 * Math.PI * R * 0.001) / 60;
  return { formingForceN: force, torqueNm: torque, powerKW: power, totalWidthMm: totalWidth, contactArcMm: contactArc, frictionCoeff: mu };
}

function computeBatchStressWorker(data) {
  const { stationIndices, stations, bendPoints, materialType, thickness, totalStations, meshDensity } = data;
  const results = {};
  for (const idx of stationIndices) {
    results[idx] = generateMeshWorker({ station: stations[idx], bendPoints, materialType, thickness, totalStations, stationIdx: idx, meshDensity });
  }
  return results;
}

self.onmessage = function(e) {
  const { id, type, data } = e.data;
  const start = performance.now();
  let result;
  try {
    switch (type) {
      case "mesh": result = generateMeshWorker(data); break;
      case "springback": result = computeSpringbackWorker(data); break;
      case "forming-force": result = computeFormingForceWorker(data); break;
      case "batch-stress": result = computeBatchStressWorker(data); break;
      default: throw new Error("Unknown task: " + type);
    }
    self.postMessage({ id, type: "result", data: result, computeTimeMs: performance.now() - start });
  } catch (err) {
    self.postMessage({ id, type: "error", error: err.message || String(err) });
  }
};
`;

function detectHardware(): HardwareCapabilities {
  if (cachedCapabilities) return cachedCapabilities;

  const cores = navigator.hardwareConcurrency || 4;
  const logicalProcessors = cores;
  const estimatedSpeed: "fast" | "medium" | "slow" = cores >= 8 ? "fast" : cores >= 4 ? "medium" : "slow";

  const gpuInfo = getGpuInfo();
  const gpuTier = detectGpuTier();
  const qualitySettings = getQualitySettings();
  const dedicated = isDedicatedGPU();
  const vram = getEstimatedVRAM();

  let maxDrawBuffers = 4;
  let maxVertexAttribs = 16;
  let floatTextures = false;
  let instancing = false;

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (gl) {
      maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);
      maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
      floatTextures = !!gl.getExtension("EXT_color_buffer_float");
      instancing = true;
    }
    canvas.remove();
  } catch {}

  const deviceMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  const perfMem = (performance as unknown as { memory?: { jsHeapSizeLimit: number; usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
  const jsHeapLimitMB = perfMem ? Math.round(perfMem.jsHeapSizeLimit / 1048576) : 2048;
  const jsHeapUsedMB = perfMem ? Math.round(perfMem.usedJSHeapSize / 1048576) : 0;
  const jsHeapTotalMB = perfMem ? Math.round(perfMem.totalJSHeapSize / 1048576) : 0;
  const availablePercent = jsHeapLimitMB > 0 ? Math.round((1 - jsHeapUsedMB / jsHeapLimitMB) * 100) : 80;

  const supportsSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  const supportsOffscreenCanvas = typeof OffscreenCanvas !== "undefined";
  const supportsTransferable = typeof MessageChannel !== "undefined";

  // Use ALL logical cores — leave 1 for the main UI thread
  const optimalPoolSize = Math.max(1, cores - 1);

  const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  const connectionType = conn?.effectiveType || "unknown";
  const saveData = conn?.saveData || false;

  let simulationQuality: "ultra" | "high" | "medium" | "low";
  if (dedicated && vram >= 4) {
    simulationQuality = "ultra";
  } else if (gpuTier === "ultra" || (gpuTier === "high" && cores >= 6 && deviceMem >= 8)) {
    simulationQuality = "ultra";
  } else if (gpuTier !== "low" && cores >= 4 && deviceMem >= 4) {
    simulationQuality = "high";
  } else if (cores >= 2 && deviceMem >= 2) {
    simulationQuality = "medium";
  } else {
    simulationQuality = "low";
  }

  const meshDensityBase = { ultra: 16, high: 10, medium: 6, low: 4 };
  const maxTriBase = { ultra: 200000, high: 100000, medium: 30000, low: 8000 };
  const batchBase = { ultra: 8, high: 6, medium: 2, low: 1 };

  let meshDensity = meshDensityBase[simulationQuality];
  let maxTriangles = maxTriBase[simulationQuality];
  let batchSize = batchBase[simulationQuality];

  if (dedicated && vram >= 4) {
    meshDensity = Math.max(meshDensity, 14);
    maxTriangles = Math.max(maxTriangles, 150000);
    batchSize = Math.max(batchSize, 6);
  }
  if (dedicated && vram >= 6) {
    meshDensity = Math.max(meshDensity, 18);
    maxTriangles = Math.max(maxTriangles, 200000);
    batchSize = Math.max(batchSize, 8);
  }

  cachedCapabilities = {
    cpu: { cores, logicalProcessors, estimatedSpeed },
    gpu: {
      renderer: gpuInfo.renderer, vendor: gpuInfo.vendor, tier: gpuTier,
      maxTextureSize: gpuInfo.maxTextureSize, webgl2: gpuInfo.webgl2, webgpu: gpuInfo.webgpu,
      maxDrawBuffers, maxVertexAttribs, floatTextures, instancing,
      isDedicated: dedicated, estimatedVRAM_GB: vram,
      brand: gpuInfo.brand, model: gpuInfo.model,
    },
    memory: { deviceMemoryGB: deviceMem, jsHeapLimitMB, jsHeapUsedMB, jsHeapTotalMB, availablePercent },
    workers: { maxWorkers: optimalPoolSize, activeWorkers: 0, supportsSharedArrayBuffer, supportsOffscreenCanvas, supportsTransferable },
    performance: { connectionType, saveData, hardwareConcurrency: cores, touchDevice: "ontouchstart" in window, pixelRatio: window.devicePixelRatio || 1 },
    recommended: {
      workerPoolSize: optimalPoolSize,
      meshDensity,
      maxTriangles,
      useOffscreen: supportsOffscreenCanvas,
      batchSize,
      simulationQuality,
    },
  };

  console.log(`[Hardware] GPU: ${gpuInfo.renderer} | ${dedicated ? "DEDICATED" : "Integrated"} | ~${vram}GB VRAM | Tier: ${gpuTier} | Quality: ${simulationQuality} | Mesh: ${meshDensity} | MaxTri: ${maxTriangles}`);

  return cachedCapabilities;
}

function initWorkerPool(size: number): void {
  terminateWorkerPool();
  const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);

  for (let i = 0; i < size; i++) {
    const w = new Worker(url);
    w.onmessage = (e) => handleWorkerMessage(i, e);
    w.onerror = (err) => {
      console.error(`[HW Worker ${i}] Error:`, err);
      workerBusy[i] = false;
      activeWorkerCount = Math.max(0, activeWorkerCount - 1);
      const taskId = workerTaskMap.get(i);
      if (taskId) {
        workerTaskMap.delete(i);
        const taskIdx = taskQueue.findIndex(t => t.id === taskId);
        if (taskIdx >= 0) {
          const task = taskQueue.splice(taskIdx, 1)[0];
          task.reject(new Error("Worker error: " + (err.message || "Unknown")));
        }
      }
      processQueue();
    };
    workerPool.push(w);
    workerBusy.push(false);
  }
  URL.revokeObjectURL(url);
}

const workerTaskMap: Map<number, string> = new Map();

function handleWorkerMessage(workerIdx: number, e: MessageEvent): void {
  const { id, type, data, error, computeTimeMs } = e.data;
  workerBusy[workerIdx] = false;
  activeWorkerCount = Math.max(0, activeWorkerCount - 1);
  workerTaskMap.delete(workerIdx);

  const taskIdx = taskQueue.findIndex(t => t.id === id);
  if (taskIdx >= 0) {
    const task = taskQueue.splice(taskIdx, 1)[0];
    if (type === "result") {
      totalTasksProcessed++;
      totalComputeTimeMs += computeTimeMs || 0;
      task.resolve(data);
    } else {
      task.reject(new Error(error || "Worker computation failed"));
    }
  }
  processQueue();
}

function processQueue(): void {
  for (let i = 0; i < workerPool.length; i++) {
    if (!workerBusy[i] && taskQueue.length > 0) {
      const pending = taskQueue.find(t => !(t as unknown as { sent?: boolean }).sent);
      if (pending) {
        (pending as unknown as { sent: boolean }).sent = true;
        workerBusy[i] = true;
        activeWorkerCount++;
        workerTaskMap.set(i, pending.id);
        workerPool[i].postMessage({ id: pending.id, type: pending.type, data: pending.payload });
      }
    }
  }
}

function terminateWorkerPool(): void {
  workerPool.forEach(w => w.terminate());
  workerPool = [];
  workerBusy = [];
  activeWorkerCount = 0;
  workerTaskMap.clear();
  for (const task of taskQueue) {
    task.reject(new Error("Worker pool terminated"));
  }
  taskQueue = [];
}

let taskIdCounter = 0;

function submitTask(type: string, payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = `hw-${++taskIdCounter}-${Date.now()}`;
    taskQueue.push({ id, type, payload, resolve, reject });
    processQueue();
  });
}

export function getHardwareCapabilities(): HardwareCapabilities {
  return detectHardware();
}

export function ensureWorkerPool(): void {
  if (workerPool.length === 0) {
    const hw = detectHardware();
    initWorkerPool(hw.recommended.workerPoolSize);
  }
}

export function getWorkerStats(): { poolSize: number; active: number; queued: number; totalProcessed: number; avgComputeMs: number } {
  return {
    poolSize: workerPool.length,
    active: activeWorkerCount,
    queued: taskQueue.filter(t => !(t as unknown as { sent?: boolean }).sent).length,
    totalProcessed: totalTasksProcessed,
    avgComputeMs: totalTasksProcessed > 0 ? Math.round(totalComputeTimeMs / totalTasksProcessed) : 0,
  };
}

export async function computeMeshOnWorker(
  station: unknown,
  bendPoints: unknown[],
  materialType: string,
  thickness: number,
  totalStations: number,
  stationIdx: number,
  meshDensity: number,
): Promise<{ triangles: unknown[]; points: unknown[] }> {
  ensureWorkerPool();
  return submitTask("mesh", { station, bendPoints, materialType, thickness, totalStations, stationIdx, meshDensity }) as Promise<{ triangles: unknown[]; points: unknown[] }>;
}

export async function computeSpringbackOnWorker(
  stations: unknown[],
  materialType: string,
  thickness: number,
  bendRadius: number,
): Promise<unknown[]> {
  ensureWorkerPool();
  return submitTask("springback", { stations, materialType, thickness, bendRadius }) as Promise<unknown[]>;
}

export async function computeFormingForceOnWorker(
  segments: unknown[],
  materialType: string,
  thickness: number,
  rollDiameter: number,
): Promise<unknown> {
  ensureWorkerPool();
  return submitTask("forming-force", { segments, materialType, thickness, rollDiameter }) as Promise<unknown>;
}

export async function computeBatchStressOnWorker(
  stationIndices: number[],
  stations: unknown[],
  bendPoints: unknown[],
  materialType: string,
  thickness: number,
  totalStations: number,
  meshDensity: number,
): Promise<Record<number, { triangles: unknown[]; points: unknown[] }>> {
  ensureWorkerPool();
  return submitTask("batch-stress", { stationIndices, stations, bendPoints, materialType, thickness, totalStations, meshDensity }) as Promise<Record<number, { triangles: unknown[]; points: unknown[] }>>;
}

export function destroyWorkerPool(): void {
  terminateWorkerPool();
  taskQueue = [];
}

export function getMemorySnapshot(): { usedMB: number; totalMB: number; limitMB: number; percent: number } {
  const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!perfMem) return { usedMB: 0, totalMB: 0, limitMB: 0, percent: 0 };
  return {
    usedMB: Math.round(perfMem.usedJSHeapSize / 1048576),
    totalMB: Math.round(perfMem.totalJSHeapSize / 1048576),
    limitMB: Math.round(perfMem.jsHeapSizeLimit / 1048576),
    percent: Math.round((perfMem.usedJSHeapSize / perfMem.jsHeapSizeLimit) * 100),
  };
}

/**
 * Returns optimal Three.js <Canvas> props based on detected hardware.
 * Uses full native DPR — no cap — to maximally utilise the GPU.
 */
export function getCanvasProps(): {
  dpr: number;
  shadows: "soft" | "basic" | false;
  shadowMapSize: number;
  powerPreference: "high-performance" | "default";
  toneMappingExposure: number;
} {
  const hw = cachedCapabilities;
  const dedicated = hw?.gpu.isDedicated ?? false;
  const tier = hw?.gpu.tier ?? "medium";
  const dpr = window.devicePixelRatio ?? 1;

  const shadowMapSize = tier === "ultra" ? 4096 : tier === "high" ? 2048 : 1024;
  const shadows: "soft" | "basic" | false = tier === "low" ? "basic" : "soft";

  return {
    dpr,
    shadows,
    shadowMapSize,
    powerPreference: dedicated ? "high-performance" : "default",
    toneMappingExposure: dedicated ? 1.4 : 1.1,
  };
}

/**
 * Request persistent storage from the browser so the asset cache is never
 * auto-evicted even under heavy RAM pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if ("storage" in navigator && "persist" in navigator.storage) {
      const granted = await navigator.storage.persist();
      if (granted) {
        console.log("[HW] Persistent storage granted — IndexedDB / Cache not auto-evicted");
      }
      return granted;
    }
  } catch {}
  return false;
}

/**
 * Enable every available WebGL2 extension on a given context to
 * unlock the full GPU feature set (HDR buffers, max anisotropy, etc.)
 */
export function activateAllWebGLExtensions(gl: WebGL2RenderingContext | WebGLRenderingContext): void {
  const extensions = [
    "EXT_texture_filter_anisotropic",
    "EXT_color_buffer_float",
    "EXT_color_buffer_half_float",
    "OES_texture_float",
    "OES_texture_float_linear",
    "OES_texture_half_float",
    "OES_texture_half_float_linear",
    "WEBGL_compressed_texture_s3tc",
    "WEBGL_compressed_texture_etc",
    "WEBGL_compressed_texture_bptc",
    "EXT_disjoint_timer_query_webgl2",
    "KHR_parallel_shader_compile",
    "OVR_multiview2",
  ];
  extensions.forEach((ext) => {
    try { gl.getExtension(ext); } catch {}
  });

  if ("hint" in gl) {
    const g = gl as WebGL2RenderingContext;
    g.hint(g.GENERATE_MIPMAP_HINT, g.NICEST);
    try { g.hint(g.FRAGMENT_SHADER_DERIVATIVE_HINT, g.NICEST); } catch {}
  }
}
