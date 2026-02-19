import { describe, expect, it } from "vitest";
import { DEFAULT_STEP_COLOR, normalizeStepColor } from "./colors";

describe("normalizeStepColor", () => {
  it("returns default color for undefined or invalid values", () => {
    expect(normalizeStepColor(undefined)).toBe(DEFAULT_STEP_COLOR);
    expect(normalizeStepColor("")).toBe(DEFAULT_STEP_COLOR);
    expect(normalizeStepColor("red")).toBe(DEFAULT_STEP_COLOR);
    expect(normalizeStepColor("#abc")).toBe(DEFAULT_STEP_COLOR);
  });

  it("keeps valid 6-digit hex colors", () => {
    expect(normalizeStepColor("#4e79a7")).toBe("#4e79a7");
    expect(normalizeStepColor("#A1B2C3")).toBe("#A1B2C3");
  });
});
