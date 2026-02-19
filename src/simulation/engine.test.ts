import { describe, expect, it } from "vitest";
import type { Plan } from "../domain/types";
import { scheduleLinear } from "./engine";

const fixturePlan: Plan = {
  id: "plan-fixture",
  name: "Fixture Plan",
  template: [
    { id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null },
    { id: "s2", name: "Soak", durationMin: 30, operatorInvolvement: "NONE", groupId: null },
    { id: "s3", name: "Measure", durationMin: 20, operatorInvolvement: "WHOLE", groupId: null },
  ],
  stepGroups: [],
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
        stepId: "s1",
        name: "Prep",
        startMin: 0,
        endMin: 10,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "WHOLE",
        operatorCheckpointAtStart: true,
        operatorCheckpointAtEnd: true,
      },
      {
        runId: "R1",
        stepId: "s2",
        name: "Soak",
        startMin: 10,
        endMin: 40,
        kind: "step",
        requiresOperator: false,
        operatorInvolvement: "NONE",
        operatorCheckpointAtStart: false,
        operatorCheckpointAtEnd: false,
      },
      {
        runId: "R1",
        stepId: "s3",
        name: "Measure",
        startMin: 40,
        endMin: 60,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "WHOLE",
        operatorCheckpointAtStart: true,
        operatorCheckpointAtEnd: true,
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

  it("produces expected segments for R2 in multi-run fixture", () => {
    const multiRunPlan: Plan = {
      ...fixturePlan,
      runs: [
        { id: "R1", label: "R1", startMin: 0, templateId: "plan-fixture" },
        { id: "R2", label: "R2", startMin: 15, templateId: "plan-fixture" },
      ],
    };

    const r2Segments = scheduleLinear(multiRunPlan).filter((segment) => segment.runId === "R2");

    expect(r2Segments).toEqual([
      {
        runId: "R2",
        stepId: "s1",
        name: "Prep",
        startMin: 15,
        endMin: 25,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "WHOLE",
        operatorCheckpointAtStart: true,
        operatorCheckpointAtEnd: true,
      },
      {
        runId: "R2",
        stepId: "s2",
        name: "Soak",
        startMin: 25,
        endMin: 55,
        kind: "step",
        requiresOperator: false,
        operatorInvolvement: "NONE",
        operatorCheckpointAtStart: false,
        operatorCheckpointAtEnd: false,
      },
      {
        runId: "R2",
        stepId: "s3",
        name: "Measure",
        startMin: 55,
        endMin: 75,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "WHOLE",
        operatorCheckpointAtStart: true,
        operatorCheckpointAtEnd: true,
      },
    ]);
  });
});
