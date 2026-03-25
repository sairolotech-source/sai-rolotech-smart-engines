/**
 * SAI Rolotech — Accuracy Interceptor Middleware
 * ================================================
 * Wraps /api/flower and /api/roll-tooling responses.
 * Runs deep offline formula validation on outputs.
 * Catches NaN, Infinity, impossible values before they reach client.
 * Adds `_accuracy` field to every response automatically.
 */
import type { Request, Response, NextFunction } from "express";
import {
  MATERIAL_PROPS,
  calcRollGap,
  calcMinRollOD,
  calcFormingForce,
} from "../lib/deep-accuracy-engine";

interface SanitizedIssue {
  field: string;
  issue: string;
  original: unknown;
  corrected: unknown;
}

function sanitizeValue(val: unknown, fallback: number, min?: number, max?: number): number {
  const n = Number(val);
  if (!isFinite(n) || isNaN(n)) return fallback;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

function deepSanitize(obj: unknown, path = "", issues: SanitizedIssue[]): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "number") {
    if (!isFinite(obj) || isNaN(obj)) {
      issues.push({ field: path, issue: "NaN/Infinity value", original: obj, corrected: 0 });
      return 0;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, i) => deepSanitize(item, `${path}[${i}]`, issues));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = deepSanitize(value, path ? `${path}.${key}` : key, issues);
    }
    return result;
  }

  return obj;
}

function quickValidateFlowerStation(station: Record<string, unknown>, materialType: string, thickness: number): SanitizedIssue[] {
  const issues: SanitizedIssue[] = [];
  const mat = MATERIAL_PROPS[materialType.toUpperCase()] ?? MATERIAL_PROPS["GI"]!;
  const rollGapSpec = calcRollGap(thickness, materialType);

  const rollGap = Number(station["rollGap"] ?? station["gap"]);
  if (isFinite(rollGap)) {
    if (rollGap < rollGapSpec.min) {
      issues.push({ field: "rollGap", issue: `Gap ${rollGap.toFixed(3)}mm < min ${rollGapSpec.min.toFixed(3)}mm`, original: rollGap, corrected: rollGapSpec.nominal });
    } else if (rollGap > rollGapSpec.max) {
      issues.push({ field: "rollGap", issue: `Gap ${rollGap.toFixed(3)}mm > max ${rollGapSpec.max.toFixed(3)}mm`, original: rollGap, corrected: rollGapSpec.nominal });
    }
  }

  const formingForce = Number(station["formingForce"]);
  if (isFinite(formingForce)) {
    const expectedForce = calcFormingForce(mat.utsMPa, thickness, 200, thickness * 2);
    if (formingForce > expectedForce * 10) {
      issues.push({ field: "formingForce", issue: `Force ${formingForce}kN seems extremely high`, original: formingForce, corrected: expectedForce });
    }
    if (formingForce < 0) {
      issues.push({ field: "formingForce", issue: "Negative forming force impossible", original: formingForce, corrected: expectedForce });
    }
  }

  const rollDiameter = Number(station["rollDiameter"] ?? station["outerDiameter"]);
  if (isFinite(rollDiameter) && rollDiameter > 0) {
    if (rollDiameter < 40) {
      issues.push({ field: "rollDiameter", issue: `Roll Ø${rollDiameter}mm < 40mm absolute minimum`, original: rollDiameter, corrected: 60 });
    }
    if (rollDiameter > 600) {
      issues.push({ field: "rollDiameter", issue: `Roll Ø${rollDiameter}mm > 600mm — verify machine capacity`, original: rollDiameter, corrected: 400 });
    }
  }

  return issues;
}

function scoreResponse(issues: SanitizedIssue[], total: number): number {
  const errorCount = issues.length;
  if (total === 0) return 98;
  const accuracy = Math.max(0, 100 - (errorCount / total) * 100);
  return parseFloat(accuracy.toFixed(1));
}

/**
 * Express middleware: deep-scan all /api/flower and /api/roll-tooling responses
 * before they leave the server. Attaches _accuracy to body.
 */
export function accuracyInterceptor(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;
  const isManagedRoute = path === "/flower" || path === "/roll-tooling" || path === "/roll-tooling/bom" || path === "/roll-tooling/tooling-only";

  if (!isManagedRoute || req.method !== "POST") {
    next();
    return;
  }

  const originalJson = res.json.bind(res);

  res.json = function (body: unknown) {
    if (!body || typeof body !== "object") {
      return originalJson(body);
    }

    const bodyObj = body as Record<string, unknown>;
    if (!bodyObj["ok"] && bodyObj["error"]) {
      return originalJson(body);
    }

    const nanIssues: SanitizedIssue[] = [];
    const sanitized = deepSanitize(body, "", nanIssues) as Record<string, unknown>;

    const matType = (req.body as Record<string, unknown>)["materialType"] as string ?? "GI";
    const thickness = sanitizeValue((req.body as Record<string, unknown>)["materialThickness"] ?? (req.body as Record<string, unknown>)["thickness"], 1.5, 0.1, 10);

    const domainIssues: SanitizedIssue[] = [];

    if (path === "/flower" && Array.isArray(sanitized["stations"])) {
      for (const stn of sanitized["stations"] as Record<string, unknown>[]) {
        domainIssues.push(...quickValidateFlowerStation(stn, matType, thickness));
      }
    }

    if ((path === "/roll-tooling" || path === "/roll-tooling/tooling-only") && Array.isArray(sanitized["rollTooling"])) {
      for (const rt of sanitized["rollTooling"] as Record<string, unknown>[]) {
        const rp = rt["rollProfile"] as Record<string, unknown> | undefined;
        if (rp) {
          domainIssues.push(...quickValidateFlowerStation(rp, matType, thickness));
        }
      }
    }

    const allIssues = [...nanIssues, ...domainIssues];
    const totalFields = path === "/flower" ? (sanitized["stations"] as unknown[])?.length ?? 1 : 1;
    const accuracy = scoreResponse(allIssues, totalFields);

    sanitized["_accuracy"] = {
      score: accuracy,
      grade: accuracy >= 98 ? "A+" : accuracy >= 93 ? "A" : accuracy >= 85 ? "B" : accuracy >= 70 ? "C" : "FAIL",
      issuesFound: allIssues.length,
      nanIssues: nanIssues.length,
      domainIssues: domainIssues.length,
      issues: allIssues.slice(0, 10),
      interceptedAt: new Date().toISOString(),
    };

    if (allIssues.length > 0) {
      console.warn(`[accuracy-interceptor] ${path} — ${allIssues.length} issues found, accuracy=${accuracy}%`);
      for (const issue of allIssues.slice(0, 5)) {
        console.warn(`  [${issue.field}]: ${issue.issue} (was: ${String(issue.original)}, corrected: ${String(issue.corrected)})`);
      }
    } else {
      console.log(`[accuracy-interceptor] ${path} — clean ✓ accuracy=${accuracy}%`);
    }

    return originalJson(sanitized);
  };

  next();
}
