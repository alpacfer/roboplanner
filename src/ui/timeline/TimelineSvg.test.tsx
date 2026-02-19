import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Run, Segment } from "../../domain/types";
import TimelineSvg from "./TimelineSvg";

const runs: Run[] = [{ id: "R1", label: "R1", startMin: 0, templateId: "plan-fixture" }];
const segments: Segment[] = [
  { runId: "R1", name: "Prep", startMin: 0, endMin: 10, kind: "step", requiresOperator: true },
  { runId: "R1", name: "Soak", startMin: 10, endMin: 40, kind: "step", requiresOperator: false },
  { runId: "R1", name: "Measure", startMin: 40, endMin: 60, kind: "step", requiresOperator: true },
];

describe("TimelineSvg", () => {
  it("renders 3 rects for R1", () => {
    render(<TimelineSvg pxPerMin={2} runs={runs} segments={segments} />);
    expect(screen.getAllByTestId("timeline-rect")).toHaveLength(3);
  });

  it("uses pxPerMin scale for x and width", () => {
    render(<TimelineSvg pxPerMin={2} runs={runs} segments={segments} />);
    const rects = screen.getAllByTestId("timeline-rect");
    const firstRect = rects[0];
    const secondRect = rects[1];

    expect(Number.parseFloat(firstRect.getAttribute("x") ?? "0")).toBeCloseTo(120, 3);
    expect(Number.parseFloat(firstRect.getAttribute("width") ?? "0")).toBeCloseTo(20, 3);
    expect(Number.parseFloat(secondRect.getAttribute("x") ?? "0")).toBeCloseTo(140, 3);
    expect(Number.parseFloat(secondRect.getAttribute("width") ?? "0")).toBeCloseTo(60, 3);
  });
});
