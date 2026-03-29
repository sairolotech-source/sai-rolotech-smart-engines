/**
 * T15 — Store migration v6 + Integration smoke tests
 *
 * Tests:
 *   T15-A: v6 migration equivalent — stale v5 data with missing passLineY repaired on load
 *   T15-B: v6 migration only repairs missing passLineY — valid records untouched
 *   T15-C: Entire array of mixed stale/valid records processes without crash
 *   T15-D: Integration smoke — normalized tooling flow (LeftPanel normalizeRollTooling equivalent)
 *   T15-E: Reload simulation — repaired state re-serializes and re-repairs to same values
 */
import { describe, it, expect } from "vitest";
import { repairOrSynthesizeRollProfile } from "../../store/useCncStore";
import type { RollToolingResult, RollProfile } from "../../store/useCncStore";

const LONG_GCODE = "G21\nG18\nG96 S200 M3\n" + "G1 X50 Z0 F0.12\n".repeat(40);

function makeStaleRt(id: number, passLineYOverride?: number | null): RollToolingResult {
  return {
    stationId: `S${id}`,
    stationNumber: id,
    label: `S${id}`,
    stationIndex: id,
    upperRollOD: 120,
    lowerRollOD: 118,
    upperRollID: 42,
    lowerRollID: 42,
    upperRollWidth: 60,
    lowerRollWidth: 60,
    rollGap: 1.6,
    passLineHeight: 61,
    profileDepthMm: 5,
    kFactor: 0.44,
    neutralAxis: 0.66,
    deflection: 0,
    concentricityTolerance: 0.02,
    rollProfile: {
      upperRoll: [{ type: "line", startX: 0, startY: 0, endX: 5, endY: 0 },
                  { type: "line", startX: 5, startY: 0, endX: 10, endY: 0 },
                  { type: "line", startX: 10, startY: 0, endX: 15, endY: 0 }],
      lowerRoll: [{ type: "line", startX: 0, startY: 0, endX: 5, endY: 0 },
                  { type: "line", startX: 5, startY: 0, endX: 10, endY: 0 },
                  { type: "line", startX: 10, startY: 0, endX: 15, endY: 0 }],
      upperLatheGcode: LONG_GCODE,
      lowerLatheGcode: LONG_GCODE,
      rollDiameter: 120,
      shaftDiameter: 40,
      rollWidth: 60,
      grooveDepth: 5,
      gap: 1.6,
      passLineY: passLineYOverride as number,   // undefined/NaN/valid — intentional
      upperRollCenterY: 122,
      lowerRollCenterY: 0,
      upperRollNumber: id * 2 - 1,
      lowerRollNumber: id * 2,
      kFactor: 0.44,
      neutralAxisOffset: 0.66,
    } as RollProfile,
  } as RollToolingResult;
}

/**
 * Simulate the v6 migration logic from useCncStore.ts:
 * Only repair if passLineY is missing or non-finite.
 */
function simulateV6Migration(
  rollTooling: RollToolingResult[],
  thickness = 1.5,
): RollToolingResult[] {
  return rollTooling.map((rt) => {
    const rp = rt.rollProfile as (Record<string, unknown> | undefined);
    if (rp && rp.passLineY != null && isFinite(rp.passLineY as number)) return rt;
    return repairOrSynthesizeRollProfile(rt, thickness);
  });
}

// ─── T15-A: v6 migration repairs missing passLineY ───────────────────────────
describe("T15-A — v6 migration: stale v5 data with missing passLineY is repaired", () => {
  it("undefined passLineY in v5 record becomes finite after migration", () => {
    const stale = [makeStaleRt(1, undefined)];
    const migrated = simulateV6Migration(stale);
    expect(isFinite(migrated[0].rollProfile!.passLineY)).toBe(true);
  });

  it("NaN passLineY in v5 record becomes non-NaN after migration", () => {
    const stale = [makeStaleRt(1, NaN)];
    const migrated = simulateV6Migration(stale);
    expect(migrated[0].rollProfile!.passLineY).not.toBeNaN();
  });

  it("migrated passLineY derives from passLineHeight=61", () => {
    const stale = [makeStaleRt(1, undefined)];
    const migrated = simulateV6Migration(stale);
    expect(migrated[0].rollProfile!.passLineY).toBeCloseTo(61, 1);
  });
});

// ─── T15-B: v6 migration skips valid records ─────────────────────────────────
describe("T15-B — v6 migration skips valid records with finite passLineY", () => {
  it("valid passLineY=52 is not touched by migration", () => {
    const valid = [makeStaleRt(1, 52)];
    const migrated = simulateV6Migration(valid);
    expect(migrated[0].rollProfile!.passLineY).toBe(52);
  });

  it("valid record gcode is preserved (migration did not re-synthesize)", () => {
    const valid = [makeStaleRt(1, 52)];
    const migrated = simulateV6Migration(valid);
    expect(migrated[0].rollProfile!.upperLatheGcode).toBe(LONG_GCODE);
  });
});

// ─── T15-C: Mixed array processes without crash ───────────────────────────────
describe("T15-C — Mixed array of stale/valid records processes without crash", () => {
  it("5-station array with mixed passLineY states does not throw", () => {
    const mixed = [
      makeStaleRt(1, undefined),   // stale — missing passLineY
      makeStaleRt(2, 52),          // valid
      makeStaleRt(3, NaN),         // stale — non-finite passLineY
      makeStaleRt(4, 60),          // valid
      makeStaleRt(5, undefined),   // stale — missing passLineY
    ];
    expect(() => simulateV6Migration(mixed, 1.5)).not.toThrow();
  });

  it("all 5 stations have finite passLineY after migration", () => {
    const mixed = [
      makeStaleRt(1, undefined),
      makeStaleRt(2, 52),
      makeStaleRt(3, NaN),
      makeStaleRt(4, 60),
      makeStaleRt(5, undefined),
    ];
    const migrated = simulateV6Migration(mixed, 1.5);
    for (const rt of migrated) {
      expect(isFinite(rt.rollProfile!.passLineY)).toBe(true);
    }
  });

  it("valid stations preserve their original passLineY values", () => {
    const mixed = [
      makeStaleRt(1, undefined),
      makeStaleRt(2, 52),
      makeStaleRt(3, NaN),
      makeStaleRt(4, 60),
    ];
    const migrated = simulateV6Migration(mixed, 1.5);
    expect(migrated[1].rollProfile!.passLineY).toBe(52);
    expect(migrated[3].rollProfile!.passLineY).toBe(60);
  });
});

// ─── T15-D: Integration smoke — LeftPanel normalizeRollTooling equivalent ─────
describe("T15-D — Integration smoke: normalizeRollTooling equivalent", () => {
  /**
   * Simulates the LeftPanel normalizeRollTooling logic:
   * - if rt has rollProfile AND passLineY is finite → return as-is
   * - otherwise build passLineY from passLineHeight fallback + construct rollProfile
   */
  function normalizeRollTooling(rawRollTooling: Partial<RollToolingResult>[]): RollToolingResult[] {
    return rawRollTooling.map((rt: Partial<RollToolingResult>) => {
      const rp = rt.rollProfile as (RollProfile & { passLineY?: number }) | undefined;
      if (rp && rp.passLineY != null && isFinite(rp.passLineY)) {
        return rt as RollToolingResult;
      }
      const upperOD = rt.upperRollOD ?? rt.rollDiameter ?? 100;
      const lowerOD = rt.lowerRollOD ?? upperOD;
      const gap = rt.rollGap ?? 1;
      const passLineY = rt.passLineHeight ?? (lowerOD / 2 + gap / 2);
      return {
        ...rt,
        stationNumber: rt.stationNumber ?? rt.stationIndex ?? 0,
        label: rt.label ?? rt.stationId ?? `S${rt.stationIndex ?? 0}`,
        rollProfile: {
          upperRoll: [],
          lowerRoll: [],
          rollDiameter: upperOD,
          shaftDiameter: rt.upperRollID ? rt.upperRollID - 2 : 40,
          rollWidth: rt.upperRollWidth ?? 50,
          gap,
          passLineY,
          upperRollCenterY: passLineY + gap / 2 + upperOD / 2,
          lowerRollCenterY: passLineY - gap / 2 - lowerOD / 2,
          grooveDepth: rt.profileDepthMm ?? 0,
          upperRollNumber: (rt.stationIndex ?? 1) * 2 - 1,
          lowerRollNumber: (rt.stationIndex ?? 1) * 2,
          kFactor: rt.kFactor ?? 0.44,
          neutralAxisOffset: rt.neutralAxis ?? 0,
          upperLatheGcode: "",
          lowerLatheGcode: "",
        } as RollProfile,
      } as RollToolingResult;
    });
  }

  it("flat server response (no rollProfile) is normalized with finite passLineY", () => {
    const flatResponse = [{
      stationId: "S1",
      stationNumber: 1,
      stationIndex: 1,
      label: "S1",
      upperRollOD: 120,
      lowerRollOD: 118,
      upperRollID: 42,
      rollGap: 1.6,
      passLineHeight: 61,
      upperRollWidth: 60,
      profileDepthMm: 5,
      kFactor: 0.44,
      neutralAxis: 0.66,
    }];
    const normalized = normalizeRollTooling(flatResponse);
    expect(normalized[0].rollProfile).toBeDefined();
    expect(isFinite(normalized[0].rollProfile!.passLineY)).toBe(true);
    expect(normalized[0].rollProfile!.passLineY).toBeCloseTo(61, 5);
  });

  it("stale cached rollProfile missing passLineY is rebuilt", () => {
    const stale = [makeStaleRt(1, undefined)];
    const normalized = normalizeRollTooling(stale);
    expect(isFinite(normalized[0].rollProfile!.passLineY)).toBe(true);
  });

  it("valid rollProfile is passed through unchanged", () => {
    const valid = [makeStaleRt(1, 52)];
    const normalized = normalizeRollTooling(valid);
    expect(normalized[0].rollProfile!.passLineY).toBe(52);
    expect(normalized[0].rollProfile!.upperLatheGcode).toBe(LONG_GCODE);
  });

  it("passLineY is used for upperRollCenterY derivation correctly", () => {
    const flat = [{
      stationIndex: 1, stationId: "S1", stationNumber: 1, label: "S1",
      upperRollOD: 120, lowerRollOD: 118, upperRollID: 42,
      rollGap: 1.6, passLineHeight: 61, upperRollWidth: 60,
    }];
    const normalized = normalizeRollTooling(flat);
    // upperRollCenterY = passLineY + gap/2 + upperOD/2 = 61 + 0.8 + 60 = 121.8
    expect(normalized[0].rollProfile!.upperRollCenterY).toBeCloseTo(121.8, 2);
  });

  it("missing passLineHeight falls back to lowerOD/2 + gap/2", () => {
    const flat = [{
      stationIndex: 1, stationId: "S1", stationNumber: 1, label: "S1",
      upperRollOD: 120, lowerRollOD: 118, upperRollID: 42,
      rollGap: 1.6, upperRollWidth: 60,
      // passLineHeight intentionally absent
    }];
    const normalized = normalizeRollTooling(flat);
    // fallback = lowerOD/2 + gap/2 = 59 + 0.8 = 59.8
    expect(normalized[0].rollProfile!.passLineY).toBeCloseTo(59.8, 2);
  });
});

// ─── T15-E: Reload simulation — serialize → deserialize → re-migrate ─────────
describe("T15-E — Reload simulation: serialize/deserialize cycle is stable", () => {
  it("re-serialized and re-migrated record has same passLineY", () => {
    const original = [makeStaleRt(1, undefined)];
    const migrated = simulateV6Migration(original, 1.5);

    // Simulate JSON serialize/deserialize (localStorage round-trip)
    const serialized = JSON.parse(JSON.stringify(migrated));

    // Re-run v6 migration on deserialized data (simulates second page load)
    const reMigrated = simulateV6Migration(serialized, 1.5);

    expect(reMigrated[0].rollProfile!.passLineY).toBeCloseTo(
      migrated[0].rollProfile!.passLineY, 5
    );
  });

  it("second migration does not alter valid passLineY (idempotent)", () => {
    const valid = [makeStaleRt(1, 52)];
    const once = simulateV6Migration(valid, 1.5);
    const twice = simulateV6Migration(JSON.parse(JSON.stringify(once)), 1.5);
    expect(twice[0].rollProfile!.passLineY).toBe(52);
  });
});
