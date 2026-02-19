import type { Run, Segment } from "../../domain/types";
import { segmentWidth, segmentX } from "./scale";
import { filterSegmentsByViewport } from "./viewport";

interface TimelineSvgProps {
  runs: Run[];
  segments: Segment[];
  pxPerMin: number;
  viewStartMin?: number;
  viewEndMin?: number;
}

const LANE_HEIGHT = 44;
const LANE_GAP = 10;
const LEFT_PAD = 120;
const RIGHT_PAD = 24;
const TOP_PAD = 18;
const BOTTOM_PAD = 18;
const BAR_HEIGHT = 28;
const LABEL_MIN_WIDTH = 56;

function TimelineSvg({ runs, segments, pxPerMin, viewStartMin = 0, viewEndMin }: TimelineSvgProps) {
  const effectiveViewEndMin =
    viewEndMin ?? (segments.length > 0 ? Math.max(...segments.map((segment) => segment.endMin)) : viewStartMin);
  const width = LEFT_PAD + (effectiveViewEndMin - viewStartMin) * pxPerMin + RIGHT_PAD;
  const height = TOP_PAD + runs.length * (LANE_HEIGHT + LANE_GAP) + BOTTOM_PAD;
  const visibleSegments = filterSegmentsByViewport(segments, viewStartMin, effectiveViewEndMin);

  return (
    <svg
      aria-label="Timeline"
      className="timeline-svg"
      data-testid="timeline-svg"
      height={height}
      role="img"
      width={Math.max(width, 400)}
    >
      {runs.map((run, laneIndex) => {
        const laneY = TOP_PAD + laneIndex * (LANE_HEIGHT + LANE_GAP);
        const runSegments = visibleSegments.filter((segment) => segment.runId === run.id);

        return (
          <g data-testid="timeline-lane" key={run.id} transform={`translate(0, ${laneY})`}>
            <text className="lane-label" x={8} y={BAR_HEIGHT / 2 + 4}>
              {run.label}
            </text>
            {runSegments.map((segment, segmentIndex) => {
              const x = segmentX(segment.startMin, viewStartMin, pxPerMin, LEFT_PAD);
              const widthPx = segmentWidth(segment.startMin, segment.endMin, pxPerMin);
              const fill =
                segment.kind === "wait"
                  ? "#9aa5b1"
                  : segment.requiresOperator
                    ? "#f57c00"
                    : "#4f7cff";

              return (
                <g key={`${segment.runId}-${segmentIndex}`}>
                  <rect
                    data-testid="timeline-rect"
                    fill={fill}
                    height={BAR_HEIGHT}
                    rx={4}
                    width={widthPx}
                    x={x}
                    y={0}
                  />
                  {widthPx >= LABEL_MIN_WIDTH ? (
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
  );
}

export default TimelineSvg;
