import { describe, expect, it } from "vitest";
import type { Plan, Segment } from "../domain/types";
import { simulateDES } from "./engine";

function basePlan(overrides: Partial<Plan>): Plan {
  return {
    id: "shared-plan",
    name: "Shared Resource Plan",
    template: [],
    stepGroups: [],
    runs: [],
    settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    sharedResources: [],
    ...overrides,
  };
}

function stepSegments(segments: Segment[], stepId: string): Segment[] {
  return segments
    .filter((segment) => segment.kind === "step" && segment.stepId === stepId)
    .sort((a, b) => a.startMin - b.startMin);
}

describe("simulateDES shared resources", () => {
  it("holds a shared resource for the full step and serves waiting runs in FIFO order", () => {
    const plan = basePlan({
      template: [{ id: "s1", name: "Use Centrifuge", durationMin: 10, operatorInvolvement: "NONE", groupId: null, resourceIds: ["cent"] }],
      runs: [
        { id: "R1", label: "R1", startMin: 0, templateId: "shared-plan" },
        { id: "R2", label: "R2", startMin: 0, templateId: "shared-plan" },
        { id: "R3", label: "R3", startMin: 0, templateId: "shared-plan" },
      ],
      sharedResources: [{ id: "cent", name: "Centrifuge", quantity: 1 }],
    });

    const { segments } = simulateDES(plan);
    const starts = stepSegments(segments, "s1").map((segment) => ({ runId: segment.runId, start: segment.startMin, end: segment.endMin }));

    expect(starts).toEqual([
      { runId: "R1", start: 0, end: 10 },
      { runId: "R2", start: 10, end: 20 },
      { runId: "R3", start: 20, end: 30 },
    ]);

    const waits = segments.filter((segment) => segment.kind === "wait").sort((a, b) => a.startMin - b.startMin);
    expect(waits).toEqual([
      expect.objectContaining({ runId: "R2", name: "wait: resources", startMin: 0, endMin: 10 }),
      expect.objectContaining({ runId: "R3", name: "wait: resources", startMin: 0, endMin: 20 }),
    ]);
  });

  it("allows concurrent starts up to each resource quantity", () => {
    const plan = basePlan({
      template: [{ id: "s1", name: "Heat", durationMin: 7, operatorInvolvement: "NONE", groupId: null, resourceIds: ["oven"] }],
      runs: [
        { id: "R1", label: "R1", startMin: 0, templateId: "shared-plan" },
        { id: "R2", label: "R2", startMin: 0, templateId: "shared-plan" },
        { id: "R3", label: "R3", startMin: 0, templateId: "shared-plan" },
        { id: "R4", label: "R4", startMin: 0, templateId: "shared-plan" },
      ],
      sharedResources: [{ id: "oven", name: "Oven", quantity: 2 }],
    });

    const { segments } = simulateDES(plan);
    const starts = stepSegments(segments, "s1").map((segment) => ({ runId: segment.runId, start: segment.startMin }));

    expect(starts).toEqual([
      { runId: "R1", start: 0 },
      { runId: "R2", start: 0 },
      { runId: "R3", start: 7 },
      { runId: "R4", start: 7 },
    ]);
  });

  it("acquires multi-resource requirements atomically and does not start with partial resources", () => {
    const plan = basePlan({
      template: [{ id: "s1", name: "Assemble", durationMin: 5, operatorInvolvement: "NONE", groupId: null, resourceIds: ["fixture", "camera"] }],
      runs: [
        { id: "R1", label: "R1", startMin: 0, templateId: "shared-plan" },
        { id: "R2", label: "R2", startMin: 0, templateId: "shared-plan" },
      ],
      sharedResources: [
        { id: "fixture", name: "Fixture", quantity: 1 },
        { id: "camera", name: "Camera", quantity: 1 },
      ],
    });

    const { segments } = simulateDES(plan);
    const s1 = stepSegments(segments, "s1");

    expect(s1).toHaveLength(2);
    expect(s1[0].startMin).toBe(0);
    expect(s1[0].endMin).toBe(5);
    expect(s1[1].startMin).toBe(5);
    expect(s1[1].endMin).toBe(10);

    expect(segments).toEqual(
      expect.arrayContaining([expect.objectContaining({ runId: "R2", kind: "wait", name: "wait: resources", startMin: 0, endMin: 5 })]),
    );
  });

  it("handles multiple shared resources with different counts across sequential steps", () => {
    const plan = basePlan({
      template: [
        { id: "press", name: "Press", durationMin: 10, operatorInvolvement: "NONE", groupId: null, resourceIds: ["press"] },
        { id: "robot", name: "Robot", durationMin: 10, operatorInvolvement: "NONE", groupId: null, resourceIds: ["robot"] },
      ],
      runs: [
        { id: "R1", label: "R1", startMin: 0, templateId: "shared-plan" },
        { id: "R2", label: "R2", startMin: 0, templateId: "shared-plan" },
        { id: "R3", label: "R3", startMin: 0, templateId: "shared-plan" },
      ],
      sharedResources: [
        { id: "press", name: "Press", quantity: 2 },
        { id: "robot", name: "Robot", quantity: 1 },
      ],
    });

    const { segments } = simulateDES(plan);
    const pressStarts = stepSegments(segments, "press").map((segment) => ({ runId: segment.runId, start: segment.startMin }));
    const robotStarts = stepSegments(segments, "robot").map((segment) => ({ runId: segment.runId, start: segment.startMin }));

    expect(pressStarts).toEqual([
      { runId: "R1", start: 0 },
      { runId: "R2", start: 0 },
      { runId: "R3", start: 10 },
    ]);

    expect(robotStarts).toEqual([
      { runId: "R1", start: 10 },
      { runId: "R2", start: 20 },
      { runId: "R3", start: 30 },
    ]);
  });

  it("combines operator and resource constraints at step start and still preserves FIFO", () => {
    const plan = basePlan({
      template: [{ id: "s1", name: "Manual Align", durationMin: 6, operatorInvolvement: "WHOLE", groupId: null, resourceIds: ["bench"] }],
      runs: [
        { id: "R1", label: "R1", startMin: 0, templateId: "shared-plan" },
        { id: "R2", label: "R2", startMin: 0, templateId: "shared-plan" },
      ],
      sharedResources: [{ id: "bench", name: "Bench", quantity: 1 }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    const { segments } = simulateDES(plan);
    const starts = stepSegments(segments, "s1").map((segment) => ({ runId: segment.runId, start: segment.startMin }));

    expect(starts).toEqual([
      { runId: "R1", start: 0 },
      { runId: "R2", start: 6 },
    ]);

    const r2Wait = segments.find((segment) => segment.kind === "wait" && segment.runId === "R2");
    expect(r2Wait).toEqual(expect.objectContaining({ name: "wait: operator/resources", startMin: 0, endMin: 6 }));
  });

  it("does not deadlock when END checkpoints are queued behind START requests waiting on held resources", () => {
    const plan = basePlan({
      template: [
        { id: "s-end", name: "END + resource", durationMin: 1, operatorInvolvement: "END", groupId: null, resourceIds: ["res-a", "res-b"] },
        { id: "s-auto", name: "Auto", durationMin: 1, operatorInvolvement: "NONE", groupId: null, resourceIds: [] },
      ],
      runs: [
        { id: "R1", label: "R1", startMin: 0, templateId: "shared-plan" },
        { id: "R2", label: "R2", startMin: 0, templateId: "shared-plan" },
        { id: "R3", label: "R3", startMin: 0, templateId: "shared-plan" },
      ],
      sharedResources: [
        { id: "res-a", name: "Res A", quantity: 1 },
        { id: "res-b", name: "Res B", quantity: 1 },
      ],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    const { segments } = simulateDES(plan);
    const endStepSegments = stepSegments(segments, "s-end");
    const autoStepSegments = stepSegments(segments, "s-auto");

    expect(endStepSegments).toHaveLength(3);
    expect(autoStepSegments).toHaveLength(3);
    expect(endStepSegments.map((segment) => segment.runId)).toEqual(["R1", "R2", "R3"]);
  });
});
