import { describe, expect, it } from "vitest";
import { deserializeScenarioData, migrateScenarioData, serializeScenarioData } from "./schema";

describe("scenario schema", () => {
  it("round-trips exported scenario data", () => {
    const serialized = serializeScenarioData({
      template: [{ id: "s1", name: "Prep", durationMin: 10, requiresOperator: true }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    const parsed = deserializeScenarioData(serialized);

    expect(parsed).toEqual({
      version: 1,
      template: [{ id: "s1", name: "Prep", durationMin: 10, requiresOperator: true }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });
  });

  it("has schema migration stub with version check", () => {
    expect(() =>
      migrateScenarioData({
        version: 99,
        template: [],
        runs: [],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Unsupported scenario version: 99.");
  });
});
