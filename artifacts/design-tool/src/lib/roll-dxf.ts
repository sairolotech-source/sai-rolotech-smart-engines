/**
 * Sai Rolotech Smart Engines — Roll DXF Generator (AutoCAD R2013 / LT compatible)
 *
 * Generates a 2D technical drawing (axial cross-section) for each roll:
 *   - OD contour, bore, groove profile
 *   - Dimension lines + annotations
 *   - Title block
 *
 * Pure client-side — no server call, works fully offline.
 */

export interface RollDxfInput {
  rollNumber: number;
  side: "upper" | "lower";
  stationLabel: string;
  rollDiameter: number;    // mm
  boreDiameter: number;    // mm
  rollWidth: number;       // mm
  grooveDepth: number;     // mm
  gap: number;             // mm
  materialType: string;
  profilePoints?: { z: number; xDia: number }[];
}

// ─── DXF primitive builders ───────────────────────────────────────────────────

function group(code: number, value: string | number): string {
  return `  ${code}\n${value}`;
}

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer = "0"): string {
  return [
    group(0, "LINE"),
    group(8, layer),
    group(10, x1.toFixed(6)),
    group(20, y1.toFixed(6)),
    group(30, "0.0"),
    group(11, x2.toFixed(6)),
    group(21, y2.toFixed(6)),
    group(31, "0.0"),
  ].join("\n");
}

function dxfCircle(cx: number, cy: number, r: number, layer = "0"): string {
  return [
    group(0, "CIRCLE"),
    group(8, layer),
    group(10, cx.toFixed(6)),
    group(20, cy.toFixed(6)),
    group(30, "0.0"),
    group(40, r.toFixed(6)),
  ].join("\n");
}

function dxfText(
  x: number, y: number, text: string,
  height = 2.5, layer = "TEXT", halign = 0
): string {
  return [
    group(0, "TEXT"),
    group(8, layer),
    group(10, x.toFixed(6)),
    group(20, y.toFixed(6)),
    group(30, "0.0"),
    group(40, height.toFixed(3)),
    group(1, text),
    group(72, halign), // 0=left,1=center,2=right
    group(11, x.toFixed(6)),
    group(21, y.toFixed(6)),
    group(31, "0.0"),
  ].join("\n");
}

function dxfPolyline(pts: [number, number][], closed = false, layer = "PROFILE"): string {
  const lines: string[] = [
    group(0, "LWPOLYLINE"),
    group(8, layer),
    group(90, pts.length),
    group(70, closed ? 1 : 0),
  ];
  for (const [x, y] of pts) {
    lines.push(group(10, x.toFixed(6)));
    lines.push(group(20, y.toFixed(6)));
  }
  return lines.join("\n");
}

// ─── Dimension line helper ────────────────────────────────────────────────────

function dimHoriz(
  x1: number, y1: number, x2: number, y2: number,
  dimY: number, label: string, layer = "DIM"
): string {
  // Extension lines
  const extLines =
    dxfLine(x1, y1, x1, dimY + 1, layer) + "\n" +
    dxfLine(x2, y2, x2, dimY + 1, layer) + "\n" +
    dxfLine(x1, dimY, x2, dimY, layer);
  // Arrow ticks (simple cross hatch)
  const arrowLen = 1.5;
  const arrows =
    dxfLine(x1, dimY, x1 + arrowLen, dimY + 0.5, layer) + "\n" +
    dxfLine(x1, dimY, x1 + arrowLen, dimY - 0.5, layer) + "\n" +
    dxfLine(x2, dimY, x2 - arrowLen, dimY + 0.5, layer) + "\n" +
    dxfLine(x2, dimY, x2 - arrowLen, dimY - 0.5, layer);
  const mid = (x1 + x2) / 2;
  const text = dxfText(mid, dimY + 2, label, 2.2, "DIM_TEXT", 1);
  return extLines + "\n" + arrows + "\n" + text;
}

function dimVert(
  x1: number, y1: number, x2: number, y2: number,
  dimX: number, label: string, layer = "DIM"
): string {
  const extLines =
    dxfLine(x1, y1, dimX - 1, y1, layer) + "\n" +
    dxfLine(x2, y2, dimX - 1, y2, layer) + "\n" +
    dxfLine(dimX, y1, dimX, y2, layer);
  const arrowLen = 1.5;
  const arrows =
    dxfLine(dimX, y1, dimX + 0.5, y1 + arrowLen, layer) + "\n" +
    dxfLine(dimX, y1, dimX - 0.5, y1 + arrowLen, layer) + "\n" +
    dxfLine(dimX, y2, dimX + 0.5, y2 - arrowLen, layer) + "\n" +
    dxfLine(dimX, y2, dimX - 0.5, y2 - arrowLen, layer);
  const mid = (y1 + y2) / 2;
  const text = dxfText(dimX + 2, mid, label, 2.2, "DIM_TEXT", 0);
  return extLines + "\n" + arrows + "\n" + text;
}

// ─── Main DXF generator ───────────────────────────────────────────────────────

export function generateRollDxf(roll: RollDxfInput): string {
  const {
    rollNumber, side, stationLabel,
    rollDiameter: D, boreDiameter: bore,
    rollWidth: W, grooveDepth: gd,
    gap, materialType, profilePoints,
  } = roll;

  const R   = D / 2;      // outer radius
  const bR  = bore / 2;   // bore radius
  const scale = 1;        // 1:1 in mm

  // ── Draw coordinate origin at center of roll face (Z=0 is front face) ──
  // X = radial distance from center (X goes left = 0 to right = R)
  // Y = axial distance (Y=0 is front face, Y=W is back face)

  const entities: string[] = [];

  // ── CENTER LINES ──
  entities.push(dxfLine(-R - 10, 0, R + 10, 0, "CENTERLINE"));      // radial CL
  entities.push(dxfLine(0, -5, 0, W + 5, "CENTERLINE"));             // axial CL

  // ── OUTER CONTOUR (solid rectangle = cross-section profile) ──
  // Draw the HALF section (standard lathe drawing convention)
  const contour: [number, number][] = [
    [bR, 0],          // bottom-left (bore surface, front face)
    [R, 0],           // bottom-right (OD, front face)
    [R, W],           // top-right (OD, back face)
    [bR, W],          // top-left (bore surface, back face)
    [bR, 0],          // close
  ];
  entities.push(dxfPolyline(contour, false, "CONTOUR"));

  // ── BORE CENTER LINE (dashed) ──
  entities.push(dxfLine(bR, 0, bR, W, "CENTERLINE"));

  // ── GROOVE PROFILE (the roll forming profile groove) ──
  // The groove is in the OD surface, centered axially
  const grooveStart = (W - W * 0.60) / 2;
  const grooveEnd   = grooveStart + W * 0.60;
  const grooveProfilePts: [number, number][] = [];

  if (profilePoints && profilePoints.length > 0) {
    // Use actual power pattern data
    const sorted = [...profilePoints].sort((a, b) => a.z - b.z);
    const zMin = sorted[0].z;
    const zMax = sorted[sorted.length - 1].z;
    const zRange = zMax - zMin || 1;
    for (const pt of sorted) {
      const z = grooveStart + ((pt.z - zMin) / zRange) * W * 0.60;
      const x = pt.xDia / 2;
      grooveProfilePts.push([x, z]);
    }
  } else {
    // Fallback: symmetric groove profile
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const z = grooveStart + t * (grooveEnd - grooveStart);
      const xDepth = gd * Math.sin(t * Math.PI); // parabolic groove
      grooveProfilePts.push([R - xDepth, z]);
    }
  }
  if (grooveProfilePts.length > 1) {
    entities.push(dxfPolyline(grooveProfilePts, false, "PROFILE"));
  }

  // ── KEYWAY (if shaftDia >= 20) ──
  const kwWidth = bore >= 20 ? bore / 4 : 0;  // simplified keyway width
  const kwDepth = kwWidth / 2;
  if (kwWidth > 0) {
    const kwL = W * 0.75;
    const kwStart = (W - kwL) / 2;
    const kwEnd   = kwStart + kwL;
    const kwPts: [number, number][] = [
      [bR, kwStart],
      [bR - kwDepth, kwStart],
      [bR - kwDepth, kwEnd],
      [bR, kwEnd],
    ];
    entities.push(dxfPolyline(kwPts, false, "KEYWAY"));
  }

  // ── CHAMFER LINES (1×45° at both faces) ──
  const ch = 1.0; // 1mm chamfer
  entities.push(dxfLine(R - ch, 0, R, ch, "CHAMFER"));          // front face chamfer
  entities.push(dxfLine(R - ch, W, R, W - ch, "CHAMFER"));       // back face chamfer
  entities.push(dxfLine(bR + ch, 0, bR, ch, "CHAMFER"));         // bore front
  entities.push(dxfLine(bR + ch, W, bR, W - ch, "CHAMFER"));     // bore back

  // ── DIMENSION LINES ──
  // Width dimension (along Y axis)
  entities.push(dimVert(R, 0, R, W, R + 12, `W = ${W.toFixed(2)} mm`, "DIM"));

  // OD dimension (horizontal at top)
  entities.push(dimHoriz(-R, W, R, W, W + 14, `Ø${D.toFixed(3)} OD`, "DIM"));

  // Bore dimension (horizontal at bottom, shorter span)
  entities.push(dimHoriz(-bR, 0, bR, 0, -12, `Ø${bore.toFixed(3)} BORE H7`, "DIM"));

  // Groove depth (vertical, inside groove area)
  if (gd > 0.5) {
    entities.push(dxfLine(R - gd, W / 2 - 2, R - gd, W / 2 + 2, "DIM"));
    entities.push(dxfText(R - gd - 3, W / 2, `GD=${gd.toFixed(2)}`, 2, "DIM_TEXT", 2));
  }

  // Gap annotation
  entities.push(dxfText(-R - 8, W / 2, `GAP=${gap.toFixed(3)}`, 2, "DIM_TEXT", 0));

  // ── TITLE BLOCK ──
  const titleY = -25;
  entities.push(dxfLine(-40, titleY, 60, titleY, "TITLEBLOCK"));
  entities.push(dxfLine(-40, titleY - 30, 60, titleY - 30, "TITLEBLOCK"));
  entities.push(dxfLine(-40, titleY, -40, titleY - 30, "TITLEBLOCK"));
  entities.push(dxfLine(60, titleY, 60, titleY - 30, "TITLEBLOCK"));

  const dateStr = new Date().toISOString().split("T")[0];
  entities.push(dxfText(-38, titleY - 6,  `Sai Rolotech Smart Engines — Roll Tooling Drawing`, 3.5, "TITLEBLOCK", 0));
  entities.push(dxfText(-38, titleY - 12, `ROLL #${String(rollNumber).padStart(3, "0")} — ${side.toUpperCase()} — ${stationLabel}`, 3.0, "TITLEBLOCK", 0));
  entities.push(dxfText(-38, titleY - 18, `Material: ${materialType}  |  Scale 1:1  |  Units: mm`, 2.5, "TITLEBLOCK", 0));
  entities.push(dxfText(-38, titleY - 24, `Date: ${dateStr}  |  Tolerance: OD ±0.010 mm  BORE H7  WIDTH ±0.050 mm`, 2.0, "TITLEBLOCK", 0));

  // ── SURFACE FINISH CALLOUT ──
  entities.push(dxfText(R + 20, W * 0.3, `Ra ≤ 0.8 μm (OD)`, 2, "NOTES", 0));
  entities.push(dxfText(R + 20, W * 0.5, `Ra ≤ 1.6 μm (Bore)`, 2, "NOTES", 0));
  entities.push(dxfText(R + 20, W * 0.7, `Runout ≤ 0.015 mm TIR`, 2, "NOTES", 0));

  // ── ASSEMBLE DXF ──
  const header = `  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1027\n  9\n$INSUNITS\n 70\n4\n  0\nENDSEC\n`;

  const layers = [
    "0", "CONTOUR", "PROFILE", "CENTERLINE", "DIM", "DIM_TEXT",
    "TITLEBLOCK", "NOTES", "CHAMFER", "KEYWAY"
  ];
  const layerDefs = layers.map(name => {
    const color = name === "CONTOUR" ? 7 : name === "PROFILE" ? 1 : name === "CENTERLINE" ? 3 :
                  name === "DIM" || name === "DIM_TEXT" ? 2 : name === "TITLEBLOCK" ? 4 : 5;
    const lt = name === "CENTERLINE" ? "CENTER2" : "CONTINUOUS";
    return [
      group(0, "LAYER"), group(2, name), group(70, 0), group(62, color), group(6, lt)
    ].join("\n");
  }).join("\n");

  const tables =
    `  0\nSECTION\n  2\nTABLES\n  0\nTABLE\n  2\nLTYPE\n 70\n2\n` +
    `  0\nLTYPE\n  2\nCONTINUOUS\n 70\n0\n  3\nSolid line\n 72\n65\n 73\n0\n 40\n0.0\n` +
    `  0\nLTYPE\n  2\nCENTER2\n 70\n0\n  3\nCenter (×0.5): ___ . ___\n 72\n65\n 73\n4\n 40\n20.0\n 49\n6.25\n 49\n-2.5\n 49\n1.5\n 49\n-2.5\n` +
    `  0\nENDTAB\n  0\nTABLE\n  2\nLAYER\n 70\n${layers.length}\n` +
    layerDefs + `\n  0\nENDTAB\n  0\nENDSEC\n`;

  const entitiesSection =
    `  0\nSECTION\n  2\nENTITIES\n` +
    entities.join("\n") + `\n  0\nENDSEC\n`;

  return header + tables + entitiesSection + `  0\nEOF\n`;
}

// ─── Batch: generate all rolls for a station ─────────────────────────────────

export function downloadRollDxf(roll: RollDxfInput): void {
  const dxf = generateRollDxf(roll);
  const blob = new Blob([dxf], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ROLL_${String(roll.rollNumber).padStart(3, "0")}_${roll.side.toUpperCase()}_${roll.stationLabel}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}
