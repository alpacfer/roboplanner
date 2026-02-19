import { describe, expect, it } from "vitest";
import { deserializeScenarioData, migrateScenarioData, serializeScenarioData } from "./schema";

describe("scenario schema", () => {
  it("round-trips exported scenario data", () => {
    const serialized = serializeScenarioData({
      template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE" }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    const parsed = deserializeScenarioData(serialized);

    expect(parsed).toEqual({
      version: 2,
      template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE" }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });
  });

  it("migrates v1 requiresOperator to v2 operatorInvolvement", () => {
    const migrated = migrateScenarioData({
      version: 1,
      template: [{ id: "s1", name: "Prep", durationMin: 10, requiresOperator: true }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    expect(migrated.version).toBe(2);
    expect(migrated.template[0].operatorInvolvement).toBe("WHOLE");
  });
});
