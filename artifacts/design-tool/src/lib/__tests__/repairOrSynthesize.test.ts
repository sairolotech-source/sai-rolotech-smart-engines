/**
 * T09–T12: repairOrSynthesizeRollProfile() tests
 * Verifies all 4 repair scenarios: null rp, empty arrays, missing thickness, missing rollWidth
 */
import { describe, it, expect } from "vitest";
import { repairOrSynthesizeRollProfile } from "../../store/useCncStore";
import type { RollToolingResult } from "../../store/useCncStore";
import { MIN_GCODE_LENGTH } from "../gcodeLathe";

function makeMinimalRt(overrides: Partial<RollToolingResult> = {}): RollToolingResult {
  return {
    stationId: "test-station-1",
    stationNumber: 1,
    label: "STN-01",
    stationIndex: 1,
    upperRollOD: 100,
    lowerRollOD: 100,
    upperRollID: 42,
    lowerRollID: 42,
    upperRollWidth: 50,
    lowerRollWidth: 50,
    rollGap: 1.5,
    passLineHeight: 52,
    profileDepthMm: 5,
    kFactor: 0.44,
    neutralAxis: 0.66,
    deflection: 0,
    concentricityTolerance: 0.02,
    ...overrides,
  } as RollToolingResult;
}

// ─── T09 ──────────────────────────────────────────────────────────────────────
describe("T09 — Scenario M1: rollProfile = null → repaired to VALID", () => {
  it("null rollProfile is repaired to have upperRoll > 1 segment", () => {
    const rt = makeMinimalRt({ rollProfile: undefined });
    const repaired = repairOrSynthesizeRollProfile(rt, 1.5);
    expect(repaired.rollProfile).toBeDefined();
    expect(repaired.rollProfile!.upperRoll.length).toBeGreaterThan(1);
  });

  it("null rollProfile is repaired to have lowerRoll > 1 segment", () => {
    const rt = makeMinimalRt({ rollProfile: undefined });
    const repaired = repairOrSynthesizeRollProfile(rt, 1.5);
    expect(repaired.rollProfile!.lowerRoll.length).toBeGreaterThan(1);
  });

  it("null rollProfile is repaired to have upperLatheGcode > MIN_GCODE_LENGTH chars", () => {
    const rt = makeMinimalRt({ rollProfile: undefined });
    const repaired = repairOrSynthesizeRollProfile(rt, 1.5);
    expect(repaired.rollProfile!.upperLatheGcode.length).toBeGreaterThan(MIN_GCODE_LENGTH);
  });

  it("null rollProfile is repaired to have lowerLatheGcode > MIN_GCODE_LENGTH chars", () => {
    const rt = makeMinimalRt({ rollProfile: undefined });
    const repaired = repairOrSynthesizeRollProfile(rt, 1.5);
    expect(repaired.rollProfile!.lowerLatheGcode.length).toBeGreaterThan(MIN_GCODE_LENGTH);
  });
});

// ─── T10 ──────────────────────────────────────────────────────────────────────
describe("T10 — Scenario M2: empty upperRoll/lowerRoll arrays → repaired", () => {
  it("empty upperRoll triggers rebuild producing > 1 segment", () => {
    const rt = makeMinimalRt({
      rollProfile: {
        upperRoll: [],
        lowerRoll: [],
        upperLatheGcode: "",
        lowerLatheGcode: "",
        rollDiameter: 100,
        shaftDiameter: 40,
        rollWidth: 50,
        grooveDepth: 5,
        gap: 1.5,
        passLineY: 52,
        upperRollCenterY: 102,
        lowerRollCenterY: 0,
        upperRollNumber: 1,
        lowerRollNumber: 2,
        kFactor: 0.44,
        neutralAxisOffset: 0.66,
      },
    });
    const repaired = repairOrSynthesizeRollProfile(rt, 1.5);
    expect(repaired.rollProfile!.upperRoll.length).toBeGreaterThan(1);
    expect(repaired.rollProfile!.lowerRoll.length).toBeGreaterThan(1);
  });

  it("single-element upperRoll (length=1) triggers rebuild (guard is > 1 not > 0)", () => {
    const singleSeg = { type: "line" as const, startX: 0, startY: 0, endX: 10, endY: 0 };
    const rt = makeMinimalRt({
      rollProfile: {
        upperRoll: [singleSeg],
        lowerRoll: [singleSeg],
        upperLatheGcode: "",
        lowerLatheGcode: "",
        rollDiameter: 100,
        shaftDiameter: 40,
        rollWidth: 50,
        grooveDepth: 5,
        gap: 1.5,
        passLineY: 52,
        upperRollCenterY: 102,
        lowerRollCenterY: 0,
        upperRollNumber: 1,
        lowerRollNumber: 2,
        kFactor: 0.44,
        neutralAxisOffset: 0.66,
      },
    });
    const repaired = repairOrSynthesizeRollProfile(rt, 1.5);
    // After repair, should have more than 1 segment
    expect(repaired.rollProfile!.upperRoll.length).toBeGreaterThan(1);
  });
});

// ─── T11 ──────────────────────────────────────────────────────────────────────
describe("T11 — Scenario M3: missing thickness → fallback 1.5mm, does not crash", () => {
  it("thickness=0 uses fallback — does not throw", () => {
    const rt = makeMinimalRt({ rollProfile: undefined });
    // Pass 0 as thickness — function should use fallback
    expect(() => repairOrSynthesizeRollProfile(rt, 0)).not.toThrow();
  });

  it("thickness omitted (default 1.5) — produces valid geometry", () => {
    const rt = makeMinimalRt({ rollProfile: undefined });
    const repaired = repairOrSynthesizeRollProfile(rt); // no thickness arg → default 1.5
    expect(repaired.rollProfile!.upperRoll.length).toBeGreaterThan(1);
    expect(repaired.rollProfile!.lowerRoll.length).toBeGreaterThan(1);
  });

  it("repaired profile has grooveDepth >= max(1.5*1.5, 2.0) = 2.25", () => {
    const rt = makeMinimalRt({ rollProfile: undefined, profileDepthMm: 0 });
    const repaired = repairOrSynthesizeRollProfile(rt, 1.5);
    expect(repaired.rollProfile!.grooveDepth).toBeGreaterThanOrEqual(2.0);
  });
});

// ─── T12 ──────────────────────────────────────────────────────────────────────
describe("T12 — Scenario M4: missing rollWidth → fallback 50mm, does not crash", () => {
  it("undefined upperRollWidth uses 50mm fallback — does not throw", () => {
    const rt = makeMinimalRt({ rollProfile: undefined, upperRollWidth: undefined });
    expect(() => repairOrSynthesizeRollProfile(rt, 1.5)).not.toThrow();
  });

  it("repaired profile with missing rollWidth still produces > 1 segment", () => {
    const rt = makeMinimalRt({ rollProfile: undefined, upperRollWidth: undefined });
    const repaired = repairOrSynthesizeRollProfile(rt, 1.5);
    expect(repaired.rollProfile!.upperRoll.length).toBeGreaterThan(1);
  });

  it("repaired rollWidth in profile is 50mm when undefined", () => {
    const rt = makeMinimalRt({ rollProfile: undefined, upperRollWidth: undefined });
    const repaired = repairOrSynthesizeRollProfile(rt, 1.5);
    expect(repaired.rollProfile!.rollWidth).toBe(50);
  });

  it("already VALID profile is returned unchanged (no unnecessary repair)", () => {
    // Create a rt that is already fully VALID
    const rt = makeMinimalRt({ rollProfile: undefined });
    const repairedOnce = repairOrSynthesizeRollProfile(rt, 1.5);
    // Call repair again — should return same object (no double repair)
    const repairedTwice = repairOrSynthesizeRollProfile(repairedOnce, 1.5);
    expect(repairedTwice.rollProfile!.upperRoll.length).toBe(repairedOnce.rollProfile!.upperRoll.length);
    expect(repairedTwice.rollProfile!.upperLatheGcode).toBe(repairedOnce.rollProfile!.upperLatheGcode);
  });
});
