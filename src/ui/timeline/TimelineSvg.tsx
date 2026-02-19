import { useState } from "react";
import { DEFAULT_STEP_COLOR } from "../../domain/colors";
import type { Run, Segment } from "../../domain/types";
import { segmentWidth, segmentX } from "./scale";
import { filterSegmentsByViewport } from "./viewport";

interface TimelineSvgProps {
  runs: Run[];
  segments: Segment[];
  stepColorsById?: Record<string, string>;
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

interface TooltipState {
  x: number;
  y: number;
  segment: Segment;
}

interface CheckpointPresence {
  hasStart: boolean;
  hasEnd: boolean;
}

interface StepLayout {
  startCheckpointWidth: number;
  endCheckpointWidth: number;
  stepWidth: number;
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

function axisTickStep(viewStartMin: number, viewEndMin: number, pxPerMin: number): number {
  const span = Math.max(1, viewEndMin - viewStartMin);
  const roughByCount = span / 8;
  const roughByPixels = MIN_AXIS_LABEL_SPACING_PX / Math.max(pxPerMin, 0.0001);
  const rough = Math.max(1, roughByCount, roughByPixels);
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
  const step = axisTickStep(viewStartMin, viewEndMin, pxPerMin);
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

function stepKey(runId: string, stepId: string): string {
  return `${runId}::${stepId}`;
}

function buildCheckpointPresence(segments: Segment[]): Map<string, CheckpointPresence> {
  const presence = new Map<string, CheckpointPresence>();
  for (const segment of segments) {
    if (segment.kind !== "operator_checkpoint" || !segment.stepId) {
      continue;
    }
    const key = stepKey(segment.runId, segment.stepId);
    const current = presence.get(key) ?? { hasStart: false, hasEnd: false };
    if (segment.operatorPhase === "START") {
      current.hasStart = true;
    }
    if (segment.operatorPhase === "END") {
      current.hasEnd = true;
    }
    presence.set(key, current);
  }
  return presence;
}

function buildStepSpans(segments: Segment[]): Map<string, { startMin: number; endMin: number }> {
  const stepSpans = new Map<string, { startMin: number; endMin: number }>();
  for (const segment of segments) {
    if (segment.kind !== "step" || !segment.stepId) {
      continue;
    }
    stepSpans.set(stepKey(segment.runId, segment.stepId), {
      startMin: segment.startMin,
      endMin: segment.endMin,
    });
  }
  return stepSpans;
}

function computeStepLayout(
  rawWidthPx: number,
  hasStartCheckpoint: boolean,
  hasEndCheckpoint: boolean,
): StepLayout {
  let startCheckpointWidth = hasStartCheckpoint ? CHECKPOINT_WIDTH_PX : 0;
  let endCheckpointWidth = hasEndCheckpoint ? CHECKPOINT_WIDTH_PX : 0;
  const markerTotal = startCheckpointWidth + endCheckpointWidth;
  const markerBudget = Math.max(0, rawWidthPx - MIN_STEP_WIDTH_PX);

  if (markerTotal > markerBudget && markerTotal > 0) {
    const ratio = markerBudget / markerTotal;
    startCheckpointWidth *= ratio;
    endCheckpointWidth *= ratio;
  }

  return {
    startCheckpointWidth,
    endCheckpointWidth,
    stepWidth: Math.max(MIN_STEP_WIDTH_PX, rawWidthPx - startCheckpointWidth - endCheckpointWidth),
  };
}

function TimelineSvg({
  runs,
  segments,
  stepColorsById = {},
  pxPerMin,
  viewStartMin = 0,
  viewEndMin,
}: TimelineSvgProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const effectiveViewEndMin =
    viewEndMin ?? (segments.length > 0 ? Math.max(...segments.map((segment) => segment.endMin)) : viewStartMin);
  const width = TIMELINE_LEFT_PAD + (effectiveViewEndMin - viewStartMin) * pxPerMin + TIMELINE_RIGHT_PAD;
  const height = TOP_PAD + AXIS_HEIGHT + runs.length * (LANE_HEIGHT + LANE_GAP) + BOTTOM_PAD;
  const visibleSegments = filterSegmentsByViewport(segments, viewStartMin, effectiveViewEndMin);
  const checkpointPresenceByStep = buildCheckpointPresence(segments);
  const stepSpansByStep = buildStepSpans(segments);
  const axisTicks = buildAxisTicks(viewStartMin, effectiveViewEndMin, pxPerMin);

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

          return (
            <g data-testid="timeline-lane" key={run.id} transform={`translate(0, ${laneY})`}>
              <text className="lane-label" x={8} y={BAR_HEIGHT / 2 + 4}>
                {run.label}
              </text>
              {runSegments.map((segment, segmentIndex) => {
                const xRaw = segmentX(segment.startMin, viewStartMin, pxPerMin, TIMELINE_LEFT_PAD);
                const widthPxRaw = segmentWidth(segment.startMin, segment.endMin, pxPerMin);
                let x = xRaw;
                let widthPx = widthPxRaw;

                if (segment.kind === "step" && segment.stepId) {
                  const presence = checkpointPresenceByStep.get(stepKey(segment.runId, segment.stepId));
                  const layout = computeStepLayout(
                    widthPxRaw,
                    presence?.hasStart ?? false,
                    presence?.hasEnd ?? false,
                  );
                  x = xRaw + layout.startCheckpointWidth;
                  widthPx = layout.stepWidth;
                } else if (segment.kind === "operator_checkpoint") {
                  let markerWidth = CHECKPOINT_WIDTH_PX;
                  if (segment.stepId) {
                    const key = stepKey(segment.runId, segment.stepId);
                    const presence = checkpointPresenceByStep.get(key);
                    const span = stepSpansByStep.get(key);
                    if (presence && span) {
                      const stepRawWidth = segmentWidth(span.startMin, span.endMin, pxPerMin);
                      const layout = computeStepLayout(stepRawWidth, presence.hasStart, presence.hasEnd);
                      if (segment.operatorPhase === "START") {
                        markerWidth = Math.max(1, layout.startCheckpointWidth);
                        x = segmentX(span.startMin, viewStartMin, pxPerMin, TIMELINE_LEFT_PAD);
                      } else if (segment.operatorPhase === "END") {
                        markerWidth = Math.max(1, layout.endCheckpointWidth);
                        const endX = segmentX(span.endMin, viewStartMin, pxPerMin, TIMELINE_LEFT_PAD);
                        x = endX - markerWidth;
                      }
                    }
                  }
                  widthPx = Math.max(1, markerWidth);
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
                        setTooltip({
                          x: event.clientX,
                          y: event.clientY,
                          segment,
                        });
                      }}
                      onMouseMove={(event) => {
                        setTooltip((current) =>
                          current
                            ? {
                                ...current,
                                x: event.clientX,
                                y: event.clientY,
                              }
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
          className="timeline-tooltip"
          data-testid="timeline-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
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
