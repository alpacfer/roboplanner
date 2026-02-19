import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Run, Segment } from "../../domain/types";
import TimelineSvg from "./TimelineSvg";

const runs: Run[] = [{ id: "R1", label: "R1", startMin: 0, templateId: "plan-fixture" }];
const segments: Segment[] = [
  {
    runId: "R1",
    name: "Prep",
    stepId: "s1",
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
    name: "Soak",
    stepId: "s2",
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
    name: "Measure",
    stepId: "s3",
    startMin: 40,
    endMin: 60,
    kind: "step",
    requiresOperator: true,
    operatorInvolvement: "WHOLE",
    operatorCheckpointAtStart: true,
    operatorCheckpointAtEnd: true,
  },
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
        operatorInvolvement: "WHOLE",
        operatorCheckpointAtStart: true,
        operatorCheckpointAtEnd: true,
      },
      {
        runId: "R2",
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
        name: "Measure",
        startMin: 55,
        endMin: 75,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "WHOLE",
        operatorCheckpointAtStart: true,
        operatorCheckpointAtEnd: true,
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
    render(<TimelineSvg pxPerMin={10} runs={runs} segments={segments} stepGroupNamesByStepId={{ s1: "Main Group" }} />);
    const firstRect = screen.getAllByTestId("timeline-rect")[0];

    fireEvent.mouseEnter(firstRect, { clientX: 200, clientY: 150 });
    const tooltip = screen.getByTestId("timeline-tooltip");

    expect(tooltip.textContent).toContain("Prep");
    expect(tooltip.textContent).toContain("Start: 0 min, End: 10 min");
    expect(tooltip.textContent).toContain("Duration:10 min");
    expect(tooltip.textContent).toContain("Group:Main Group");
    expect(tooltip.textContent).toContain("Whole step");
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

  it("avoids overlapping duplicate labels for short ranges", () => {
    render(<TimelineSvg pxPerMin={40} runs={runs} segments={segments} viewStartMin={0} viewEndMin={4} />);
    const labels = Array.from(document.querySelectorAll(".axis-label")).map((label) =>
      label.textContent?.trim(),
    );
    const uniqueLabels = new Set(labels);

    expect(uniqueLabels.size).toBe(labels.length);
    expect(labels.every((label) => typeof label === "string" && /^\d+ min$/.test(label))).toBe(true);
  });

  it("uses step color and overlays operator pattern", () => {
    const coloredSegments: Segment[] = [
      {
        ...segments[0],
        stepId: "s1",
      },
      {
        ...segments[1],
        stepId: "s2",
      },
      {
        ...segments[2],
        stepId: "s3",
      },
    ];
    render(<TimelineSvg pxPerMin={2} runs={runs} segments={coloredSegments} stepColorsById={{ s1: "#00ff00" }} />);
    const rects = screen.getAllByTestId("timeline-rect");
    expect(rects[0].getAttribute("fill")).toBe("#00ff00");
    const patternRects = screen.getAllByTestId("timeline-operator-pattern");
    expect(patternRects).toHaveLength(2);
  });

  it("renders start and end checkpoints as checkpoint segments", () => {
    const checkpointSegments: Segment[] = [
      {
        runId: "R1",
        stepId: "s1",
        name: "Start checkpoint",
        startMin: 0,
        endMin: 0,
        kind: "operator_checkpoint",
        requiresOperator: true,
        operatorInvolvement: "START",
        operatorPhase: "START",
      },
      {
        runId: "R1",
        stepId: "s2",
        name: "End checkpoint",
        startMin: 20,
        endMin: 20,
        kind: "operator_checkpoint",
        requiresOperator: true,
        operatorInvolvement: "END",
        operatorPhase: "END",
      },
    ];

    render(<TimelineSvg pxPerMin={4} runs={runs} segments={checkpointSegments} />);
    expect(screen.getAllByTestId("timeline-operator-start-checkpoint")).toHaveLength(1);
    expect(screen.getAllByTestId("timeline-operator-end-checkpoint")).toHaveLength(1);
  });

  it("visually reserves space for checkpoints inside a step duration", () => {
    const checkpointSegments: Segment[] = [
      {
        runId: "R1",
        stepId: "s1",
        name: "Task start checkpoint",
        startMin: 0,
        endMin: 0,
        kind: "operator_checkpoint",
        requiresOperator: true,
        operatorInvolvement: "START_END",
        operatorPhase: "START",
      },
      {
        runId: "R1",
        stepId: "s1",
        name: "Task",
        startMin: 0,
        endMin: 10,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "START_END",
      },
      {
        runId: "R1",
        stepId: "s1",
        name: "Task end checkpoint",
        startMin: 10,
        endMin: 10,
        kind: "operator_checkpoint",
        requiresOperator: true,
        operatorInvolvement: "START_END",
        operatorPhase: "END",
      },
    ];

    render(<TimelineSvg pxPerMin={10} runs={runs} segments={checkpointSegments} />);

    const stepRect = document.querySelector(
      '[data-testid="timeline-rect"][data-segment-name="Task"]',
    ) as SVGRectElement;
    const startCheckpointRect = document.querySelector(
      '[data-testid="timeline-rect"][data-segment-name="Task start checkpoint"]',
    ) as SVGRectElement;
    const endCheckpointRect = document.querySelector(
      '[data-testid="timeline-rect"][data-segment-name="Task end checkpoint"]',
    ) as SVGRectElement;

    const rawDurationWidth = 100;
    const stepX = Number.parseFloat(stepRect.getAttribute("x") ?? "0");
    const stepWidth = Number.parseFloat(stepRect.getAttribute("width") ?? "0");
    const startX = Number.parseFloat(startCheckpointRect.getAttribute("x") ?? "0");
    const startWidth = Number.parseFloat(startCheckpointRect.getAttribute("width") ?? "0");
    const endX = Number.parseFloat(endCheckpointRect.getAttribute("x") ?? "0");
    const endWidth = Number.parseFloat(endCheckpointRect.getAttribute("width") ?? "0");

    expect(stepWidth).toBeLessThan(rawDurationWidth);
    expect(stepX).toBeCloseTo(startX + startWidth, 3);
    expect(endX).toBeCloseTo(stepX + stepWidth, 3);
    expect(startWidth + stepWidth + endWidth).toBeCloseTo(rawDurationWidth, 3);

    fireEvent.mouseEnter(stepRect, { clientX: 200, clientY: 150 });
    const tooltip = screen.getByTestId("timeline-tooltip");
    expect(tooltip.textContent).toContain("Start: 0 min, End: 10 min");
  });

  it("hides checkpoints when a step is too narrow to display them", () => {
    const narrowSegments: Segment[] = [
      {
        runId: "R1",
        stepId: "s1",
        name: "Task start checkpoint",
        startMin: 0,
        endMin: 0,
        kind: "operator_checkpoint",
        requiresOperator: true,
        operatorInvolvement: "START_END",
        operatorPhase: "START",
      },
      {
        runId: "R1",
        stepId: "s1",
        name: "Task",
        startMin: 0,
        endMin: 1,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "START_END",
      },
      {
        runId: "R1",
        stepId: "s1",
        name: "Task end checkpoint",
        startMin: 1,
        endMin: 1,
        kind: "operator_checkpoint",
        requiresOperator: true,
        operatorInvolvement: "START_END",
        operatorPhase: "END",
      },
    ];

    render(<TimelineSvg pxPerMin={10} runs={runs} segments={narrowSegments} />);

    const stepRect = document.querySelector(
      '[data-testid="timeline-rect"][data-segment-name="Task"]',
    ) as SVGRectElement;
    const startCheckpointRect = document.querySelector<SVGRectElement>(
      '[data-testid="timeline-rect"][data-segment-name="Task start checkpoint"]',
    );
    const endCheckpointRect = document.querySelector<SVGRectElement>(
      '[data-testid="timeline-rect"][data-segment-name="Task end checkpoint"]',
    );

    const stepX = Number.parseFloat(stepRect.getAttribute("x") ?? "0");
    const stepWidth = Number.parseFloat(stepRect.getAttribute("width") ?? "0");

    expect(startCheckpointRect).toBeNull();
    expect(endCheckpointRect).toBeNull();
    expect(stepX).toBeCloseTo(84, 3);
    expect(stepWidth).toBeCloseTo(10, 3);
  });

  it("anchors checkpoints to the correct step when step ids repeat", () => {
    const duplicateIdSegments: Segment[] = [
      {
        runId: "R1",
        stepId: "dup",
        name: "Task A start checkpoint",
        startMin: 10,
        endMin: 10,
        kind: "operator_checkpoint",
        requiresOperator: true,
        operatorInvolvement: "START_END",
        operatorPhase: "START",
      },
      {
        runId: "R1",
        stepId: "dup",
        name: "Task A",
        startMin: 10,
        endMin: 20,
        kind: "step",
        requiresOperator: true,
        operatorInvolvement: "START_END",
      },
      {
        runId: "R1",
        stepId: "dup",
        name: "Task A end checkpoint",
        startMin: 20,
        endMin: 20,
        kind: "operator_checkpoint",
        requiresOperator: true,
        operatorInvolvement: "START_END",
        operatorPhase: "END",
      },
      {
        runId: "R1",
        stepId: "dup",
        name: "Task B",
        startMin: 30,
        endMin: 31,
        kind: "step",
        requiresOperator: false,
        operatorInvolvement: "NONE",
      },
    ];

    render(<TimelineSvg pxPerMin={10} runs={runs} segments={duplicateIdSegments} />);

    const taskBRect = document.querySelector(
      '[data-testid="timeline-rect"][data-segment-name="Task B"]',
    ) as SVGRectElement;
    const startCheckpointRect = document.querySelector(
      '[data-testid="timeline-rect"][data-segment-name="Task A start checkpoint"]',
    ) as SVGRectElement;
    const endCheckpointRect = document.querySelector(
      '[data-testid="timeline-rect"][data-segment-name="Task A end checkpoint"]',
    ) as SVGRectElement;

    const taskBX = Number.parseFloat(taskBRect.getAttribute("x") ?? "0");
    const startX = Number.parseFloat(startCheckpointRect.getAttribute("x") ?? "0");
    const endX = Number.parseFloat(endCheckpointRect.getAttribute("x") ?? "0");
    const endWidth = Number.parseFloat(endCheckpointRect.getAttribute("width") ?? "0");

    expect(startX).toBeCloseTo(184, 3);
    expect(endX).toBeCloseTo(276, 3);
    expect(endX + endWidth).toBeLessThan(taskBX);
  });
});
