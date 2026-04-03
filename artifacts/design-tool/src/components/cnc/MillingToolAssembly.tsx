import React, { useMemo } from "react";
import * as THREE from "three";

export type MillingToolType = "end_mill" | "face_mill" | "ball_nose" | "drill";

export interface MillingToolDimensions {
  type: MillingToolType;
  diameter: number;
  fluteLength: number;
  overallLength: number;
  fluteCount: number;
  cornerRadius?: number;
  holderDiameter: number;
  holderLength: number;
  shankDiameter: number;
  tipAngle?: number;
}

const DEFAULT_TOOL: MillingToolDimensions = {
  type: "end_mill",
  diameter: 10,
  fluteLength: 25,
  overallLength: 75,
  fluteCount: 4,
  cornerRadius: 0,
  holderDiameter: 40,
  holderLength: 50,
  shankDiameter: 10,
};

interface MillingToolAssemblyProps {
  tool: Partial<MillingToolDimensions>;
  position: [number, number, number];
  isCollision?: boolean;
  isCutting?: boolean;
}

function EndMillGeometry({ tool }: { tool: MillingToolDimensions }) {
  const cuttingGeo = useMemo(() => {
    const r = tool.diameter / 2;
    const cr = tool.cornerRadius || 0;
    const fluteLen = tool.fluteLength;
    const segments = 32;

    if (cr > 0 && cr < r) {
      const pts: THREE.Vector2[] = [];
      pts.push(new THREE.Vector2(0, 0));
      const arcSteps = 8;
      for (let i = 0; i <= arcSteps; i++) {
        const angle = (Math.PI / 2) * (1 - i / arcSteps);
        pts.push(
          new THREE.Vector2(
            r - cr + cr * Math.cos(angle),
            cr - cr * Math.sin(angle)
          )
        );
      }
      pts.push(new THREE.Vector2(r, fluteLen));
      pts.push(new THREE.Vector2(0, fluteLen));
      return new THREE.LatheGeometry(pts, segments);
    }

    return new THREE.CylinderGeometry(r, r, fluteLen, segments);
  }, [tool.diameter, tool.fluteLength, tool.cornerRadius]);

  return (
    <mesh
      geometry={cuttingGeo}
      position={[0, tool.cornerRadius ? 0 : tool.fluteLength / 2, 0]}
      castShadow
    >
      <meshStandardMaterial
        color="#4a90d9"
        metalness={0.7}
        roughness={0.25}
      />
    </mesh>
  );
}

function BallNoseGeometry({ tool }: { tool: MillingToolDimensions }) {
  const r = tool.diameter / 2;
  const fluteLen = tool.fluteLength;

  return (
    <group>
      <mesh position={[0, r, 0]} castShadow>
        <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#4a90d9" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, r + (fluteLen - r) / 2, 0]} castShadow>
        <cylinderGeometry args={[r, r, Math.max(fluteLen - r, 0.1), 32]} />
        <meshStandardMaterial color="#4a90d9" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

function FaceMillGeometry({ tool }: { tool: MillingToolDimensions }) {
  const r = tool.diameter / 2;
  const bodyH = Math.min(tool.fluteLength, 15);
  const insertCount = Math.max(tool.fluteCount, 4);

  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[r, r, bodyH, 32]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
      </mesh>
      {Array.from({ length: insertCount }).map((_, i) => {
        const angle = (i * Math.PI * 2) / insertCount;
        const ix = (r - 2) * Math.cos(angle);
        const iz = (r - 2) * Math.sin(angle);
        return (
          <mesh
            key={i}
            position={[ix, 2, iz]}
            rotation={[0, -angle, 0]}
            castShadow
          >
            <boxGeometry args={[4, 3, 2]} />
            <meshStandardMaterial
              color="#eab308"
              metalness={0.5}
              roughness={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function DrillGeometry({ tool }: { tool: MillingToolDimensions }) {
  const r = tool.diameter / 2;
  const tipAngle = tool.tipAngle || 118;
  const tipH = r / Math.tan(((tipAngle / 2) * Math.PI) / 180);
  const bodyLen = tool.fluteLength - tipH;

  return (
    <group>
      <mesh position={[0, tipH / 2, 0]} castShadow>
        <coneGeometry args={[r, tipH, 32]} />
        <meshStandardMaterial color="#4a90d9" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, tipH + bodyLen / 2, 0]} castShadow>
        <cylinderGeometry args={[r, r, Math.max(bodyLen, 0.1), 32]} />
        <meshStandardMaterial color="#4a90d9" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

export function MillingToolAssembly({
  tool: partialTool,
  position,
  isCollision = false,
  isCutting = false,
}: MillingToolAssemblyProps) {
  const tool: MillingToolDimensions = { ...DEFAULT_TOOL, ...partialTool };

  const holderColor = isCollision ? "#ef4444" : "#334155";
  const holderEmissive = isCollision ? "#ff0000" : "#000000";
  const holderEmissiveIntensity = isCollision ? 1.2 : 0;

  const shankLen = tool.overallLength - tool.fluteLength;

  return (
    <group position={position}>
      <group position={[0, tool.fluteLength + shankLen + tool.holderLength / 2, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[tool.holderDiameter / 2, tool.holderDiameter / 2, tool.holderLength, 32]} />
          <meshStandardMaterial
            color={holderColor}
            metalness={0.6}
            roughness={0.35}
            emissive={holderEmissive}
            emissiveIntensity={holderEmissiveIntensity}
          />
        </mesh>
      </group>

      <mesh position={[0, tool.fluteLength + shankLen / 2, 0]} castShadow>
        <cylinderGeometry args={[tool.shankDiameter / 2, tool.shankDiameter / 2, shankLen, 32]} />
        <meshStandardMaterial color="#666" metalness={0.6} roughness={0.3} />
      </mesh>

      {tool.type === "end_mill" && <EndMillGeometry tool={tool} />}
      {tool.type === "ball_nose" && <BallNoseGeometry tool={tool} />}
      {tool.type === "face_mill" && <FaceMillGeometry tool={tool} />}
      {tool.type === "drill" && <DrillGeometry tool={tool} />}

      {isCutting && !isCollision && (
        <pointLight
          position={[0, 2, 0]}
          color="#ff8800"
          intensity={0.8}
          distance={tool.diameter * 3}
        />
      )}

      {isCollision && (
        <pointLight
          position={[0, tool.fluteLength / 2, 0]}
          color="#ff0000"
          intensity={2}
          distance={tool.diameter * 5}
        />
      )}
    </group>
  );
}

export function getDefaultToolDimensions(
  type: MillingToolType
): MillingToolDimensions {
  switch (type) {
    case "end_mill":
      return {
        type: "end_mill",
        diameter: 10,
        fluteLength: 25,
        overallLength: 75,
        fluteCount: 4,
        cornerRadius: 0,
        holderDiameter: 40,
        holderLength: 50,
        shankDiameter: 10,
      };
    case "face_mill":
      return {
        type: "face_mill",
        diameter: 50,
        fluteLength: 15,
        overallLength: 60,
        fluteCount: 6,
        holderDiameter: 55,
        holderLength: 40,
        shankDiameter: 22,
      };
    case "ball_nose":
      return {
        type: "ball_nose",
        diameter: 8,
        fluteLength: 20,
        overallLength: 65,
        fluteCount: 2,
        holderDiameter: 32,
        holderLength: 45,
        shankDiameter: 8,
      };
    case "drill":
      return {
        type: "drill",
        diameter: 8,
        fluteLength: 40,
        overallLength: 90,
        fluteCount: 2,
        tipAngle: 118,
        holderDiameter: 32,
        holderLength: 45,
        shankDiameter: 8,
      };
  }
}
