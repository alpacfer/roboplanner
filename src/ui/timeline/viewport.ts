import type { Segment } from "../../domain/types";

export function intersectsWindow(segment: Segment, viewStartMin: number, viewEndMin: number): boolean {
  return segment.endMin > viewStartMin && segment.startMin < viewEndMin;
}

export function filterSegmentsByViewport(
  segments: Segment[],
  viewStartMin: number,
  viewEndMin: number,
): Segment[] {
  return segments.filter((segment) => intersectsWindow(segment, viewStartMin, viewEndMin));
}
