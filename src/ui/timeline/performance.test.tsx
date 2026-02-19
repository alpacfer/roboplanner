import { performance } from "node:perf_hooks";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Run, Segment } from "../../domain/types";
import TimelineSvg from "./TimelineSvg";

function buildLargeTimelineFixture(runCount: number, stepsPerRun: number): { runs: Run[]; segments: Segment[] } {
  const runs: Run[] = [];
  const segments: Segment[] = [];

  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    const runId = `run-${runIndex + 1}`;
    runs.push({
      id: runId,
      label: `R${runIndex + 1}`,
      startMin: runIndex % 7,
      templateId: "plan-large",
    });

    let currentMin = runIndex % 7;
    for (let stepIndex = 0; stepIndex < stepsPerRun; stepIndex += 1) {
      const duration = 2 + (stepIndex % 4);
      segments.push({
        runId,
        stepId: `step-${stepIndex + 1}`,
        name: `Step ${stepIndex + 1}`,
        startMin: currentMin,
        endMin: currentMin + duration,
        kind: "step",
        requiresOperator: stepIndex % 5 === 0,
        operatorInvolvement: stepIndex % 5 === 0 ? "WHOLE" : "NONE",
        operatorCheckpointAtStart: stepIndex % 5 === 0,
        operatorCheckpointAtEnd: stepIndex % 5 === 0,
      });
      currentMin += duration;
    }
  }

  return { runs, segments };
}

describe("TimelineSvg performance", () => {
  it("renders a large timeline dataset within the regression budget", () => {
    const { runs, segments } = buildLargeTimelineFixture(60, 100);

    const startTime = performance.now();
    render(<TimelineSvg pxPerMin={1.5} runs={runs} segments={segments} />);
    const elapsedMs = performance.now() - startTime;

    expect(screen.getAllByTestId("timeline-lane")).toHaveLength(60);
    expect(screen.getAllByTestId("timeline-rect")).toHaveLength(6000);
    expect(elapsedMs).toBeLessThan(5000);
  });
});
