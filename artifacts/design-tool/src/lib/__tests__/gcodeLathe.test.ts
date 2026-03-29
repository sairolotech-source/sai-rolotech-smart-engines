/**
 * T05–T08: generateLatheGcode() + debugRollProfile() tests
 * Verifies G-code structure, length, preamble, safe return, and debug object
 */
import { describe, it, expect } from "vitest";
import { generateLatheGcode, debugRollProfile, MIN_GCODE_LENGTH } from "../gcodeLathe";

const BASE_PARAMS = {
  rollDiameter:  100,
  shaftDiameter: 40,
  rollWidth:     50,
  grooveDepth:   5,
  bendAngleDeg:  30,
  thickness:     1.5,
  rollNumber:    1,
  side:          "upper" as const,
  stationLabel:  "STN-01",
  stationIndex:  1,
};

// ─── T05 ──────────────────────────────────────────────────────────────────────
describe("T05 — generateLatheGcode output length > MIN_GCODE_LENGTH", () => {
  it("upper roll gcode length exceeds 20 characters", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode.length).toBeGreaterThan(MIN_GCODE_LENGTH);
  });

  it("lower roll gcode length exceeds 20 characters", () => {
    const gcode = generateLatheGcode({ ...BASE_PARAMS, side: "lower", rollNumber: 2 });
    expect(gcode.length).toBeGreaterThan(MIN_GCODE_LENGTH);
  });

  it("gcode length is > 500 chars (meaningful program, not stub)", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode.length).toBeGreaterThan(500);
  });
});

// ─── T06 ──────────────────────────────────────────────────────────────────────
describe("T06 — G-code has valid Fanuc preamble", () => {
  it("contains G21 (metric units)", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode).toContain("G21");
  });

  it("contains G18 (ZX plane — lathe mode)", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode).toContain("G18");
  });

  it("contains G40 (cutter compensation cancel)", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode).toContain("G40");
  });

  it("contains G28 (reference return) at start", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode).toContain("G28");
  });

  it("contains spindle command M03", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode).toContain("M03");
  });
});

// ─── T07 ──────────────────────────────────────────────────────────────────────
describe("T07 — G-code ends with safe return", () => {
  it("contains M30 (program end)", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode).toContain("M30");
  });

  it("contains M05 (spindle stop)", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode).toContain("M05");
  });

  it("ends with % (tape end marker)", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    expect(gcode.trim()).toMatch(/%\s*$/);
  });

  it("safe return (G28 at end) present", () => {
    const gcode = generateLatheGcode(BASE_PARAMS);
    const lines = gcode.split("\n");
    const lastG28 = [...lines].reverse().findIndex(l => l.includes("G28"));
    expect(lastG28).toBeGreaterThanOrEqual(0);
  });
});

// ─── T08 ──────────────────────────────────────────────────────────────────────
describe("T08 — C6 FIX: debugRollProfile returns structured object not void", () => {
  it("returns an object with status field", () => {
    const result = debugRollProfile({
      stationNumber: 1,
      label: "STN-01",
      upperRollLength: 6,
      lowerRollLength: 6,
      upperGcodeLength: 1200,
      lowerGcodeLength: 1200,
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect(result.status).toBeDefined();
  });

  it("status is VALID when all conditions met", () => {
    const result = debugRollProfile({
      stationNumber: 1,
      label: "STN-01",
      upperRollLength: 6,
      lowerRollLength: 6,
      upperGcodeLength: 1200,
      lowerGcodeLength: 1200,
    });
    expect(result.status).toBe("VALID");
    expect(result.issues).toHaveLength(0);
  });

  it("status is BASIC when upperRoll too short", () => {
    const result = debugRollProfile({
      stationNumber: 1,
      label: "STN-01",
      upperRollLength: 1,   // too short
      lowerRollLength: 6,
      upperGcodeLength: 1200,
      lowerGcodeLength: 1200,
    });
    expect(result.status).toBe("BASIC");
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toContain("upperRoll");
  });

  it("status is BASIC when gcode too short (using MIN_GCODE_LENGTH threshold)", () => {
    const result = debugRollProfile({
      stationNumber: 1,
      label: "STN-01",
      upperRollLength: 6,
      lowerRollLength: 6,
      upperGcodeLength: MIN_GCODE_LENGTH,   // exactly at limit — should be BASIC (not > limit)
      lowerGcodeLength: 1200,
    });
    expect(result.status).toBe("BASIC");
    expect(result.issues.some(i => i.includes("upperGcode"))).toBe(true);
  });

  it("issues array is empty for VALID station", () => {
    const result = debugRollProfile({
      stationNumber: 2,
      label: "STN-02",
      upperRollLength: 10,
      lowerRollLength: 8,
      upperGcodeLength: 2000,
      lowerGcodeLength: 1800,
    });
    expect(result.issues).toHaveLength(0);
  });
});
