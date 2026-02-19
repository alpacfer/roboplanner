import { describe, expect, it } from "vitest";
import type { Plan, Segment } from "../domain/types";
import { simulateDES } from "./engine";

const fixturePlan: Plan = {
  id: "plan-des",
  name: "DES Fixture",
  template: [
    { id: "op-a", name: "OpA", durationMin: 10, requiresOperator: true },
    { id: "auto-b", name: "AutoB", durationMin: 20, requiresOperator: false },
    { id: "op-c", name: "OpC", durationMin: 10, requiresOperator: true },
  ],
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
      },
      {
        runId: "R2",
        stepId: "op-a",
        name: "OpA",
        startMin: 10,
        endMin: 20,
        kind: "step",
        requiresOperator: true,
      },
      {
        runId: "R2",
        stepId: "auto-b",
        name: "AutoB",
        startMin: 20,
        endMin: 40,
        kind: "step",
        requiresOperator: false,
      },
      {
        runId: "R2",
        stepId: "op-c",
        name: "OpC",
        startMin: 40,
        endMin: 50,
        kind: "step",
        requiresOperator: true,
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
        { timeMin: 0, type: "OP_ACQUIRE", runId: "R1", stepId: "op-a" },
        { timeMin: 10, type: "OP_ACQUIRE", runId: "R2", stepId: "op-a" },
        { timeMin: 30, type: "OP_ACQUIRE", runId: "R1", stepId: "op-c" },
        { timeMin: 40, type: "OP_ACQUIRE", runId: "R2", stepId: "op-c" },
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
});
