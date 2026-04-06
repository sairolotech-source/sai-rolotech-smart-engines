import { MATERIAL_PROPS } from "./deep-accuracy-engine.js";

export interface MaterialModel {
  code: string;
  label: string;
  yieldStrengthMPa: number;
  elasticModulusMPa: number;
  utsMPa: number;
  maxStrain: number;
}

export interface ResolvedMaterialModel extends MaterialModel {
  materialUsed: string;
}

const MAX_STRAIN_BY_CODE: Record<string, number> = {
  GI: 0.20,
  CR: 0.18,
  HR: 0.16,
  SS: 0.12,
  AL: 0.22,
  MS: 0.20,
  CU: 0.25,
  TI: 0.08,
  PP: 0.18,
  HSLA: 0.10,
};

const MATERIAL_LABELS: Record<string, string> = {
  GI: "GI",
  CR: "CRCA",
  HR: "HR",
  SS: "SS304",
  AL: "AL",
  MS: "MS",
  CU: "CU",
  TI: "TI",
  PP: "PPGI",
  HSLA: "HSLA",
};

const MATERIAL_ALIASES: Record<string, string> = {
  GI: "GI",
  GALV: "GI",
  GALVANIZED: "GI",
  PPGI: "PP",
  PP: "PP",
  CR: "CR",
  CRC: "CR",
  CRCA: "CR",
  COLDROLLED: "CR",
  HR: "HR",
  HOTROLLED: "HR",
  SS: "SS",
  SS304: "SS",
  STAINLESS: "SS",
  STAINLESS304: "SS",
  SS316: "SS",
  AL: "AL",
  ALUMINIUM: "AL",
  ALUMINUM: "AL",
  MS: "MS",
  MILDSTEEL: "MS",
  CU: "CU",
  COPPER: "CU",
  TI: "TI",
  TITANIUM: "TI",
  HSLA: "HSLA",
};

function sanitizeMaterialInput(input: string | undefined): string {
  return (input ?? "GI")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function buildMaterialModel(code: string, materialUsed: string): ResolvedMaterialModel {
  const props = MATERIAL_PROPS[code] ?? MATERIAL_PROPS["GI"]!;
  const maxStrain = MAX_STRAIN_BY_CODE[code] ?? MAX_STRAIN_BY_CODE["GI"]!;

  return {
    code,
    label: MATERIAL_LABELS[code] ?? code,
    yieldStrengthMPa: props.yieldMPa,
    elasticModulusMPa: props.elasticGPa * 1000,
    utsMPa: props.utsMPa,
    maxStrain,
    materialUsed,
  };
}

export function resolveMaterialInput(input: string | undefined): ResolvedMaterialModel {
  const normalized = sanitizeMaterialInput(input);
  const resolvedCode = MATERIAL_ALIASES[normalized] ?? "GI";
  const materialUsed = normalized.length > 0 ? normalized : "GI";
  return buildMaterialModel(resolvedCode, materialUsed);
}
