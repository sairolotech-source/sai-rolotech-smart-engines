import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

export type MateType = "coincident" | "concentric" | "parallel" | "perpendicular" | "distance" | "angle";

export type PartPrimitiveType = "box" | "cylinder" | "sphere" | "cone";

export interface AssemblyPartInstance {
  id: string;
  name: string;
  primitiveType: PartPrimitiveType;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  material: string;
  weightKg: number;
  locked: boolean;
}

export interface MateFace {
  partId: string;
  faceIndex: number;
  point: [number, number, number];
  normal: [number, number, number];
  axis?: [number, number, number];
}

export interface MateDefinition {
  id: string;
  type: MateType;
  face1: MateFace;
  face2: MateFace;
  value?: number;
  satisfied: boolean;
}

export interface Assembly {
  id: string;
  name: string;
  parts: AssemblyPartInstance[];
  mates: MateDefinition[];
  createdAt: number;
  updatedAt: number;
}

export interface InterferenceResult {
  partId1: string;
  partId2: string;
  overlapVolume: number;
  overlapCenter: [number, number, number];
}

export interface AssemblyBomItem {
  itemNo: number;
  partName: string;
  partId: string;
  primitiveType: string;
  material: string;
  qty: number;
  color: string;
  weightKg: number;
  dimensions: string;
}

export type ViewMode = "normal" | "exploded" | "section";

interface AssemblyState {
  assembly: Assembly;
  selectedPartId: string | null;
  selectedMateId: string | null;
  viewMode: ViewMode;
  explosionDistance: number;
  sectionPlaneY: number;
  sectionPlaneEnabled: boolean;
  showInterference: boolean;
  interferences: InterferenceResult[];
  mateCreationMode: boolean;
  mateCreationStep: "select-face1" | "select-face2" | "configure";
  pendingMateType: MateType;
  pendingFace1: MateFace | null;
  pendingMateValue: number | undefined;

  insertPart: (type: PartPrimitiveType) => void;
  removePart: (id: string) => void;
  selectPart: (id: string | null) => void;
  updatePartTransform: (id: string, position?: [number, number, number], rotation?: [number, number, number]) => void;
  updatePartProps: (id: string, updates: Partial<AssemblyPartInstance>) => void;
  togglePartLock: (id: string) => void;
  duplicatePart: (id: string) => void;

  addMate: (type: MateType, face1: MateFace, face2: MateFace, value?: number) => void;
  removeMate: (id: string) => void;
  selectMate: (id: string | null) => void;

  startMateCreation: (type: MateType) => void;
  setMateCreationFace1: (face: MateFace) => void;
  completeMateCreation: (face2: MateFace, value?: number) => void;
  cancelMateCreation: () => void;
  setPendingMateValue: (value: number | undefined) => void;

  setViewMode: (mode: ViewMode) => void;
  setExplosionDistance: (d: number) => void;
  setSectionPlaneY: (y: number) => void;
  setSectionPlaneEnabled: (enabled: boolean) => void;

  runInterferenceCheck: () => void;
  setShowInterference: (show: boolean) => void;

  solveMates: () => void;

  getBom: () => AssemblyBomItem[];

  setAssemblyName: (name: string) => void;
  clearAssembly: () => void;
}

const PART_COLORS = ["#4488ff", "#44ff88", "#ff8844", "#ff44aa", "#88ffff", "#ffff44", "#aa44ff", "#ff6644"];

const MATERIALS = ["Steel", "Aluminum", "Brass", "Titanium", "ABS Plastic", "Nylon", "Cast Iron", "Copper"];

function estimateWeight(type: PartPrimitiveType, scale: [number, number, number], material: string): number {
  const densityMap: Record<string, number> = {
    "Steel": 7850, "Aluminum": 2700, "Brass": 8500, "Titanium": 4500,
    "ABS Plastic": 1050, "Nylon": 1150, "Cast Iron": 7200, "Copper": 8900,
  };
  const density = densityMap[material] || 7850;
  let volumeM3 = 0;
  const s = scale.map(v => v / 1000);
  switch (type) {
    case "box": volumeM3 = s[0] * s[1] * s[2]; break;
    case "cylinder": volumeM3 = Math.PI * (s[0] / 2) ** 2 * s[1]; break;
    case "sphere": volumeM3 = (4 / 3) * Math.PI * (s[0] / 2) ** 3; break;
    case "cone": volumeM3 = (1 / 3) * Math.PI * (s[0] / 2) ** 2 * s[1]; break;
  }
  return Math.round(volumeM3 * density * 1000) / 1000;
}

function formatDimensions(type: PartPrimitiveType, scale: [number, number, number]): string {
  switch (type) {
    case "box": return `${scale[0]}×${scale[1]}×${scale[2]} mm`;
    case "cylinder": return `Ø${scale[0]}×H${scale[1]} mm`;
    case "sphere": return `Ø${scale[0]} mm`;
    case "cone": return `Ø${scale[0]}×H${scale[1]} mm`;
    default: return `${scale[0]}×${scale[1]}×${scale[2]} mm`;
  }
}

function computeBoundingBox(part: AssemblyPartInstance): { min: [number, number, number]; max: [number, number, number] } {
  const [px, py, pz] = part.position;
  const [sx, sy, sz] = part.scale;
  let hx: number, hy: number, hz: number;
  switch (part.primitiveType) {
    case "box":
      hx = sx / 2; hy = sy / 2; hz = sz / 2;
      break;
    case "cylinder":
      hx = sx / 2; hy = sy / 2; hz = sx / 2;
      break;
    case "sphere":
      hx = sx / 2; hy = sx / 2; hz = sx / 2;
      break;
    case "cone":
      hx = sx / 2; hy = sy / 2; hz = sx / 2;
      break;
    default:
      hx = sx / 2; hy = sy / 2; hz = sz / 2;
  }
  return {
    min: [px - hx, py - hy, pz - hz],
    max: [px + hx, py + hy, pz + hz],
  };
}

function checkAABBOverlap(
  a: { min: [number, number, number]; max: [number, number, number] },
  b: { min: [number, number, number]; max: [number, number, number] }
): { overlaps: boolean; volume: number; center: [number, number, number] } {
  const overlapMin: [number, number, number] = [
    Math.max(a.min[0], b.min[0]),
    Math.max(a.min[1], b.min[1]),
    Math.max(a.min[2], b.min[2]),
  ];
  const overlapMax: [number, number, number] = [
    Math.min(a.max[0], b.max[0]),
    Math.min(a.max[1], b.max[1]),
    Math.min(a.max[2], b.max[2]),
  ];
  const dx = overlapMax[0] - overlapMin[0];
  const dy = overlapMax[1] - overlapMin[1];
  const dz = overlapMax[2] - overlapMin[2];
  if (dx <= 0 || dy <= 0 || dz <= 0) {
    return { overlaps: false, volume: 0, center: [0, 0, 0] };
  }
  return {
    overlaps: true,
    volume: dx * dy * dz,
    center: [
      (overlapMin[0] + overlapMax[0]) / 2,
      (overlapMin[1] + overlapMax[1]) / 2,
      (overlapMin[2] + overlapMax[2]) / 2,
    ],
  };
}

function computeResidual(mate: MateDefinition, p1: AssemblyPartInstance, p2: AssemblyPartInstance): number {
  const dx = p1.position[0] - p2.position[0];
  const dy = p1.position[1] - p2.position[1];
  const dz = p1.position[2] - p2.position[2];
  const posDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  switch (mate.type) {
    case "coincident": return posDist < 1 ? 0 : posDist;
    case "concentric": {
      const axis = mate.face1.axis || [0, 1, 0];
      let offAxis = 0;
      if (Math.abs(axis[1]) > 0.5) offAxis = Math.sqrt(dx * dx + dz * dz);
      else if (Math.abs(axis[0]) > 0.5) offAxis = Math.sqrt(dy * dy + dz * dz);
      else offAxis = Math.sqrt(dx * dx + dy * dy);
      return offAxis;
    }
    case "distance": {
      const target = mate.value ?? 10;
      return Math.abs(posDist - target);
    }
    case "angle": return 0;
    case "parallel": {
      const rdx = Math.abs(p1.rotation[0] - p2.rotation[0]);
      const rdy = Math.abs(p1.rotation[1] - p2.rotation[1]);
      const rdz = Math.abs(p1.rotation[2] - p2.rotation[2]);
      return rdx + rdy + rdz;
    }
    case "perpendicular": return 0;
    default: return 0;
  }
}

function solveMateConstraints(parts: AssemblyPartInstance[], mates: MateDefinition[]): { parts: AssemblyPartInstance[]; mates: MateDefinition[] } {
  const updated = parts.map(p => ({ ...p, position: [...p.position] as [number, number, number], rotation: [...p.rotation] as [number, number, number] }));
  const updatedMates = mates.map(m => ({ ...m }));

  for (let iteration = 0; iteration < 10; iteration++) {
    for (let mi = 0; mi < updatedMates.length; mi++) {
      const mate = updatedMates[mi];
      const p1 = updated.find(p => p.id === mate.face1.partId);
      const p2 = updated.find(p => p.id === mate.face2.partId);
      if (!p1 || !p2) { mate.satisfied = false; continue; }
      if (p1.locked && p2.locked) {
        const residual = computeResidual(mate, p1, p2);
        mate.satisfied = residual < 2;
        continue;
      }

      const movable = p2.locked ? p1 : p2;
      const anchor = p2.locked ? p2 : p1;
      const anchorFace = p2.locked ? mate.face2 : mate.face1;
      const movableFace = p2.locked ? mate.face1 : mate.face2;

      switch (mate.type) {
        case "coincident": {
          const target: [number, number, number] = [
            anchor.position[0] + anchorFace.point[0] - movableFace.point[0],
            anchor.position[1] + anchorFace.point[1] - movableFace.point[1],
            anchor.position[2] + anchorFace.point[2] - movableFace.point[2],
          ];
          const offset = anchorFace.normal.map((n, i) => n * (movable.scale[i] / 2 + anchor.scale[i] / 2));
          movable.position = [
            target[0] + offset[0] * 0.5,
            target[1] + offset[1] * 0.5,
            target[2] + offset[2] * 0.5,
          ];
          break;
        }
        case "concentric": {
          const axis = anchorFace.axis || [0, 1, 0];
          const alignedPos: [number, number, number] = [...movable.position];
          if (Math.abs(axis[0]) > 0.5) {
            alignedPos[1] = anchor.position[1];
            alignedPos[2] = anchor.position[2];
          } else if (Math.abs(axis[1]) > 0.5) {
            alignedPos[0] = anchor.position[0];
            alignedPos[2] = anchor.position[2];
          } else {
            alignedPos[0] = anchor.position[0];
            alignedPos[1] = anchor.position[1];
          }
          movable.position = alignedPos;
          break;
        }
        case "distance": {
          const dist = mate.value ?? 10;
          const dir = anchorFace.normal;
          const dirLen = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]) || 1;
          const normDir: [number, number, number] = [dir[0] / dirLen, dir[1] / dirLen, dir[2] / dirLen];
          movable.position = [
            anchor.position[0] + normDir[0] * dist,
            anchor.position[1] + normDir[1] * dist,
            anchor.position[2] + normDir[2] * dist,
          ];
          break;
        }
        case "angle": {
          const angleDeg = mate.value ?? 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          const axis = anchorFace.axis || [0, 1, 0];
          if (Math.abs(axis[1]) > 0.5) {
            movable.rotation = [movable.rotation[0], angleRad, movable.rotation[2]];
          } else if (Math.abs(axis[0]) > 0.5) {
            movable.rotation = [angleRad, movable.rotation[1], movable.rotation[2]];
          } else {
            movable.rotation = [movable.rotation[0], movable.rotation[1], angleRad];
          }
          break;
        }
        case "parallel": {
          movable.rotation = [...anchor.rotation];
          break;
        }
        case "perpendicular": {
          const axis = anchorFace.axis || [0, 1, 0];
          if (Math.abs(axis[1]) > 0.5) {
            movable.rotation = [Math.PI / 2, movable.rotation[1], movable.rotation[2]];
          } else if (Math.abs(axis[0]) > 0.5) {
            movable.rotation = [movable.rotation[0], Math.PI / 2, movable.rotation[2]];
          } else {
            movable.rotation = [movable.rotation[0], movable.rotation[1], Math.PI / 2];
          }
          break;
        }
      }
    }
  }

  for (let mi = 0; mi < updatedMates.length; mi++) {
    const mate = updatedMates[mi];
    const p1 = updated.find(p => p.id === mate.face1.partId);
    const p2 = updated.find(p => p.id === mate.face2.partId);
    if (!p1 || !p2) { mate.satisfied = false; continue; }
    const residual = computeResidual(mate, p1, p2);
    mate.satisfied = residual < 2;
  }

  return { parts: updated, mates: updatedMates };
}

function createDefaultAssembly(): Assembly {
  return {
    id: uuidv4(),
    name: "New Assembly",
    parts: [],
    mates: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const useAssemblyStore = create<AssemblyState>((set, get) => ({
  assembly: createDefaultAssembly(),
  selectedPartId: null,
  selectedMateId: null,
  viewMode: "normal",
  explosionDistance: 50,
  sectionPlaneY: 0,
  sectionPlaneEnabled: false,
  showInterference: false,
  interferences: [],
  mateCreationMode: false,
  mateCreationStep: "select-face1",
  pendingMateType: "coincident",
  pendingFace1: null,
  pendingMateValue: undefined,

  insertPart: (type) => {
    const { assembly } = get();
    const count = assembly.parts.filter(p => p.primitiveType === type).length;
    const names: Record<PartPrimitiveType, string> = { box: "Block", cylinder: "Shaft", sphere: "Ball", cone: "Cone" };
    const defaultScales: Record<PartPrimitiveType, [number, number, number]> = {
      box: [40, 20, 30],
      cylinder: [20, 40, 20],
      sphere: [30, 30, 30],
      cone: [20, 30, 20],
    };
    const material = MATERIALS[assembly.parts.length % MATERIALS.length];
    const scale = defaultScales[type];
    const part: AssemblyPartInstance = {
      id: uuidv4(),
      name: `${names[type]} ${count + 1}`,
      primitiveType: type,
      color: PART_COLORS[assembly.parts.length % PART_COLORS.length],
      position: [(assembly.parts.length % 4) * 50 - 75, 0, Math.floor(assembly.parts.length / 4) * 50],
      rotation: [0, 0, 0],
      scale,
      material,
      weightKg: estimateWeight(type, scale, material),
      locked: false,
    };
    set({
      assembly: {
        ...assembly,
        parts: [...assembly.parts, part],
        updatedAt: Date.now(),
      },
      selectedPartId: part.id,
    });
  },

  removePart: (id) => {
    const { assembly } = get();
    set({
      assembly: {
        ...assembly,
        parts: assembly.parts.filter(p => p.id !== id),
        mates: assembly.mates.filter(m => m.face1.partId !== id && m.face2.partId !== id),
        updatedAt: Date.now(),
      },
      selectedPartId: null,
    });
  },

  selectPart: (id) => set({ selectedPartId: id, selectedMateId: null }),

  updatePartTransform: (id, position, rotation) => {
    const { assembly } = get();
    set({
      assembly: {
        ...assembly,
        parts: assembly.parts.map(p => {
          if (p.id !== id || p.locked) return p;
          return {
            ...p,
            ...(position ? { position } : {}),
            ...(rotation ? { rotation } : {}),
          };
        }),
        updatedAt: Date.now(),
      },
    });
  },

  updatePartProps: (id, updates) => {
    const { assembly } = get();
    set({
      assembly: {
        ...assembly,
        parts: assembly.parts.map(p => {
          if (p.id !== id) return p;
          const updated = { ...p, ...updates };
          if (updates.scale || updates.material) {
            updated.weightKg = estimateWeight(updated.primitiveType, updated.scale, updated.material);
          }
          return updated;
        }),
        updatedAt: Date.now(),
      },
    });
  },

  togglePartLock: (id) => {
    const { assembly } = get();
    set({
      assembly: {
        ...assembly,
        parts: assembly.parts.map(p => p.id === id ? { ...p, locked: !p.locked } : p),
        updatedAt: Date.now(),
      },
    });
  },

  duplicatePart: (id) => {
    const { assembly } = get();
    const original = assembly.parts.find(p => p.id === id);
    if (!original) return;
    const newPart: AssemblyPartInstance = {
      ...original,
      id: uuidv4(),
      name: `${original.name} (copy)`,
      position: [original.position[0] + 30, original.position[1], original.position[2] + 30],
      locked: false,
    };
    set({
      assembly: {
        ...assembly,
        parts: [...assembly.parts, newPart],
        updatedAt: Date.now(),
      },
      selectedPartId: newPart.id,
    });
  },

  addMate: (type, face1, face2, value) => {
    const { assembly } = get();
    const mate: MateDefinition = {
      id: uuidv4(),
      type,
      face1,
      face2,
      value,
      satisfied: false,
    };
    const newAssembly = {
      ...assembly,
      mates: [...assembly.mates, mate],
      updatedAt: Date.now(),
    };
    set({ assembly: newAssembly });
    get().solveMates();
  },

  removeMate: (id) => {
    const { assembly } = get();
    set({
      assembly: {
        ...assembly,
        mates: assembly.mates.filter(m => m.id !== id),
        updatedAt: Date.now(),
      },
      selectedMateId: null,
    });
  },

  selectMate: (id) => set({ selectedMateId: id, selectedPartId: null }),

  startMateCreation: (type) => set({
    mateCreationMode: true,
    mateCreationStep: "select-face1",
    pendingMateType: type,
    pendingFace1: null,
    pendingMateValue: type === "distance" ? 10 : type === "angle" ? 90 : undefined,
  }),

  setMateCreationFace1: (face) => set({
    pendingFace1: face,
    mateCreationStep: "select-face2",
  }),

  completeMateCreation: (face2, value) => {
    const { pendingMateType, pendingFace1, pendingMateValue } = get();
    if (!pendingFace1) return;
    if (pendingFace1.partId === face2.partId) return;
    const effectiveValue = value !== undefined ? value : pendingMateValue;
    get().addMate(pendingMateType, pendingFace1, face2, effectiveValue);
    set({
      mateCreationMode: false,
      mateCreationStep: "select-face1",
      pendingFace1: null,
      pendingMateValue: undefined,
    });
  },

  cancelMateCreation: () => set({
    mateCreationMode: false,
    mateCreationStep: "select-face1",
    pendingFace1: null,
    pendingMateValue: undefined,
  }),

  setPendingMateValue: (value) => set({ pendingMateValue: value }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setExplosionDistance: (d) => set({ explosionDistance: d }),
  setSectionPlaneY: (y) => set({ sectionPlaneY: y }),
  setSectionPlaneEnabled: (enabled) => set({ sectionPlaneEnabled: enabled }),

  runInterferenceCheck: () => {
    const { assembly } = get();
    const results: InterferenceResult[] = [];
    for (let i = 0; i < assembly.parts.length; i++) {
      for (let j = i + 1; j < assembly.parts.length; j++) {
        const bbA = computeBoundingBox(assembly.parts[i]);
        const bbB = computeBoundingBox(assembly.parts[j]);
        const overlap = checkAABBOverlap(bbA, bbB);
        if (overlap.overlaps) {
          results.push({
            partId1: assembly.parts[i].id,
            partId2: assembly.parts[j].id,
            overlapVolume: Math.round(overlap.volume * 100) / 100,
            overlapCenter: overlap.center,
          });
        }
      }
    }
    set({ interferences: results, showInterference: results.length > 0 });
  },

  setShowInterference: (show) => set({ showInterference: show }),

  solveMates: () => {
    const { assembly } = get();
    if (assembly.mates.length === 0) return;
    const result = solveMateConstraints(assembly.parts, assembly.mates);
    set({
      assembly: {
        ...assembly,
        parts: result.parts,
        mates: result.mates,
        updatedAt: Date.now(),
      },
    });
  },

  getBom: () => {
    const { assembly } = get();
    const countMap = new Map<string, { part: AssemblyPartInstance; qty: number }>();
    for (const part of assembly.parts) {
      const key = `${part.primitiveType}-${part.material}-${part.scale.join(",")}`;
      const existing = countMap.get(key);
      if (existing) {
        existing.qty++;
      } else {
        countMap.set(key, { part, qty: 1 });
      }
    }
    let itemNo = 1;
    const items: AssemblyBomItem[] = [];
    for (const [, { part, qty }] of countMap) {
      items.push({
        itemNo: itemNo++,
        partName: part.name,
        partId: part.id,
        primitiveType: part.primitiveType,
        material: part.material,
        qty,
        color: part.color,
        weightKg: part.weightKg,
        dimensions: formatDimensions(part.primitiveType, part.scale),
      });
    }
    return items;
  },

  setAssemblyName: (name) => {
    const { assembly } = get();
    set({ assembly: { ...assembly, name, updatedAt: Date.now() } });
  },

  clearAssembly: () => set({
    assembly: createDefaultAssembly(),
    selectedPartId: null,
    selectedMateId: null,
    interferences: [],
    viewMode: "normal",
  }),
}));
