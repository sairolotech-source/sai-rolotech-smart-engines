import * as THREE from "three";

export interface STEPImportResult {
  geometry: THREE.BufferGeometry;
  name: string;
  boundingBox: THREE.Box3;
  faceCount: number;
  vertexCount: number;
}

interface STEPEntity {
  id: number;
  type: string;
  args: string;
}

interface CartesianPoint {
  x: number;
  y: number;
  z: number;
}

function parseSTEPEntities(content: string): Map<number, STEPEntity> {
  const entities = new Map<number, STEPEntity>();
  const dataSection = content.indexOf("DATA;");
  const endSection = content.indexOf("END-ISO-10303-21;");
  if (dataSection < 0) return entities;

  const data = content.substring(dataSection + 5, endSection > 0 ? endSection : undefined);
  const entityRegex = /#(\d+)\s*=\s*([A-Z_]+)\s*\(([^;]*)\)\s*;/g;
  let match: RegExpExecArray | null;

  while ((match = entityRegex.exec(data)) !== null) {
    entities.set(parseInt(match[1]), {
      id: parseInt(match[1]),
      type: match[2],
      args: match[3].trim(),
    });
  }

  return entities;
}

function parseRef(s: string): number {
  const m = s.trim().match(/^#(\d+)$/);
  return m ? parseInt(m[1]) : -1;
}

function parseFloatList(s: string): number[] {
  const inner = s.replace(/^\(/, "").replace(/\)$/, "");
  return inner.split(",").map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));
}

function parseArgList(s: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of s) {
    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function resolveCartesianPoint(
  entities: Map<number, STEPEntity>,
  refId: number
): CartesianPoint | null {
  const e = entities.get(refId);
  if (!e || e.type !== "CARTESIAN_POINT") return null;
  const args = parseArgList(e.args);
  if (args.length < 2) return null;
  const coords = parseFloatList(args[1]);
  return {
    x: coords[0] || 0,
    y: coords[1] || 0,
    z: coords[2] || 0,
  };
}

function buildTriangulatedGeometry(
  entities: Map<number, STEPEntity>
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];

  const closedShells: STEPEntity[] = [];
  for (const e of entities.values()) {
    if (
      e.type === "CLOSED_SHELL" ||
      e.type === "OPEN_SHELL" ||
      e.type === "MANIFOLD_SOLID_BREP" ||
      e.type === "BREP_WITH_VOIDS"
    ) {
      closedShells.push(e);
    }
  }

  const pointMap = new Map<string, number>();

  function addVertex(p: CartesianPoint): number {
    const key = `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`;
    if (pointMap.has(key)) return pointMap.get(key)!;
    const idx = vertices.length / 3;
    vertices.push(p.x, p.y, p.z);
    pointMap.set(key, idx);
    return idx;
  }

  const faceEntities: STEPEntity[] = [];
  for (const e of entities.values()) {
    if (e.type === "ADVANCED_FACE" || e.type === "FACE_SURFACE") {
      faceEntities.push(e);
    }
  }

  for (const face of faceEntities) {
    const faceArgs = parseArgList(face.args);
    const boundsStr = faceArgs[1] || "";
    const boundRefs = boundsStr
      .replace(/^\(/, "")
      .replace(/\)$/, "")
      .split(",")
      .map((s) => parseRef(s.trim()))
      .filter((r) => r > 0);

    const loopPoints: CartesianPoint[] = [];

    for (const boundRef of boundRefs) {
      const bound = entities.get(boundRef);
      if (!bound) continue;

      let loopRef = -1;
      if (
        bound.type === "FACE_BOUND" ||
        bound.type === "FACE_OUTER_BOUND"
      ) {
        const boundArgs = parseArgList(bound.args);
        loopRef = parseRef(boundArgs[1] || "");
      }

      const loop = entities.get(loopRef);
      if (!loop) continue;

      if (loop.type === "EDGE_LOOP" || loop.type === "POLY_LOOP") {
        const loopArgs = parseArgList(loop.args);
        const edgesStr = loopArgs[1] || loopArgs[0] || "";
        const edgeRefs = edgesStr
          .replace(/^\(/, "")
          .replace(/\)$/, "")
          .split(",")
          .map((s) => parseRef(s.trim()))
          .filter((r) => r > 0);

        if (loop.type === "POLY_LOOP") {
          for (const ptRef of edgeRefs) {
            const pt = resolveCartesianPoint(entities, ptRef);
            if (pt) loopPoints.push(pt);
          }
        } else {
          for (const edgeRef of edgeRefs) {
            const oriented = entities.get(edgeRef);
            if (!oriented) continue;

            let actualEdgeRef = edgeRef;
            if (
              oriented.type === "ORIENTED_EDGE"
            ) {
              const oeArgs = parseArgList(oriented.args);
              actualEdgeRef = parseRef(oeArgs[3] || oeArgs[2] || "");
            }

            const edge = entities.get(actualEdgeRef);
            if (!edge) continue;

            if (
              edge.type === "EDGE_CURVE" ||
              edge.type === "EDGE"
            ) {
              const ecArgs = parseArgList(edge.args);
              const v1Ref = parseRef(ecArgs[1] || "");
              const v2Ref = parseRef(ecArgs[2] || "");

              const v1Entity = entities.get(v1Ref);
              if (v1Entity && v1Entity.type === "VERTEX_POINT") {
                const vpArgs = parseArgList(v1Entity.args);
                const ptRef = parseRef(vpArgs[1] || vpArgs[0] || "");
                const pt = resolveCartesianPoint(entities, ptRef);
                if (pt) loopPoints.push(pt);
              }
            }
          }
        }
      }
    }

    if (loopPoints.length >= 3) {
      const idxs = loopPoints.map((p) => addVertex(p));
      for (let i = 1; i < idxs.length - 1; i++) {
        indices.push(idxs[0], idxs[i], idxs[i + 1]);
      }
    }
  }

  if (vertices.length === 0) {
    return buildFallbackGeometry(entities);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  if (indices.length > 0) {
    geometry.setIndex(indices);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function buildFallbackGeometry(
  entities: Map<number, STEPEntity>
): THREE.BufferGeometry {
  const points: CartesianPoint[] = [];

  for (const e of entities.values()) {
    if (e.type === "CARTESIAN_POINT") {
      const args = parseArgList(e.args);
      if (args.length >= 2) {
        const coords = parseFloatList(args[1]);
        if (coords.length >= 3) {
          points.push({ x: coords[0], y: coords[1], z: coords[2] });
        }
      }
    }
  }

  if (points.length < 4) {
    return new THREE.BoxGeometry(50, 50, 50);
  }

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }

  const sx = max.x - min.x || 10;
  const sy = max.y - min.y || 10;
  const sz = max.z - min.z || 10;
  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  const cz = (min.z + max.z) / 2;

  const geo = new THREE.BoxGeometry(sx, sy, sz);
  geo.translate(cx, cy, cz);
  return geo;
}

function extractProductName(content: string): string {
  const match = content.match(/PRODUCT\s*\(\s*'([^']+)'/);
  if (match) return match[1];
  const fileMatch = content.match(/FILE_NAME\s*\(\s*'([^']+)'/);
  if (fileMatch) return fileMatch[1].replace(/\.[^.]+$/, "");
  return "Imported Part";
}

export function parseSTEPFile(content: string): STEPImportResult {
  const entities = parseSTEPEntities(content);
  const geometry = buildTriangulatedGeometry(entities);
  const name = extractProductName(content);

  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox || new THREE.Box3();

  const posAttr = geometry.getAttribute("position");
  const vertexCount = posAttr ? posAttr.count : 0;
  const indexAttr = geometry.index;
  const faceCount = indexAttr ? indexAttr.count / 3 : vertexCount / 3;

  return {
    geometry,
    name,
    boundingBox,
    faceCount: Math.floor(faceCount),
    vertexCount,
  };
}

export function isSTEPFile(filename: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith(".step") || ext.endsWith(".stp");
}

export function readSTEPFileFromBlob(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read STEP file"));
    reader.readAsText(file);
  });
}
