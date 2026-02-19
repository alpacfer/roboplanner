import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Plan, Segment } from "../domain/types";
import { simulateDES } from "./engine";

interface GeneratedPlan {
  plan: Plan;
  stepDurationsById: Map<string, number>;
}

function buildGeneratedPlan(
  runStarts: number[],
  stepDurations: number[],
  operatorFlags: boolean[],
  operatorCapacity: number,
): GeneratedPlan {
  const template = stepDurations.map((durationMin, index) => ({
    id: `s${index + 1}`,
    name: `Step${index + 1}`,
    durationMin,
    operatorInvolvement: operatorFlags[index] ? "WHOLE" : "NONE",
  }));
  const runs = runStarts.map((startMin, index) => ({
    id: `R${index + 1}`,
    label: `R${index + 1}`,
    startMin,
    templateId: "prop-plan",
  }));

  return {
    plan: {
      id: "prop-plan",
      name: "Property Plan",
      template,
      runs,
      settings: {
        operatorCapacity,
        queuePolicy: "FIFO",
      },
    },
    stepDurationsById: new Map(template.map((step) => [step.id, step.durationMin])),
  };
}

function assertOperatorCapacity(segments: Segment[], capacity: number) {
  const opSegments = segments.filter((segment) => segment.kind === "step" && segment.requiresOperator);
  const timelineEvents: Array<{ at: number; delta: number }> = [];

  for (const segment of opSegments) {
    timelineEvents.push({ at: segment.startMin, delta: 1 });
    timelineEvents.push({ at: segment.endMin, delta: -1 });
  }

  timelineEvents.sort((a, b) => {
    if (a.at !== b.at) {
      return a.at - b.at;
    }
    return a.delta - b.delta;
  });

  let inUse = 0;
  for (const event of timelineEvents) {
    inUse += event.delta;
    expect(inUse).toBeLessThanOrEqual(capacity);
    expect(inUse).toBeGreaterThanOrEqual(0);
  }
}

describe("simulateDES property-based", () => {
  it("maintains run sequencing, operator capacity, and duration preservation", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 120 }), { minLength: 1, maxLength: 10 }),
        fc.array(fc.integer({ min: 1, max: 60 }), { minLength: 1, maxLength: 10 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 3 }),
        (runStarts, stepDurations, operatorFlagSeed, operatorCapacity) => {
          const operatorFlags = stepDurations.map(
            (_, index) => operatorFlagSeed[index % operatorFlagSeed.length],
          );

          const { plan, stepDurationsById } = buildGeneratedPlan(
            runStarts,
            stepDurations,
            operatorFlags,
            operatorCapacity,
          );
          const { segments } = simulateDES(plan);

          for (const run of plan.runs) {
            const runSegments = segments
              .filter((segment) => segment.runId === run.id)
              .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
            const runStepSegments = runSegments.filter((segment) => segment.kind === "step");

            expect(runStepSegments).toHaveLength(plan.template.length);

            for (let index = 0; index < runStepSegments.length - 1; index += 1) {
              expect(runStepSegments[index + 1].startMin).toBeGreaterThanOrEqual(runStepSegments[index].endMin);
            }

            if (runSegments.length === 0) {
              continue;
            }

            const runEnd = runSegments[runSegments.length - 1].endMin;
            const waitTime = runSegments
              .filter((segment) => segment.kind === "wait")
              .reduce((sum, segment) => sum + (segment.endMin - segment.startMin), 0);
            const observedNetStepTime = runEnd - run.startMin - waitTime;
            const expectedStepTime = runStepSegments.reduce((sum, stepSegment) => {
              const duration = stepSegment.stepId ? stepDurationsById.get(stepSegment.stepId) : undefined;
              return sum + (duration ?? 0);
            }, 0);

            expect(observedNetStepTime).toBe(expectedStepTime);
          }

          assertOperatorCapacity(segments, plan.settings.operatorCapacity);
        },
      ),
      { numRuns: 150 },
    );
  });
});
