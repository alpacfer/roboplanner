import { describe, expect, it } from "vitest";
import {
  isNonNegativeInteger,
  isPositiveInteger,
  validatePlanSettings,
  validateRun,
  validateStep,
  validateTemplateSteps,
} from "./validation";

describe("validation", () => {
  it("rejects invalid durationMin values", () => {
    expect(isPositiveInteger(0)).toBe(false);
    expect(isPositiveInteger(-1)).toBe(false);
    expect(isPositiveInteger(1.5)).toBe(false);
    expect(
      validateStep({
        id: "s1",
        name: "Prep",
        durationMin: 0,
        operatorInvolvement: "NONE",
      }),
    ).not.toHaveLength(0);
  });

  it("accepts valid durationMin values", () => {
    expect(isPositiveInteger(1)).toBe(true);
    expect(isPositiveInteger(30)).toBe(true);
  });

  it("rejects invalid startMin values", () => {
    expect(isNonNegativeInteger(-1)).toBe(false);
    expect(isNonNegativeInteger(2.2)).toBe(false);
    expect(
      validateRun({
        id: "r1",
        label: "R1",
        startMin: -1,
        templateId: "plan-1",
      }),
    ).not.toHaveLength(0);
  });

  it("accepts valid startMin values", () => {
    expect(isNonNegativeInteger(0)).toBe(true);
    expect(isNonNegativeInteger(120)).toBe(true);
  });

  it("rejects invalid operatorCapacity", () => {
    expect(
      validatePlanSettings({
        operatorCapacity: 0,
        queuePolicy: "FIFO",
      }),
    ).not.toHaveLength(0);
  });

  it("rejects empty names and labels", () => {
    expect(
      validateStep({
        id: "s1",
        name: "",
        durationMin: 10,
        operatorInvolvement: "NONE",
      }),
    ).not.toHaveLength(0);

    expect(
      validateRun({
        id: "r1",
        label: "   ",
        startMin: 0,
        templateId: "plan-1",
      }),
    ).not.toHaveLength(0);
  });

  it("rejects duplicate step names in template", () => {
    const errors = validateTemplateSteps([
      {
        id: "s1",
        name: "Prep",
        durationMin: 10,
        operatorInvolvement: "NONE",
      },
      {
        id: "s2",
        name: " prep ",
        durationMin: 5,
        operatorInvolvement: "START",
      },
    ]);

    expect(errors[0]).toContain("Step name must be unique.");
    expect(errors[1]).toContain("Step name must be unique.");
  });
});
