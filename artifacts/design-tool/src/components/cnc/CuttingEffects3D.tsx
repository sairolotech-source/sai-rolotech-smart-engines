import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ChipParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  rotation: number;
  rotSpeed: number;
}

interface SparkParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const MAX_CHIPS = 60;
const MAX_SPARKS = 80;
const MAX_COOLANT = 40;

interface CoolantParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
}

export interface CuttingEffectsProps {
  toolPosition: [number, number, number];
  isCutting: boolean;
  isPlaying: boolean;
  feedRate?: number;
  spindleRpm?: number;
  showChips?: boolean;
  showSparks?: boolean;
  showCoolant?: boolean;
  mode?: "lathe" | "milling";
}

function createChip(pos: THREE.Vector3, mode: "lathe" | "milling"): ChipParticle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 15 + Math.random() * 35;
  const upSpeed = 10 + Math.random() * 25;

  let vx: number, vy: number, vz: number;
  if (mode === "lathe") {
    vx = Math.cos(angle) * speed;
    vy = upSpeed;
    vz = Math.sin(angle) * speed * 0.5;
  } else {
    vx = (Math.random() - 0.5) * speed;
    vy = upSpeed + Math.random() * 10;
    vz = (Math.random() - 0.5) * speed;
  }

  return {
    position: pos.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 3,
    )),
    velocity: new THREE.Vector3(vx, vy, vz),
    life: 0,
    maxLife: 0.4 + Math.random() * 0.8,
    size: 0.3 + Math.random() * 1.2,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 15,
  };
}

function createSpark(pos: THREE.Vector3, mode: "lathe" | "milling"): SparkParticle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 30 + Math.random() * 60;

  let vx: number, vy: number, vz: number;
  if (mode === "lathe") {
    vx = Math.cos(angle) * speed * 0.8;
    vy = 15 + Math.random() * 30;
    vz = Math.sin(angle) * speed * 0.4;
  } else {
    vx = (Math.random() - 0.5) * speed;
    vy = 20 + Math.random() * 40;
    vz = (Math.random() - 0.5) * speed;
  }

  return {
    position: pos.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2,
      (Math.random() - 0.5) * 2,
    )),
    velocity: new THREE.Vector3(vx, vy, vz),
    life: 0,
    maxLife: 0.15 + Math.random() * 0.3,
  };
}

function createCoolant(pos: THREE.Vector3, mode: "lathe" | "milling"): CoolantParticle {
  const offset = mode === "lathe"
    ? new THREE.Vector3(8 + Math.random() * 5, 12 + Math.random() * 5, Math.random() * 3)
    : new THREE.Vector3((Math.random() - 0.5) * 5, 20 + Math.random() * 10, (Math.random() - 0.5) * 5);

  return {
    position: pos.clone().add(offset),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      -20 - Math.random() * 15,
      (Math.random() - 0.5) * 8,
    ),
    life: 0,
    maxLife: 0.3 + Math.random() * 0.5,
    size: 0.5 + Math.random() * 1.5,
  };
}

export function CuttingEffects({
  toolPosition,
  isCutting,
  isPlaying,
  showChips = true,
  showSparks = true,
  showCoolant = true,
  mode = "lathe",
}: CuttingEffectsProps) {
  const chipsRef = useRef<ChipParticle[]>([]);
  const sparksRef = useRef<SparkParticle[]>([]);
  const coolantRef = useRef<CoolantParticle[]>([]);
  const chipMeshRef = useRef<THREE.InstancedMesh>(null);
  const sparkPointsRef = useRef<THREE.Points>(null);
  const coolantPointsRef = useRef<THREE.Points>(null);
  const spawnTimerRef = useRef(0);

  const chipGeom = useMemo(() => new THREE.BoxGeometry(1, 0.3, 0.5), []);
  const chipMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#b8a080",
    metalness: 0.85,
    roughness: 0.2,
    emissive: "#332200",
    emissiveIntensity: 0.3,
  }), []);

  const sparkGeom = useMemo(() => new THREE.BufferGeometry(), []);
  const sparkMat = useMemo(() => new THREE.PointsMaterial({
    color: "#ff8800",
    size: 1.5,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }), []);

  const coolantGeom = useMemo(() => new THREE.BufferGeometry(), []);
  const coolantMat = useMemo(() => new THREE.PointsMaterial({
    color: "#44aaff",
    size: 2,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    if (!isPlaying) return;
    const clampedDt = Math.min(dt, 0.05);
    const pos = new THREE.Vector3(...toolPosition);
    const gravity = -80;

    spawnTimerRef.current += clampedDt;

    if (isCutting && spawnTimerRef.current > 0.02) {
      spawnTimerRef.current = 0;

      if (showChips) {
        const chipCount = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < chipCount; i++) {
          if (chipsRef.current.length >= MAX_CHIPS) {
            chipsRef.current.shift();
          }
          chipsRef.current.push(createChip(pos, mode));
        }
      }

      if (showSparks) {
        const sparkCount = 2 + Math.floor(Math.random() * 5);
        for (let i = 0; i < sparkCount; i++) {
          if (sparksRef.current.length >= MAX_SPARKS) {
            sparksRef.current.shift();
          }
          sparksRef.current.push(createSpark(pos, mode));
        }
      }

      if (showCoolant) {
        const coolCount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < coolCount; i++) {
          if (coolantRef.current.length >= MAX_COOLANT) {
            coolantRef.current.shift();
          }
          coolantRef.current.push(createCoolant(pos, mode));
        }
      }
    }

    chipsRef.current = chipsRef.current.filter(c => {
      c.life += clampedDt;
      if (c.life >= c.maxLife) return false;
      c.velocity.y += gravity * clampedDt;
      c.position.addScaledVector(c.velocity, clampedDt);
      c.rotation += c.rotSpeed * clampedDt;
      return true;
    });

    sparksRef.current = sparksRef.current.filter(s => {
      s.life += clampedDt;
      if (s.life >= s.maxLife) return false;
      s.velocity.y += gravity * 0.5 * clampedDt;
      s.position.addScaledVector(s.velocity, clampedDt);
      return true;
    });

    coolantRef.current = coolantRef.current.filter(c => {
      c.life += clampedDt;
      if (c.life >= c.maxLife) return false;
      c.velocity.y += gravity * 0.3 * clampedDt;
      c.position.addScaledVector(c.velocity, clampedDt);
      return true;
    });

    if (chipMeshRef.current) {
      const mesh = chipMeshRef.current;
      for (let i = 0; i < MAX_CHIPS; i++) {
        if (i < chipsRef.current.length) {
          const c = chipsRef.current[i];
          const fade = 1 - c.life / c.maxLife;
          dummy.position.copy(c.position);
          dummy.rotation.set(c.rotation, c.rotation * 0.7, c.rotation * 0.3);
          dummy.scale.setScalar(c.size * fade);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        } else {
          dummy.position.set(0, -1000, 0);
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    if (sparkPointsRef.current && sparksRef.current.length > 0) {
      const positions = new Float32Array(sparksRef.current.length * 3);
      sparksRef.current.forEach((s, i) => {
        positions[i * 3] = s.position.x;
        positions[i * 3 + 1] = s.position.y;
        positions[i * 3 + 2] = s.position.z;
      });
      sparkGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      sparkGeom.attributes.position.needsUpdate = true;
    } else if (sparkPointsRef.current) {
      sparkGeom.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(0), 3));
    }

    if (coolantPointsRef.current && coolantRef.current.length > 0) {
      const positions = new Float32Array(coolantRef.current.length * 3);
      coolantRef.current.forEach((c, i) => {
        positions[i * 3] = c.position.x;
        positions[i * 3 + 1] = c.position.y;
        positions[i * 3 + 2] = c.position.z;
      });
      coolantGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      coolantGeom.attributes.position.needsUpdate = true;
    } else if (coolantPointsRef.current) {
      coolantGeom.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(0), 3));
    }
  });

  return (
    <group>
      {showChips && (
        <instancedMesh
          ref={chipMeshRef}
          args={[chipGeom, chipMat, MAX_CHIPS]}
          frustumCulled={false}
        />
      )}
      {showSparks && (
        <points ref={sparkPointsRef} geometry={sparkGeom} material={sparkMat} frustumCulled={false} />
      )}
      {showCoolant && (
        <points ref={coolantPointsRef} geometry={coolantGeom} material={coolantMat} frustumCulled={false} />
      )}
      {isCutting && isPlaying && (
        <pointLight
          position={toolPosition}
          color="#ff6600"
          intensity={1.5}
          distance={25}
          decay={2}
        />
      )}
    </group>
  );
}

export default CuttingEffects;
