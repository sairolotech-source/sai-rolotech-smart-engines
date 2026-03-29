/**
 * T14 — Formatter / display-truth tests
 *
 * Verifies:
 *   A. Missing values render "N/A", not "0.000" or any fake numeric default.
 *   B. Finite values render as correct fixed-decimal strings.
 *   C. Object payloads never produce "[object Object]" in display strings.
 *   D. Export formatter writes "N/A" for missing — not fake engineering defaults.
 */
import { describe, it, expect } from "vitest";
import {
  formatEngineeringMM,
  formatEngineeringMMWithUnit,
  safeWarningText,
  formatExportMM,
} from "../formatters";

// ─── T14-A: Missing / non-finite → "N/A" ─────────────────────────────────────
describe("T14-A — Missing engineering values render N/A, not 0.000", () => {
  it("undefined renders N/A", () => {
    expect(formatEngineeringMM(undefined)).toBe("N/A");
  });

  it("null renders N/A", () => {
    expect(formatEngineeringMM(null)).toBe("N/A");
  });

  it("NaN renders N/A", () => {
    expect(formatEngineeringMM(NaN)).toBe("N/A");
  });

  it("Infinity renders N/A", () => {
    expect(formatEngineeringMM(Infinity)).toBe("N/A");
  });

  it("-Infinity renders N/A", () => {
    expect(formatEngineeringMM(-Infinity)).toBe("N/A");
  });

  it("undefined does NOT render 0.000 (regression guard for ?? 0 fallback)", () => {
    const result = formatEngineeringMM(undefined);
    expect(result).not.toBe("0.000");
    expect(result).not.toBe("0");
  });
});

// ─── T14-B: Finite values render correct fixed-decimal strings ────────────────
describe("T14-B — Finite values render as correct fixed-decimal strings", () => {
  it("52.000 renders as 3dp string", () => {
    expect(formatEngineeringMM(52)).toBe("52.000");
  });

  it("52.5678 renders as 52.568 (3dp, rounds)", () => {
    expect(formatEngineeringMM(52.5678)).toBe("52.568");
  });

  it("0 renders as 0.000 — only valid when value is explicitly known-zero", () => {
    expect(formatEngineeringMM(0)).toBe("0.000");
  });

  it("custom decimals: 4dp", () => {
    expect(formatEngineeringMM(1.23456, 4)).toBe("1.2346");
  });

  it("negative values work", () => {
    expect(formatEngineeringMM(-12.5)).toBe("-12.500");
  });
});

// ─── T14-B2: With unit suffix ─────────────────────────────────────────────────
describe("T14-B2 — formatEngineeringMMWithUnit adds unit only for finite values", () => {
  it("finite value includes mm suffix", () => {
    expect(formatEngineeringMMWithUnit(52)).toBe("52.000 mm");
  });

  it("undefined returns N/A without suffix", () => {
    expect(formatEngineeringMMWithUnit(undefined)).toBe("N/A");
  });

  it("NaN returns N/A without suffix", () => {
    expect(formatEngineeringMMWithUnit(NaN)).toBe("N/A");
  });
});

// ─── T14-C: Object payloads never produce [object Object] ────────────────────
describe("T14-C — Object payloads never produce [object Object]", () => {
  it("string passes through unchanged", () => {
    expect(safeWarningText("Roll gap exceeded")).toBe("Roll gap exceeded");
  });

  it("ValidationError with .issue extracts issue string", () => {
    expect(safeWarningText({ issue: "Thickness out of range", code: "ERR_01" }))
      .toBe("Thickness out of range");
  });

  it("Error instance extracts .message", () => {
    expect(safeWarningText(new Error("Division by zero"))).toBe("Division by zero");
  });

  it("object with .message (no .issue) extracts message", () => {
    expect(safeWarningText({ message: "Springback factor missing" }))
      .toBe("Springback factor missing");
  });

  it("arbitrary object falls back to JSON.stringify, never [object Object]", () => {
    const result = safeWarningText({ someKey: "someValue" });
    expect(result).not.toBe("[object Object]");
    expect(result).toContain("someKey");
  });

  it("null returns empty string", () => {
    expect(safeWarningText(null)).toBe("");
  });

  it("undefined returns empty string", () => {
    expect(safeWarningText(undefined)).toBe("");
  });

  it("number converts to string", () => {
    expect(safeWarningText(42)).toBe("42");
  });

  it("direct [object Object] string cannot be produced from an object input", () => {
    const result = safeWarningText({ x: 1 });
    expect(result).not.toBe("[object Object]");
  });
});

// ─── T14-D: Export formatter writes N/A for missing, not fake defaults ────────
describe("T14-D — Export formatter: N/A for missing, not fake engineering defaults", () => {
  it("undefined passLineY exports as N/A", () => {
    expect(formatExportMM(undefined)).toBe("N/A");
  });

  it("null passLineY exports as N/A", () => {
    expect(formatExportMM(null)).toBe("N/A");
  });

  it("NaN passLineY exports as N/A (not 0.000)", () => {
    expect(formatExportMM(NaN)).not.toBe("0.000");
    expect(formatExportMM(NaN)).toBe("N/A");
  });

  it("valid passLineY 52.375 exports as 52.375", () => {
    expect(formatExportMM(52.375)).toBe("52.375");
  });

  it("4dp export for gap values", () => {
    expect(formatExportMM(1.1234, 4)).toBe("1.1234");
  });

  it("missing gap does not export as 0.0000", () => {
    expect(formatExportMM(undefined, 4)).toBe("N/A");
    expect(formatExportMM(undefined, 4)).not.toBe("0.0000");
  });
});
