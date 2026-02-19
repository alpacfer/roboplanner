import { fireEvent, render, screen } from "@testing-library/react";
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

    expect(Number.parseFloat(firstRect.getAttribute("x") ?? "0")).toBeCloseTo(84, 3);
    expect(Number.parseFloat(firstRect.getAttribute("width") ?? "0")).toBeCloseTo(20, 3);
    expect(Number.parseFloat(secondRect.getAttribute("x") ?? "0")).toBeCloseTo(104, 3);
    expect(Number.parseFloat(secondRect.getAttribute("width") ?? "0")).toBeCloseTo(60, 3);
  });

  it("renders two lanes and segments stay in their lane group", () => {
    const multiRuns: Run[] = [
      { id: "R1", label: "R1", startMin: 0, templateId: "plan-fixture" },
      { id: "R2", label: "R2", startMin: 15, templateId: "plan-fixture" },
    ];
    const multiSegments: Segment[] = [
      ...segments,
      {
        runId: "R2",
        name: "Prep",
        startMin: 15,
        endMin: 25,
        kind: "step",
        requiresOperator: true,
      },
      {
        runId: "R2",
        name: "Soak",
        startMin: 25,
        endMin: 55,
        kind: "step",
        requiresOperator: false,
      },
      {
        runId: "R2",
        name: "Measure",
        startMin: 55,
        endMin: 75,
        kind: "step",
        requiresOperator: true,
      },
    ];

    render(<TimelineSvg pxPerMin={2} runs={multiRuns} segments={multiSegments} />);
    const laneGroups = screen.getAllByTestId("timeline-lane");

    expect(laneGroups).toHaveLength(2);
    expect(laneGroups[0].querySelectorAll('[data-testid="timeline-rect"]')).toHaveLength(3);
    expect(laneGroups[1].querySelectorAll('[data-testid="timeline-rect"]')).toHaveLength(3);
    expect(laneGroups[0].textContent).toContain("R1");
    expect(laneGroups[1].textContent).toContain("R2");
  });

  it("shows tooltip with segment details on hover", () => {
    render(<TimelineSvg pxPerMin={10} runs={runs} segments={segments} />);
    const firstRect = screen.getAllByTestId("timeline-rect")[0];

    fireEvent.mouseEnter(firstRect, { clientX: 200, clientY: 150 });
    const tooltip = screen.getByTestId("timeline-tooltip");

    expect(tooltip.textContent).toContain("Prep");
    expect(tooltip.textContent).toContain("Start: 0 min, End: 10 min");
    expect(tooltip.textContent).toContain("Requires operator: Yes");
  });

  it("does not render label text when name does not fit bar width", () => {
    const tinySegments: Segment[] = [
      {
        runId: "R1",
        name: "VeryLongStepNameThatCannotFit",
        startMin: 0,
        endMin: 5,
        kind: "step",
        requiresOperator: false,
      },
    ];

    render(<TimelineSvg pxPerMin={4} runs={runs} segments={tinySegments} />);
    expect(screen.queryByText("VeryLongStepNameThatCannotFit")).toBeNull();
  });

  it("renders a horizontal minute axis with auto-scaled ticks", () => {
    render(<TimelineSvg pxPerMin={1} runs={runs} segments={segments} viewStartMin={0} viewEndMin={600} />);
    expect(screen.getByTestId("timeline-axis")).toBeTruthy();
    expect(screen.getByText("0 min")).toBeTruthy();
    expect(screen.getByText("100 min")).toBeTruthy();
    expect(screen.getByText("500 min")).toBeTruthy();
  });
});
