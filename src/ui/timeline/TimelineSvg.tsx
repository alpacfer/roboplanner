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

interface TooltipState {
  x: number;
  y: number;
  segment: Segment;
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
                const x = segmentX(segment.startMin, viewStartMin, pxPerMin, TIMELINE_LEFT_PAD);
                const widthPx = segmentWidth(segment.startMin, segment.endMin, pxPerMin);
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
                    {segment.requiresOperator && segment.kind === "step" ? (
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
                    {canRenderLabel(segment.name, widthPx) ? (
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
          <div>{tooltip.segment.name}</div>
          <div>
            Start: {tooltip.segment.startMin} min, End: {tooltip.segment.endMin} min
          </div>
          <div>Requires operator: {tooltip.segment.requiresOperator ? "Yes" : "No"}</div>
        </div>
      ) : null}
    </div>
  );
}

export default TimelineSvg;
