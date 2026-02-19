import { describe, expect, it } from "vitest";
import { segmentWidth, segmentX } from "./scale";

describe("timeline scale", () => {
  it("zoom scaling changes x and width with pxPerMin", () => {
    const x1 = segmentX(10, 0, 2);
    const w1 = segmentWidth(10, 40, 2);
    const x2 = segmentX(10, 0, 4);
    const w2 = segmentWidth(10, 40, 4);

    expect(x2).toBe(120 + (x1 - 120) * 2);
    expect(w2).toBe(w1 * 2);
  });
});
