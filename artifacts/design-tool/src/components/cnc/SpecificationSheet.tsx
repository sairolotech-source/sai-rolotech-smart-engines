import React, { useMemo } from "react";
import {
  useCncStore,
  MATERIAL_DATABASE,
  getKeywaySizeForShaft,
  type RollToolingResult,
  type GuardrailProfileMetadata,
} from "../../store/useCncStore";
import { Download, FileText, Printer, ClipboardList } from "lucide-react";

interface StationSpec {
  stationNumber: number;
  label: string;
  bearing: {
    skfNumber: string;
    type: string;
    material: string;
    sealType: string;
    qtyPerStation: number;
  };
  plate: {
    materialType: string;
    materialName: string;
    thicknessMm: number;
    stripWidth: number;
    kFactor: number;
    yieldStrength: number;
    springbackFactor: number;
  };
  shaft: {
    diameterMm: number;
    material: string;
    keyWidth: number;
    keyDepth: number;
    lockingNutSize: string;
  };
  roll: {
    diameterMm: number;
    grooveDepth: number;
    boreSizeMm: number;
    material: string;
    hardness: string;
    surfaceTreatment: string;
    rollWidth: number;
    rollType: string;
  };
  gearbox: {
    gearRatio: number;
    outputTorqueNm: number;
    recommendedRatingNm: number;
    vfdRecommendation: string;
  };
  motor: {
    powerKw: number;
    motorRPM: number;
    rollRPM: number;
    motorClass: string;
  };
  sideCollar: {
    material: string;
    od: number;
    id: number;
    width: number;
    hardness: string;
  } | null;
  spacer: {
    thicknessMm: number;
    material: string;
  } | null;
}

function getMotorClass(kw: number): string {
  if (kw <= 5) return "Light";
  if (kw <= 15) return "Medium";
  return "Heavy";
}

function buildStationSpecs(
  rollTooling: RollToolingResult[],
  shaftDiameter: number,
  rollDiameter: number,
  materialType: string,
  materialThickness: number,
  lineSpeed: number,
  motorRPM: number,
  motorPower: number,
): StationSpec[] {
  const matProps = MATERIAL_DATABASE[materialType as keyof typeof MATERIAL_DATABASE];
  const keyway = getKeywaySizeForShaft(shaftDiameter);

  const brgCode = shaftDiameter <= 40 ? "6208" : shaftDiameter <= 50 ? "6210" : "6212";
  const lockingNutSize = `KM${shaftDiameter >= 45 ? 9 : 8}`;
  const shaftMaterial = shaftDiameter <= 50 ? "EN8" : "EN19";

  return rollTooling.map((rt) => {
    const rp = rt.rollProfile;
    const spec = rt.mfgSpec;

    const stationRollDia = rp.rollDiameter || rollDiameter;
    const rollRPM = stationRollDia > 0 ? (1000 * lineSpeed) / (Math.PI * stationRollDia) : 0;
    const gearRatio = rollRPM > 0 ? motorRPM / rollRPM : 0;
    const outputTorque = rollRPM > 0 ? (9550 * motorPower) / rollRPM : 0;

    return {
      stationNumber: rt.stationNumber,
      label: rt.label,
      bearing: {
        skfNumber: `SKF ${brgCode} (2RS)`,
        type: "Deep Groove Ball Bearing",
        material: "GCr15 Chrome Steel",
        sealType: "2RS (sealed both sides)",
        qtyPerStation: 4,
      },
      plate: {
        materialType,
        materialName: matProps?.name ?? materialType,
        thicknessMm: materialThickness,
        stripWidth: rp.rollWidth,
        kFactor: rp.kFactor,
        yieldStrength: matProps?.yieldStrength ?? 0,
        springbackFactor: matProps?.springbackFactor ?? 1,
      },
      shaft: {
        diameterMm: shaftDiameter,
        material: shaftMaterial,
        keyWidth: keyway.width,
        keyDepth: keyway.height,
        lockingNutSize,
      },
      roll: {
        diameterMm: rp.rollDiameter,
        grooveDepth: rp.grooveDepth,
        boreSizeMm: spec?.boreSize ?? rp.shaftDiameter,
        material: spec?.rollMaterial ?? "D2 Tool Steel",
        hardness: spec?.rollHardness ?? "58–62 HRC",
        surfaceTreatment: spec?.surfaceTreatment ?? "TD coat",
        rollWidth: rp.rollWidth,
        rollType: spec?.rollType === "split" ? "Split" : "Solid",
      },
      gearbox: {
        gearRatio: isFinite(gearRatio) ? gearRatio : 0,
        outputTorqueNm: isFinite(outputTorque) ? outputTorque : 0,
        recommendedRatingNm: isFinite(outputTorque) ? outputTorque * 1.5 : 0,
        vfdRecommendation: motorPower <= 7.5 ? "Single-phase VFD" : "Three-phase VFD",
      },
      motor: {
        powerKw: motorPower,
        motorRPM,
        rollRPM: isFinite(rollRPM) ? rollRPM : 0,
        motorClass: getMotorClass(motorPower),
      },
      sideCollar: rp.sideCollar
        ? {
            material: rp.sideCollar.material,
            od: rp.sideCollar.OD,
            id: rp.sideCollar.ID,
            width: rp.sideCollar.width,
            hardness: rp.sideCollar.hardness,
          }
        : null,
      spacer:
        spec && spec.spacerThickness > 0
          ? {
              thicknessMm: spec.spacerThickness,
              material: spec.spacerMaterial ?? "EN8",
            }
          : null,
    };
  });
}

function exportCSV(specs: StationSpec[], summary: { totalStations: number; totalPowerKw: number; totalWeightKg: number; material: string }, profileMeta?: GuardrailProfileMetadata | null) {
  const rows: string[][] = [];
  rows.push(["SPECIFICATION SHEET"]);
  rows.push(["Total Stations", String(summary.totalStations)]);
  rows.push(["Total Motor Power (kW)", summary.totalPowerKw.toFixed(2)]);
  rows.push(["Estimated Weight (kg)", summary.totalWeightKg.toFixed(1)]);
  rows.push(["Material", summary.material]);
  if (profileMeta) {
    rows.push([]);
    rows.push(["SAI SAI_ROLOTECH_SMART_ENGINES ENGINE — PROFILE TOOLING DATA"]);
    rows.push(["Model", profileMeta.model]);
    rows.push(["Coil Width (mm)", String(profileMeta.coilWidth)]);
    rows.push(["Cover Width (mm)", String(profileMeta.coverWidth)]);
    rows.push(["Thickness (mm)", String(profileMeta.thickness)]);
    rows.push(["Usage", profileMeta.usage]);
    if (profileMeta.pitch) rows.push(["Pitch (mm)", String(profileMeta.pitch)]);
    if (profileMeta.waveHeight) rows.push(["Wave Height (mm)", String(profileMeta.waveHeight)]);
  }
  rows.push([]);
  rows.push([
    "Station", "Bearing", "Bearing Qty",
    "Material", "Thickness (mm)", "Strip Width (mm)", "K-Factor", "Yield Strength (MPa)", "Springback",
    "Shaft Dia (mm)", "Shaft Material", "Key W×D (mm)", "Locking Nut",
    "Roll Dia (mm)", "Groove Depth (mm)", "Bore (mm)", "Roll Material", "Hardness", "Surface", "Roll Type",
    "Gear Ratio", "Output Torque (Nm)", "Recommended Rating (Nm)", "VFD",
    "Motor Power (kW)", "Motor RPM", "Roll RPM", "Motor Class",
    "Collar Material", "Collar OD/ID/W (mm)", "Collar Hardness",
    "Spacer Thickness (mm)", "Spacer Material",
  ]);

  for (const s of specs) {
    rows.push([
      s.label,
      s.bearing.skfNumber, String(s.bearing.qtyPerStation),
      s.plate.materialName, s.plate.thicknessMm.toFixed(2), s.plate.stripWidth.toFixed(2), s.plate.kFactor.toFixed(3), String(s.plate.yieldStrength), ((s.plate.springbackFactor - 1) * 100).toFixed(1) + "%",
      s.shaft.diameterMm.toFixed(0), s.shaft.material, `${s.shaft.keyWidth}×${s.shaft.keyDepth}`, s.shaft.lockingNutSize,
      s.roll.diameterMm.toFixed(1), s.roll.grooveDepth.toFixed(2), s.roll.boreSizeMm.toFixed(1), s.roll.material, s.roll.hardness, s.roll.surfaceTreatment, s.roll.rollType,
      s.gearbox.gearRatio.toFixed(2), s.gearbox.outputTorqueNm.toFixed(1), s.gearbox.recommendedRatingNm.toFixed(1), s.gearbox.vfdRecommendation,
      s.motor.powerKw.toFixed(2), String(s.motor.motorRPM), s.motor.rollRPM.toFixed(2), s.motor.motorClass,
      s.sideCollar?.material ?? "—", s.sideCollar ? `${s.sideCollar.od}/${s.sideCollar.id}/${s.sideCollar.width}` : "—", s.sideCollar?.hardness ?? "—",
      s.spacer ? s.spacer.thicknessMm.toFixed(2) : "—", s.spacer?.material ?? "—",
    ]);
  }

  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "specification_sheet.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportText(specs: StationSpec[], summary: { totalStations: number; totalPowerKw: number; totalWeightKg: number; material: string }, profileMeta?: GuardrailProfileMetadata | null) {
  const lines: string[] = [];
  const divider = "═".repeat(72);
  const thinDiv = "─".repeat(72);

  lines.push(divider);
  lines.push("  SPECIFICATION SHEET — Sai Rolotech Smart Engines");
  lines.push(divider);
  lines.push("");
  lines.push("  MACHINE SUMMARY");
  lines.push(thinDiv);
  lines.push(`  Total Stations     : ${summary.totalStations}`);
  lines.push(`  Total Motor Power  : ${summary.totalPowerKw.toFixed(2)} kW`);
  lines.push(`  Estimated Weight   : ${summary.totalWeightKg.toFixed(1)} kg`);
  lines.push(`  Material           : ${summary.material}`);

  if (profileMeta) {
    lines.push("");
    lines.push(thinDiv);
    lines.push("  SAI SAI_ROLOTECH_SMART_ENGINES ENGINE — PROFILE TOOLING DATA");
    lines.push(thinDiv);
    lines.push(`  Model              : ${profileMeta.model}`);
    lines.push(`  Coil Width         : ${profileMeta.coilWidth} mm`);
    lines.push(`  Cover Width        : ${profileMeta.coverWidth} mm`);
    lines.push(`  Thickness          : ${profileMeta.thickness} mm`);
    lines.push(`  Usage              : ${profileMeta.usage}`);
    if (profileMeta.pitch) lines.push(`  Pitch              : ${profileMeta.pitch} mm`);
    if (profileMeta.waveHeight) lines.push(`  Wave Height        : ${profileMeta.waveHeight} mm`);
  }

  lines.push("");

  for (const s of specs) {
    lines.push(divider);
    lines.push(`  ${s.label}`);
    lines.push(divider);

    lines.push("");
    lines.push("  BEARING");
    lines.push(`    SKF Number       : ${s.bearing.skfNumber}`);
    lines.push(`    Type             : ${s.bearing.type}`);
    lines.push(`    Material         : ${s.bearing.material}`);
    lines.push(`    Seal             : ${s.bearing.sealType}`);
    lines.push(`    Qty / Station    : ${s.bearing.qtyPerStation}`);

    lines.push("");
    lines.push("  PLATE / MATERIAL");
    lines.push(`    Material         : ${s.plate.materialName} (${s.plate.materialType})`);
    lines.push(`    Thickness        : ${s.plate.thicknessMm.toFixed(2)} mm`);
    lines.push(`    Strip Width      : ${s.plate.stripWidth.toFixed(2)} mm`);
    lines.push(`    K-Factor         : ${s.plate.kFactor.toFixed(3)}`);
    lines.push(`    Yield Strength   : ${s.plate.yieldStrength} MPa`);
    lines.push(`    Springback       : +${((s.plate.springbackFactor - 1) * 100).toFixed(1)}%`);

    lines.push("");
    lines.push("  SHAFT");
    lines.push(`    Diameter         : ${s.shaft.diameterMm.toFixed(0)} mm`);
    lines.push(`    Material         : ${s.shaft.material}`);
    lines.push(`    Key (W×D)        : ${s.shaft.keyWidth} × ${s.shaft.keyDepth} mm`);
    lines.push(`    Locking Nut      : ${s.shaft.lockingNutSize}`);

    lines.push("");
    lines.push("  ROLL");
    lines.push(`    Diameter         : ${s.roll.diameterMm.toFixed(1)} mm`);
    lines.push(`    Groove Depth     : ${s.roll.grooveDepth.toFixed(2)} mm`);
    lines.push(`    Bore Size        : ${s.roll.boreSizeMm.toFixed(1)} mm`);
    lines.push(`    Material         : ${s.roll.material}`);
    lines.push(`    Hardness         : ${s.roll.hardness}`);
    lines.push(`    Surface          : ${s.roll.surfaceTreatment}`);
    lines.push(`    Type             : ${s.roll.rollType}`);
    lines.push(`    Width            : ${s.roll.rollWidth.toFixed(2)} mm`);

    lines.push("");
    lines.push("  GEARBOX");
    lines.push(`    Gear Ratio       : ${s.gearbox.gearRatio.toFixed(2)}`);
    lines.push(`    Output Torque    : ${s.gearbox.outputTorqueNm.toFixed(1)} Nm`);
    lines.push(`    Recommended (1.5×): ${s.gearbox.recommendedRatingNm.toFixed(1)} Nm`);
    lines.push(`    VFD              : ${s.gearbox.vfdRecommendation}`);

    lines.push("");
    lines.push("  MOTOR");
    lines.push(`    Power            : ${s.motor.powerKw.toFixed(2)} kW`);
    lines.push(`    Motor RPM        : ${s.motor.motorRPM}`);
    lines.push(`    Roll RPM         : ${s.motor.rollRPM.toFixed(2)}`);
    lines.push(`    Class            : ${s.motor.motorClass}`);

    if (s.sideCollar) {
      lines.push("");
      lines.push("  SIDE COLLAR");
      lines.push(`    Material         : ${s.sideCollar.material}`);
      lines.push(`    OD / ID / Width  : ${s.sideCollar.od} / ${s.sideCollar.id} / ${s.sideCollar.width} mm`);
      lines.push(`    Hardness         : ${s.sideCollar.hardness}`);
    }

    if (s.spacer) {
      lines.push("");
      lines.push("  SPACER");
      lines.push(`    Thickness        : ${s.spacer.thicknessMm.toFixed(2)} mm`);
      lines.push(`    Material         : ${s.spacer.material}`);
    }

    lines.push("");
  }

  lines.push(divider);
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push(divider);

  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "specification_sheet.txt";
  a.click();
  URL.revokeObjectURL(url);
}

function SpecRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className="text-[11px] text-zinc-200 font-medium font-mono text-right">{value}</span>
    </div>
  );
}

function SpecSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/[0.06] pb-1 mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function StationCard({ spec }: { spec: StationSpec }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
      <div className="text-sm font-bold text-orange-300">{spec.label}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpecSection title="Bearing">
          <SpecRow label="SKF Number" value={spec.bearing.skfNumber} />
          <SpecRow label="Type" value={spec.bearing.type} />
          <SpecRow label="Material" value={spec.bearing.material} />
          <SpecRow label="Seal" value={spec.bearing.sealType} />
          <SpecRow label="Qty / Station" value={spec.bearing.qtyPerStation} />
        </SpecSection>

        <SpecSection title="Plate / Material">
          <SpecRow label="Material" value={`${spec.plate.materialName}`} />
          <SpecRow label="Thickness" value={`${spec.plate.thicknessMm.toFixed(2)} mm`} />
          <SpecRow label="Strip Width" value={`${spec.plate.stripWidth.toFixed(2)} mm`} />
          <SpecRow label="K-Factor" value={spec.plate.kFactor.toFixed(3)} />
          <SpecRow label="Yield Strength" value={`${spec.plate.yieldStrength} MPa`} />
          <SpecRow label="Springback" value={`+${((spec.plate.springbackFactor - 1) * 100).toFixed(1)}%`} />
        </SpecSection>

        <SpecSection title="Shaft">
          <SpecRow label="Diameter" value={`${spec.shaft.diameterMm.toFixed(0)} mm`} />
          <SpecRow label="Material" value={spec.shaft.material} />
          <SpecRow label="Key (W×D)" value={`${spec.shaft.keyWidth} × ${spec.shaft.keyDepth} mm`} />
          <SpecRow label="Locking Nut" value={spec.shaft.lockingNutSize} />
        </SpecSection>

        <SpecSection title="Roll">
          <SpecRow label="Diameter" value={`${spec.roll.diameterMm.toFixed(1)} mm`} />
          <SpecRow label="Groove Depth" value={`${spec.roll.grooveDepth.toFixed(2)} mm`} />
          <SpecRow label="Bore Size" value={`${spec.roll.boreSizeMm.toFixed(1)} mm`} />
          <SpecRow label="Material" value={spec.roll.material} />
          <SpecRow label="Hardness" value={spec.roll.hardness} />
          <SpecRow label="Surface" value={spec.roll.surfaceTreatment} />
          <SpecRow label="Type" value={spec.roll.rollType} />
          <SpecRow label="Width" value={`${spec.roll.rollWidth.toFixed(2)} mm`} />
        </SpecSection>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpecSection title="Gearbox">
          <SpecRow label="Gear Ratio" value={spec.gearbox.gearRatio.toFixed(2)} />
          <SpecRow label="Output Torque" value={`${spec.gearbox.outputTorqueNm.toFixed(1)} Nm`} />
          <SpecRow label="Recommended (1.5×)" value={`${spec.gearbox.recommendedRatingNm.toFixed(1)} Nm`} />
          <SpecRow label="VFD" value={spec.gearbox.vfdRecommendation} />
        </SpecSection>

        <SpecSection title="Motor">
          <SpecRow label="Power" value={`${spec.motor.powerKw.toFixed(2)} kW`} />
          <SpecRow label="Motor RPM" value={spec.motor.motorRPM} />
          <SpecRow label="Roll RPM" value={spec.motor.rollRPM.toFixed(2)} />
          <SpecRow label="Class" value={spec.motor.motorClass} />
        </SpecSection>

        {spec.sideCollar && (
          <SpecSection title="Side Collar">
            <SpecRow label="Material" value={spec.sideCollar.material} />
            <SpecRow label="OD" value={`${spec.sideCollar.od} mm`} />
            <SpecRow label="ID" value={`${spec.sideCollar.id} mm`} />
            <SpecRow label="Width" value={`${spec.sideCollar.width} mm`} />
            <SpecRow label="Hardness" value={spec.sideCollar.hardness} />
          </SpecSection>
        )}

        {spec.spacer && (
          <SpecSection title="Spacer">
            <SpecRow label="Thickness" value={`${spec.spacer.thicknessMm.toFixed(2)} mm`} />
            <SpecRow label="Material" value={spec.spacer.material} />
          </SpecSection>
        )}
      </div>
    </div>
  );
}

export function SpecificationSheet() {
  const {
    rollTooling,
    shaftDiameter,
    rollDiameter,
    materialType,
    materialThickness,
    lineSpeed,
    motorRPM,
    motorPower,
    profileName,
    numStations,
    profileMetadata,
  } = useCncStore();

  const specs = useMemo(() => {
    if (rollTooling.length === 0) return [];
    return buildStationSpecs(
      rollTooling,
      shaftDiameter,
      rollDiameter,
      materialType,
      materialThickness,
      lineSpeed,
      motorRPM,
      motorPower,
    );
  }, [rollTooling, shaftDiameter, rollDiameter, materialType, materialThickness, lineSpeed, motorRPM, motorPower]);

  const summary = useMemo(() => {
    const DENSITY = 7.85e-6;
    let totalWeightKg = 0;
    for (const rt of rollTooling) {
      const rp = rt.rollProfile;
      const spec = rt.mfgSpec;
      const rollVol = Math.PI / 4 * (rp.rollDiameter ** 2 - rp.shaftDiameter ** 2) * rp.rollWidth;
      totalWeightKg += rollVol * DENSITY * 2;
      const shaftLen = rp.rollWidth + 220;
      const shaftVol = Math.PI / 4 * shaftDiameter * shaftDiameter * shaftLen;
      totalWeightKg += shaftVol * DENSITY * 2;
      if (spec && spec.spacerThickness > 0) {
        const spOD = Math.round(shaftDiameter * 1.6);
        const spVol = Math.PI / 4 * (spOD ** 2 - shaftDiameter ** 2) * spec.spacerThickness;
        totalWeightKg += spVol * DENSITY * 2;
      }
    }
    totalWeightKg += rollTooling.length * 4 * 0.28;
    totalWeightKg = Math.round(totalWeightKg * 10) / 10;

    const matProps = MATERIAL_DATABASE[materialType as keyof typeof MATERIAL_DATABASE];
    return {
      totalStations: rollTooling.length,
      totalPowerKw: motorPower,
      totalWeightKg,
      material: `${matProps?.name ?? materialType} — ${materialThickness} mm`,
    };
  }, [rollTooling, shaftDiameter, materialType, materialThickness, motorPower]);

  if (rollTooling.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#070710]">
        <div className="text-center space-y-3 max-w-md">
          <ClipboardList className="w-12 h-12 text-zinc-700 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-300">No Specification Data</h2>
          <p className="text-sm text-zinc-500">
            Roll tooling generate karein pehle — Specs tab automatically sab engineering details
            consolidate karega har station ke liye.
          </p>
          <p className="text-xs text-zinc-600">
            Setup → Profile Upload → Power Pattern → Roll Tooling → Specs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#070710] p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-400" />
            Specification Sheet
            {profileName && (
              <span className="text-sm font-normal text-zinc-400 ml-1">— {profileName}</span>
            )}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Consolidated engineering details per station
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(specs, summary, profileMetadata)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => exportText(specs, summary, profileMetadata)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Text
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
          Machine Summary
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-0.5">
            <div className="text-[10px] text-zinc-500">Total Stations</div>
            <div className="text-xl font-bold text-orange-300">{summary.totalStations}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-zinc-500">Total Motor Power</div>
            <div className="text-xl font-bold text-blue-300">{summary.totalPowerKw.toFixed(2)} kW</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-zinc-500">Estimated Weight</div>
            <div className="text-xl font-bold text-emerald-300">{summary.totalWeightKg.toFixed(1)} kg</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-zinc-500">Material</div>
            <div className="text-sm font-bold text-zinc-200">{summary.material}</div>
          </div>
        </div>
      </div>

      {profileMetadata && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
          <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
            SAI Sai Rolotech Smart Engines Engine — Profile Tooling Data
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-0.5">
              <div className="text-[10px] text-zinc-500">Model</div>
              <div className="text-sm font-bold text-zinc-100 font-mono">{profileMetadata.model}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-zinc-500">Coil Width</div>
              <div className="text-sm font-bold text-zinc-100 font-mono">{profileMetadata.coilWidth}mm</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-zinc-500">Cover Width</div>
              <div className="text-sm font-bold text-zinc-100 font-mono">{profileMetadata.coverWidth}mm</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-zinc-500">Thickness</div>
              <div className="text-sm font-bold text-zinc-100 font-mono">{profileMetadata.thickness}mm</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-zinc-500">Usage</div>
              <div className="text-sm font-bold text-zinc-100 font-mono">{profileMetadata.usage}</div>
            </div>
            {profileMetadata.pitch && (
              <div className="space-y-0.5">
                <div className="text-[10px] text-zinc-500">Pitch</div>
                <div className="text-sm font-bold text-zinc-100 font-mono">{profileMetadata.pitch}mm</div>
              </div>
            )}
            {profileMetadata.waveHeight && (
              <div className="space-y-0.5">
                <div className="text-[10px] text-zinc-500">Wave Height</div>
                <div className="text-sm font-bold text-zinc-100 font-mono">{profileMetadata.waveHeight}mm</div>
              </div>
            )}
          </div>
          {profileMetadata.referenceImage && (
            <div className="mt-2">
              <img
                src={`${import.meta.env.BASE_URL}${profileMetadata.referenceImage}`}
                alt={`${profileMetadata.model} reference drawing`}
                className="max-w-md rounded-lg border border-zinc-700"
              />
              <div className="text-[10px] text-zinc-500 mt-1">Reference drawing — {profileMetadata.model}</div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {specs.map((spec) => (
          <StationCard key={spec.stationNumber} spec={spec} />
        ))}
      </div>
    </div>
  );
}
