import { useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_STEP_COLOR } from "../../domain/colors";
import type { Run, Segment } from "../../domain/types";
import { segmentWidth, segmentX } from "./scale";
import { filterSegmentsByViewport } from "./viewport";

interface TimelineSvgProps {
  runs: Run[];
  segments: Segment[];
  stepColorsById?: Record<string, string>;
  stepGroupNamesByStepId?: Record<string, string | undefined>;
  pxPerMin: number;
  viewStartMin?: number;
  viewEndMin?: number;
}

const LANE_HEIGHT = 44;
const LANE_GAP = 10;
export const TIMELINE_LEFT_PAD = 84;
export const TIMELINE_RIGHT_PAD = 24;
const TOP_PAD = 18;
const AXIS_HEIGHT = 26;
const BOTTOM_PAD = 18;
const BAR_HEIGHT = 28;
const LABEL_HORIZONTAL_PADDING = 10;
const APPROX_CHAR_WIDTH = 5;
const MIN_AXIS_LABEL_SPACING_PX = 46;
const CHECKPOINT_WIDTH_PX = 8;
const MIN_STEP_WIDTH_PX = 2;
const TOOLTIP_OFFSET_PX = 10;
const TOOLTIP_MARGIN_PX = 12;
const TOOLTIP_FALLBACK_WIDTH_PX = 240;
const TOOLTIP_FALLBACK_HEIGHT_PX = 140;

interface TooltipState {
  clientX: number;
  clientY: number;
  left: number;
  top: number;
  segment: Segment;
}

interface CheckpointLookup {
  startTimes: Set<string>;
  endTimes: Set<string>;
}

interface StepSpan {
  startMin: number;
  endMin: number;
}

interface StepSpanLookup {
  byStartTime: Map<string, StepSpan>;
  byEndTime: Map<string, StepSpan>;
}

interface StepLayout {
  startCheckpointWidth: number;
  endCheckpointWidth: number;
  stepWidth: number;
  totalWidth: number;
}

function involvementLabel(segment: Segment): string {
  switch (segment.operatorInvolvement) {
    case "WHOLE":
      return "Whole step";
    case "START":
      return "Start only";
    case "END":
      return "End only";
    case "START_END":
      return "Start + End";
    default:
      return "None";
  }
}

function checkpointLabel(segment: Segment): string {
  if (segment.operatorPhase === "START") {
    return "Start";
  }
  if (segment.operatorPhase === "END") {
    return "End";
  }
  return "Unknown";
}

function checkpointTestId(segment: Segment): string {
  if (segment.operatorPhase === "START") {
    return "timeline-operator-start-checkpoint";
  }
  if (segment.operatorPhase === "END") {
    return "timeline-operator-end-checkpoint";
  }
  return "timeline-operator-checkpoint";
}

function canRenderLabel(name: string, widthPx: number): boolean {
  const estimatedTextWidth = name.length * APPROX_CHAR_WIDTH + LABEL_HORIZONTAL_PADDING;
  return widthPx >= estimatedTextWidth;
}

function axisTickStep(pxPerMin: number): number {
  const roughByPixels = MIN_AXIS_LABEL_SPACING_PX / Math.max(pxPerMin, 0.0001);
  const rough = Math.max(1, roughByPixels);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  if (normalized <= 1) {
    return 1 * magnitude;
  }
  if (normalized <= 2) {
    return 2 * magnitude;
  }
  if (normalized <= 5) {
    return 5 * magnitude;
  }
  return 10 * magnitude;
}

function buildAxisTicks(viewStartMin: number, viewEndMin: number, pxPerMin: number): number[] {
  const step = axisTickStep(pxPerMin);
  const first = Math.ceil(viewStartMin / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= viewEndMin; tick += step) {
    ticks.push(tick);
  }
  if (ticks.length === 0) {
    ticks.push(Math.floor(viewStartMin));
  }
  return ticks;
}

function stepTimeKey(runId: string, stepId: string, atMin: number): string {
  return `${runId}::${stepId}::${atMin}`;
}

function buildCheckpointLookup(segments: Segment[]): CheckpointLookup {
  const startTimes = new Set<string>();
  const endTimes = new Set<string>();

  for (const segment of segments) {
    if (segment.kind !== "operator_checkpoint" || !segment.stepId) {
      continue;
    }
    const key = stepTimeKey(segment.runId, segment.stepId, segment.startMin);

    if (segment.operatorPhase === "START") {
      startTimes.add(key);
    }
    if (segment.operatorPhase === "END") {
      endTimes.add(key);
    }
  }

  return { startTimes, endTimes };
}

function hasCheckpointAt(
  lookup: CheckpointLookup,
  runId: string,
  stepId: string,
  atMin: number,
  phase: "START" | "END",
): boolean {
  const key = stepTimeKey(runId, stepId, atMin);
  return phase === "START" ? lookup.startTimes.has(key) : lookup.endTimes.has(key);
}

function buildStepSpanLookup(segments: Segment[]): StepSpanLookup {
  const byStartTime = new Map<string, StepSpan>();
  const byEndTime = new Map<string, StepSpan>();

  for (const segment of segments) {
    if (segment.kind !== "step" || !segment.stepId) {
      continue;
    }
    const span: StepSpan = {
      startMin: segment.startMin,
      endMin: segment.endMin,
    };
    byStartTime.set(stepTimeKey(segment.runId, segment.stepId, segment.startMin), span);
    byEndTime.set(stepTimeKey(segment.runId, segment.stepId, segment.endMin), span);
  }

  return { byStartTime, byEndTime };
}

function computeStepLayout(
  rawWidthPx: number,
  hasStartCheckpoint: boolean,
  hasEndCheckpoint: boolean,
): StepLayout {
  const targetWidth = Math.max(rawWidthPx, MIN_STEP_WIDTH_PX);
  const checkpointCount = Number(hasStartCheckpoint) + Number(hasEndCheckpoint);
  const minWidthForCheckpoints = MIN_STEP_WIDTH_PX + checkpointCount * CHECKPOINT_WIDTH_PX;

  if (checkpointCount > 0 && rawWidthPx < minWidthForCheckpoints) {
    return {
      startCheckpointWidth: 0,
      endCheckpointWidth: 0,
      stepWidth: targetWidth,
      totalWidth: targetWidth,
    };
  }

  let startCheckpointWidth = hasStartCheckpoint ? CHECKPOINT_WIDTH_PX : 0;
  let endCheckpointWidth = hasEndCheckpoint ? CHECKPOINT_WIDTH_PX : 0;
  const markerTotal = startCheckpointWidth + endCheckpointWidth;
  const markerBudget = Math.max(0, targetWidth - MIN_STEP_WIDTH_PX);

  if (markerTotal > markerBudget && markerTotal > 0) {
    const ratio = markerBudget / markerTotal;
    startCheckpointWidth *= ratio;
    endCheckpointWidth *= ratio;
  }

  let stepWidth = Math.max(MIN_STEP_WIDTH_PX, targetWidth - startCheckpointWidth - endCheckpointWidth);
  let totalWidth = startCheckpointWidth + stepWidth + endCheckpointWidth;
  if (totalWidth > targetWidth) {
    stepWidth = Math.max(MIN_STEP_WIDTH_PX, stepWidth - (totalWidth - targetWidth));
    totalWidth = startCheckpointWidth + stepWidth + endCheckpointWidth;
  }

  return {
    startCheckpointWidth,
    endCheckpointWidth,
    stepWidth,
    totalWidth,
  };
}

function clampTooltipPosition(
  clientX: number,
  clientY: number,
  tooltipWidth: number,
  tooltipHeight: number,
): { left: number; top: number } {
  const nextLeft = clientX + TOOLTIP_OFFSET_PX;
  const nextTop = clientY + TOOLTIP_OFFSET_PX;

  if (typeof window === "undefined") {
    return { left: nextLeft, top: nextTop };
  }

  const maxLeft = window.innerWidth - tooltipWidth - TOOLTIP_MARGIN_PX;
  const maxTop = window.innerHeight - tooltipHeight - TOOLTIP_MARGIN_PX;
  let left = nextLeft;
  let top = nextTop;

  if (left + tooltipWidth + TOOLTIP_MARGIN_PX > window.innerWidth) {
    left = clientX - tooltipWidth - TOOLTIP_OFFSET_PX;
  }
  if (top + tooltipHeight + TOOLTIP_MARGIN_PX > window.innerHeight) {
    top = clientY - tooltipHeight - TOOLTIP_OFFSET_PX;
  }

  return {
    left: Math.max(TOOLTIP_MARGIN_PX, Math.min(left, maxLeft)),
    top: Math.max(TOOLTIP_MARGIN_PX, Math.min(top, maxTop)),
  };
}

function TimelineSvg({
  runs,
  segments,
  stepColorsById = {},
  stepGroupNamesByStepId = {},
  pxPerMin,
  viewStartMin = 0,
  viewEndMin,
}: TimelineSvgProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const effectiveViewEndMin =
    viewEndMin ?? (segments.length > 0 ? Math.max(...segments.map((segment) => segment.endMin)) : viewStartMin);
  const width = TIMELINE_LEFT_PAD + (effectiveViewEndMin - viewStartMin) * pxPerMin + TIMELINE_RIGHT_PAD;
  const height = TOP_PAD + AXIS_HEIGHT + runs.length * (LANE_HEIGHT + LANE_GAP) + BOTTOM_PAD;
  const visibleSegments = filterSegmentsByViewport(segments, viewStartMin, effectiveViewEndMin);
  const checkpointLookup = buildCheckpointLookup(segments);
  const stepSpanLookup = buildStepSpanLookup(segments);
  const axisTicks = buildAxisTicks(viewStartMin, effectiveViewEndMin, pxPerMin);
  const buildTooltipState = (clientX: number, clientY: number, segment: Segment): TooltipState => {
    const tooltipWidth = tooltipRef.current?.offsetWidth ?? TOOLTIP_FALLBACK_WIDTH_PX;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? TOOLTIP_FALLBACK_HEIGHT_PX;
    const { left, top } = clampTooltipPosition(clientX, clientY, tooltipWidth, tooltipHeight);
    return {
      clientX,
      clientY,
      left,
      top,
      segment,
    };
  };

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      return;
    }
    const tooltipWidth = tooltipRef.current.offsetWidth || TOOLTIP_FALLBACK_WIDTH_PX;
    const tooltipHeight = tooltipRef.current.offsetHeight || TOOLTIP_FALLBACK_HEIGHT_PX;
    const { left, top } = clampTooltipPosition(tooltip.clientX, tooltip.clientY, tooltipWidth, tooltipHeight);
    if (left !== tooltip.left || top !== tooltip.top) {
      setTooltip((current) =>
        current
          ? {
              ...current,
              left,
              top,
            }
          : current,
      );
    }
  }, [tooltip]);

  return (
    <div className="timeline-wrap">
      <svg
        aria-label="Timeline"
        className="timeline-svg"
        data-testid="timeline-svg"
        height={height}
        role="img"
        width={Math.max(width, 400)}
      >
        <defs>
          <pattern
            id="operator-grid-pattern"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          </pattern>
          <pattern id="operator-marker-pattern" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M 0 6 L 6 0" stroke="rgba(0,0,0,0.45)" strokeWidth="1.2" />
          </pattern>
        </defs>
        <g data-testid="timeline-axis">
          <line
            className="axis-line"
            x1={TIMELINE_LEFT_PAD}
            x2={Math.max(width, 400) - TIMELINE_RIGHT_PAD}
            y1={TOP_PAD + AXIS_HEIGHT}
            y2={TOP_PAD + AXIS_HEIGHT}
          />
          {axisTicks.map((tickMin) => {
            const x = segmentX(tickMin, viewStartMin, pxPerMin, TIMELINE_LEFT_PAD);
            return (
              <g key={`axis-tick-${tickMin}`}>
                <line
                  className="axis-tick"
                  x1={x}
                  x2={x}
                  y1={TOP_PAD + AXIS_HEIGHT - 5}
                  y2={TOP_PAD + AXIS_HEIGHT + 5}
                />
                <text className="axis-label" x={x + 2} y={TOP_PAD + AXIS_HEIGHT - 8}>
                  {Math.round(tickMin)} min
                </text>
              </g>
            );
          })}
        </g>
        {runs.map((run, laneIndex) => {
          const laneY = TOP_PAD + AXIS_HEIGHT + laneIndex * (LANE_HEIGHT + LANE_GAP);
          const runSegments = visibleSegments.filter((segment) => segment.runId === run.id);
          const laneTrackWidth = Math.max(0, Math.max(width, 400) - TIMELINE_LEFT_PAD - TIMELINE_RIGHT_PAD);

          return (
            <g data-testid="timeline-lane" key={run.id} transform={`translate(0, ${laneY})`}>
              <rect
                className="lane-track"
                height={BAR_HEIGHT}
                rx={8}
                width={laneTrackWidth}
                x={TIMELINE_LEFT_PAD}
                y={0}
              />
              <text className="lane-label" x={8} y={BAR_HEIGHT / 2 + 4}>
                {run.label}
              </text>
              {runSegments.map((segment, segmentIndex) => {
                const xRaw = segmentX(segment.startMin, viewStartMin, pxPerMin, TIMELINE_LEFT_PAD);
                const widthPxRaw = segmentWidth(segment.startMin, segment.endMin, pxPerMin);
                let x = xRaw;
                let widthPx = widthPxRaw;
                let skipRendering = false;

                if (segment.kind === "step" && segment.stepId) {
                  const hasStartCheckpoint = hasCheckpointAt(
                    checkpointLookup,
                    segment.runId,
                    segment.stepId,
                    segment.startMin,
                    "START",
                  );
                  const hasEndCheckpoint = hasCheckpointAt(
                    checkpointLookup,
                    segment.runId,
                    segment.stepId,
                    segment.endMin,
                    "END",
                  );
                  const layout = computeStepLayout(
                    widthPxRaw,
                    hasStartCheckpoint,
                    hasEndCheckpoint,
                  );
                  x = xRaw + layout.startCheckpointWidth;
                  widthPx = layout.stepWidth;
                } else if (segment.kind === "operator_checkpoint") {
                  let markerWidth = CHECKPOINT_WIDTH_PX;
                  if (segment.stepId && (segment.operatorPhase === "START" || segment.operatorPhase === "END")) {
                    const key = stepTimeKey(segment.runId, segment.stepId, segment.startMin);
                    const span =
                      segment.operatorPhase === "START"
                        ? stepSpanLookup.byStartTime.get(key)
                        : stepSpanLookup.byEndTime.get(key);

                    if (span) {
                      const hasStartCheckpoint = hasCheckpointAt(
                        checkpointLookup,
                        segment.runId,
                        segment.stepId,
                        span.startMin,
                        "START",
                      );
                      const hasEndCheckpoint = hasCheckpointAt(
                        checkpointLookup,
                        segment.runId,
                        segment.stepId,
                        span.endMin,
                        "END",
                      );
                      const startX = segmentX(span.startMin, viewStartMin, pxPerMin, TIMELINE_LEFT_PAD);
                      const stepRawWidth = segmentWidth(span.startMin, span.endMin, pxPerMin);
                      const layout = computeStepLayout(stepRawWidth, hasStartCheckpoint, hasEndCheckpoint);
                      if (segment.operatorPhase === "START") {
                        markerWidth = layout.startCheckpointWidth;
                        x = startX;
                      } else if (segment.operatorPhase === "END") {
                        markerWidth = layout.endCheckpointWidth;
                        x = startX + layout.totalWidth - markerWidth;
                      }
                      if (markerWidth <= 0) {
                        skipRendering = true;
                      }
                    }
                  }
                  widthPx = markerWidth;
                }

                if (skipRendering) {
                  return null;
                }
                const fill =
                  segment.kind === "wait"
                    ? "#9aa5b1"
                    : segment.stepId
                      ? (stepColorsById[segment.stepId] ?? DEFAULT_STEP_COLOR)
                      : DEFAULT_STEP_COLOR;

                return (
                  <g key={`${segment.runId}-${segmentIndex}`}>
                    <rect
                      className={`timeline-segment timeline-segment-${segment.kind}`}
                      data-testid="timeline-rect"
                      data-segment-kind={segment.kind}
                      data-segment-name={segment.name}
                      fill={fill}
                      height={BAR_HEIGHT}
                      rx={4}
                      width={widthPx}
                      x={x}
                      y={0}
                      onMouseEnter={(event) => {
                        setTooltip(buildTooltipState(event.clientX, event.clientY, segment));
                      }}
                      onMouseMove={(event) => {
                        setTooltip((current) =>
                          current
                            ? buildTooltipState(event.clientX, event.clientY, segment)
                            : current,
                        );
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {segment.kind === "operator_checkpoint" ? (
                      <rect
                        className="operator-pattern-overlay"
                        data-testid={checkpointTestId(segment)}
                        fill="url(#operator-marker-pattern)"
                        height={BAR_HEIGHT}
                        width={widthPx}
                        x={x}
                        y={0}
                      />
                    ) : null}
                    {segment.operatorInvolvement === "WHOLE" && segment.kind === "step" ? (
                      <rect
                        className="operator-pattern-overlay"
                        data-testid="timeline-operator-pattern"
                        fill="url(#operator-grid-pattern)"
                        height={BAR_HEIGHT}
                        rx={4}
                        width={widthPx}
                        x={x}
                        y={0}
                      />
                    ) : null}
                    {segment.kind === "step" && canRenderLabel(segment.name, widthPx) ? (
                      <text className="segment-label" x={x + 6} y={BAR_HEIGHT / 2 + 4}>
                        {segment.name}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {tooltip ? (
        <div
          ref={tooltipRef}
          className="timeline-tooltip"
          data-testid="timeline-tooltip"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          <div className="tooltip-title">{tooltip.segment.name}</div>
          <div className="tooltip-row">
            <span className="tooltip-key">Start:</span>
            <span className="tooltip-value">{tooltip.segment.startMin} min</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-key">End:</span>
            <span className="tooltip-value">{tooltip.segment.endMin} min</span>
          </div>
          {tooltip.segment.kind === "step" ? (
            <>
              <div className="tooltip-row">
                <span className="tooltip-key">Duration:</span>
                <span className="tooltip-value">{tooltip.segment.endMin - tooltip.segment.startMin} min</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-key">Group:</span>
                <span className="tooltip-value">
                  {tooltip.segment.stepId ? (stepGroupNamesByStepId[tooltip.segment.stepId] ?? "Unsequenced") : "N/A"}
                </span>
              </div>
            </>
          ) : null}
          <div className="tooltip-row">
            <span className="tooltip-key">Operator:</span>
            <span
              className={`tooltip-badge ${
                tooltip.segment.requiresOperator ? "tooltip-badge-op" : "tooltip-badge-auto"
              }`}
            >
              {involvementLabel(tooltip.segment)}
            </span>
          </div>
          {tooltip.segment.kind === "operator_checkpoint" ? (
            <div className="tooltip-row">
              <span className="tooltip-key">Checkpoint:</span>
              <span className="tooltip-value">{checkpointLabel(tooltip.segment)}</span>
            </div>
          ) : null}
          <div className="tooltip-row tooltip-legacy">
            Start: {tooltip.segment.startMin} min, End: {tooltip.segment.endMin} min
          </div>
          <div className="tooltip-row tooltip-legacy">
            Requires operator: {tooltip.segment.requiresOperator ? "Yes" : "No"}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TimelineSvg;
