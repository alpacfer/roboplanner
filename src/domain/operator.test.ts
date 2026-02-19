import { describe, expect, it } from "vitest";
import {
  mapLegacyRequiresOperator,
  needsEndCheckpoint,
  needsStartCheckpoint,
  normalizeOperatorInvolvement,
  requiresOperator,
} from "./operator";

describe("operator helpers", () => {
  it("maps legacy requiresOperator to involvement", () => {
    expect(mapLegacyRequiresOperator(true)).toBe("WHOLE");
    expect(mapLegacyRequiresOperator(false)).toBe("NONE");
    expect(mapLegacyRequiresOperator(undefined)).toBe("NONE");
  });

  it("normalizes operator involvement with legacy fallback", () => {
    expect(normalizeOperatorInvolvement({ operatorInvolvement: "START", requiresOperator: false })).toBe("START");
    expect(normalizeOperatorInvolvement({ operatorInvolvement: "END", requiresOperator: true })).toBe("END");
    expect(normalizeOperatorInvolvement({ operatorInvolvement: undefined, requiresOperator: true })).toBe("WHOLE");
    expect(normalizeOperatorInvolvement({ operatorInvolvement: undefined, requiresOperator: false })).toBe("NONE");
  });

  it("computes involvement predicates across all modes", () => {
    const modes = ["NONE", "WHOLE", "START", "END", "START_END"] as const;
    const expectedRequires = {
      NONE: false,
      WHOLE: true,
      START: true,
      END: true,
      START_END: true,
    } as const;
    const expectedStart = {
      NONE: false,
      WHOLE: true,
      START: true,
      END: false,
      START_END: true,
    } as const;
    const expectedEnd = {
      NONE: false,
      WHOLE: true,
      START: false,
      END: true,
      START_END: true,
    } as const;

    for (const mode of modes) {
      expect(requiresOperator(mode)).toBe(expectedRequires[mode]);
      expect(needsStartCheckpoint(mode)).toBe(expectedStart[mode]);
      expect(needsEndCheckpoint(mode)).toBe(expectedEnd[mode]);
    }
  });
});
