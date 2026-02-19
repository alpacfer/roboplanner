import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deserializeScenarioData, migrateScenarioData } from "./schema";

const validPayload = {
  version: 3 as const,
  template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE" as const, groupId: null }],
  stepGroups: [],
  runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
  settings: { operatorCapacity: 1, queuePolicy: "FIFO" as const },
};

describe("scenario schema robustness (property-based)", () => {
  it("rejects unsupported schema versions", () => {
    fc.assert(
      fc.property(fc.integer().filter((version) => version !== 1 && version !== 2 && version !== 3), (version) => {
        expect(() =>
          migrateScenarioData({
            ...validPayload,
            version,
          }),
        ).toThrow(`Unsupported scenario version: ${String(version)}.`);
      }),
      { numRuns: 80 },
    );
  });

  it("rejects payloads missing required fields", () => {
    fc.assert(
      fc.property(fc.constantFrom("template", "stepGroups", "runs", "settings"), (missingKey) => {
        const mutated = { ...validPayload } as Record<string, unknown>;
        delete mutated[missingKey];
        expect(() => migrateScenarioData(mutated)).toThrow();
      }),
      { numRuns: 60 },
    );
  });

  it("rejects malformed JSON text", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(() => deserializeScenarioData(`${raw}{`)).toThrow("Scenario payload is not valid JSON.");
      }),
      { numRuns: 80 },
    );
  });
});
