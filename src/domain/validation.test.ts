import { describe, expect, it } from "vitest";
import {
  isNonNegativeInteger,
  isPositiveInteger,
  validatePlanSettings,
  validateRun,
  validateStepGroups,
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
        groupId: null,
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
        groupId: null,
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

  it("allows duplicate step names in template", () => {
    const errors = validateTemplateSteps([
      {
        id: "s1",
        name: "Prep",
        durationMin: 10,
        operatorInvolvement: "NONE",
        groupId: null,
      },
      {
        id: "s2",
        name: " prep ",
        durationMin: 5,
        operatorInvolvement: "START",
        groupId: null,
      },
    ]);

    expect(errors[0]).toHaveLength(0);
    expect(errors[1]).toHaveLength(0);
  });

  it("allows duplicate step group names", () => {
    const errors = validateStepGroups([
      { id: "g1", name: "Main", color: "#4e79a7" },
      { id: "g2", name: " main ", color: "#f28e2b" },
    ]);

    expect(errors[0]).toHaveLength(0);
    expect(errors[1]).toHaveLength(0);
  });
});
