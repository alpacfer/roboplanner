import { describe, expect, it } from "vitest";
import type { Plan } from "../domain/types";
import { scheduleLinear } from "./engine";

const fixturePlan: Plan = {
  id: "plan-fixture",
  name: "Fixture Plan",
  template: [
    { id: "s1", name: "Prep", durationMin: 10, requiresOperator: true },
    { id: "s2", name: "Soak", durationMin: 30, requiresOperator: false },
    { id: "s3", name: "Measure", durationMin: 20, requiresOperator: true },
  ],
  runs: [{ id: "R1", label: "R1", startMin: 0, templateId: "plan-fixture" }],
  settings: {
    operatorCapacity: 1,
    queuePolicy: "FIFO",
  },
};

describe("scheduleLinear", () => {
  it("produces expected segments for the MVP3 fixture", () => {
    expect(scheduleLinear(fixturePlan)).toEqual([
      {
        runId: "R1",
        name: "Prep",
        startMin: 0,
        endMin: 10,
        kind: "step",
        requiresOperator: true,
      },
      {
        runId: "R1",
        name: "Soak",
        startMin: 10,
        endMin: 40,
        kind: "step",
        requiresOperator: false,
      },
      {
        runId: "R1",
        name: "Measure",
        startMin: 40,
        endMin: 60,
        kind: "step",
        requiresOperator: true,
      },
    ]);
  });

  it("has total time equal to last endMin", () => {
    const segments = scheduleLinear(fixturePlan);
    const totalTime = segments[segments.length - 1]?.endMin ?? 0;
    expect(totalTime).toBe(60);
  });

  it("creates contiguous segments per run", () => {
    const segments = scheduleLinear(fixturePlan);
    for (let index = 0; index < segments.length - 1; index += 1) {
      expect(segments[index].endMin).toBe(segments[index + 1].startMin);
    }
  });
});
