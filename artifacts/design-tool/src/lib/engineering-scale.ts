export type EngineeringScale = "1:1" | "1:2" | "1:5" | "1:10" | "1:20" | "1:50" | "1:70" | "1:100";

export const ENGINEERING_SCALES: { value: EngineeringScale; label: string; factor: number }[] = [
  { value: "1:1",   label: "1:1 (Full)",    factor: 1 },
  { value: "1:2",   label: "1:2",           factor: 2 },
  { value: "1:5",   label: "1:5",           factor: 5 },
  { value: "1:10",  label: "1:10",          factor: 10 },
  { value: "1:20",  label: "1:20",          factor: 20 },
  { value: "1:50",  label: "1:50",          factor: 50 },
  { value: "1:70",  label: "1:70 (FormAxis)",  factor: 70 },
  { value: "1:100", label: "1:100",         factor: 100 },
];

export function getScaleFactor(scale: EngineeringScale): number {
  return ENGINEERING_SCALES.find(s => s.value === scale)?.factor ?? 1;
}

export function getScaleDivisor(scale: EngineeringScale): number {
  return 1 / getScaleFactor(scale);
}

export function formatMM(value: number, precision: number = 2): string {
  return value.toFixed(precision);
}

export function formatAngle(degrees: number, precision: number = 1): string {
  return degrees.toFixed(precision) + "°";
}

export function formatDimension(valueMM: number): string {
  if (Math.abs(valueMM) >= 1000) {
    return (valueMM / 1000).toFixed(3) + " m";
  }
  return valueMM.toFixed(2) + " mm";
}

export type GapSeverity = "safe" | "tight" | "critical";

export function getGapSeverity(gapMM: number, materialThickness: number): GapSeverity {
  const ratio = gapMM / materialThickness;
  if (ratio >= 1.05) return "safe";
  if (ratio >= 0.98) return "tight";
  return "critical";
}

export function getGapColor(severity: GapSeverity): string {
  switch (severity) {
    case "safe": return "#22c55e";
    case "tight": return "#eab308";
    case "critical": return "#ef4444";
  }
}

export function getGapHexColor(severity: GapSeverity): number {
  switch (severity) {
    case "safe": return 0x22c55e;
    case "tight": return 0xeab308;
    case "critical": return 0xef4444;
  }
}

export interface CameraPreset {
  name: string;
  key: string;
  position: [number, number, number];
  target: [number, number, number];
  icon: string;
}

export function getCameraPresets(centerX: number, centerY: number, centerZ: number, distance: number): CameraPreset[] {
  return [
    { name: "Front",      key: "front",      position: [centerX, centerY, centerZ + distance], target: [centerX, centerY, centerZ], icon: "⬛" },
    { name: "Side",       key: "side",       position: [centerX + distance, centerY, centerZ], target: [centerX, centerY, centerZ], icon: "◻️" },
    { name: "Top",        key: "top",        position: [centerX, centerY + distance, centerZ], target: [centerX, centerY, centerZ], icon: "⬜" },
    { name: "Isometric",  key: "iso",        position: [centerX + distance * 0.577, centerY + distance * 0.577, centerZ + distance * 0.577], target: [centerX, centerY, centerZ], icon: "◇" },
    { name: "Iso 30°",    key: "iso30",      position: [centerX + distance * Math.cos(Math.PI/6), centerY + distance * 0.5, centerZ + distance * Math.sin(Math.PI/6)], target: [centerX, centerY, centerZ], icon: "△" },
  ];
}

export function computeDistance(p1: [number, number, number], p2: [number, number, number]): number {
  return Math.sqrt(
    (p2[0] - p1[0]) ** 2 +
    (p2[1] - p1[1]) ** 2 +
    (p2[2] - p1[2]) ** 2
  );
}

export function computeAngleBetween(
  origin: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number]
): number {
  const v1 = [p1[0] - origin[0], p1[1] - origin[1], p1[2] - origin[2]];
  const v2 = [p2[0] - origin[0], p2[1] - origin[1], p2[2] - origin[2]];
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2);
  const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}
