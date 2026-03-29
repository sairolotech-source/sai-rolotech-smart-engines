/**
 * toolSelectionAdvisor.ts — Smart tool recommendation engine.
 *
 * Given groove geometry and operation type, recommends the best tool.
 */

import { TOOL_LIBRARY } from "./toolLibraryEngine";
import type { TurningTool } from "./toolLibraryEngine";

export type OperationType =
  | "OD_rough"
  | "OD_finish"
  | "groove_rough"
  | "groove_finish"
  | "bore_finish"
  | "cutoff";

export interface ToolRecommendation {
  tool:        TurningTool;
  operation:   OperationType;
  confidence:  "high" | "medium" | "low";
  reason:      string;
  warnings:    string[];
  feedMmRev:   number;
  speedMmin:   number;
  depthMm:     number;
}

export interface GrooveGeometryInput {
  grooveDepthMm: number;
  grooveWidthMm: number;
  bendAngleDeg:  number;
  thickness:     number;
  rollOD:        number;
}

export function recommendToolsForGroove(geo: GrooveGeometryInput): ToolRecommendation[] {
  const results: ToolRecommendation[] = [];

  // OD Rough — large nose radius profile tool
  const odRough = TOOL_LIBRARY.find(t => t.toolType === "profile" && t.noseRadiusMm >= 0.8);
  if (odRough) {
    results.push({
      tool:       odRough,
      operation:  "OD_rough",
      confidence: "high",
      reason:     `Tool ${odRough.toolNo} — R${odRough.noseRadiusMm} robust for OD roughing D2 steel`,
      warnings:   [],
      feedMmRev:  0.25,
      speedMmin:  120,
      depthMm:    2.0,
    });
  }

  // OD Finish — small nose radius profile tool
  const odFinish = TOOL_LIBRARY.find(t => t.toolType === "profile" && t.noseRadiusMm <= 0.4);
  if (odFinish) {
    results.push({
      tool:       odFinish,
      operation:  "OD_finish",
      confidence: "high",
      reason:     `Tool ${odFinish.toolNo} — R${odFinish.noseRadiusMm} for surface finish on OD`,
      warnings:   [],
      feedMmRev:  0.08,
      speedMmin:  180,
      depthMm:    0.2,
    });
  }

  // Groove rough — groove tool if narrow slot, else profile
  const isNarrow   = geo.grooveWidthMm < 8.0;
  const grooveTool = isNarrow
    ? TOOL_LIBRARY.find(t => t.toolType === "groove")
    : TOOL_LIBRARY.find(t => t.toolType === "profile" && t.noseRadiusMm >= 0.8);

  if (grooveTool) {
    const narrowWarn = isNarrow && grooveTool.insertThicknessMm > geo.grooveWidthMm
      ? [`Insert width ${grooveTool.insertThicknessMm}mm may be too wide for groove ${geo.grooveWidthMm.toFixed(1)}mm`]
      : [];
    results.push({
      tool:       grooveTool,
      operation:  "groove_rough",
      confidence: isNarrow ? "medium" : "high",
      reason:     isNarrow
        ? `Groove tool for narrow slot (${geo.grooveWidthMm.toFixed(1)}mm)`
        : `Profile tool for wide groove (${geo.grooveWidthMm.toFixed(1)}mm)`,
      warnings:   narrowWarn,
      feedMmRev:  0.10,
      speedMmin:  100,
      depthMm:    1.5,
    });
  }

  // Groove finish — smallest nose radius available
  const grooveFinish = TOOL_LIBRARY.filter(t => t.toolType === "profile" && t.noseRadiusMm <= 0.4)[0];
  if (grooveFinish) {
    const thetaRad     = (geo.bendAngleDeg * Math.PI) / 180;
    const minCorner    = geo.grooveDepthMm * Math.tan(thetaRad / 2);
    const noseWarnings: string[] = [];
    if (grooveFinish.noseRadiusMm > minCorner) {
      noseWarnings.push(
        `Nose R${grooveFinish.noseRadiusMm}mm may leave undercutting in ${geo.bendAngleDeg}° groove (corner ~${minCorner.toFixed(2)}mm)`
      );
    }
    results.push({
      tool:       grooveFinish,
      operation:  "groove_finish",
      confidence: noseWarnings.length === 0 ? "high" : "medium",
      reason:     `Tool ${grooveFinish.toolNo} — R${grooveFinish.noseRadiusMm} smallest for groove finish`,
      warnings:   noseWarnings,
      feedMmRev:  0.06,
      speedMmin:  200,
      depthMm:    0.15,
    });
  }

  // Bore finish
  const boreTool = TOOL_LIBRARY.find(t => t.toolType === "boring");
  if (boreTool) {
    results.push({
      tool:       boreTool,
      operation:  "bore_finish",
      confidence: "high",
      reason:     `Tool ${boreTool.toolNo} — boring bar for shaft bore finish`,
      warnings:   [],
      feedMmRev:  0.08,
      speedMmin:  200,
      depthMm:    0.3,
    });
  }

  return results;
}

export function suggestTool(op: OperationType): TurningTool | undefined {
  const geo: GrooveGeometryInput = {
    grooveDepthMm: 5, grooveWidthMm: 20, bendAngleDeg: 30, thickness: 1.5, rollOD: 100,
  };
  return recommendToolsForGroove(geo).find(r => r.operation === op)?.tool;
}
