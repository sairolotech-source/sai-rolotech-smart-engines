import * as THREE from "three";

export type CSGOperation = "union" | "subtract" | "intersect";

function createGeometryFromType(
  type: string,
  scale: [number, number, number]
): THREE.BufferGeometry {
  switch (type) {
    case "box":
    case "extrude":
      return new THREE.BoxGeometry(scale[0], scale[1], scale[2]);
    case "cylinder":
      return new THREE.CylinderGeometry(
        0.5 * scale[0],
        0.5 * scale[0],
        scale[1],
        32
      );
    case "sphere":
      return new THREE.SphereGeometry(0.5 * scale[0], 32, 16);
    case "cone":
      return new THREE.ConeGeometry(0.5 * scale[0], scale[1], 32);
    default:
      return new THREE.BoxGeometry(scale[0], scale[1], scale[2]);
  }
}

function applyTransformToGeometry(
  geometry: THREE.BufferGeometry,
  position: [number, number, number],
  rotation: [number, number, number]
): THREE.BufferGeometry {
  const matrix = new THREE.Matrix4();
  const euler = new THREE.Euler(rotation[0], rotation[1], rotation[2]);
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  matrix.compose(
    new THREE.Vector3(position[0], position[1], position[2]),
    quaternion,
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function performCSGManual(
  geoA: THREE.BufferGeometry,
  geoB: THREE.BufferGeometry,
  operation: CSGOperation
): THREE.BufferGeometry {
  const meshA = new THREE.Mesh(geoA);
  const meshB = new THREE.Mesh(geoB);

  const bspA = meshToPolygons(meshA);
  const bspB = meshToPolygons(meshB);

  let resultPolygons: CSGPolygon[];

  switch (operation) {
    case "union":
      resultPolygons = csgUnion(bspA, bspB);
      break;
    case "subtract":
      resultPolygons = csgSubtract(bspA, bspB);
      break;
    case "intersect":
      resultPolygons = csgIntersect(bspA, bspB);
      break;
  }

  return polygonsToGeometry(resultPolygons);
}

interface CSGVertex {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
}

interface CSGPolygon {
  vertices: CSGVertex[];
  plane: { normal: THREE.Vector3; w: number };
}

function computePlane(
  vertices: CSGVertex[]
): { normal: THREE.Vector3; w: number } {
  const a = vertices[0].pos;
  const b = vertices[1].pos;
  const c = vertices[2].pos;
  const normal = new THREE.Vector3()
    .subVectors(b, a)
    .cross(new THREE.Vector3().subVectors(c, a))
    .normalize();
  return { normal, w: normal.dot(a) };
}

function meshToPolygons(mesh: THREE.Mesh): CSGPolygon[] {
  const geo = mesh.geometry;
  const position = geo.getAttribute("position");
  const normalAttr = geo.getAttribute("normal");
  const index = geo.getIndex();
  const polygons: CSGPolygon[] = [];

  const getVertex = (i: number): CSGVertex => ({
    pos: new THREE.Vector3(
      position.getX(i),
      position.getY(i),
      position.getZ(i)
    ),
    normal: normalAttr
      ? new THREE.Vector3(
          normalAttr.getX(i),
          normalAttr.getY(i),
          normalAttr.getZ(i)
        )
      : new THREE.Vector3(0, 1, 0),
  });

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const vertices = [
        getVertex(index.getX(i)),
        getVertex(index.getX(i + 1)),
        getVertex(index.getX(i + 2)),
      ];
      const plane = computePlane(vertices);
      if (plane.normal.lengthSq() > 0) {
        polygons.push({ vertices, plane });
      }
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      const vertices = [getVertex(i), getVertex(i + 1), getVertex(i + 2)];
      const plane = computePlane(vertices);
      if (plane.normal.lengthSq() > 0) {
        polygons.push({ vertices, plane });
      }
    }
  }

  return polygons;
}

function polygonsToGeometry(polygons: CSGPolygon[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  for (const poly of polygons) {
    for (let i = 2; i < poly.vertices.length; i++) {
      const v0 = poly.vertices[0];
      const v1 = poly.vertices[i - 1];
      const v2 = poly.vertices[i];
      positions.push(v0.pos.x, v0.pos.y, v0.pos.z);
      positions.push(v1.pos.x, v1.pos.y, v1.pos.z);
      positions.push(v2.pos.x, v2.pos.y, v2.pos.z);
      normals.push(v0.normal.x, v0.normal.y, v0.normal.z);
      normals.push(v1.normal.x, v1.normal.y, v1.normal.z);
      normals.push(v2.normal.x, v2.normal.y, v2.normal.z);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

const EPSILON = 1e-5;

function splitPolygon(
  polygon: CSGPolygon,
  plane: { normal: THREE.Vector3; w: number },
  coplanarFront: CSGPolygon[],
  coplanarBack: CSGPolygon[],
  front: CSGPolygon[],
  back: CSGPolygon[]
) {
  const COPLANAR = 0;
  const FRONT = 1;
  const BACK = 2;
  const SPANNING = 3;

  let polygonType = 0;
  const types: number[] = [];

  for (const v of polygon.vertices) {
    const t = plane.normal.dot(v.pos) - plane.w;
    const type = t < -EPSILON ? BACK : t > EPSILON ? FRONT : COPLANAR;
    polygonType |= type;
    types.push(type);
  }

  switch (polygonType) {
    case COPLANAR:
      (plane.normal.dot(polygon.plane.normal) > 0
        ? coplanarFront
        : coplanarBack
      ).push(polygon);
      break;
    case FRONT:
      front.push(polygon);
      break;
    case BACK:
      back.push(polygon);
      break;
    case SPANNING: {
      const f: CSGVertex[] = [];
      const b: CSGVertex[] = [];
      for (let i = 0; i < polygon.vertices.length; i++) {
        const j = (i + 1) % polygon.vertices.length;
        const ti = types[i];
        const tj = types[j];
        const vi = polygon.vertices[i];
        const vj = polygon.vertices[j];
        if (ti !== BACK) f.push(vi);
        if (ti !== FRONT) b.push(vi);
        if ((ti | tj) === SPANNING) {
          const t =
            (plane.w - plane.normal.dot(vi.pos)) /
            plane.normal.dot(new THREE.Vector3().subVectors(vj.pos, vi.pos));
          const v: CSGVertex = {
            pos: vi.pos.clone().lerp(vj.pos, t),
            normal: vi.normal.clone().lerp(vj.normal, t).normalize(),
          };
          f.push(v);
          b.push(v.pos ? { pos: v.pos.clone(), normal: v.normal.clone() } : v);
        }
      }
      if (f.length >= 3) {
        const p = computePlane(f);
        if (p.normal.lengthSq() > 0) front.push({ vertices: f, plane: p });
      }
      if (b.length >= 3) {
        const p = computePlane(b);
        if (p.normal.lengthSq() > 0) back.push({ vertices: b, plane: p });
      }
      break;
    }
  }
}

interface BSPNode {
  plane: { normal: THREE.Vector3; w: number } | null;
  front: BSPNode | null;
  back: BSPNode | null;
  polygons: CSGPolygon[];
}

function buildBSP(polygons: CSGPolygon[]): BSPNode {
  const node: BSPNode = {
    plane: null,
    front: null,
    back: null,
    polygons: [],
  };
  if (polygons.length === 0) return node;

  node.plane = {
    normal: polygons[0].plane.normal.clone(),
    w: polygons[0].plane.w,
  };
  const frontPolys: CSGPolygon[] = [];
  const backPolys: CSGPolygon[] = [];

  for (const poly of polygons) {
    splitPolygon(
      poly,
      node.plane,
      node.polygons,
      node.polygons,
      frontPolys,
      backPolys
    );
  }

  if (frontPolys.length > 0) node.front = buildBSP(frontPolys);
  if (backPolys.length > 0) node.back = buildBSP(backPolys);

  return node;
}

function allPolygons(node: BSPNode): CSGPolygon[] {
  let polys = [...node.polygons];
  if (node.front) polys = polys.concat(allPolygons(node.front));
  if (node.back) polys = polys.concat(allPolygons(node.back));
  return polys;
}

function clipPolygons(
  node: BSPNode,
  polygons: CSGPolygon[]
): CSGPolygon[] {
  if (!node.plane) return [...polygons];
  let front: CSGPolygon[] = [];
  let back: CSGPolygon[] = [];
  for (const poly of polygons) {
    splitPolygon(poly, node.plane, front, back, front, back);
  }
  if (node.front) front = clipPolygons(node.front, front);
  back = node.back ? clipPolygons(node.back, back) : [];
  return front.concat(back);
}

function clipTo(node: BSPNode, bsp: BSPNode) {
  node.polygons = clipPolygons(bsp, node.polygons);
  if (node.front) clipTo(node.front, bsp);
  if (node.back) clipTo(node.back, bsp);
}

function invertNode(node: BSPNode) {
  for (const poly of node.polygons) {
    poly.vertices.reverse();
    for (const v of poly.vertices) v.normal.negate();
    poly.plane.normal.negate();
    poly.plane.w = -poly.plane.w;
  }
  if (node.plane) {
    node.plane.normal.negate();
    node.plane.w = -node.plane.w;
  }
  if (node.front) invertNode(node.front);
  if (node.back) invertNode(node.back);
  const temp = node.front;
  node.front = node.back;
  node.back = temp;
}

function addPolygonsToBSP(node: BSPNode, polygons: CSGPolygon[]) {
  if (polygons.length === 0) return;
  if (!node.plane) {
    node.plane = {
      normal: polygons[0].plane.normal.clone(),
      w: polygons[0].plane.w,
    };
  }
  const front: CSGPolygon[] = [];
  const back: CSGPolygon[] = [];
  for (const poly of polygons) {
    splitPolygon(poly, node.plane, node.polygons, node.polygons, front, back);
  }
  if (front.length > 0) {
    if (!node.front) node.front = buildBSP([]);
    addPolygonsToBSP(node.front, front);
  }
  if (back.length > 0) {
    if (!node.back) node.back = buildBSP([]);
    addPolygonsToBSP(node.back, back);
  }
}

function csgUnion(a: CSGPolygon[], b: CSGPolygon[]): CSGPolygon[] {
  const bspA = buildBSP(a);
  const bspB = buildBSP(b);
  clipTo(bspA, bspB);
  clipTo(bspB, bspA);
  invertNode(bspB);
  clipTo(bspB, bspA);
  invertNode(bspB);
  addPolygonsToBSP(bspA, allPolygons(bspB));
  return allPolygons(bspA);
}

function csgSubtract(a: CSGPolygon[], b: CSGPolygon[]): CSGPolygon[] {
  const bspA = buildBSP(a);
  const bspB = buildBSP(b);
  invertNode(bspA);
  clipTo(bspA, bspB);
  clipTo(bspB, bspA);
  invertNode(bspB);
  clipTo(bspB, bspA);
  invertNode(bspB);
  addPolygonsToBSP(bspA, allPolygons(bspB));
  invertNode(bspA);
  return allPolygons(bspA);
}

function csgIntersect(a: CSGPolygon[], b: CSGPolygon[]): CSGPolygon[] {
  const bspA = buildBSP(a);
  const bspB = buildBSP(b);
  invertNode(bspA);
  clipTo(bspB, bspA);
  invertNode(bspB);
  clipTo(bspA, bspB);
  clipTo(bspB, bspA);
  addPolygonsToBSP(bspA, allPolygons(bspB));
  invertNode(bspA);
  return allPolygons(bspA);
}

export function performCSG(
  objA: {
    type: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    customGeometry?: THREE.BufferGeometry;
  },
  objB: {
    type: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    customGeometry?: THREE.BufferGeometry;
  },
  operation: CSGOperation
): THREE.BufferGeometry {
  let geoA =
    objA.customGeometry?.clone() ||
    createGeometryFromType(objA.type, objA.scale);
  let geoB =
    objB.customGeometry?.clone() ||
    createGeometryFromType(objB.type, objB.scale);

  if (!objA.customGeometry) {
    geoA = applyTransformToGeometry(geoA, objA.position, objA.rotation);
  }
  if (!objB.customGeometry) {
    geoB = applyTransformToGeometry(geoB, objB.position, objB.rotation);
  }

  return performCSGManual(geoA, geoB, operation);
}

export function createRevolveGeometry(
  profilePoints: Array<{ x: number; y: number }>,
  axis: "x" | "y",
  angleDeg: number = 360,
  segments: number = 32
): THREE.BufferGeometry {
  const angleRad = (angleDeg * Math.PI) / 180;
  const steps = Math.max(3, Math.round((segments * angleDeg) / 360));

  const positions: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i < profilePoints.length - 1; i++) {
    const p0 = profilePoints[i];
    const p1 = profilePoints[i + 1];

    for (let j = 0; j < steps; j++) {
      const a0 = (j / steps) * angleRad;
      const a1 = ((j + 1) / steps) * angleRad;

      let v00: THREE.Vector3, v01: THREE.Vector3;
      let v10: THREE.Vector3, v11: THREE.Vector3;

      if (axis === "y") {
        v00 = new THREE.Vector3(
          p0.x * Math.cos(a0),
          p0.y,
          p0.x * Math.sin(a0)
        );
        v01 = new THREE.Vector3(
          p0.x * Math.cos(a1),
          p0.y,
          p0.x * Math.sin(a1)
        );
        v10 = new THREE.Vector3(
          p1.x * Math.cos(a0),
          p1.y,
          p1.x * Math.sin(a0)
        );
        v11 = new THREE.Vector3(
          p1.x * Math.cos(a1),
          p1.y,
          p1.x * Math.sin(a1)
        );
      } else {
        v00 = new THREE.Vector3(
          p0.x,
          p0.y * Math.cos(a0),
          p0.y * Math.sin(a0)
        );
        v01 = new THREE.Vector3(
          p0.x,
          p0.y * Math.cos(a1),
          p0.y * Math.sin(a1)
        );
        v10 = new THREE.Vector3(
          p1.x,
          p1.y * Math.cos(a0),
          p1.y * Math.sin(a0)
        );
        v11 = new THREE.Vector3(
          p1.x,
          p1.y * Math.cos(a1),
          p1.y * Math.sin(a1)
        );
      }

      const n1 = new THREE.Vector3()
        .subVectors(v10, v00)
        .cross(new THREE.Vector3().subVectors(v01, v00))
        .normalize();

      positions.push(v00.x, v00.y, v00.z);
      positions.push(v10.x, v10.y, v10.z);
      positions.push(v01.x, v01.y, v01.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);

      const n2 = new THREE.Vector3()
        .subVectors(v11, v01)
        .cross(new THREE.Vector3().subVectors(v10, v01))
        .normalize();

      positions.push(v01.x, v01.y, v01.z);
      positions.push(v10.x, v10.y, v10.z);
      positions.push(v11.x, v11.y, v11.z);
      normals.push(n2.x, n2.y, n2.z);
      normals.push(n2.x, n2.y, n2.z);
      normals.push(n2.x, n2.y, n2.z);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createSweepGeometry(
  profilePoints: Array<{ x: number; y: number }>,
  pathPoints: Array<{ x: number; y: number; z: number }>,
  closed: boolean = false
): THREE.BufferGeometry {
  if (pathPoints.length < 2 || profilePoints.length < 2) {
    return new THREE.BoxGeometry(1, 1, 1);
  }

  const positions: number[] = [];
  const normals: number[] = [];

  const frames: Array<{
    position: THREE.Vector3;
    normal: THREE.Vector3;
    binormal: THREE.Vector3;
    tangent: THREE.Vector3;
  }> = [];

  for (let i = 0; i < pathPoints.length; i++) {
    const p = new THREE.Vector3(
      pathPoints[i].x,
      pathPoints[i].y,
      pathPoints[i].z
    );
    let tangent: THREE.Vector3;

    if (i === 0) {
      tangent = new THREE.Vector3()
        .subVectors(
          new THREE.Vector3(
            pathPoints[1].x,
            pathPoints[1].y,
            pathPoints[1].z
          ),
          p
        )
        .normalize();
    } else if (i === pathPoints.length - 1) {
      tangent = new THREE.Vector3()
        .subVectors(
          p,
          new THREE.Vector3(
            pathPoints[i - 1].x,
            pathPoints[i - 1].y,
            pathPoints[i - 1].z
          )
        )
        .normalize();
    } else {
      tangent = new THREE.Vector3()
        .subVectors(
          new THREE.Vector3(
            pathPoints[i + 1].x,
            pathPoints[i + 1].y,
            pathPoints[i + 1].z
          ),
          new THREE.Vector3(
            pathPoints[i - 1].x,
            pathPoints[i - 1].y,
            pathPoints[i - 1].z
          )
        )
        .normalize();
    }

    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(tangent.dot(up)) > 0.99) {
      up = new THREE.Vector3(1, 0, 0);
    }

    const normal = new THREE.Vector3()
      .crossVectors(tangent, up)
      .normalize();
    const binormal = new THREE.Vector3()
      .crossVectors(tangent, normal)
      .normalize();

    frames.push({ position: p, normal, binormal, tangent });
  }

  for (let i = 0; i < frames.length - 1; i++) {
    const f0 = frames[i];
    const f1 = frames[i + 1];

    for (let j = 0; j < profilePoints.length - 1; j++) {
      const pp0 = profilePoints[j];
      const pp1 = profilePoints[j + 1];

      const v00 = f0.position
        .clone()
        .add(f0.normal.clone().multiplyScalar(pp0.x))
        .add(f0.binormal.clone().multiplyScalar(pp0.y));
      const v01 = f0.position
        .clone()
        .add(f0.normal.clone().multiplyScalar(pp1.x))
        .add(f0.binormal.clone().multiplyScalar(pp1.y));
      const v10 = f1.position
        .clone()
        .add(f1.normal.clone().multiplyScalar(pp0.x))
        .add(f1.binormal.clone().multiplyScalar(pp0.y));
      const v11 = f1.position
        .clone()
        .add(f1.normal.clone().multiplyScalar(pp1.x))
        .add(f1.binormal.clone().multiplyScalar(pp1.y));

      const n1 = new THREE.Vector3()
        .subVectors(v10, v00)
        .cross(new THREE.Vector3().subVectors(v01, v00))
        .normalize();

      positions.push(v00.x, v00.y, v00.z);
      positions.push(v10.x, v10.y, v10.z);
      positions.push(v01.x, v01.y, v01.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);

      positions.push(v01.x, v01.y, v01.z);
      positions.push(v10.x, v10.y, v10.z);
      positions.push(v11.x, v11.y, v11.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);
    }

    if (closed) {
      const pp0 = profilePoints[profilePoints.length - 1];
      const pp1 = profilePoints[0];
      const v00 = f0.position
        .clone()
        .add(f0.normal.clone().multiplyScalar(pp0.x))
        .add(f0.binormal.clone().multiplyScalar(pp0.y));
      const v01 = f0.position
        .clone()
        .add(f0.normal.clone().multiplyScalar(pp1.x))
        .add(f0.binormal.clone().multiplyScalar(pp1.y));
      const v10 = f1.position
        .clone()
        .add(f1.normal.clone().multiplyScalar(pp0.x))
        .add(f1.binormal.clone().multiplyScalar(pp0.y));
      const v11 = f1.position
        .clone()
        .add(f1.normal.clone().multiplyScalar(pp1.x))
        .add(f1.binormal.clone().multiplyScalar(pp1.y));

      const n1 = new THREE.Vector3()
        .subVectors(v10, v00)
        .cross(new THREE.Vector3().subVectors(v01, v00))
        .normalize();

      positions.push(v00.x, v00.y, v00.z);
      positions.push(v10.x, v10.y, v10.z);
      positions.push(v01.x, v01.y, v01.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);

      positions.push(v01.x, v01.y, v01.z);
      positions.push(v10.x, v10.y, v10.z);
      positions.push(v11.x, v11.y, v11.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);
      normals.push(n1.x, n1.y, n1.z);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createLoftGeometry(
  profiles: Array<{
    points: Array<{ x: number; y: number }>;
    z: number;
  }>,
  segments: number = 16
): THREE.BufferGeometry {
  if (profiles.length < 2) {
    return new THREE.BoxGeometry(1, 1, 1);
  }

  const maxPoints = Math.max(...profiles.map((p) => p.points.length));
  const normalizedProfiles = profiles.map((profile) => {
    const pts = profile.points;
    if (pts.length === maxPoints) return { ...profile, points: pts };
    const result: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < maxPoints; i++) {
      const t = i / (maxPoints - 1);
      const srcIdx = t * (pts.length - 1);
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, pts.length - 1);
      const frac = srcIdx - lo;
      result.push({
        x: pts[lo].x * (1 - frac) + pts[hi].x * frac,
        y: pts[lo].y * (1 - frac) + pts[hi].y * frac,
      });
    }
    return { ...profile, points: result };
  });

  const positions: number[] = [];
  const normals: number[] = [];

  for (let s = 0; s < normalizedProfiles.length - 1; s++) {
    const profileA = normalizedProfiles[s];
    const profileB = normalizedProfiles[s + 1];

    for (let substep = 0; substep < segments; substep++) {
      const t0 = substep / segments;
      const t1 = (substep + 1) / segments;
      const z0 = profileA.z + (profileB.z - profileA.z) * t0;
      const z1 = profileA.z + (profileB.z - profileA.z) * t1;

      for (let i = 0; i < maxPoints - 1; i++) {
        const a0 = profileA.points[i];
        const a1 = profileA.points[i + 1];
        const b0 = profileB.points[i];
        const b1 = profileB.points[i + 1];

        const x00 = a0.x + (b0.x - a0.x) * t0;
        const y00 = a0.y + (b0.y - a0.y) * t0;
        const x01 = a1.x + (b1.x - a1.x) * t0;
        const y01 = a1.y + (b1.y - a1.y) * t0;
        const x10 = a0.x + (b0.x - a0.x) * t1;
        const y10 = a0.y + (b0.y - a0.y) * t1;
        const x11 = a1.x + (b1.x - a1.x) * t1;
        const y11 = a1.y + (b1.y - a1.y) * t1;

        const v00 = new THREE.Vector3(x00, z0, y00);
        const v01 = new THREE.Vector3(x01, z0, y01);
        const v10 = new THREE.Vector3(x10, z1, y10);
        const v11 = new THREE.Vector3(x11, z1, y11);

        const n = new THREE.Vector3()
          .subVectors(v10, v00)
          .cross(new THREE.Vector3().subVectors(v01, v00))
          .normalize();

        positions.push(v00.x, v00.y, v00.z);
        positions.push(v10.x, v10.y, v10.z);
        positions.push(v01.x, v01.y, v01.z);
        normals.push(n.x, n.y, n.z);
        normals.push(n.x, n.y, n.z);
        normals.push(n.x, n.y, n.z);

        positions.push(v01.x, v01.y, v01.z);
        positions.push(v10.x, v10.y, v10.z);
        positions.push(v11.x, v11.y, v11.z);
        normals.push(n.x, n.y, n.z);
        normals.push(n.x, n.y, n.z);
        normals.push(n.x, n.y, n.z);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createShellGeometry(
  sourceGeometry: THREE.BufferGeometry,
  thickness: number
): THREE.BufferGeometry {
  const outerGeo = sourceGeometry.clone();

  const innerGeo = sourceGeometry.clone();
  const innerPos = innerGeo.getAttribute("position");
  const innerNorm = innerGeo.getAttribute("normal");

  if (!innerPos || !innerNorm) return outerGeo;

  for (let i = 0; i < innerPos.count; i++) {
    const nx = innerNorm.getX(i);
    const ny = innerNorm.getY(i);
    const nz = innerNorm.getZ(i);
    innerPos.setXYZ(
      i,
      innerPos.getX(i) - nx * thickness,
      innerPos.getY(i) - ny * thickness,
      innerPos.getZ(i) - nz * thickness
    );
  }

  const innerIndex = innerGeo.getIndex();
  if (innerIndex) {
    const reversed = new Uint32Array(innerIndex.count);
    for (let i = 0; i < innerIndex.count; i += 3) {
      reversed[i] = innerIndex.getX(i);
      reversed[i + 1] = innerIndex.getX(i + 2);
      reversed[i + 2] = innerIndex.getX(i + 1);
    }
    innerGeo.setIndex(new THREE.BufferAttribute(reversed, 1));
  } else {
    const posArr = innerPos.array as Float32Array;
    const newArr = new Float32Array(posArr.length);
    for (let i = 0; i < posArr.length; i += 9) {
      newArr[i] = posArr[i];
      newArr[i + 1] = posArr[i + 1];
      newArr[i + 2] = posArr[i + 2];
      newArr[i + 3] = posArr[i + 6];
      newArr[i + 4] = posArr[i + 7];
      newArr[i + 5] = posArr[i + 8];
      newArr[i + 6] = posArr[i + 3];
      newArr[i + 7] = posArr[i + 4];
      newArr[i + 8] = posArr[i + 5];
    }
    innerGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(newArr, 3)
    );
  }

  for (let i = 0; i < innerNorm.count; i++) {
    innerNorm.setXYZ(
      i,
      -innerNorm.getX(i),
      -innerNorm.getY(i),
      -innerNorm.getZ(i)
    );
  }

  const merged = mergeBufferGeometries([outerGeo, innerGeo]);
  return merged || outerGeo;
}

function mergeBufferGeometries(
  geometries: THREE.BufferGeometry[]
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];

  for (const geo of geometries) {
    const pos = geo.getAttribute("position");
    const norm = geo.getAttribute("normal");
    const index = geo.getIndex();

    if (index) {
      for (let i = 0; i < index.count; i++) {
        const idx = index.getX(i);
        positions.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
        if (norm)
          normals.push(norm.getX(idx), norm.getY(idx), norm.getZ(idx));
        else normals.push(0, 1, 0);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (norm)
          normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        else normals.push(0, 1, 0);
      }
    }
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  result.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normals, 3)
  );
  return result;
}

export function applyFilletToGeometry(
  geometry: THREE.BufferGeometry,
  radius: number,
  _selectedEdges?: number[]
): THREE.BufferGeometry {
  const geo = geometry.clone();
  const pos = geo.getAttribute("position");
  const norm = geo.getAttribute("normal");
  if (!pos || !norm) return geo;

  const bbox = new THREE.Box3();
  bbox.setFromBufferAttribute(pos as THREE.BufferAttribute);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const r = Math.min(radius, maxDim * 0.3);

  const center = new THREE.Vector3();
  bbox.getCenter(center);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const dx = x - center.x;
    const dy = y - center.y;
    const dz = z - center.z;

    const halfX = size.x / 2;
    const halfY = size.y / 2;
    const halfZ = size.z / 2;

    const edgeDistX = halfX - Math.abs(dx);
    const edgeDistY = halfY - Math.abs(dy);
    const edgeDistZ = halfZ - Math.abs(dz);

    const dists = [edgeDistX, edgeDistY, edgeDistZ].sort((a, b) => a - b);

    if (dists[0] < r && dists[1] < r) {
      const d0 = Math.max(0, r - dists[0]);
      const d1 = Math.max(0, r - dists[1]);
      const dist = Math.sqrt(d0 * d0 + d1 * d1);
      if (dist > 0) {
        const blend = 1 - Math.min(1, (r - dist) / r) * 0.3;
        const nx = norm.getX(i);
        const ny = norm.getY(i);
        const nz = norm.getZ(i);
        pos.setXYZ(
          i,
          x + nx * (r - dist) * blend * 0.15,
          y + ny * (r - dist) * blend * 0.15,
          z + nz * (r - dist) * blend * 0.15
        );
      }
    }
  }

  geo.computeVertexNormals();
  return geo;
}

export function applyChamferToGeometry(
  geometry: THREE.BufferGeometry,
  distance: number,
  _selectedEdges?: number[]
): THREE.BufferGeometry {
  const geo = geometry.clone();
  const pos = geo.getAttribute("position");
  const norm = geo.getAttribute("normal");
  if (!pos || !norm) return geo;

  const bbox = new THREE.Box3();
  bbox.setFromBufferAttribute(pos as THREE.BufferAttribute);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const d = Math.min(distance, Math.min(size.x, size.y, size.z) * 0.3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const dx = x - center.x;
    const dy = y - center.y;
    const dz = z - center.z;

    const halfX = size.x / 2;
    const halfY = size.y / 2;
    const halfZ = size.z / 2;

    const edgeDistX = halfX - Math.abs(dx);
    const edgeDistY = halfY - Math.abs(dy);
    const edgeDistZ = halfZ - Math.abs(dz);

    const dists = [edgeDistX, edgeDistY, edgeDistZ].sort((a, b) => a - b);

    if (dists[0] < d && dists[1] < d) {
      const cutAmount = d - (dists[0] + dists[1]) / 2;
      if (cutAmount > 0) {
        const nx = norm.getX(i);
        const ny = norm.getY(i);
        const nz = norm.getZ(i);
        pos.setXYZ(
          i,
          x - nx * cutAmount * 0.2,
          y - ny * cutAmount * 0.2,
          z - nz * cutAmount * 0.2
        );
      }
    }
  }

  geo.computeVertexNormals();
  return geo;
}

export function geometryToSTL(
  geometry: THREE.BufferGeometry,
  name: string = "solid"
): string {
  const pos = geometry.getAttribute("position");
  if (!pos) return "";

  const lines: string[] = [`solid ${name}`];
  const index = geometry.getIndex();

  const getTriangle = (
    i0: number,
    i1: number,
    i2: number
  ): { v: THREE.Vector3[]; n: THREE.Vector3 } => {
    const v0 = new THREE.Vector3(pos.getX(i0), pos.getY(i0), pos.getZ(i0));
    const v1 = new THREE.Vector3(pos.getX(i1), pos.getY(i1), pos.getZ(i1));
    const v2 = new THREE.Vector3(pos.getX(i2), pos.getY(i2), pos.getZ(i2));
    const n = new THREE.Vector3()
      .subVectors(v1, v0)
      .cross(new THREE.Vector3().subVectors(v2, v0))
      .normalize();
    return { v: [v0, v1, v2], n };
  };

  const count = index ? index.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    const { v, n } = getTriangle(i0, i1, i2);
    lines.push(`  facet normal ${n.x} ${n.y} ${n.z}`);
    lines.push(`    outer loop`);
    for (const vert of v) {
      lines.push(`      vertex ${vert.x} ${vert.y} ${vert.z}`);
    }
    lines.push(`    endloop`);
    lines.push(`  endfacet`);
  }

  lines.push(`endsolid ${name}`);
  return lines.join("\n");
}

export function geometryToSTEP(
  geometry: THREE.BufferGeometry,
  name: string = "Part"
): string {
  const pos = geometry.getAttribute("position");
  if (!pos) return "";

  const bbox = new THREE.Box3();
  bbox.setFromBufferAttribute(pos as THREE.BufferAttribute);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);

  const triCount = pos.count / 3;

  const lines: string[] = [
    `ISO-10303-21;`,
    `HEADER;`,
    `FILE_DESCRIPTION(('3D Studio Mesh Export - ${triCount} triangles - approximate BREP representation'),'2;1');`,
    `FILE_NAME('${name}.step','${now}',(''),(''),'','3D Studio','');`,
    `FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));`,
    `ENDSEC;`,
    `DATA;`,
    `#1=APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#2);`,
    `#2=APPLICATION_CONTEXT('core data for automotive mechanical design processes');`,
    `#3=SHAPE_DEFINITION_REPRESENTATION(#4,#10);`,
    `#4=PRODUCT_DEFINITION_SHAPE('','',#5);`,
    `#5=PRODUCT_DEFINITION('design','',#6,#9);`,
    `#6=PRODUCT_DEFINITION_FORMATION('','',#7);`,
    `#7=PRODUCT('${name}','${name}','',(#8));`,
    `#8=PRODUCT_CONTEXT('',#2,'mechanical');`,
    `#9=PRODUCT_DEFINITION_CONTEXT('part definition',#2,'design');`,
    `#10=ADVANCED_BREP_SHAPE_REPRESENTATION('',(#11,#12),#13);`,
    `#11=AXIS2_PLACEMENT_3D('',#14,#15,#16);`,
    `#12=MANIFOLD_SOLID_BREP('${name}',#17);`,
    `#13=(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#18)) GLOBAL_UNIT_ASSIGNED_CONTEXT((#19,#20,#21)) REPRESENTATION_CONTEXT('Context3D','3D Context'));`,
    `#14=CARTESIAN_POINT('',(0.,0.,0.));`,
    `#15=DIRECTION('',(0.,0.,1.));`,
    `#16=DIRECTION('',(1.,0.,0.));`,
    `#17=CLOSED_SHELL('',(#22));`,
    `#18=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#19,'distance_accuracy_value','');`,
    `#19=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));`,
    `#20=(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.));`,
    `#21=(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT());`,
    `#22=ADVANCED_FACE('',(#23),#24,.T.);`,
    `#23=FACE_BOUND('',#25,.T.);`,
    `#24=PLANE('',#26);`,
    `#25=EDGE_LOOP('',(#27));`,
    `#26=AXIS2_PLACEMENT_3D('',#28,#29,#30);`,
    `#27=ORIENTED_EDGE('',*,*,#31,.T.);`,
    `#28=CARTESIAN_POINT('',(${center.x},${center.y},${center.z}));`,
    `#29=DIRECTION('',(0.,0.,1.));`,
    `#30=DIRECTION('',(1.,0.,0.));`,
    `#31=EDGE_CURVE('',#32,#33,#34,.T.);`,
    `#32=VERTEX_POINT('',#35);`,
    `#33=VERTEX_POINT('',#36);`,
    `#34=LINE('',#37,#38);`,
    `#35=CARTESIAN_POINT('',(${bbox.min.x},${bbox.min.y},${bbox.min.z}));`,
    `#36=CARTESIAN_POINT('',(${bbox.max.x},${bbox.max.y},${bbox.max.z}));`,
    `#37=CARTESIAN_POINT('',(${center.x},${center.y},${center.z}));`,
    `#38=VECTOR('',#39,1.);`,
    `#39=DIRECTION('',(1.,0.,0.));`,
    `ENDSEC;`,
    `END-ISO-10303-21;`,
  ];

  return lines.join("\n");
}

export function getDefaultProfile(
  type: "rect" | "circle" | "l-shape",
  size: number = 1
): Array<{ x: number; y: number }> {
  const s = size / 2;
  switch (type) {
    case "rect":
      return [
        { x: -s, y: -s },
        { x: s, y: -s },
        { x: s, y: s },
        { x: -s, y: s },
        { x: -s, y: -s },
      ];
    case "circle": {
      const pts: Array<{ x: number; y: number }> = [];
      const segs = 24;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push({ x: Math.cos(a) * s, y: Math.sin(a) * s });
      }
      return pts;
    }
    case "l-shape":
      return [
        { x: -s, y: -s },
        { x: s, y: -s },
        { x: s, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: s },
        { x: -s, y: s },
        { x: -s, y: -s },
      ];
  }
}
