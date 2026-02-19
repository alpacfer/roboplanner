import type { Segment } from "../../domain/types";

export function intersectsWindow(segment: Segment, viewStartMin: number, viewEndMin: number): boolean {
  if (segment.kind === "operator_checkpoint") {
    return segment.startMin >= viewStartMin && segment.startMin <= viewEndMin;
  }
  return segment.endMin > viewStartMin && segment.startMin < viewEndMin;
}

export function filterSegmentsByViewport(
  segments: Segment[],
  viewStartMin: number,
  viewEndMin: number,
): Segment[] {
  return segments.filter((segment) => intersectsWindow(segment, viewStartMin, viewEndMin));
}
