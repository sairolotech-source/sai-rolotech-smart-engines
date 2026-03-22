import type { Point, DrawEntity } from "./ManualDrawingEngine";
import { worldToCanvas } from "./ManualDrawingEngine";

export type HatchPattern = "ANSI31" | "ANSI37" | "ISO" | "SOLID" | "DOTS" | "DASH";

export interface HatchStyle {
  pattern: HatchPattern;
  scale: number;
  angle: number;
  color: string;
}

export const DEFAULT_HATCH_STYLE: HatchStyle = {
  pattern: "ANSI31",
  scale: 1,
  angle: 0,
  color: "#ffffff",
};

export const HATCH_PATTERNS: Record<HatchPattern, { label: string; description: string }> = {
  ANSI31: { label: "ANSI31", description: "Iron, Brick, Stone masonry (45° lines)" },
  ANSI37: { label: "ANSI37", description: "Cast iron / section lining (45° closely spaced)" },
  ISO: { label: "ISO", description: "ISO crosshatch (45° + 135° lines)" },
  SOLID: { label: "SOLID", description: "Solid fill" },
  DOTS: { label: "DOTS", description: "Dot pattern" },
  DASH: { label: "DASH", description: "Dashed lines" },
};

export function extractBoundaryPoints(entities: DrawEntity[], selectedIds: string[]): Point[][] {
  const boundaries: Point[][] = [];

  for (const ent of entities) {
    if (!selectedIds.includes(ent.id)) continue;

    if (ent.type === "polyline" && ent.data.closed) {
      const pts: Point[] = ent.data.points || [];
      if (pts.length >= 3) {
        boundaries.push([...pts]);
      }
    } else if (ent.type === "circle") {
      const { cx, cy, r } = ent.data;
      const steps = 64;
      const pts: Point[] = [];
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      boundaries.push(pts);
    } else if (ent.type === "rectangle") {
      const pts: Point[] = ent.data.points || [];
      if (pts.length >= 3) {
        boundaries.push([...pts]);
      }
    }
  }

  return boundaries;
}

function getPolyBounds(pts: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function pointInPolygon(px: number, py: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function lineSegIntersectsPolygon(
  x1: number, y1: number, x2: number, y2: number, polygon: Point[]
): { enter: number; exit: number }[] {
  const intersections: number[] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const px1 = polygon[j].x, py1 = polygon[j].y;
    const px2 = polygon[i].x, py2 = polygon[i].y;
    const edx = px2 - px1;
    const edy = py2 - py1;
    const denom = dx * edy - dy * edx;
    if (Math.abs(denom) < 1e-10) continue;
    const t = ((px1 - x1) * edy - (py1 - y1) * edx) / denom;
    const u = ((px1 - x1) * dy - (py1 - y1) * dx) / denom;
    if (u >= 0 && u <= 1 && t >= -0.001 && t <= 1.001) {
      intersections.push(Math.max(0, Math.min(1, t)));
    }
  }

  intersections.sort((a, b) => a - b);
  const segments: { enter: number; exit: number }[] = [];
  for (let i = 0; i < intersections.length - 1; i += 2) {
    segments.push({ enter: intersections[i], exit: intersections[i + 1] });
  }
  return segments;
}

export function generateHatchLines(
  boundary: Point[],
  style: HatchStyle
): { x1: number; y1: number; x2: number; y2: number }[] {
  const bounds = getPolyBounds(boundary);
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const totalAngle = style.angle;

  let spacing: number;
  let angles: number[];

  switch (style.pattern) {
    case "ANSI31":
      spacing = 4 * style.scale;
      angles = [45 + totalAngle];
      break;
    case "ANSI37":
      spacing = 2 * style.scale;
      angles = [45 + totalAngle];
      break;
    case "ISO":
      spacing = 4 * style.scale;
      angles = [45 + totalAngle, 135 + totalAngle];
      break;
    case "DOTS":
      spacing = 5 * style.scale;
      angles = [0 + totalAngle, 90 + totalAngle];
      break;
    case "DASH":
      spacing = 3 * style.scale;
      angles = [0 + totalAngle];
      break;
    case "SOLID":
      spacing = 0.8 * style.scale;
      angles = [45 + totalAngle];
      break;
    default:
      spacing = 4 * style.scale;
      angles = [45 + totalAngle];
  }

  if (spacing < 0.1) spacing = 0.1;

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const diag = Math.sqrt(
    (bounds.maxX - bounds.minX) ** 2 + (bounds.maxY - bounds.minY) ** 2
  );

  const maxHatchLines = 5000;

  for (const angleDeg of angles) {
    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    const perpX = -sinA;
    const perpY = cosA;

    const numLines = Math.min(Math.ceil(diag / spacing) + 2, 500);

    for (let i = -numLines; i <= numLines; i++) {
      if (lines.length >= maxHatchLines) break;
      const offset = i * spacing;
      const ox = cx + perpX * offset;
      const oy = cy + perpY * offset;

      const lx1 = ox - cosA * diag;
      const ly1 = oy - sinA * diag;
      const lx2 = ox + cosA * diag;
      const ly2 = oy + sinA * diag;

      const segs = lineSegIntersectsPolygon(lx1, ly1, lx2, ly2, boundary);
      for (const seg of segs) {
        const dx = lx2 - lx1;
        const dy = ly2 - ly1;
        lines.push({
          x1: lx1 + dx * seg.enter,
          y1: ly1 + dy * seg.enter,
          x2: lx1 + dx * seg.exit,
          y2: ly1 + dy * seg.exit,
        });
      }
    }
  }

  return lines;
}

export function renderHatchOnCanvas(
  ctx: CanvasRenderingContext2D,
  entity: DrawEntity,
  panX: number,
  panY: number,
  zoom: number,
  canvasH: number,
  preview: boolean = false
): void {
  if (entity.type !== "hatch") return;

  const { boundary, style, hatchLines } = entity.data;
  const hStyle: HatchStyle = style || DEFAULT_HATCH_STYLE;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = hatchLines || [];

  ctx.save();
  ctx.strokeStyle = preview ? "#60a5fa" : (hStyle.color || entity.color);
  ctx.lineWidth = preview ? 0.5 : Math.max(0.3, 0.5 * zoom * 0.3);
  ctx.setLineDash(preview ? [4, 3] : []);

  if (hStyle.pattern === "SOLID") {
    const bPts: Point[] = boundary || [];
    if (bPts.length >= 3) {
      ctx.beginPath();
      const c0 = worldToCanvas(bPts[0].x, bPts[0].y, panX, panY, zoom, canvasH);
      ctx.moveTo(c0.cx, c0.cy);
      for (let i = 1; i < bPts.length; i++) {
        const cp = worldToCanvas(bPts[i].x, bPts[i].y, panX, panY, zoom, canvasH);
        ctx.lineTo(cp.cx, cp.cy);
      }
      ctx.closePath();
      ctx.fillStyle = preview ? "rgba(96,165,250,0.2)" : (hStyle.color || entity.color);
      ctx.globalAlpha = preview ? 0.3 : 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  for (const line of lines) {
    const c1 = worldToCanvas(line.x1, line.y1, panX, panY, zoom, canvasH);
    const c2 = worldToCanvas(line.x2, line.y2, panX, panY, zoom, canvasH);
    ctx.beginPath();
    ctx.moveTo(c1.cx, c1.cy);
    ctx.lineTo(c2.cx, c2.cy);
    ctx.stroke();
  }

  ctx.restore();
}
