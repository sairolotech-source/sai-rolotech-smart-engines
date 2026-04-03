
export type CoordMode = "absolute" | "relative" | "polar";

export interface Point {
  x: number;
  y: number;
}

export interface DrawEntity {
  id: string;
  type:
    | "line"
    | "circle"
    | "arc"
    | "polyline"
    | "rectangle"
    | "ellipse"
    | "spline"
    | "point"
    | "xline"
    | "ray"
    | "text"
    | "mtext"
    | "dimension_linear"
    | "dimension_angular"
    | "dimension_radius"
    | "dimension_diameter"
    | "hatch"
    | "block_ref"
    | "leader";
  layer: string;
  color: string;
  lineType: string;
  lineWeight: number;
  data: Record<string, any>;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  lineType: string;
  frozen: boolean;
}

export interface DrawingState {
  entities: DrawEntity[];
  layers: Layer[];
  currentLayer: string;
  selectedIds: string[];
  zoom: number;
  panX: number;
  panY: number;
  gridVisible: boolean;
  gridSpacing: number;
  orthoMode: boolean;
  snapMode: boolean;
  osnapEnabled: boolean;
  osnapTypes: string[];
  units: "mm" | "inch";
  undoStack: DrawEntity[][];
  redoStack: DrawEntity[][];
}

export interface CommandLineEntry {
  type: "input" | "prompt" | "response" | "error";
  text: string;
}

export type CommandState =
  | "idle"
  | "awaiting_first_point"
  | "awaiting_second_point"
  | "awaiting_next_point"
  | "awaiting_radius"
  | "awaiting_center"
  | "awaiting_start_angle"
  | "awaiting_end_angle"
  | "awaiting_text"
  | "awaiting_angle"
  | "awaiting_scale_factor"
  | "awaiting_base_point"
  | "awaiting_displacement"
  | "awaiting_offset_distance"
  | "awaiting_object_select"
  | "awaiting_mirror_line_first"
  | "awaiting_mirror_line_second"
  | "awaiting_fillet_radius"
  | "awaiting_fillet_select_first"
  | "awaiting_fillet_select_second"
  | "awaiting_chamfer_dist1"
  | "awaiting_chamfer_dist2"
  | "awaiting_chamfer_select_first"
  | "awaiting_chamfer_select_second"
  | "awaiting_dim_first_point"
  | "awaiting_dim_second_point"
  | "awaiting_dim_location"
  | "awaiting_text_insert"
  | "awaiting_text_height"
  | "awaiting_text_rotation"
  | "awaiting_text_value"
  | "awaiting_hatch_pattern"
  | "awaiting_hatch_boundary"
  | "awaiting_hatch_scale"
  | "awaiting_hatch_angle"
  | "awaiting_block_name"
  | "awaiting_block_base"
  | "awaiting_insert_name"
  | "awaiting_insert_point"
  | "awaiting_insert_scale"
  | "awaiting_insert_rotation"
  | "awaiting_array_type"
  | "awaiting_array_rows"
  | "awaiting_array_cols"
  | "awaiting_array_row_spacing"
  | "awaiting_array_col_spacing"
  | "awaiting_array_count"
  | "awaiting_array_angle"
  | "awaiting_array_center"
  | "awaiting_trim_cutting"
  | "awaiting_trim_object"
  | "awaiting_extend_boundary"
  | "awaiting_extend_object"
  | "awaiting_leader_next"
  | "awaiting_leader_text"
  | "awaiting_mtext_width"
  | "awaiting_mtext_value"
  | "awaiting_text_font"
  | "awaiting_text_justify";

const COMMAND_ALIASES: Record<string, string> = {
  L: "LINE",
  C: "CIRCLE",
  A: "ARC",
  REC: "RECTANGLE",
  RECTANG: "RECTANGLE",
  PL: "POLYLINE",
  SPL: "SPLINE",
  EL: "ELLIPSE",
  PO: "POINT",
  XL: "XLINE",
  M: "MOVE",
  CO: "COPY",
  CP: "COPY",
  RO: "ROTATE",
  SC: "SCALE",
  MI: "MIRROR",
  O: "OFFSET",
  TR: "TRIM",
  EX: "EXTEND",
  F: "FILLET",
  CHA: "CHAMFER",
  X: "EXPLODE",
  S: "STRETCH",
  LEN: "LENGTHEN",
  E: "ERASE",
  Z: "ZOOM",
  P: "PAN",
  U: "UNDO",
  LA: "LAYER",
  PR: "PROPERTIES",
  DL: "DIMLINEAR",
  DA: "DIMANGULAR",
  DR: "DIMRADIUS",
  DD: "DIMDIAMETER",
  H: "HATCH",
  BH: "HATCH",
  B: "BLOCK",
  W: "WBLOCK",
  I: "INSERT",
  AR: "ARRAY",
  MT: "MTEXT",
  LE: "LEADER",
  QLE: "QLEADER",
  PLOT: "PLOT",
  PRINT: "PLOT",
};

export function parseCoordinates(
  input: string,
  lastPoint?: Point
): Point | null {
  input = input.trim();

  const polarRel = /^@([\d.-]+)<([\d.-]+)$/;
  const polarMatch = input.match(polarRel);
  if (polarMatch && lastPoint) {
    const dist = parseFloat(polarMatch[1]);
    const angleDeg = parseFloat(polarMatch[2]);
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: lastPoint.x + dist * Math.cos(angleRad),
      y: lastPoint.y + dist * Math.sin(angleRad),
    };
  }

  const relMatch = input.match(/^@([\d.-]+)[,\s]([\d.-]+)$/);
  if (relMatch && lastPoint) {
    return {
      x: lastPoint.x + parseFloat(relMatch[1]),
      y: lastPoint.y + parseFloat(relMatch[2]),
    };
  }

  const absMatch = input.match(/^([\d.-]+)[,\s]([\d.-]+)$/);
  if (absMatch) {
    return { x: parseFloat(absMatch[1]), y: parseFloat(absMatch[2]) };
  }

  return null;
}

export function resolveCommand(input: string): string {
  const upper = input.toUpperCase().trim();
  return COMMAND_ALIASES[upper] || upper;
}

let entityCounter = 1;
export function newEntityId(type: string): string {
  return `${type.toLowerCase()}_${entityCounter++}`;
}

export function createDefaultLayer(): Layer {
  return {
    id: "0",
    name: "0",
    visible: true,
    locked: false,
    color: "#ffffff",
    lineType: "Continuous",
    frozen: false,
  };
}

export function getInitialDrawingState(): DrawingState {
  return {
    entities: [],
    layers: [createDefaultLayer()],
    currentLayer: "0",
    selectedIds: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    gridVisible: true,
    gridSpacing: 20,
    orthoMode: false,
    snapMode: false,
    osnapEnabled: true,
    osnapTypes: [
      "endpoint",
      "midpoint",
      "center",
      "intersection",
      "perpendicular",
      "nearest",
      "quadrant",
    ],
    units: "mm",
    undoStack: [],
    redoStack: [],
  };
}

export function worldToCanvas(
  wx: number,
  wy: number,
  panX: number,
  panY: number,
  zoom: number,
  canvasH: number
): { cx: number; cy: number } {
  return {
    cx: panX + wx * zoom,
    cy: canvasH - (panY + wy * zoom),
  };
}

export function canvasToWorld(
  cx: number,
  cy: number,
  panX: number,
  panY: number,
  zoom: number,
  canvasH: number
): Point {
  return {
    x: (cx - panX) / zoom,
    y: (canvasH - cy - panY) / zoom,
  };
}

export function applyOrtho(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: to.x, y: from.y };
  }
  return { x: from.x, y: to.y };
}

export function snapToGrid(p: Point, spacing: number): Point {
  return {
    x: Math.round(p.x / spacing) * spacing,
    y: Math.round(p.y / spacing) * spacing,
  };
}

export function findNearestOsnap(
  p: Point,
  entities: DrawEntity[],
  types: string[],
  threshold: number = 12
): { point: Point; type: string } | null {
  let best: { point: Point; type: string; dist: number } | null = null;

  const check = (pt: Point, type: string) => {
    const dist = Math.sqrt((pt.x - p.x) ** 2 + (pt.y - p.y) ** 2);
    if (dist < threshold && (!best || dist < best.dist)) {
      best = { point: pt, type, dist };
    }
  };

  for (const ent of entities) {
    if (ent.type === "line") {
      const { x1, y1, x2, y2 } = ent.data;
      if (types.includes("endpoint")) {
        check({ x: x1, y: y1 }, "endpoint");
        check({ x: x2, y: y2 }, "endpoint");
      }
      if (types.includes("midpoint")) {
        check({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, "midpoint");
      }
    } else if (ent.type === "circle") {
      const { cx, cy, r } = ent.data;
      if (types.includes("center")) {
        check({ x: cx, y: cy }, "center");
      }
      if (types.includes("quadrant")) {
        check({ x: cx + r, y: cy }, "quadrant");
        check({ x: cx - r, y: cy }, "quadrant");
        check({ x: cx, y: cy + r }, "quadrant");
        check({ x: cx, y: cy - r }, "quadrant");
      }
    } else if (ent.type === "polyline") {
      const pts: Point[] = ent.data.points || [];
      for (let i = 0; i < pts.length; i++) {
        if (types.includes("endpoint")) check(pts[i], "endpoint");
        if (i > 0 && types.includes("midpoint")) {
          const prev = pts[i - 1];
          check(
            { x: (prev.x + pts[i].x) / 2, y: (prev.y + pts[i].y) / 2 },
            "midpoint"
          );
        }
      }
    }
  }

  return best;
}

export function generateDXF(
  entities: DrawEntity[],
  layers: Layer[]
): string {
  const lines: string[] = [];

  lines.push("0\nSECTION");
  lines.push("2\nHEADER");
  lines.push("9\n$ACADVER");
  lines.push("1\nAC1015");
  lines.push("0\nENDSEC");

  lines.push("0\nSECTION");
  lines.push("2\nTABLES");
  lines.push("0\nTABLE");
  lines.push("2\nLAYER");

  for (const layer of layers) {
    lines.push("0\nLAYER");
    lines.push(`2\n${layer.name}`);
    lines.push("70\n0");
    const colorNum = dxfColorIndex(layer.color);
    lines.push(`62\n${colorNum}`);
    lines.push(`6\n${layer.lineType}`);
  }

  lines.push("0\nENDTAB");
  lines.push("0\nENDSEC");

  lines.push("0\nSECTION");
  lines.push("2\nENTITIES");

  for (const ent of entities) {
    switch (ent.type) {
      case "line": {
        const { x1, y1, x2, y2 } = ent.data;
        lines.push("0\nLINE");
        lines.push(`8\n${ent.layer}`);
        lines.push(`10\n${x1.toFixed(6)}`);
        lines.push(`20\n${y1.toFixed(6)}`);
        lines.push(`30\n0.0`);
        lines.push(`11\n${x2.toFixed(6)}`);
        lines.push(`21\n${y2.toFixed(6)}`);
        lines.push(`31\n0.0`);
        break;
      }
      case "circle": {
        const { cx, cy, r } = ent.data;
        lines.push("0\nCIRCLE");
        lines.push(`8\n${ent.layer}`);
        lines.push(`10\n${cx.toFixed(6)}`);
        lines.push(`20\n${cy.toFixed(6)}`);
        lines.push(`30\n0.0`);
        lines.push(`40\n${r.toFixed(6)}`);
        break;
      }
      case "arc": {
        const { cx, cy, r, startAngle, endAngle } = ent.data;
        lines.push("0\nARC");
        lines.push(`8\n${ent.layer}`);
        lines.push(`10\n${cx.toFixed(6)}`);
        lines.push(`20\n${cy.toFixed(6)}`);
        lines.push(`30\n0.0`);
        lines.push(`40\n${r.toFixed(6)}`);
        lines.push(`50\n${startAngle.toFixed(6)}`);
        lines.push(`51\n${endAngle.toFixed(6)}`);
        break;
      }
      case "polyline": {
        const pts: Point[] = ent.data.points || [];
        lines.push("0\nPOLYLINE");
        lines.push(`8\n${ent.layer}`);
        lines.push("70\n0");
        for (const pt of pts) {
          lines.push("0\nVERTEX");
          lines.push(`8\n${ent.layer}`);
          lines.push(`10\n${pt.x.toFixed(6)}`);
          lines.push(`20\n${pt.y.toFixed(6)}`);
          lines.push("30\n0.0");
        }
        lines.push("0\nSEQEND");
        break;
      }
      case "text": {
        const { x, y, text, height, rotation } = ent.data;
        lines.push("0\nTEXT");
        lines.push(`8\n${ent.layer}`);
        lines.push(`10\n${x.toFixed(6)}`);
        lines.push(`20\n${y.toFixed(6)}`);
        lines.push("30\n0.0");
        lines.push(`40\n${(height || 2.5).toFixed(6)}`);
        lines.push(`1\n${text}`);
        lines.push(`50\n${(rotation || 0).toFixed(6)}`);
        break;
      }
      default:
        break;
    }
  }

  lines.push("0\nENDSEC");
  lines.push("0\nEOF");

  return lines.join("\n");
}

function dxfColorIndex(hex: string): number {
  const map: Record<string, number> = {
    "#ff0000": 1,
    "#ffff00": 2,
    "#00ff00": 3,
    "#00ffff": 4,
    "#0000ff": 5,
    "#ff00ff": 6,
    "#ffffff": 7,
    "#808080": 8,
  };
  return map[hex.toLowerCase()] || 7;
}
