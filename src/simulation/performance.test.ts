import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import type { Plan, Run, Step } from "../domain/types";
import { simulateDES } from "./engine";

function buildLargePlan(runCount: number, stepCount: number): Plan {
  const template: Step[] = Array.from({ length: stepCount }, (_, index) => ({
    id: `step-${index + 1}`,
    name: `Step ${index + 1}`,
    durationMin: 5 + (index % 4),
    operatorInvolvement: index % 3 === 0 ? "WHOLE" : "NONE",
    groupId: null,
  }));

  const runs: Run[] = Array.from({ length: runCount }, (_, index) => ({
    id: `run-${index + 1}`,
    label: `R${index + 1}`,
    startMin: index % 20,
    templateId: "plan-perf",
  }));

  return {
    id: "plan-perf",
    name: "Performance fixture",
    template,
    stepGroups: [],
    runs,
    settings: {
      operatorCapacity: 3,
      queuePolicy: "FIFO",
    },
  };
}

describe("simulateDES performance", () => {
  it("simulates a large plan within the regression budget", () => {
    const largePlan = buildLargePlan(180, 90);
    const expectedStepSegments = largePlan.runs.length * largePlan.template.length;

    const startTime = performance.now();
    const result = simulateDES(largePlan);
    const elapsedMs = performance.now() - startTime;

    const stepSegments = result.segments.filter((segment) => segment.kind === "step");
    expect(stepSegments).toHaveLength(expectedStepSegments);
    expect(result.metrics.makespan).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(4000);
  });
});
