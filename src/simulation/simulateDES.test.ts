import { describe, expect, it } from "vitest";
import type { Plan, Segment } from "../domain/types";
import { simulateDES } from "./engine";

const fixturePlan: Plan = {
  id: "plan-des",
  name: "DES Fixture",
  template: [
    { id: "op-a", name: "OpA", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null },
    { id: "auto-b", name: "AutoB", durationMin: 20, operatorInvolvement: "NONE", groupId: null },
    { id: "op-c", name: "OpC", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null },
  ],
  stepGroups: [],
  runs: [
    { id: "R1", label: "R1", startMin: 0, templateId: "plan-des" },
    { id: "R2", label: "R2", startMin: 0, templateId: "plan-des" },
  ],
  settings: {
    operatorCapacity: 1,
    queuePolicy: "FIFO",
  },
};

function operatorStepSegments(segments: Segment[]): Segment[] {
  return segments.filter((segment) => segment.kind === "step" && segment.requiresOperator);
}

describe("simulateDES", () => {
  it("produces exact expected segments for R2 fixture", () => {
    const { segments } = simulateDES(fixturePlan);
    const r2Segments = segments.filter((segment) => segment.runId === "R2");

    expect(r2Segments).toEqual([
      {
        runId: "R2",
        name: "wait: operator",
        startMin: 0,
        endMin: 10,
        kind: "wait",
        requiresOperator: false,
        operatorInvolvement: "NONE",
        operatorCheckpointAtStart: false,
        operatorCheckpointAtEnd: false,
      },
      {
        runId: "R2",
        stepId: "op-a",
        name: "OpA",
        startMin: 10,
        endMin: 20,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "WHOLE",
        operatorCheckpointAtStart: true,
        operatorCheckpointAtEnd: true,
      },
      {
        runId: "R2",
        stepId: "auto-b",
        name: "AutoB",
        startMin: 20,
        endMin: 40,
        kind: "step",
        requiresOperator: false,
        operatorInvolvement: "NONE",
        operatorCheckpointAtStart: false,
        operatorCheckpointAtEnd: false,
      },
      {
        runId: "R2",
        stepId: "op-c",
        name: "OpC",
        startMin: 40,
        endMin: 50,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "WHOLE",
        operatorCheckpointAtStart: true,
        operatorCheckpointAtEnd: true,
      },
    ]);
  });

  it("does not overlap operator steps across runs for capacity=1", () => {
    const { segments } = simulateDES(fixturePlan);
    const operatorSegments = operatorStepSegments(segments).sort((a, b) => a.startMin - b.startMin);

    for (let index = 0; index < operatorSegments.length - 1; index += 1) {
      expect(operatorSegments[index].endMin).toBeLessThanOrEqual(operatorSegments[index + 1].startMin);
    }
  });

  it("follows FIFO and gives R2 the next operator slot after R1 OpA", () => {
    const { segments } = simulateDES(fixturePlan);
    const r2OpA = segments.find((segment) => segment.runId === "R2" && segment.name === "OpA");

    expect(r2OpA?.startMin).toBe(10);
  });

  it("creates waits only when delay > 0 and wait end equals operator step start", () => {
    const { segments } = simulateDES(fixturePlan);
    const waitSegments = segments.filter((segment) => segment.kind === "wait");

    expect(waitSegments).toHaveLength(1);
    expect(waitSegments[0].endMin - waitSegments[0].startMin).toBeGreaterThan(0);

    const r2OpA = segments.find((segment) => segment.runId === "R2" && segment.name === "OpA");
    expect(waitSegments[0].endMin).toBe(r2OpA?.startMin);
  });

  it("emits expected OP_ACQUIRE events", () => {
    const { events } = simulateDES(fixturePlan);
    const acquireEvents = events.filter((event) => event.type === "OP_ACQUIRE");

    expect(acquireEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ timeMin: 0, type: "OP_ACQUIRE", runId: "R1", stepId: "op-a", phase: "WHOLE" }),
        expect.objectContaining({ timeMin: 10, type: "OP_ACQUIRE", runId: "R2", stepId: "op-a", phase: "WHOLE" }),
        expect.objectContaining({ timeMin: 30, type: "OP_ACQUIRE", runId: "R1", stepId: "op-c", phase: "WHOLE" }),
        expect.objectContaining({ timeMin: 40, type: "OP_ACQUIRE", runId: "R2", stepId: "op-c", phase: "WHOLE" }),
      ]),
    );
  });

  it("computes MVP6 metrics correctly", () => {
    const { metrics } = simulateDES(fixturePlan);

    expect(metrics.makespan).toBe(50);
    expect(metrics.operatorBusyMin).toBe(40);
    expect(metrics.operatorUtilization).toBe(0.8);
    expect(metrics.totalWaitingMin).toBe(10);
  });

  it("supports START and START_END checkpoints without whole-step occupancy", () => {
    const plan: Plan = {
      ...fixturePlan,
      template: [
        { id: "s1", name: "StartOnly", durationMin: 5, operatorInvolvement: "START", groupId: null },
        { id: "s2", name: "Both", durationMin: 5, operatorInvolvement: "START_END", groupId: null },
      ],
      runs: [{ id: "R1", label: "R1", startMin: 0, templateId: "plan-des" }],
    };
    const { segments, events } = simulateDES(plan);

    const stepSegments = segments.filter((segment) => segment.kind === "step");
    expect(stepSegments).toHaveLength(2);
    expect(stepSegments[0].operatorInvolvement).toBe("START");
    expect(stepSegments[1].operatorInvolvement).toBe("START_END");

    const checkpointSegments = segments.filter((segment) => segment.kind === "operator_checkpoint");
    expect(checkpointSegments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "StartOnly start checkpoint",
          operatorPhase: "START",
          startMin: 0,
          endMin: 0,
        }),
        expect.objectContaining({
          name: "Both start checkpoint",
          operatorPhase: "START",
          startMin: 5,
          endMin: 5,
        }),
        expect.objectContaining({
          name: "Both end checkpoint",
          operatorPhase: "END",
          startMin: 10,
          endMin: 10,
        }),
      ]),
    );

    expect(events.filter((event) => event.type === "OP_ACQUIRE")).toHaveLength(3);
  });

  it("delays END-only completion when operator is unavailable at end", () => {
    const plan: Plan = {
      id: "plan-end-delay",
      name: "End Delay",
      template: [
        { id: "whole-step", name: "Whole", durationMin: 20, operatorInvolvement: "WHOLE", groupId: null },
        { id: "end-step", name: "EndOnly", durationMin: 1, operatorInvolvement: "END", groupId: null },
      ],
      stepGroups: [],
      runs: [
        { id: "R1", label: "R1", startMin: 0, templateId: "plan-end-delay" },
        { id: "R2", label: "R2", startMin: 10, templateId: "plan-end-delay" },
      ],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    };

    const { segments, events } = simulateDES(plan);
    const waits = segments.filter((segment) => segment.kind === "wait" && segment.runId === "R1");
    expect(waits.length).toBeGreaterThan(0);
    expect(waits[0].startMin).toBe(21);

    const endAcquires = events.filter((event) => event.type === "OP_ACQUIRE" && event.phase === "END");
    expect(endAcquires).toHaveLength(2);
  });
});

