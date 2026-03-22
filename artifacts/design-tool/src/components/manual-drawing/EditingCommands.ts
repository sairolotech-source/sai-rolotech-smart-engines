import type { Point, DrawEntity } from "./ManualDrawingEngine";
import { newEntityId } from "./ManualDrawingEngine";

function lineLineIntersection(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): { x: number; y: number; t1: number; t2: number } | null {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
    t1: t,
    t2: u,
  };
}

function dist(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function normalize(dx: number, dy: number): { nx: number; ny: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return { nx: 0, ny: 0 };
  return { nx: dx / len, ny: dy / len };
}

export function trimLine(
  line: DrawEntity,
  cuttingEdges: DrawEntity[],
  pickPoint: Point
): DrawEntity[] {
  if (line.type !== "line") return [line];

  const { x1, y1, x2, y2 } = line.data;
  const intersections: { t: number; x: number; y: number }[] = [];

  for (const edge of cuttingEdges) {
    if (edge.id === line.id) continue;
    if (edge.type === "line") {
      const result = lineLineIntersection(
        x1, y1, x2, y2,
        edge.data.x1, edge.data.y1, edge.data.x2, edge.data.y2
      );
      if (result && result.t1 > 0.001 && result.t1 < 0.999 && result.t2 >= -0.001 && result.t2 <= 1.001) {
        intersections.push({ t: result.t1, x: result.x, y: result.y });
      }
    } else if (edge.type === "circle") {
      const { cx, cy, r } = edge.data;
      const dx = x2 - x1, dy = y2 - y1;
      const fx = x1 - cx, fy = y1 - cy;
      const a = dx * dx + dy * dy;
      const b = 2 * (fx * dx + fy * dy);
      const c = fx * fx + fy * fy - r * r;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sqrtDisc = Math.sqrt(disc);
        for (const sign of [-1, 1]) {
          const t = (-b + sign * sqrtDisc) / (2 * a);
          if (t > 0.001 && t < 0.999) {
            intersections.push({ t, x: x1 + t * dx, y: y1 + t * dy });
          }
        }
      }
    }
  }

  if (intersections.length === 0) return [line];

  intersections.sort((a, b) => a.t - b.t);

  const pickT = closestTOnLine(x1, y1, x2, y2, pickPoint.x, pickPoint.y);
  let removeStart = 0, removeEnd = 1;

  for (let i = 0; i < intersections.length; i++) {
    if (intersections[i].t > pickT) {
      removeStart = i > 0 ? intersections[i - 1].t : 0;
      removeEnd = intersections[i].t;
      break;
    }
    if (i === intersections.length - 1) {
      removeStart = intersections[i].t;
      removeEnd = 1;
    }
  }

  const results: DrawEntity[] = [];
  if (removeStart > 0.001) {
    results.push({
      ...line,
      id: newEntityId("line"),
      data: {
        x1, y1,
        x2: x1 + removeStart * (x2 - x1),
        y2: y1 + removeStart * (y2 - y1),
      },
    });
  }
  if (removeEnd < 0.999) {
    results.push({
      ...line,
      id: newEntityId("line"),
      data: {
        x1: x1 + removeEnd * (x2 - x1),
        y1: y1 + removeEnd * (y2 - y1),
        x2, y2,
      },
    });
  }

  return results;
}

function closestTOnLine(x1: number, y1: number, x2: number, y2: number, px: number, py: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
}

export function extendLine(
  line: DrawEntity,
  boundaryEdges: DrawEntity[],
  pickPoint: Point
): DrawEntity | null {
  if (line.type !== "line") return null;

  const { x1, y1, x2, y2 } = line.data;
  const dx = x2 - x1, dy = y2 - y1;

  const distToStart = Math.hypot(pickPoint.x - x1, pickPoint.y - y1);
  const distToEnd = Math.hypot(pickPoint.x - x2, pickPoint.y - y2);
  const extendFromEnd = distToEnd < distToStart;

  let bestT: number | null = null;
  let bestDist = Infinity;

  for (const edge of boundaryEdges) {
    if (edge.id === line.id) continue;
    if (edge.type === "line") {
      const ex1 = x1 - 1000 * dx;
      const ey1 = y1 - 1000 * dy;
      const ex2 = x2 + 1000 * dx;
      const ey2 = y2 + 1000 * dy;
      const result = lineLineIntersection(
        ex1, ey1, ex2, ey2,
        edge.data.x1, edge.data.y1, edge.data.x2, edge.data.y2
      );
      if (result && result.t2 >= -0.001 && result.t2 <= 1.001) {
        const origT = ((result.x - x1) * dx + (result.y - y1) * dy) / (dx * dx + dy * dy);
        if (extendFromEnd && origT > 1.001) {
          const d = Math.hypot(result.x - x2, result.y - y2);
          if (d < bestDist) { bestDist = d; bestT = origT; }
        } else if (!extendFromEnd && origT < -0.001) {
          const d = Math.hypot(result.x - x1, result.y - y1);
          if (d < bestDist) { bestDist = d; bestT = origT; }
        }
      }
    }
  }

  if (bestT === null) return null;

  const newData = { ...line.data };
  if (extendFromEnd) {
    newData.x2 = x1 + bestT * dx;
    newData.y2 = y1 + bestT * dy;
  } else {
    newData.x1 = x1 + bestT * dx;
    newData.y1 = y1 + bestT * dy;
  }

  return { ...line, data: newData };
}

export function filletLines(
  line1: DrawEntity,
  line2: DrawEntity,
  radius: number,
  layer: string,
  color: string
): { modified1: DrawEntity; modified2: DrawEntity; arc: DrawEntity } | null {
  if (line1.type !== "line" || line2.type !== "line") return null;

  const { x1: ax1, y1: ay1, x2: ax2, y2: ay2 } = line1.data;
  const { x1: bx1, y1: by1, x2: bx2, y2: by2 } = line2.data;

  const inter = lineLineIntersection(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2);
  if (!inter) return null;

  const ip = { x: inter.x, y: inter.y };

  if (radius <= 0) {
    return {
      modified1: {
        ...line1,
        data: { ...line1.data, x2: ip.x, y2: ip.y },
      },
      modified2: {
        ...line2,
        data: { ...line2.data, x1: ip.x, y1: ip.y },
      },
      arc: {
        id: newEntityId("arc"),
        type: "arc",
        layer,
        color,
        lineType: "Continuous",
        lineWeight: 0.25,
        data: { cx: ip.x, cy: ip.y, r: 0, startAngle: 0, endAngle: 0 },
      },
    };
  }

  const d1 = normalize(ax2 - ax1, ay2 - ay1);
  const d2 = normalize(bx2 - bx1, by2 - by1);

  const bisX = d1.nx + d2.nx;
  const bisY = d1.ny + d2.ny;
  const bisLen = Math.sqrt(bisX * bisX + bisY * bisY);
  if (bisLen < 1e-10) return null;

  const halfAngle = Math.acos(Math.max(-1, Math.min(1, d1.nx * d2.nx + d1.ny * d2.ny))) / 2;
  if (Math.abs(Math.sin(halfAngle)) < 1e-10) return null;

  const distToCenter = radius / Math.sin(halfAngle);
  const centerX = ip.x + (bisX / bisLen) * distToCenter;
  const centerY = ip.y + (bisY / bisLen) * distToCenter;

  const tangentDist = radius / Math.tan(halfAngle);

  const t1x = ip.x + d1.nx * tangentDist;
  const t1y = ip.y + d1.ny * tangentDist;
  const t2x = ip.x + d2.nx * tangentDist;
  const t2y = ip.y + d2.ny * tangentDist;

  const startAngle = Math.atan2(t1y - centerY, t1x - centerX) * (180 / Math.PI);
  const endAngle = Math.atan2(t2y - centerY, t2x - centerX) * (180 / Math.PI);

  const distA1 = Math.hypot(ax1 - ip.x, ay1 - ip.y);
  const distA2 = Math.hypot(ax2 - ip.x, ay2 - ip.y);
  const distB1 = Math.hypot(bx1 - ip.x, by1 - ip.y);
  const distB2 = Math.hypot(bx2 - ip.x, by2 - ip.y);

  const mod1Data = { ...line1.data };
  if (distA2 < distA1) {
    mod1Data.x2 = t1x; mod1Data.y2 = t1y;
  } else {
    mod1Data.x1 = t1x; mod1Data.y1 = t1y;
  }

  const mod2Data = { ...line2.data };
  if (distB1 < distB2) {
    mod2Data.x1 = t2x; mod2Data.y1 = t2y;
  } else {
    mod2Data.x2 = t2x; mod2Data.y2 = t2y;
  }

  return {
    modified1: { ...line1, data: mod1Data },
    modified2: { ...line2, data: mod2Data },
    arc: {
      id: newEntityId("arc"),
      type: "arc",
      layer,
      color,
      lineType: "Continuous",
      lineWeight: 0.25,
      data: { cx: centerX, cy: centerY, r: radius, startAngle, endAngle },
    },
  };
}

export function chamferLines(
  line1: DrawEntity,
  line2: DrawEntity,
  dist1: number,
  dist2: number,
  layer: string,
  color: string
): { modified1: DrawEntity; modified2: DrawEntity; chamferLine: DrawEntity } | null {
  if (line1.type !== "line" || line2.type !== "line") return null;

  const { x1: ax1, y1: ay1, x2: ax2, y2: ay2 } = line1.data;
  const { x1: bx1, y1: by1, x2: bx2, y2: by2 } = line2.data;

  const inter = lineLineIntersection(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2);
  if (!inter) return null;

  const ip = { x: inter.x, y: inter.y };

  const d1 = normalize(ax2 - ax1, ay2 - ay1);
  const d2 = normalize(bx2 - bx1, by2 - by1);

  const distA1 = Math.hypot(ax1 - ip.x, ay1 - ip.y);
  const distA2 = Math.hypot(ax2 - ip.x, ay2 - ip.y);
  const awayFromInter1 = distA2 > distA1
    ? { nx: d1.nx, ny: d1.ny }
    : { nx: -d1.nx, ny: -d1.ny };

  const distB1 = Math.hypot(bx1 - ip.x, by1 - ip.y);
  const distB2 = Math.hypot(bx2 - ip.x, by2 - ip.y);
  const awayFromInter2 = distB2 > distB1
    ? { nx: d2.nx, ny: d2.ny }
    : { nx: -d2.nx, ny: -d2.ny };

  const cp1x = ip.x + awayFromInter1.nx * dist1;
  const cp1y = ip.y + awayFromInter1.ny * dist1;
  const cp2x = ip.x + awayFromInter2.nx * dist2;
  const cp2y = ip.y + awayFromInter2.ny * dist2;

  const mod1Data = { ...line1.data };
  if (distA2 > distA1) {
    mod1Data.x1 = cp1x; mod1Data.y1 = cp1y;
  } else {
    mod1Data.x2 = cp1x; mod1Data.y2 = cp1y;
  }

  const mod2Data = { ...line2.data };
  if (distB2 > distB1) {
    mod2Data.x1 = cp2x; mod2Data.y1 = cp2y;
  } else {
    mod2Data.x2 = cp2x; mod2Data.y2 = cp2y;
  }

  return {
    modified1: { ...line1, data: mod1Data },
    modified2: { ...line2, data: mod2Data },
    chamferLine: {
      id: newEntityId("line"),
      type: "line",
      layer,
      color,
      lineType: "Continuous",
      lineWeight: 0.25,
      data: { x1: cp1x, y1: cp1y, x2: cp2x, y2: cp2y },
    },
  };
}

export function rectangularArray(
  entities: DrawEntity[],
  rows: number,
  cols: number,
  rowSpacing: number,
  colSpacing: number
): DrawEntity[] {
  const result: DrawEntity[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue;
      const dx = c * colSpacing;
      const dy = r * rowSpacing;

      for (const ent of entities) {
        const newEnt = JSON.parse(JSON.stringify(ent)) as DrawEntity;
        newEnt.id = newEntityId(ent.type);

        if (ent.type === "line") {
          newEnt.data.x1 += dx; newEnt.data.y1 += dy;
          newEnt.data.x2 += dx; newEnt.data.y2 += dy;
        } else if (ent.type === "circle" || ent.type === "arc") {
          newEnt.data.cx += dx; newEnt.data.cy += dy;
        } else if (ent.type === "polyline") {
          newEnt.data.points = (newEnt.data.points as Point[]).map((p: Point) => ({
            x: p.x + dx, y: p.y + dy,
          }));
        } else if (ent.type === "text" || ent.type === "mtext" || ent.type === "point") {
          newEnt.data.x += dx; newEnt.data.y += dy;
        }

        result.push(newEnt);
      }
    }
  }

  return result;
}

export function polarArray(
  entities: DrawEntity[],
  center: Point,
  count: number,
  totalAngle: number = 360
): DrawEntity[] {
  const result: DrawEntity[] = [];
  const angleStep = (totalAngle / count) * (Math.PI / 180);

  for (let i = 1; i < count; i++) {
    const angle = i * angleStep;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const rotPt = (px: number, py: number) => ({
      x: center.x + (px - center.x) * cosA - (py - center.y) * sinA,
      y: center.y + (px - center.x) * sinA + (py - center.y) * cosA,
    });

    for (const ent of entities) {
      const newEnt = JSON.parse(JSON.stringify(ent)) as DrawEntity;
      newEnt.id = newEntityId(ent.type);

      if (ent.type === "line") {
        const np1 = rotPt(newEnt.data.x1, newEnt.data.y1);
        const np2 = rotPt(newEnt.data.x2, newEnt.data.y2);
        newEnt.data.x1 = np1.x; newEnt.data.y1 = np1.y;
        newEnt.data.x2 = np2.x; newEnt.data.y2 = np2.y;
      } else if (ent.type === "circle" || ent.type === "arc") {
        const nc = rotPt(newEnt.data.cx, newEnt.data.cy);
        newEnt.data.cx = nc.x; newEnt.data.cy = nc.y;
        if (ent.type === "arc") {
          newEnt.data.startAngle += (i * totalAngle) / count;
          newEnt.data.endAngle += (i * totalAngle) / count;
        }
      } else if (ent.type === "polyline") {
        newEnt.data.points = (newEnt.data.points as Point[]).map((p: Point) => rotPt(p.x, p.y));
      } else if (ent.type === "text" || ent.type === "mtext" || ent.type === "point") {
        const np = rotPt(newEnt.data.x, newEnt.data.y);
        newEnt.data.x = np.x; newEnt.data.y = np.y;
      }

      result.push(newEnt);
    }
  }

  return result;
}
