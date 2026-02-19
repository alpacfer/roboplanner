import { describe, expect, it } from "vitest";
import type { Segment } from "../../domain/types";
import { filterSegmentsByViewport } from "./viewport";

describe("filterSegmentsByViewport", () => {
  it("excludes segments fully outside the viewport", () => {
    const segments: Segment[] = [
      { runId: "R1", name: "A", startMin: 0, endMin: 10, kind: "step", requiresOperator: false },
      { runId: "R1", name: "B", startMin: 15, endMin: 25, kind: "step", requiresOperator: false },
      { runId: "R1", name: "C", startMin: 30, endMin: 40, kind: "step", requiresOperator: false },
    ];

    const visible = filterSegmentsByViewport(segments, 12, 28);

    expect(visible).toHaveLength(1);
    expect(visible[0].name).toBe("B");
  });
});
