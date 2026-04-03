import type { Point, DrawEntity } from "./ManualDrawingEngine";
import { newEntityId } from "./ManualDrawingEngine";

export interface BlockDefinition {
  name: string;
  basePoint: Point;
  entities: DrawEntity[];
  description: string;
  createdAt: number;
}

export interface BlockReference {
  blockName: string;
  insertPoint: Point;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface BlockLibrary {
  blocks: Record<string, BlockDefinition>;
}

export function createBlockLibrary(): BlockLibrary {
  return { blocks: {} };
}

export function defineBlock(
  library: BlockLibrary,
  name: string,
  basePoint: Point,
  entities: DrawEntity[],
  description: string = ""
): BlockLibrary {
  const block: BlockDefinition = {
    name,
    basePoint,
    entities: JSON.parse(JSON.stringify(entities)),
    description,
    createdAt: Date.now(),
  };
  return {
    blocks: { ...library.blocks, [name]: block },
  };
}

export function insertBlock(
  library: BlockLibrary,
  blockName: string,
  insertPoint: Point,
  scaleX: number = 1,
  scaleY: number = 1,
  rotation: number = 0,
  layer: string = "0",
  color: string = "#ffffff"
): DrawEntity | null {
  const block = library.blocks[blockName];
  if (!block) return null;

  const ref: DrawEntity = {
    id: newEntityId("block_ref"),
    type: "block_ref" as any,
    layer,
    color,
    lineType: "Continuous",
    lineWeight: 0.25,
    data: {
      blockName,
      insertPoint,
      scaleX,
      scaleY,
      rotation,
      basePoint: block.basePoint,
    },
  };

  return ref;
}

export function explodeBlockRef(
  library: BlockLibrary,
  ref: DrawEntity
): DrawEntity[] {
  if ((ref.type as string) !== "block_ref") return [ref];

  const { blockName, insertPoint, scaleX, scaleY, rotation, basePoint } = ref.data;
  const block = library.blocks[blockName];
  if (!block) return [];

  const rad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const transformPoint = (px: number, py: number): Point => {
    const lx = (px - basePoint.x) * scaleX;
    const ly = (py - basePoint.y) * scaleY;
    return {
      x: insertPoint.x + lx * cosR - ly * sinR,
      y: insertPoint.y + lx * sinR + ly * cosR,
    };
  };

  const result: DrawEntity[] = [];

  for (const ent of block.entities) {
    const newEnt = JSON.parse(JSON.stringify(ent)) as DrawEntity;
    newEnt.id = newEntityId(ent.type);
    newEnt.layer = ref.layer;

    if (ent.type === "line") {
      const p1 = transformPoint(newEnt.data.x1, newEnt.data.y1);
      const p2 = transformPoint(newEnt.data.x2, newEnt.data.y2);
      newEnt.data.x1 = p1.x; newEnt.data.y1 = p1.y;
      newEnt.data.x2 = p2.x; newEnt.data.y2 = p2.y;
    } else if (ent.type === "circle") {
      const c = transformPoint(newEnt.data.cx, newEnt.data.cy);
      newEnt.data.cx = c.x; newEnt.data.cy = c.y;
      newEnt.data.r *= Math.max(Math.abs(scaleX), Math.abs(scaleY));
    } else if (ent.type === "arc") {
      const c = transformPoint(newEnt.data.cx, newEnt.data.cy);
      newEnt.data.cx = c.x; newEnt.data.cy = c.y;
      newEnt.data.r *= Math.max(Math.abs(scaleX), Math.abs(scaleY));
      newEnt.data.startAngle += rotation;
      newEnt.data.endAngle += rotation;
    } else if (ent.type === "polyline") {
      newEnt.data.points = (newEnt.data.points as Point[]).map(
        (p: Point) => transformPoint(p.x, p.y)
      );
    } else if (ent.type === "text" || ent.type === "mtext" || ent.type === "point") {
      const np = transformPoint(newEnt.data.x, newEnt.data.y);
      newEnt.data.x = np.x; newEnt.data.y = np.y;
    }

    result.push(newEnt);
  }

  return result;
}

export function getBlockNames(library: BlockLibrary): string[] {
  return Object.keys(library.blocks);
}

export function deleteBlock(library: BlockLibrary, name: string): BlockLibrary {
  const blocks = { ...library.blocks };
  delete blocks[name];
  return { blocks };
}

export const BUILT_IN_SYMBOLS: Record<string, { entities: DrawEntity[]; basePoint: Point; description: string }> = {
  "ARROW-RIGHT": {
    description: "Right-pointing arrow",
    basePoint: { x: 0, y: 0 },
    entities: [
      {
        id: "sym_arrow_line", type: "line", layer: "0", color: "#ffffff",
        lineType: "Continuous", lineWeight: 0.25,
        data: { x1: 0, y1: 0, x2: 10, y2: 0 },
      },
      {
        id: "sym_arrow_head1", type: "line", layer: "0", color: "#ffffff",
        lineType: "Continuous", lineWeight: 0.25,
        data: { x1: 10, y1: 0, x2: 7, y2: 2 },
      },
      {
        id: "sym_arrow_head2", type: "line", layer: "0", color: "#ffffff",
        lineType: "Continuous", lineWeight: 0.25,
        data: { x1: 10, y1: 0, x2: 7, y2: -2 },
      },
    ],
  },
  "CENTER-MARK": {
    description: "Center mark crosshair",
    basePoint: { x: 0, y: 0 },
    entities: [
      {
        id: "sym_cm_h", type: "line", layer: "0", color: "#ff0000",
        lineType: "Continuous", lineWeight: 0.18,
        data: { x1: -3, y1: 0, x2: 3, y2: 0 },
      },
      {
        id: "sym_cm_v", type: "line", layer: "0", color: "#ff0000",
        lineType: "Continuous", lineWeight: 0.18,
        data: { x1: 0, y1: -3, x2: 0, y2: 3 },
      },
    ],
  },
  "SECTION-MARK": {
    description: "Section cut marker",
    basePoint: { x: 0, y: 0 },
    entities: [
      {
        id: "sym_sec_line", type: "line", layer: "0", color: "#00ffff",
        lineType: "Continuous", lineWeight: 0.35,
        data: { x1: -5, y1: 0, x2: 5, y2: 0 },
      },
      {
        id: "sym_sec_arr1", type: "line", layer: "0", color: "#00ffff",
        lineType: "Continuous", lineWeight: 0.35,
        data: { x1: -5, y1: 0, x2: -3, y2: 3 },
      },
      {
        id: "sym_sec_arr2", type: "line", layer: "0", color: "#00ffff",
        lineType: "Continuous", lineWeight: 0.35,
        data: { x1: 5, y1: 0, x2: 3, y2: 3 },
      },
    ],
  },
  "NORTH-ARROW": {
    description: "North arrow symbol",
    basePoint: { x: 0, y: 0 },
    entities: [
      {
        id: "sym_na_l1", type: "line", layer: "0", color: "#ffffff",
        lineType: "Continuous", lineWeight: 0.25,
        data: { x1: 0, y1: -5, x2: 0, y2: 5 },
      },
      {
        id: "sym_na_l2", type: "line", layer: "0", color: "#ffffff",
        lineType: "Continuous", lineWeight: 0.25,
        data: { x1: 0, y1: 5, x2: 2, y2: 3 },
      },
      {
        id: "sym_na_l3", type: "line", layer: "0", color: "#ffffff",
        lineType: "Continuous", lineWeight: 0.25,
        data: { x1: 0, y1: 5, x2: -2, y2: 3 },
      },
      {
        id: "sym_na_text", type: "text", layer: "0", color: "#ffffff",
        lineType: "Continuous", lineWeight: 0.18,
        data: { x: -1.5, y: 7, text: "N", height: 3, rotation: 0 },
      },
    ],
  },
  "WELD-SYMBOL": {
    description: "Basic weld symbol",
    basePoint: { x: 0, y: 0 },
    entities: [
      {
        id: "sym_weld_base", type: "line", layer: "0", color: "#ffff00",
        lineType: "Continuous", lineWeight: 0.25,
        data: { x1: -5, y1: 0, x2: 5, y2: 0 },
      },
      {
        id: "sym_weld_v1", type: "line", layer: "0", color: "#ffff00",
        lineType: "Continuous", lineWeight: 0.25,
        data: { x1: -2, y1: 0, x2: 0, y2: -3 },
      },
      {
        id: "sym_weld_v2", type: "line", layer: "0", color: "#ffff00",
        lineType: "Continuous", lineWeight: 0.25,
        data: { x1: 0, y1: -3, x2: 2, y2: 0 },
      },
    ],
  },
};
