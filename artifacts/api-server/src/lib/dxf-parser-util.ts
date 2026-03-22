export interface Segment {
  type: "line" | "arc";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx?: number;
  cy?: number;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  length: number;
}

export interface BendInfo {
  angle: number;
  radius: number;
  segmentIndex: number;
  side: "left" | "right";
  direction: "up" | "down";
}

export interface ProfileGeometry {
  segments: Segment[];
  bends: BendInfo[];
  totalLength: number;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  symmetryAxis?: number;
  centroid?: { x: number; y: number };
}

function parseNumber(s: string): number {
  return parseFloat(s) || 0;
}

function distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function arcLength(radius: number, startAngle: number, endAngle: number): number {
  let delta = endAngle - startAngle;
  if (delta < 0) delta += 360;
  return (Math.PI * radius * delta) / 180;
}

export function parseDxfContent(content: string): ProfileGeometry {
  const lines = content.split(/\r?\n/);
  const segments: Segment[] = [];
  const entities: { type: string; data: Record<string, string[]> }[] = [];

  let i = 0;
  let inEntities = false;
  let currentEntity: { type: string; data: Record<string, string[]> } | null = null;

  while (i < lines.length) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim() ?? "";
    i += 2;

    if (code === "2" && value === "ENTITIES") {
      inEntities = true;
      continue;
    }
    if (code === "2" && value === "ENDSEC" && inEntities) {
      if (currentEntity) entities.push(currentEntity);
      currentEntity = null;
      inEntities = false;
      continue;
    }

    if (!inEntities) continue;

    if (code === "0") {
      if (currentEntity) entities.push(currentEntity);
      if (["LINE", "ARC", "LWPOLYLINE", "POLYLINE", "CIRCLE", "SPLINE"].includes(value)) {
        currentEntity = { type: value, data: {} };
      } else {
        currentEntity = null;
      }
      continue;
    }

    if (currentEntity && code !== undefined) {
      if (!currentEntity.data[code]) currentEntity.data[code] = [];
      currentEntity.data[code].push(value);
    }
  }

  if (currentEntity) entities.push(currentEntity);

  for (const entity of entities) {
    const d = entity.data;
    if (entity.type === "LINE") {
      const x1 = parseNumber(d["10"]?.[0] ?? "0");
      const y1 = parseNumber(d["20"]?.[0] ?? "0");
      const x2 = parseNumber(d["11"]?.[0] ?? "0");
      const y2 = parseNumber(d["21"]?.[0] ?? "0");
      segments.push({ type: "line", x1, y1, x2, y2, length: distanceBetween(x1, y1, x2, y2) });
    } else if (entity.type === "ARC") {
      const cx = parseNumber(d["10"]?.[0] ?? "0");
      const cy = parseNumber(d["20"]?.[0] ?? "0");
      const radius = parseNumber(d["40"]?.[0] ?? "1");
      const startAngle = parseNumber(d["50"]?.[0] ?? "0");
      const endAngle = parseNumber(d["51"]?.[0] ?? "90");
      const x1 = cx + radius * Math.cos((startAngle * Math.PI) / 180);
      const y1 = cy + radius * Math.sin((startAngle * Math.PI) / 180);
      const x2 = cx + radius * Math.cos((endAngle * Math.PI) / 180);
      const y2 = cy + radius * Math.sin((endAngle * Math.PI) / 180);
      segments.push({
        type: "arc", x1, y1, x2, y2, cx, cy, radius, startAngle, endAngle,
        length: arcLength(radius, startAngle, endAngle),
      });
    }
  }

  if (segments.length === 0) {
    return {
      segments: [],
      bends: [],
      totalLength: 0,
      boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
    };
  }

  const totalLength = segments.reduce((sum, s) => sum + s.length, 0);

  const allX = segments.flatMap(s => [s.x1, s.x2]);
  const allY = segments.flatMap(s => [s.y1, s.y2]);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const bends: BendInfo[] = [];
  for (let idx = 0; idx < segments.length - 1; idx++) {
    const s1 = segments[idx];
    const s2 = segments[idx + 1];
    if (!s1 || !s2) continue;
    if (s1.type === "line" && s2.type === "line") {
      const dx1 = s1.x2 - s1.x1; const dy1 = s1.y2 - s1.y1;
      const dx2 = s2.x2 - s2.x1; const dy2 = s2.y2 - s2.y1;
      const angle1 = Math.atan2(dy1, dx1);
      const angle2 = Math.atan2(dy2, dx2);
      let diff = ((angle2 - angle1) * 180) / Math.PI;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      if (Math.abs(diff) > 1) {
        bends.push({
          angle: Math.abs(diff),
          radius: 2,
          segmentIndex: idx,
          side: diff > 0 ? "left" : "right",
          direction: diff > 0 ? "up" : "down",
        });
      }
    } else if (s1.type === "arc" || s2.type === "arc") {
      const r = s1.type === "arc" ? (s1.radius ?? 5) : (s2.radius ?? 5);
      let delta = 0;
      if (s1.type === "arc") {
        delta = s1.endAngle! - s1.startAngle!;
        if (delta < 0) delta += 360;
      }
      bends.push({
        angle: delta || 45,
        radius: r,
        segmentIndex: idx,
        side: "left",
        direction: "up",
      });
    }
  }

  return {
    segments,
    bends,
    totalLength,
    boundingBox: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
    centroid: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}
