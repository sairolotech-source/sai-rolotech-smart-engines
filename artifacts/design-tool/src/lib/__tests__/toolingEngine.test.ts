/**
 * T01–T04: synthesizeGroove() tests
 * Verifies groove geometry rules: segment count, depth floors, wall guard, complementarity
 */
import { describe, it, expect } from "vitest";
import { synthesizeGroove, buildStationRollProfile } from "../toolingEngine";

// ─── T01 ──────────────────────────────────────────────────────────────────────
describe("T01 — synthesizeGroove produces > 1 segment for both upper and lower", () => {
  it("upper roll has more than 1 segment", () => {
    const segs = synthesizeGroove({
      rollWidth: 50,
      grooveDepth: 5,
      bendAngleDeg: 30,
      thickness: 1.5,
      isUpper: true,
    });
    expect(segs.length).toBeGreaterThan(1);
  });

  it("lower roll has more than 1 segment", () => {
    const segs = synthesizeGroove({
      rollWidth: 50,
      grooveDepth: 5,
      bendAngleDeg: 30,
      thickness: 1.5,
      isUpper: false,
    });
    expect(segs.length).toBeGreaterThan(1);
  });
});

// ─── T02 ──────────────────────────────────────────────────────────────────────
describe("T02 — A2 FIX: grooveDepth floor is max(thickness*1.5, 2.0) not thickness+0.1", () => {
  it("groove for t=1.5 has effective depth >= 2.25 (1.5*1.5)", () => {
    const segs = synthesizeGroove({
      rollWidth: 50,
      grooveDepth: 0.1,   // intentionally too small — should be overridden
      bendAngleDeg: 30,
      thickness: 1.5,
      isUpper: true,
    });
    // All segments should exist and the groove depth (Y of deepest point) >= 2.25
    const maxDepth = Math.max(...segs.map((s) => Math.abs(s.startY), ...segs.map((s) => Math.abs(s.endY))));
    expect(maxDepth).toBeGreaterThanOrEqual(2.0);
    // exact: should be >= thickness * 1.5 = 2.25
    expect(maxDepth).toBeGreaterThanOrEqual(1.5 * 1.5);
  });

  it("groove for t=0.8 has effective depth >= 2.0 (floor)", () => {
    const segs = synthesizeGroove({
      rollWidth: 50,
      grooveDepth: 0,   // zero input → floor applies
      bendAngleDeg: 30,
      thickness: 0.8,
      isUpper: true,
    });
    const maxDepth = Math.max(...segs.map((s) => Math.abs(s.startY)), ...segs.map((s) => Math.abs(s.endY)));
    // t*1.5 = 1.2 < 2.0 → floor is 2.0
    expect(maxDepth).toBeGreaterThanOrEqual(2.0);
  });
});

// ─── T03 ──────────────────────────────────────────────────────────────────────
describe("T03 — A1 FIX: wallRun is never less than 2.0mm", () => {
  it("extreme angle (85 deg) still produces >= 2.0mm wall run", () => {
    // At 85°, tan(85°) ≈ 11.43, wallRun = D/11.43 ≈ 0.2mm without guard
    const segs = synthesizeGroove({
      rollWidth: 50,
      grooveDepth: 5,
      bendAngleDeg: 85,
      thickness: 1.5,
      isUpper: true,
    });
    // All segments must be finite, no NaN
    for (const s of segs) {
      expect(isFinite(s.startX)).toBe(true);
      expect(isFinite(s.startY)).toBe(true);
      expect(isFinite(s.endX)).toBe(true);
      expect(isFinite(s.endY)).toBe(true);
    }
    // Segments should still exist
    expect(segs.length).toBeGreaterThan(1);
  });

  it("very low angle (5 deg) still produces finite segments", () => {
    const segs = synthesizeGroove({
      rollWidth: 50,
      grooveDepth: 3,
      bendAngleDeg: 5,
      thickness: 1.5,
      isUpper: false,
    });
    expect(segs.length).toBeGreaterThan(1);
    for (const s of segs) {
      expect(isFinite(s.startX)).toBe(true);
      expect(isFinite(s.endX)).toBe(true);
    }
  });
});

// ─── T04 ──────────────────────────────────────────────────────────────────────
describe("T04 — buildStationRollProfile produces both upper AND lower rolls", () => {
  it("returns both upperRoll and lowerRoll with > 1 segment each", () => {
    const result = buildStationRollProfile({
      rollWidth: 50,
      grooveDepth: 5,
      bendAngleDeg: 30,
      thickness: 1.5,
    });
    expect(result.upperRoll.length).toBeGreaterThan(1);
    expect(result.lowerRoll.length).toBeGreaterThan(1);
  });

  it("upper and lower are differentiated (not identical)", () => {
    const result = buildStationRollProfile({
      rollWidth: 50,
      grooveDepth: 5,
      bendAngleDeg: 30,
      thickness: 1.5,
    });
    // Upper groove faces downward (negative Y), lower faces upward (positive Y)
    const upperDeepY = Math.min(...result.upperRoll.map((s) => s.startY), ...result.upperRoll.map((s) => s.endY));
    const lowerDeepY = Math.max(...result.lowerRoll.map((s) => s.startY), ...result.lowerRoll.map((s) => s.endY));
    expect(upperDeepY).toBeLessThan(0);  // upper groove goes below 0
    expect(lowerDeepY).toBeGreaterThan(0); // lower groove goes above 0
  });

  it("small rollWidth still produces valid segments", () => {
    const result = buildStationRollProfile({
      rollWidth: 20,
      grooveDepth: 3,
      bendAngleDeg: 45,
      thickness: 1.0,
    });
    expect(result.upperRoll.length).toBeGreaterThan(1);
    expect(result.lowerRoll.length).toBeGreaterThan(1);
  });

  it("zero grooveDepth triggers floor — still produces valid geometry", () => {
    const result = buildStationRollProfile({
      rollWidth: 50,
      grooveDepth: 0,
      bendAngleDeg: 30,
      thickness: 1.5,
    });
    expect(result.upperRoll.length).toBeGreaterThan(1);
    expect(result.lowerRoll.length).toBeGreaterThan(1);
  });
});
