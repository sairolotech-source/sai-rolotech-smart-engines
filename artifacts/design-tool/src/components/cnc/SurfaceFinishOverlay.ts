import * as THREE from "three";

export interface SurfaceFinishParams {
  feedRate: number;
  spindleRpm: number;
  toolDiameter: number;
  toolType: "end_mill" | "ball_nose" | "face_mill" | "drill";
  stepover: number;
  fluteCount: number;
  cornerRadius?: number;
}

export interface SurfaceFinishResult {
  ra: number;
  rz: number;
  quality: "mirror" | "fine" | "standard" | "rough" | "very_rough";
  color: string;
  label: string;
}

export function calculateMillingRa(params: SurfaceFinishParams): number {
  const {
    feedRate,
    spindleRpm,
    toolDiameter,
    toolType,
    stepover,
    fluteCount,
    cornerRadius,
  } = params;

  const fz = spindleRpm > 0 && fluteCount > 0
    ? feedRate / (spindleRpm * fluteCount)
    : 0.05;

  if (toolType === "ball_nose") {
    const R = toolDiameter / 2;
    if (R <= 0) return 10;
    const raAxial = (fz * fz) / (4 * R) * 1000;
    const raStepover = (stepover * stepover) / (8 * R) * 1000;
    return Math.max(raAxial, raStepover);
  }

  if (toolType === "face_mill") {
    const R = cornerRadius || 0.8;
    return (fz * fz) / (8 * R) * 1000;
  }

  if (toolType === "end_mill") {
    const R = cornerRadius || 0;
    if (R > 0) {
      return (fz * fz) / (8 * R) * 1000;
    }
    const ae = stepover;
    const D = toolDiameter;
    if (D <= 0) return 10;
    return (ae * ae) / (8 * (D / 2)) * 1000;
  }

  return 6.3;
}

export function calculateRz(ra: number): number {
  return ra * 4.0;
}

export function getSurfaceFinishResult(params: SurfaceFinishParams): SurfaceFinishResult {
  const ra = calculateMillingRa(params);
  const rz = calculateRz(ra);

  let quality: SurfaceFinishResult["quality"];
  let color: string;
  let label: string;

  if (ra <= 0.4) {
    quality = "mirror";
    color = "#22c55e";
    label = `Mirror Finish (Ra ${ra.toFixed(2)} µm)`;
  } else if (ra <= 1.6) {
    quality = "fine";
    color = "#3b82f6";
    label = `Fine (Ra ${ra.toFixed(2)} µm)`;
  } else if (ra <= 3.2) {
    quality = "standard";
    color = "#f59e0b";
    label = `Standard (Ra ${ra.toFixed(1)} µm)`;
  } else if (ra <= 6.3) {
    quality = "rough";
    color = "#f97316";
    label = `Rough (Ra ${ra.toFixed(1)} µm)`;
  } else {
    quality = "very_rough";
    color = "#ef4444";
    label = `Very Rough (Ra ${ra.toFixed(1)} µm)`;
  }

  return { ra, rz, quality, color, label };
}

export function getRaColor(ra: number): THREE.Color {
  if (ra <= 0.4) return new THREE.Color(0x22c55e);
  if (ra <= 0.8) return new THREE.Color(0x4ade80);
  if (ra <= 1.6) return new THREE.Color(0x3b82f6);
  if (ra <= 3.2) return new THREE.Color(0xf59e0b);
  if (ra <= 6.3) return new THREE.Color(0xf97316);
  return new THREE.Color(0xef4444);
}

export function applyFinishColorToHeightmap(
  heightmap: Float32Array,
  resolution: number,
  originalHeight: number,
  params: SurfaceFinishParams
): THREE.DataTexture {
  const size = resolution;
  const data = new Uint8Array(size * size * 4);
  const result = getSurfaceFinishResult(params);
  const color = new THREE.Color(result.color);

  for (let i = 0; i < size * size; i++) {
    const h = heightmap[i];
    const machined = h < originalHeight - 0.01;

    if (machined) {
      data[i * 4] = Math.floor(color.r * 255);
      data[i * 4 + 1] = Math.floor(color.g * 255);
      data[i * 4 + 2] = Math.floor(color.b * 255);
      data[i * 4 + 3] = 200;
    } else {
      data[i * 4] = 138;
      data[i * 4 + 1] = 154;
      data[i * 4 + 2] = 176;
      data[i * 4 + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

export const SURFACE_FINISH_LEGEND = [
  { label: "Mirror (≤0.4 µm)", color: "#22c55e", raMax: 0.4 },
  { label: "Fine (≤1.6 µm)", color: "#3b82f6", raMax: 1.6 },
  { label: "Standard (≤3.2 µm)", color: "#f59e0b", raMax: 3.2 },
  { label: "Rough (≤6.3 µm)", color: "#f97316", raMax: 6.3 },
  { label: "Very Rough (>6.3 µm)", color: "#ef4444", raMax: Infinity },
] as const;
