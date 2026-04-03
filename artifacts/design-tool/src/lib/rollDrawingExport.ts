/**
 * rollDrawingExport.ts
 * Phase 2 Export Engine — Sai Rolotech Smart Engines v2.3.0
 *
 * Modular, deterministic, production-grade export architecture for:
 *  - DrawingModel (normalized data layer)
 *  - Validation gate (pre-export checks)
 *  - SVG generation (A3 landscape, 3-view engineering drawing)
 *  - DXF generation (R12 ASCII, 5 layers)
 *  - Single / multi-page PDF (browser print engine)
 *  - ZIP package (structured folders + manifest + readme)
 *  - Deterministic file naming
 *  - Export manifest (JSON traceability)
 *  - Export summary (human-readable TXT)
 */

import JSZip from "jszip";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Pt { x: number; y: number; }

export interface RawPassData {
  pass_no:            number;
  station_label:      string;
  target_angle_deg:   number;
  roll_gap_mm:        number;
  strip_width_mm:     number;
  stage_type:         string;
  forming_depth_mm:   number;
  pass_progress_pct:  number;
  upper_roll_profile: Pt[];
  lower_roll_profile: Pt[];
}

export interface RawRollDimensions {
  estimated_roll_od_mm: number;
  face_width_mm:        number;
  bore_dia_mm:          number;
  keyway_width_mm:      number;
  spacer_width_mm:      number;
  shaft_dia_mm:         number;
  notes?:               string[];
}

export type ReleaseState =
  | "draft"
  | "internal_review"
  | "shop_drawing"
  | "manufacturing_release";

export interface DrawingModel {
  stationNo:     number;
  stationLabel:  string;
  totalStations: number;

  upperProfile:  Pt[];
  lowerProfile:  Pt[];

  bendAngle:     number;
  rollGap:       number;
  formDepth:     number;
  stripWidth:    number;
  passProgress:  number;
  stageType:     string;
  springbackDeg: number;

  rollOD:    number;
  bore:      number;
  faceWidth: number;
  shaft:     number;
  keyway:    number;
  spacer:    number;
  notes:     string[];

  profileType:  string;
  material:     string;
  thickness:    number;

  revision:            string;
  releaseState:        ReleaseState;
  checkedBy:           string;
  approvedBy:          string;
  manufacturingNote:   string;
  toleranceNote:       string;
  drawingNo:           string;
  exportDate:          string;

  // ── ISO 7200 / Commercial tracking ────────────────────────────
  companyName:   string;
  customerName:  string;
  jobNo:         string;
  projectName:   string;
  partNo:        string;
  sheetNo:       number;
  totalSheets:   number;
  drawingScale:  string;
}

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

export interface ExportManifest {
  exportId:       string;
  timestamp:      string;
  softwareVersion: string;
  profileType:    string;
  material:       string;
  thickness:      number;
  stripWidth:     number;
  totalStations:  number;
  revision:       string;
  releaseState:   ReleaseState;
  checkedBy:      string;
  approvedBy:     string;
  rollOD:         number;
  bore:           number;
  faceWidth:      number;
  files:          string[];
}

// ─── Stage colours ────────────────────────────────────────────────────────────

export const STAGE_COLOR: Record<string, string> = {
  pre_bend:            "#3b82f6",
  initial_bend:        "#6366f1",
  progressive_forming: "#8b5cf6",
  lip_forming:         "#ec4899",
  final_form:          "#f59e0b",
  calibration:         "#10b981",
  flat:                "#64748b",
};

// ─── Release state meta ───────────────────────────────────────────────────────

export const RELEASE_META: Record<ReleaseState, {
  label:    string;
  sublabel: string;
  bgFill:   string;
  stroke:   string;
  textFill: string;
  subFill:  string;
}> = {
  draft: {
    label:    "⚠ ENGINEERING DRAFT — NOT FOR MANUFACTURE",
    sublabel: "Verify all dimensions before production use",
    bgFill:   "#1c1917",
    stroke:   "#57534e",
    textFill: "#78716c",
    subFill:  "#57534e",
  },
  internal_review: {
    label:    "◈ INTERNAL REVIEW ONLY",
    sublabel: "Not released for shop floor use",
    bgFill:   "#1e1b4b",
    stroke:   "#3730a3",
    textFill: "#a5b4fc",
    subFill:  "#4338ca",
  },
  shop_drawing: {
    label:    "▶ SHOP DRAWING — VERIFY BEFORE USE",
    sublabel: "Issued for shop reference — not a manufacturing release",
    bgFill:   "#431407",
    stroke:   "#c2410c",
    textFill: "#fdba74",
    subFill:  "#ea580c",
  },
  manufacturing_release: {
    label:    "✔ APPROVED FOR MANUFACTURING",
    sublabel: "Sai Rolotech Smart Engines · Manufacturing Release",
    bgFill:   "#052e16",
    stroke:   "#16a34a",
    textFill: "#4ade80",
    subFill:  "#16a34a",
  },
};

// ─── buildDrawingModel ────────────────────────────────────────────────────────

export function buildDrawingModel(
  pass:          RawPassData,
  rd:            RawRollDimensions,
  opts: {
    totalStations:      number;
    material:           string;
    thickness:          number;
    profileType?:       string;
    springbackDeg?:     number;
    revision?:          string;
    releaseState?:      ReleaseState;
    checkedBy?:         string;
    approvedBy?:        string;
    manufacturingNote?: string;
    toleranceNote?:     string;
    // ISO 7200 / commercial fields
    customerName?:  string;
    jobNo?:         string;
    projectName?:   string;
    partNo?:        string;
    sheetNo?:       number;
    totalSheets?:   number;
    drawingScale?:  string;
    customDrawNo?:  string;
  }
): DrawingModel {
  const rev   = opts.revision ?? "R0";
  const ptype = opts.profileType ?? "";
  const tag   = (ptype || opts.material).substring(0, 3).toUpperCase();

  // ISO 7200 drawing number — format: SRT-{customerCode}-{jobNo}-{profileTag}-ST{nn}-{rev}
  const custCode  = opts.customerName
    ? opts.customerName.replace(/[^A-Za-z0-9]/g, "").substring(0, 4).toUpperCase()
    : "SAI";
  const jobCode   = opts.jobNo
    ? opts.jobNo.replace(/[^A-Za-z0-9]/g, "").substring(0, 6).toUpperCase()
    : "LOCAL";
  const drawNo    = opts.customDrawNo
    ?? `SRT-${custCode}-${jobCode}-${tag}-ST${String(pass.pass_no).padStart(2,"0")}-${rev}`;

  return {
    stationNo:    pass.pass_no,
    stationLabel: pass.station_label,
    totalStations: opts.totalStations,

    upperProfile: pass.upper_roll_profile,
    lowerProfile: pass.lower_roll_profile,

    bendAngle:    pass.target_angle_deg,
    rollGap:      pass.roll_gap_mm,
    formDepth:    pass.forming_depth_mm,
    stripWidth:   pass.strip_width_mm,
    passProgress: pass.pass_progress_pct,
    stageType:    pass.stage_type,
    springbackDeg: opts.springbackDeg ?? 0,

    rollOD:    rd.estimated_roll_od_mm,
    bore:      rd.bore_dia_mm,
    faceWidth: rd.face_width_mm,
    shaft:     rd.shaft_dia_mm,
    keyway:    rd.keyway_width_mm,
    spacer:    rd.spacer_width_mm,
    notes:     rd.notes ?? [],

    profileType: ptype,
    material:    opts.material,
    thickness:   opts.thickness,

    revision:          rev,
    releaseState:      opts.releaseState ?? "draft",
    checkedBy:         opts.checkedBy ?? "",
    approvedBy:        opts.approvedBy ?? "",
    manufacturingNote: opts.manufacturingNote ?? "",
    toleranceNote:     opts.toleranceNote ?? "All dimensions ±0.05 mm unless stated",
    drawingNo:         drawNo,
    exportDate:        new Date().toLocaleDateString("en-GB"),

    // ISO 7200
    companyName:   "Sai Rolotech Pvt. Ltd.",
    customerName:  opts.customerName  ?? "",
    jobNo:         opts.jobNo         ?? "",
    projectName:   opts.projectName   ?? "",
    partNo:        opts.partNo        ?? "",
    sheetNo:       opts.sheetNo       ?? 1,
    totalSheets:   opts.totalSheets   ?? opts.totalStations,
    drawingScale:  opts.drawingScale  ?? "1:1 (approx)",
  };
}

// ─── validateDrawingModel ─────────────────────────────────────────────────────

export function validateDrawingModel(
  models:   DrawingModel[],
  forceRelease?: ReleaseState,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!models.length) {
    errors.push("No station data found. Run the pipeline first.");
    return { valid: false, errors, warnings };
  }

  const m0 = models[0];

  if (!m0.revision || m0.revision.trim() === "") {
    errors.push("Revision is required (e.g. R0, R1).");
  }

  for (const m of models) {
    if (!m.upperProfile.length || !m.lowerProfile.length) {
      errors.push(`Station ${m.stationNo}: Profile geometry missing.`);
    }
    const hasNaN = [...m.upperProfile, ...m.lowerProfile]
      .some(p => !isFinite(p.x) || !isFinite(p.y));
    if (hasNaN) {
      errors.push(`Station ${m.stationNo}: NaN coordinate detected — geometry invalid.`);
    }
  }

  if (m0.rollOD <= 0) errors.push("Roll OD must be > 0 mm.");
  if (m0.bore <= 0)   errors.push("Bore diameter must be > 0 mm.");
  if (m0.faceWidth <= 0) errors.push("Face width must be > 0 mm.");
  if (m0.shaft <= 0)  errors.push("Shaft diameter must be > 0 mm.");

  const wall = (m0.rollOD - m0.bore) / 2;
  if (wall < 15) {
    warnings.push(
      `Thin wall: ${wall.toFixed(1)} mm (OD ${m0.rollOD} − Bore ${m0.bore}). ` +
      `Minimum recommended: 15 mm for rigidity.`
    );
  }

  const release = forceRelease ?? m0.releaseState;
  if (release === "manufacturing_release") {
    if (!m0.checkedBy.trim())
      errors.push("Manufacturing Release requires 'Checked By' field.");
    if (!m0.approvedBy.trim())
      errors.push("Manufacturing Release requires 'Approved By' field.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── generateFileName ─────────────────────────────────────────────────────────

export function generateFileName(
  model:  DrawingModel,
  format: "svg" | "dxf" | "pdf" | "zip",
): string {
  const tag = (model.profileType || model.material)
    .substring(0, 6).toLowerCase().replace(/[^a-z0-9]/g, "-");
  const stn = `station-${String(model.stationNo).padStart(2, "0")}`;
  const rev = model.revision.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `srt-roll-tooling-${tag}-${stn}-${rev}.${format}`;
}

export function generatePackageZipName(
  model: DrawingModel,
): string {
  const tag = (model.profileType || model.material)
    .substring(0, 6).toLowerCase().replace(/[^a-z0-9]/g, "-");
  const rev = model.revision.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `srt-roll-tooling-${tag}-${rev}-manufacturing-package.zip`;
}

export function generateAllPdfName(model: DrawingModel): string {
  const tag = (model.profileType || model.material)
    .substring(0, 6).toLowerCase().replace(/[^a-z0-9]/g, "-");
  const rev = model.revision.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `srt-roll-tooling-${tag}-${rev}-all-stations.pdf`;
}

// ─── renderDrawingToSVG ────────────────────────────────────────────────────────

export function renderDrawingToSVG(m: DrawingModel): string {
  const W = 1189, H = 841;
  const stageColor = STAGE_COLOR[m.stageType] || "#8b5cf6";
  const relMeta = RELEASE_META[m.releaseState];

  const upper = m.upperProfile;
  const lower = m.lowerProfile;

  if (!upper.length || !lower.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#0c1220"/>
  <text x="${W/2}" y="${H/2}" font-size="18" fill="#64748b" text-anchor="middle">No profile geometry for Station ${m.stationNo}</text>
</svg>`;
  }

  /* ── Cross-section nip view ── */
  const cW = 380, cH = 380, cX = 40, cY = 80, cPad = 40;
  const allPts = [...upper, ...lower];
  const xs = allPts.map(p => p.x), ys = allPts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (v: number) => cX + cPad + ((v - minX) / (maxX - minX || 1)) * (cW - cPad * 2);
  const sy = (v: number) => cY + cPad + ((v - minY) / (maxY - minY || 1)) * (cH - cPad * 2);
  const uPath = upper.map((p, i) => `${i===0?"M":"L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
  const lPath = lower.map((p, i) => `${i===0?"M":"L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");

  const uFillPts = [
    `${cX+cPad},${cY+cPad}`, `${cX+cW-cPad},${cY+cPad}`,
    ...upper.slice().reverse().map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`),
  ].join(" ");
  const lFillPts = [
    `${cX+cPad},${cY+cH-cPad}`, `${cX+cW-cPad},${cY+cH-cPad}`,
    ...lower.slice().reverse().map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`),
  ].join(" ");

  const uMidX = sx((upper[0].x + upper[upper.length-1].x) / 2);
  const uMidY = sy(upper[Math.floor(upper.length/2)].y);
  const lMidY = sy(lower[Math.floor(lower.length/2)].y);
  const stripW = sx(upper[upper.length-1].x) - sx(upper[0].x);

  /* ── Front view ── */
  const fCx=660, fCy=300, fR=140;
  const scale = fR / (m.rollOD / 2);
  const fBoreR = (m.bore / 2) * scale;
  const fGrooveD = (m.formDepth / (m.rollOD / 2)) * fR;
  const fGrooveW = m.stripWidth * scale * 0.55;
  const fKwW = (m.keyway / 2) * scale;
  const fKwH = fKwW * 0.8;

  /* ── Side view ── */
  const sX=880, sW=260, sCy=300;
  const scaleS = (360 * 0.45) / (m.rollOD / 2);
  const sOuterR = (m.rollOD / 2) * scaleS;
  const sBoreR  = (m.bore / 2) * scaleS;
  const sFW     = (m.faceWidth / 2) * scaleS;
  const sDepth  = m.formDepth * scaleS;
  const sSW     = (m.stripWidth / 2) * scaleS * 0.45;
  const sCx     = sX + sW / 2;

  const sUpperPts = [
    `${sCx-sFW},${sCy-sOuterR}`,`${sCx-sSW},${sCy-sOuterR}`,
    `${sCx-sSW},${sCy-sOuterR+sDepth}`,`${sCx+sSW},${sCy-sOuterR+sDepth}`,
    `${sCx+sSW},${sCy-sOuterR}`,`${sCx+sFW},${sCy-sOuterR}`,
    `${sCx+sFW},${sCy-sBoreR}`,`${sCx-sFW},${sCy-sBoreR}`,
  ].join(" ");
  const sLowerPts = [
    `${sCx-sFW},${sCy+sOuterR}`,`${sCx-sSW},${sCy+sOuterR}`,
    `${sCx-sSW},${sCy+sOuterR-sDepth}`,`${sCx+sSW},${sCy+sOuterR-sDepth}`,
    `${sCx+sSW},${sCy+sOuterR}`,`${sCx+sFW},${sCy+sOuterR}`,
    `${sCx+sFW},${sCy+sBoreR}`,`${sCx-sFW},${sCy+sBoreR}`,
  ].join(" ");

  /* ── Title block extended ── */
  const tbChecked = m.checkedBy || "—";
  const tbApproved = m.approvedBy || "—";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs><style>text { font-family: 'Courier New', monospace; }</style></defs>

  <rect width="${W}" height="${H}" fill="#0c1220"/>

  <!-- DIN border -->
  <rect x="10" y="10" width="${W-20}" height="${H-20}" fill="none" stroke="#334155" stroke-width="2"/>
  <rect x="15" y="15" width="${W-30}" height="${H-30}" fill="none" stroke="#1e40af" stroke-width="0.8"/>

  <!-- Title bar -->
  <rect x="15" y="15" width="${W-30}" height="52" fill="#1e1b4b" stroke="#312e81" stroke-width="0.6"/>
  <text x="30" y="38" font-size="16" font-weight="bold" fill="#a5b4fc">SAI ROLOTECH SMART ENGINES v2.3.0</text>
  <text x="30" y="56" font-size="10" fill="#64748b">ROLL TOOLING DRAWING — ENGINEERING APPROXIMATION ONLY — NOT FEM</text>
  <text x="${W-30}" y="38" font-size="12" fill="#60a5fa" text-anchor="end">${m.stationLabel.toUpperCase()}</text>
  <text x="${W-30}" y="56" font-size="10" fill="#475569" text-anchor="end">${m.material} · ${m.thickness}mm · ${m.stageType.replace(/_/g," ").toUpperCase()}</text>

  <!-- View labels -->
  <text x="${cX+cW/2}" y="${cY-10}" font-size="9" fill="#475569" text-anchor="middle" font-style="italic">CROSS-SECTION — NIP VIEW</text>
  <text x="${fCx}" y="75" font-size="9" fill="#475569" text-anchor="middle" font-style="italic">FRONT VIEW — ROLL FACE</text>
  <text x="${sCx}" y="75" font-size="9" fill="#475569" text-anchor="middle" font-style="italic">SECTION A-A — SIDE VIEW</text>

  <!-- === CROSS-SECTION === -->
  <polygon points="${uFillPts}" fill="#1e293b"/>
  <polygon points="${lFillPts}" fill="#064e3b"/>
  <path d="${uPath}" fill="none" stroke="#60a5fa" stroke-width="2.5"/>
  <path d="${lPath}" fill="none" stroke="#34d399" stroke-width="2.5"/>

  <rect x="${sx(upper[0].x).toFixed(1)}" y="${uMidY.toFixed(1)}"
    width="${stripW.toFixed(1)}" height="${(lMidY-uMidY).toFixed(1)}"
    fill="#fbbf24" opacity="0.35" stroke="#fbbf24" stroke-width="1"/>

  <line x1="${(sx(upper[0].x)+stripW*0.3).toFixed(1)}" y1="${((uMidY+lMidY)/2).toFixed(1)}"
        x2="${(sx(upper[0].x)+stripW*0.45).toFixed(1)}" y2="${((uMidY+lMidY)/2).toFixed(1)}"
        stroke="#fbbf24" stroke-width="1.5"/>
  <polygon points="${(sx(upper[0].x)+stripW*0.45).toFixed(1)},${((uMidY+lMidY)/2).toFixed(1)} ${(sx(upper[0].x)+stripW*0.42).toFixed(1)},${((uMidY+lMidY)/2-3).toFixed(1)} ${(sx(upper[0].x)+stripW*0.42).toFixed(1)},${((uMidY+lMidY)/2+3).toFixed(1)}" fill="#fbbf24"/>

  <line x1="${uMidX.toFixed(1)}" y1="${cY}" x2="${uMidX.toFixed(1)}" y2="${cY+cH}"
    stroke="#334155" stroke-width="0.8" stroke-dasharray="6,4"/>

  <!-- DIM: strip width -->
  <line x1="${sx(upper[0].x).toFixed(1)}" y1="${(cY+cH-15).toFixed(1)}"
        x2="${sx(upper[upper.length-1].x).toFixed(1)}" y2="${(cY+cH-15).toFixed(1)}"
        stroke="#fbbf24" stroke-width="0.8"/>
  <polygon points="${sx(upper[0].x).toFixed(1)},${(cY+cH-15).toFixed(1)} ${(sx(upper[0].x)+6).toFixed(1)},${(cY+cH-18).toFixed(1)} ${(sx(upper[0].x)+6).toFixed(1)},${(cY+cH-12).toFixed(1)}" fill="#fbbf24"/>
  <polygon points="${sx(upper[upper.length-1].x).toFixed(1)},${(cY+cH-15).toFixed(1)} ${(sx(upper[upper.length-1].x)-6).toFixed(1)},${(cY+cH-18).toFixed(1)} ${(sx(upper[upper.length-1].x)-6).toFixed(1)},${(cY+cH-12).toFixed(1)}" fill="#fbbf24"/>
  <text x="${uMidX.toFixed(1)}" y="${(cY+cH-18).toFixed(1)}" font-size="9" fill="#fbbf24" text-anchor="middle">Strip W: ${m.stripWidth.toFixed(1)} mm</text>

  ${m.formDepth > 0 ? `
  <line x1="${(cX+cW-20).toFixed(1)}" y1="${uMidY.toFixed(1)}"
        x2="${(cX+cW-20).toFixed(1)}" y2="${lMidY.toFixed(1)}"
        stroke="#a78bfa" stroke-width="0.8"/>
  <text x="${(cX+cW-10).toFixed(1)}" y="${((uMidY+lMidY)/2).toFixed(1)}" font-size="8" fill="#a78bfa">Depth</text>
  <text x="${(cX+cW-10).toFixed(1)}" y="${((uMidY+lMidY)/2+10).toFixed(1)}" font-size="8" fill="#a78bfa">${m.formDepth.toFixed(1)}mm</text>
  ` : ""}

  <text x="${(cX+8).toFixed(1)}" y="${((uMidY+lMidY)/2).toFixed(1)}" font-size="8" fill="#34d399">Gap</text>
  <text x="${(cX+8).toFixed(1)}" y="${((uMidY+lMidY)/2+10).toFixed(1)}" font-size="8" fill="#34d399">${m.rollGap}mm</text>

  <text x="${(uMidX+10).toFixed(1)}" y="${(uMidY-12).toFixed(1)}" font-size="10" fill="${stageColor}" font-weight="bold">θ = ${m.bendAngle.toFixed(1)}°</text>

  <rect x="${cX}" y="${cY+cH+5}" width="200" height="32" fill="#0f172a" stroke="#1e293b" stroke-width="0.5" rx="2"/>
  <line x1="${cX+8}" y1="${cY+cH+16}" x2="${cX+28}" y2="${cY+cH+16}" stroke="#60a5fa" stroke-width="2"/>
  <text x="${cX+32}" y="${cY+cH+19}" font-size="8" fill="#94a3b8">Upper Roll</text>
  <line x1="${cX+8}" y1="${cY+cH+28}" x2="${cX+28}" y2="${cY+cH+28}" stroke="#34d399" stroke-width="2"/>
  <text x="${cX+32}" y="${cY+cH+31}" font-size="8" fill="#94a3b8">Lower Roll</text>

  <!-- === FRONT VIEW === -->
  <circle cx="${fCx}" cy="${fCy}" r="${fR}" fill="#1e293b" stroke="#60a5fa" stroke-width="2"/>
  ${m.formDepth > 0 ? `
  <path d="M ${fCx-fR},${fCy} L ${fCx-fR+fGrooveD*0.5},${fCy} L ${fCx-fGrooveW*0.6},${fCy+fGrooveD*1.2} L ${fCx+fGrooveW*0.6},${fCy+fGrooveD*1.2} L ${fCx+fR-fGrooveD*0.5},${fCy} L ${fCx+fR},${fCy}"
    fill="none" stroke="${stageColor}" stroke-width="2"/>
  ` : ""}
  <circle cx="${fCx}" cy="${fCy}" r="${fBoreR}" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6,4"/>
  <rect x="${fCx-fKwW}" y="${fCy-fBoreR-fKwH}" width="${fKwW*2}" height="${fKwH}"
    fill="#0f172a" stroke="#f59e0b" stroke-width="1.2"/>
  <line x1="${fCx-fBoreR-8}" y1="${fCy}" x2="${fCx+fBoreR+8}" y2="${fCy}" stroke="#334155" stroke-width="0.8" stroke-dasharray="5,3"/>
  <line x1="${fCx}" y1="${fCy-fBoreR-8}" x2="${fCx}" y2="${fCy+fBoreR+8}" stroke="#334155" stroke-width="0.8" stroke-dasharray="5,3"/>
  <line x1="${fCx}" y1="${fCy}" x2="${fCx+fR}" y2="${fCy}" stroke="#60a5fa" stroke-width="1"/>
  <text x="${fCx+fR*0.55}" y="${fCy-6}" font-size="10" fill="#60a5fa" text-anchor="middle" font-weight="bold">⌀${m.rollOD} h6</text>
  <text x="${fCx-fBoreR-20}" y="${fCy-fBoreR*0.5}" font-size="9" fill="#e2e8f0">⌀${m.bore} H7</text>
  <text x="${fCx}" y="${fCy-fBoreR-fKwH-8}" font-size="9" fill="#f59e0b" text-anchor="middle">KW ${m.keyway}mm (DIN 6885)</text>
  ${m.formDepth > 0 ? `<text x="${fCx}" y="${fCy+fR+20}" font-size="10" fill="${stageColor}" text-anchor="middle" font-weight="bold">Groove Depth: ${m.formDepth.toFixed(1)} mm</text>` : ""}
  <text x="${fCx}" y="${fCy-fR-12}" font-size="9" fill="${stageColor}" text-anchor="middle">[ ${m.stageType.replace(/_/g," ").toUpperCase()} ]</text>

  <!-- === SIDE VIEW === -->
  <polygon points="${sUpperPts}" fill="#1e293b" stroke="#60a5fa" stroke-width="1.5"/>
  <polyline points="${sCx-sFW},${sCy-sOuterR} ${sCx-sSW},${sCy-sOuterR} ${sCx-sSW},${sCy-sOuterR+sDepth} ${sCx+sSW},${sCy-sOuterR+sDepth} ${sCx+sSW},${sCy-sOuterR} ${sCx+sFW},${sCy-sOuterR}"
    fill="none" stroke="${stageColor}" stroke-width="2.5"/>
  <polygon points="${sLowerPts}" fill="#064e3b" stroke="#34d399" stroke-width="1.5"/>
  <polyline points="${sCx-sFW},${sCy+sOuterR} ${sCx-sSW},${sCy+sOuterR} ${sCx-sSW},${sCy+sOuterR-sDepth} ${sCx+sSW},${sCy+sOuterR-sDepth} ${sCx+sSW},${sCy+sOuterR} ${sCx+sFW},${sCy+sOuterR}"
    fill="none" stroke="${stageColor}" stroke-width="2.5"/>
  <rect x="${sCx-sSW}" y="${sCy-m.thickness*scaleS/2}" width="${sSW*2}" height="${m.thickness*scaleS}"
    fill="#fbbf24" opacity="0.4" stroke="#fbbf24" stroke-width="1"/>
  <line x1="${sX}" y1="${sCy}" x2="${sX+sW}" y2="${sCy}" stroke="#334155" stroke-width="0.8" stroke-dasharray="6,4"/>
  <rect x="${sCx-sFW}" y="${sCy-sBoreR}" width="${sFW*2}" height="${sBoreR*2}"
    fill="none" stroke="#475569" stroke-width="0.8" stroke-dasharray="4,3"/>
  <line x1="${sCx-sFW}" y1="${sCy+sOuterR+18}" x2="${sCx+sFW}" y2="${sCy+sOuterR+18}" stroke="#60a5fa" stroke-width="0.8"/>
  <text x="${sCx}" y="${sCy+sOuterR+32}" font-size="9" fill="#60a5fa" text-anchor="middle">Face: ${m.faceWidth} mm</text>
  <line x1="${sCx+sFW+10}" y1="${sCy-sOuterR}" x2="${sCx+sFW+10}" y2="${sCy+sOuterR}" stroke="#94a3b8" stroke-width="0.8"/>
  <text x="${sCx+sFW+14}" y="${sCy-4}" font-size="8" fill="#94a3b8">⌀${m.rollOD}</text>
  <line x1="${sCx-sFW-10}" y1="${sCy-sBoreR}" x2="${sCx-sFW-10}" y2="${sCy+sBoreR}" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="${sCx-sFW-14}" y="${sCy-4}" font-size="8" fill="#f59e0b" text-anchor="end">⌀${m.bore}</text>

  <!-- === RELEASE STAMP === -->
  <rect x="${W-380}" y="${H-235}" width="365" height="42" fill="${relMeta.bgFill}" stroke="${relMeta.stroke}" stroke-width="1.5" rx="3"/>
  <text x="${W-197}" y="${H-221}" font-size="9" fill="${relMeta.textFill}" text-anchor="middle" font-weight="bold" letter-spacing="1.5">${relMeta.label}</text>
  <text x="${W-197}" y="${H-207}" font-size="7.5" fill="${relMeta.subFill}" text-anchor="middle">${relMeta.sublabel} · ${m.exportDate} · ${m.revision}</text>

  <!-- ═══ ISO 7200 TITLE BLOCK ═══ -->
  <!-- Outer border -->
  <rect x="${W-380}" y="${H-192}" width="365" height="177" fill="#0a1120" stroke="#1e3a8a" stroke-width="1.5"/>

  <!-- Company header strip -->
  <rect x="${W-380}" y="${H-192}" width="365" height="22" fill="#0d2456" stroke="none"/>
  <text x="${W-197}" y="${H-176}" font-size="9" fill="#93c5fd" text-anchor="middle" font-weight="bold" letter-spacing="2">SAI ROLOTECH PVT. LTD.</text>
  <text x="${W-375}" y="${H-177}" font-size="6.5" fill="#3b82f6">ISO 7200</text>
  <text x="${W-20}" y="${H-177}" font-size="6.5" fill="#3b82f6" text-anchor="end">AS 1100.301</text>

  <!-- Row dividers (8 rows × 21px below company header) -->
  <line x1="${W-380}" y1="${H-170}" x2="${W-15}" y2="${H-170}" stroke="#1e3a5a" stroke-width="0.6"/>
  <line x1="${W-380}" y1="${H-149}" x2="${W-15}" y2="${H-149}" stroke="#1e3a5a" stroke-width="0.6"/>
  <line x1="${W-380}" y1="${H-128}" x2="${W-15}" y2="${H-128}" stroke="#1e3a5a" stroke-width="0.6"/>
  <line x1="${W-380}" y1="${H-107}" x2="${W-15}" y2="${H-107}" stroke="#1e3a5a" stroke-width="0.6"/>
  <line x1="${W-380}" y1="${H-86}" x2="${W-15}" y2="${H-86}" stroke="#1e3a5a" stroke-width="0.6"/>
  <line x1="${W-380}" y1="${H-65}" x2="${W-15}" y2="${H-65}" stroke="#1e3a5a" stroke-width="0.6"/>
  <line x1="${W-380}" y1="${H-44}" x2="${W-15}" y2="${H-44}" stroke="#1e3a5a" stroke-width="0.6"/>
  <line x1="${W-380}" y1="${H-22}" x2="${W-15}" y2="${H-22}" stroke="#1e3a5a" stroke-width="0.6"/>
  <!-- Vertical divider -->
  <line x1="${W-200}" y1="${H-170}" x2="${W-200}" y2="${H-15}" stroke="#1e3a5a" stroke-width="0.6"/>

  <!-- ── LEFT COLUMN LABELS ── -->
  <text x="${W-376}" y="${H-160}" font-size="6" fill="#475569" letter-spacing="0.5">DRG. NO. (ISO 7200)</text>
  <text x="${W-376}" y="${H-139}" font-size="6" fill="#475569" letter-spacing="0.5">CUSTOMER</text>
  <text x="${W-376}" y="${H-118}" font-size="6" fill="#475569" letter-spacing="0.5">JOB NO. / PROJECT</text>
  <text x="${W-376}" y="${H-97}" font-size="6" fill="#475569" letter-spacing="0.5">MATERIAL / THK. / STAGE</text>
  <text x="${W-376}" y="${H-76}" font-size="6" fill="#475569" letter-spacing="0.5">REV. / DATE</text>
  <text x="${W-376}" y="${H-55}" font-size="6" fill="#475569" letter-spacing="0.5">CHECKED BY</text>
  <text x="${W-376}" y="${H-34}" font-size="6" fill="#475569" letter-spacing="0.5">APPROVED BY</text>
  <text x="${W-376}" y="${H-12}" font-size="6" fill="#475569" letter-spacing="0.5">SCALE / SHEET / UNIT</text>

  <!-- ── LEFT COLUMN VALUES ── -->
  <text x="${W-376}" y="${H-151}" font-size="8" fill="#e2e8f0" font-weight="bold" letter-spacing="0.5">${m.drawingNo}</text>
  <text x="${W-376}" y="${H-130}" font-size="8" fill="#93c5fd">${m.customerName || "—"}</text>
  <text x="${W-376}" y="${H-109}" font-size="7.5" fill="#93c5fd">${m.jobNo || "—"} ${m.projectName ? "/ " + m.projectName : ""}</text>
  <text x="${W-376}" y="${H-88}" font-size="7.5" fill="#a5b4fc">${m.material} / ${m.thickness} mm · <tspan fill="${stageColor}">${m.stageType.replace(/_/g," ")}</tspan></text>
  <text x="${W-376}" y="${H-67}" font-size="8" fill="#94a3b8">${m.revision}  /  ${m.exportDate}</text>
  <text x="${W-376}" y="${H-46}" font-size="8" fill="${m.checkedBy ? "#4ade80" : "#475569"}">${tbChecked}</text>
  <text x="${W-376}" y="${H-25}" font-size="8" fill="${m.approvedBy ? "#4ade80" : "#475569"}">${tbApproved}</text>
  <text x="${W-376}" y="${H-13}" font-size="7.5" fill="#94a3b8">${m.drawingScale}  ·  Sh ${m.sheetNo}/${m.totalSheets}  ·  mm</text>

  <!-- ── RIGHT COLUMN LABELS ── -->
  <text x="${W-196}" y="${H-160}" font-size="6" fill="#475569" letter-spacing="0.5">ROLL OD (h6)</text>
  <text x="${W-196}" y="${H-139}" font-size="6" fill="#475569" letter-spacing="0.5">BORE DIA. (H7)</text>
  <text x="${W-196}" y="${H-118}" font-size="6" fill="#475569" letter-spacing="0.5">FACE WIDTH</text>
  <text x="${W-196}" y="${H-97}" font-size="6" fill="#475569" letter-spacing="0.5">SHAFT DIA.</text>
  <text x="${W-196}" y="${H-76}" font-size="6" fill="#475569" letter-spacing="0.5">KEYWAY (DIN 6885)</text>
  <text x="${W-196}" y="${H-55}" font-size="6" fill="#475569" letter-spacing="0.5">ROLL MATERIAL</text>
  <text x="${W-196}" y="${H-34}" font-size="6" fill="#475569" letter-spacing="0.5">SURFACE FINISH / HRC</text>
  <text x="${W-196}" y="${H-12}" font-size="6" fill="#475569" letter-spacing="0.5">TOLERANCE</text>

  <!-- ── RIGHT COLUMN VALUES ── -->
  <text x="${W-196}" y="${H-151}" font-size="8" fill="#60a5fa" font-weight="bold">⌀${m.rollOD} mm</text>
  <text x="${W-196}" y="${H-130}" font-size="8" fill="#fbbf24">⌀${m.bore} mm</text>
  <text x="${W-196}" y="${H-109}" font-size="8" fill="#c4b5fd">${m.faceWidth} mm</text>
  <text x="${W-196}" y="${H-88}" font-size="8" fill="#34d399">⌀${m.shaft} mm</text>
  <text x="${W-196}" y="${H-67}" font-size="8" fill="#f97316">${m.keyway} mm</text>
  <text x="${W-196}" y="${H-46}" font-size="8" fill="#f87171">EN31 / D2 Steel</text>
  <text x="${W-196}" y="${H-25}" font-size="8" fill="#94a3b8">Ra 0.8 μm · 60–62 HRC</text>
  <text x="${W-196}" y="${H-13}" font-size="6.5" fill="#64748b">${m.toleranceNote.length > 30 ? m.toleranceNote.substring(0,30)+"…" : m.toleranceNote}</text>

  <!-- Forming data box -->
  <rect x="15" y="${H-190}" width="295" height="175" fill="#0f172a" stroke="#1e3a8a" stroke-width="1"/>
  <text x="20" y="${H-175}" font-size="8" fill="#64748b">FORMING DATA — ${m.stationLabel.toUpperCase()}</text>
  <line x1="15" y1="${H-167}" x2="310" y2="${H-167}" stroke="#1e293b" stroke-width="0.5"/>
  ${[
    ["Bend Angle",     `${m.bendAngle}°`],
    ["Springback Adj.", m.springbackDeg > 0 ? `+${m.springbackDeg.toFixed(1)}° (${m.material})` : `0° (${m.material})`],
    ["Tool Angle",     `${(m.bendAngle + m.springbackDeg).toFixed(1)}°`],
    ["Roll Gap",       `${m.rollGap} mm`],
    ["Form Depth",     `${m.formDepth.toFixed(1)} mm`],
    ["Progress",       `${m.passProgress.toFixed(0)}%`],
    ["Station",        `${m.stationNo} of ${m.totalStations}`],
  ].map(([label, val], i) => `
    <text x="22" y="${H-153+i*22}" font-size="8" fill="#64748b">${label}:</text>
    <text x="130" y="${H-153+i*22}" font-size="9" fill="#e2e8f0" font-weight="bold">${val}</text>
  `).join("")}

  <!-- Watermark -->
  <text x="${W/2}" y="${H/2}" font-size="80" fill="#1e293b" text-anchor="middle"
    dominant-baseline="middle" opacity="0.15" transform="rotate(-30 ${W/2} ${H/2})">SAI ROLOTECH</text>

</svg>`;
}

// ─── renderDrawingToDXF ────────────────────────────────────────────────────────

export function renderDrawingToDXF(m: DrawingModel): string {
  const upper = m.upperProfile;
  const lower = m.lowerProfile;
  const lines: string[] = [];
  const push = (...args: (string | number)[]) =>
    args.forEach(a => lines.push(String(a)));

  // ── DXF R2000 (AC1015) — AutoCAD 2000+ compatible ────────────────────────
  push("0","SECTION","2","HEADER");
  push("9","$ACADVER","1","AC1015");   // R2000 — supported by all modern CAD
  push("9","$DWGCODEPAGE","3","ANSI_1252");
  push("9","$INSBASE","10","0.0","20","0.0","30","0.0");
  push("9","$EXTMIN","10","-10.0","20","-10.0","30","0.0");
  push("9","$EXTMAX","10","620.0","20","510.0","30","0.0");
  push("9","$LUNITS","70","4");        // Engineering units
  push("9","$LUPREC","70","4");        // 4 decimal places
  push("9","$AUNITS","70","0");        // Decimal degrees
  push("9","$MEASUREMENT","70","1");   // Metric
  push("0","ENDSEC");

  push("0","SECTION","2","TABLES");
  push("0","TABLE","2","LTYPE","70","2");
  push("0","LTYPE","2","CONTINUOUS","70","0","3","Solid line","72","65","73","0","40","0.0");
  push("0","LTYPE","2","CENTER",    "70","0","3","Center line","72","65","73","4","40","2.0","49","1.25","74","0","49","-0.25","74","0","49","0.25","74","0","49","-0.25","74","0");
  push("0","LTYPE","2","DASHED",    "70","0","3","Dashed line","72","65","73","2","40","0.75","49","0.5","74","0","49","-0.25","74","0");
  push("0","ENDTAB");
  push("0","TABLE","2","LAYER","70","6");
  push("0","LAYER","2","OUTLINE",     "70","0","62","7","6","CONTINUOUS");
  push("0","LAYER","2","ROLL_PROFILE","70","0","62","5","6","CONTINUOUS");
  push("0","LAYER","2","STRIP",       "70","0","62","2","6","CONTINUOUS");
  push("0","LAYER","2","CENTERLINE",  "70","0","62","8","6","CENTER");
  push("0","LAYER","2","ANNOTATION",  "70","0","62","1","6","CONTINUOUS");
  push("0","LAYER","2","CONSTRUCTION","70","0","62","9","6","DASHED");
  push("0","ENDTAB");
  push("0","ENDSEC");

  push("0","SECTION","2","ENTITIES");

  // Annotation
  push("0","TEXT","8","ANNOTATION",
    "10","0.0","20","445.0","30","0.0","40","6","1",
    `${m.drawingNo} · ${m.material} · ${m.thickness}mm · ${m.revision} · ${m.exportDate}`);
  push("0","TEXT","8","ANNOTATION",
    "10","0.0","20","435.0","30","0.0","40","4","1",
    `OD:${m.rollOD}  BORE:${m.bore}H7  FACE:${m.faceWidth}  SHAFT:${m.shaft}  KW:${m.keyway}  GAP:${m.rollGap}mm`);
  push("0","TEXT","8","ANNOTATION",
    "10","0.0","20","425.0","30","0.0","40","4","1",
    `RELEASE: ${m.releaseState.replace(/_/g," ").toUpperCase()}  CHK: ${m.checkedBy||"—"}  APPVD: ${m.approvedBy||"—"}`);

  const scaleX = 2.5, scaleY = 2.5, offX = 50, offY = 200;

  // ROLL_PROFILE — upper (LWPOLYLINE: R2000+ preferred, more compact than POLYLINE)
  push("0","LWPOLYLINE","8","ROLL_PROFILE","62","5",
       "90",String(upper.length),"70","0");
  upper.forEach(pt => {
    push("10",(pt.x*scaleX+offX).toFixed(4),"20",(pt.y*scaleY+offY).toFixed(4));
  });

  // ROLL_PROFILE — lower (LWPOLYLINE)
  push("0","LWPOLYLINE","8","ROLL_PROFILE","62","3",
       "90",String(lower.length),"70","0");
  lower.forEach(pt => {
    push("10",(pt.x*scaleX+offX).toFixed(4),"20",(pt.y*scaleY+offY).toFixed(4));
  });

  // OUTLINE — bounding box of cross-section
  const allPts = [...upper, ...lower];
  const minX = Math.min(...allPts.map(p=>p.x))*scaleX+offX;
  const maxX = Math.max(...allPts.map(p=>p.x))*scaleX+offX;
  const minY = Math.min(...allPts.map(p=>p.y))*scaleY+offY;
  const maxY = Math.max(...allPts.map(p=>p.y))*scaleY+offY;
  push("0","LINE","8","OUTLINE","62","7",
    "10",minX.toFixed(4),"20",minY.toFixed(4),"30","0.0",
    "11",maxX.toFixed(4),"21",minY.toFixed(4),"31","0.0");
  push("0","LINE","8","OUTLINE","62","7",
    "10",maxX.toFixed(4),"20",minY.toFixed(4),"30","0.0",
    "11",maxX.toFixed(4),"21",maxY.toFixed(4),"31","0.0");
  push("0","LINE","8","OUTLINE","62","7",
    "10",maxX.toFixed(4),"20",maxY.toFixed(4),"30","0.0",
    "11",minX.toFixed(4),"21",maxY.toFixed(4),"31","0.0");
  push("0","LINE","8","OUTLINE","62","7",
    "10",minX.toFixed(4),"20",maxY.toFixed(4),"30","0.0",
    "11",minX.toFixed(4),"21",minY.toFixed(4),"31","0.0");

  // STRIP boundary
  const sL = (upper[0].x*scaleX+offX).toFixed(4);
  const sR = (upper[upper.length-1].x*scaleX+offX).toFixed(4);
  const uMid = ((upper[0].y+upper[upper.length-1].y)/2*scaleY+offY).toFixed(4);
  const lMid = ((lower[0].y+lower[lower.length-1].y)/2*scaleY+offY).toFixed(4);
  push("0","LINE","8","STRIP","62","2","10",sL,"20",uMid,"30","0.0","11",sR,"21",uMid,"31","0.0");
  push("0","LINE","8","STRIP","62","2","10",sL,"20",lMid,"30","0.0","11",sR,"21",lMid,"31","0.0");
  push("0","LINE","8","STRIP","62","2","10",sL,"20",uMid,"30","0.0","11",sL,"21",lMid,"31","0.0");
  push("0","LINE","8","STRIP","62","2","10",sR,"20",uMid,"30","0.0","11",sR,"21",lMid,"31","0.0");

  // CENTERLINE
  const cX = ((upper[0].x+upper[upper.length-1].x)/2*scaleX+offX).toFixed(4);
  push("0","LINE","8","CENTERLINE","62","8",
    "10",cX,"20","0.0","30","0.0","11",cX,"21","500.0","31","0.0");

  // CONSTRUCTION — front view: OD + bore circles
  const fcx = 450, fcy = 200;
  const fod = (m.rollOD/2)*0.6;
  const fbr = (m.bore/2)*0.6;
  push("0","CIRCLE","8","ROLL_PROFILE","62","5","10",fcx,"20",fcy,"30","0.0","40",fod.toFixed(4));
  push("0","CIRCLE","8","CONSTRUCTION","62","8","10",fcx,"20",fcy,"30","0.0","40",fbr.toFixed(4));

  // ANNOTATION — dimension text
  const swCx = ((upper[0].x+upper[upper.length-1].x)/2*scaleX+offX).toFixed(4);
  push("0","TEXT","8","ANNOTATION",
    "10",swCx,"20",(parseFloat(lMid)+20).toFixed(4),"30","0.0","40","4.5","1",
    `Strip W: ${m.stripWidth.toFixed(1)}mm  Angle: ${m.bendAngle}°  Tool: ${(m.bendAngle+m.springbackDeg).toFixed(1)}°  Gap: ${m.rollGap}mm`);

  push("0","ENDSEC","0","EOF");
  return lines.join("\r\n");
}

// ─── printSinglePDF ───────────────────────────────────────────────────────────

export function printSinglePDF(model: DrawingModel, title: string) {
  const svg = renderDrawingToSVG(model);
  const html = `<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
  @page { size: A3 landscape; margin: 0; }
  html, body { margin:0; padding:0; background:#0c1220; width:420mm; height:297mm; }
  svg { width:420mm; height:297mm; display:block; }
</style>
</head>
<body>${svg}
<script>window.onload=()=>{setTimeout(()=>window.print(),400);};<\/script>
</body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

// ─── printAllStationsPDF ──────────────────────────────────────────────────────
// Multi-page PDF: each station gets its own A3 landscape page.

export function printAllStationsPDF(models: DrawingModel[], title: string) {
  const pages = models.map(m => {
    const svg = renderDrawingToSVG(m);
    return `<div class="page">${svg}</div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
  @page { size: A3 landscape; margin: 0; }
  html, body { margin:0; padding:0; background:#0c1220; }
  .page {
    width: 420mm; height: 297mm;
    display: block;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: avoid; }
  svg { width: 420mm; height: 297mm; display: block; }
</style>
</head>
<body>
${pages}
<script>window.onload=()=>{setTimeout(()=>window.print(),600);};<\/script>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ─── buildExportManifest ──────────────────────────────────────────────────────

export function buildExportManifest(
  models:    DrawingModel[],
  fileList:  string[],
): ExportManifest {
  const m0 = models[0];
  const ts = new Date().toISOString();
  const exportId = `SRE-${m0.profileType.substring(0,3).toUpperCase() || "ROL"}-${m0.revision}-${Date.now().toString(36).toUpperCase()}`;

  return {
    exportId,
    timestamp:      ts,
    softwareVersion: "Sai Rolotech Smart Engines v2.3.0",
    profileType:    m0.profileType,
    material:       m0.material,
    thickness:      m0.thickness,
    stripWidth:     m0.stripWidth,
    totalStations:  m0.totalStations,
    revision:       m0.revision,
    releaseState:   m0.releaseState,
    checkedBy:      m0.checkedBy,
    approvedBy:     m0.approvedBy,
    rollOD:         m0.rollOD,
    bore:           m0.bore,
    faceWidth:      m0.faceWidth,
    files:          fileList,
  };
}

// ─── buildExportSummaryTxt ────────────────────────────────────────────────────

export function buildExportSummaryTxt(
  models:   DrawingModel[],
  manifest: ExportManifest,
): string {
  const m0 = models[0];
  const line = (k: string, v: string) => `  ${k.padEnd(22)}: ${v}`;
  const sep  = "─".repeat(60);

  return [
    "SAI ROLOTECH SMART ENGINES v2.4.0",
    "ROLL TOOLING MANUFACTURING EXPORT SUMMARY",
    sep,
    "",
    "PROJECT / PROFILE (ISO 7200)",
    line("Drawing No.",    m0.drawingNo),
    line("Profile Type",   m0.profileType || "—"),
    line("Customer",       m0.customerName || "—"),
    line("Job No.",        m0.jobNo || "—"),
    line("Project",        m0.projectName || "—"),
    line("Company",        m0.companyName),
    line("Sheet",          `${m0.sheetNo} of ${m0.totalSheets}`),
    line("Export ID",      manifest.exportId),
    "",
    "MATERIAL & SECTION",
    line("Material",       m0.material),
    line("Thickness",      `${m0.thickness} mm`),
    line("Strip Width",    `${m0.stripWidth.toFixed(1)} mm`),
    line("Springback",     m0.springbackDeg > 0 ? `${m0.springbackDeg.toFixed(1)}° (${m0.material})` : "0°"),
    "",
    "ROLL DIMENSIONS",
    line("Roll OD",        `⌀${m0.rollOD} mm h6`),
    line("Bore",           `⌀${m0.bore} mm H7`),
    line("Face Width",     `${m0.faceWidth} mm`),
    line("Shaft",          `⌀${m0.shaft} mm`),
    line("Keyway",         `${m0.keyway} mm (DIN 6885 A)`),
    line("Spacer",         `${m0.spacer} mm`),
    "",
    "TOOLING INFO",
    line("Total Stations", `${m0.totalStations}`),
    line("Roll Material",  "EN31 / D2"),
    line("Hardness",       "60–62 HRC"),
    line("Surface Finish", "Ra 0.8 μm"),
    line("Tolerance",      m0.toleranceNote),
    "",
    "RELEASE INFO",
    line("Revision",       m0.revision),
    line("Release State",  m0.releaseState.replace(/_/g," ").toUpperCase()),
    line("Checked By",     m0.checkedBy || "—"),
    line("Approved By",    m0.approvedBy || "—"),
    line("Export Date",    m0.exportDate),
    line("Timestamp",      manifest.timestamp),
    "",
    "PACKAGE CONTENTS",
    ...manifest.files.map(f => `  • ${f}`),
    "",
    sep,
    "NOTE: This package is for engineering reference.",
    "Verify all dimensions before production machining.",
    sep,
  ].join("\n");
}

// ─── buildZipPackage ──────────────────────────────────────────────────────────
// Returns a Blob of the structured ZIP archive.

export async function buildZipPackage(
  models: DrawingModel[],
): Promise<Blob> {
  const zip      = new JSZip();
  const m0       = models[0];
  const tag      = (m0.profileType || m0.material).substring(0,6)
    .toLowerCase().replace(/[^a-z0-9]/g,"-");
  const rev      = m0.revision.toLowerCase().replace(/[^a-z0-9]/g,"-");
  const root     = zip.folder(`srt-roll-tooling-${tag}-${rev}`)!;
  const svgFolder = root.folder("svg")!;
  const dxfFolder = root.folder("dxf")!;
  const maniFolder= root.folder("manifest")!;
  const readmeFolder = root.folder("readme")!;

  const fileList: string[] = [];

  models.forEach(m => {
    const svg  = renderDrawingToSVG(m);
    const dxf  = renderDrawingToDXF(m);
    const fSvg = generateFileName(m, "svg");
    const fDxf = generateFileName(m, "dxf");

    svgFolder.file(fSvg, svg);
    dxfFolder.file(fDxf, dxf);

    fileList.push(`svg/${fSvg}`);
    fileList.push(`dxf/${fDxf}`);
  });

  const manifest = buildExportManifest(models, fileList);
  const summary  = buildExportSummaryTxt(models, manifest);

  maniFolder.file("export-manifest.json",
    JSON.stringify(manifest, null, 2));
  readmeFolder.file("export-summary.txt", summary);

  fileList.push("manifest/export-manifest.json");
  fileList.push("readme/export-summary.txt");

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

// ─── Download helpers (re-exported) ──────────────────────────────────────────

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement("a"), {
    href: url, download: filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function triggerSVGDownload(svgString: string, filename: string) {
  triggerBlobDownload(
    new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
    filename,
  );
}
