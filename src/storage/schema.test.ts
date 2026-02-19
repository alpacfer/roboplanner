import { describe, expect, it } from "vitest";
import { deserializeScenarioData, migrateScenarioData, serializeScenarioData } from "./schema";

describe("scenario schema", () => {
  it("round-trips exported v3 scenario data with groups", () => {
    const serialized = serializeScenarioData({
      template: [
        { id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: "g1" },
        { id: "s2", name: "Measure", durationMin: 5, operatorInvolvement: "NONE", groupId: null },
      ],
      stepGroups: [{ id: "g1", name: "Main", color: "#4e79a7" }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    const parsed = deserializeScenarioData(serialized);

    expect(parsed).toEqual({
      version: 3,
      template: [
        { id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: "g1" },
        { id: "s2", name: "Measure", durationMin: 5, operatorInvolvement: "NONE", groupId: null },
      ],
      stepGroups: [{ id: "g1", name: "Main", color: "#4e79a7" }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });
  });

  it("migrates v1 requiresOperator to v3 with no groups", () => {
    const migrated = migrateScenarioData({
      version: 1,
      template: [{ id: "s1", name: "Prep", durationMin: 10, requiresOperator: true }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    expect(migrated.version).toBe(3);
    expect(migrated.template[0].operatorInvolvement).toBe("WHOLE");
    expect(migrated.template[0].groupId).toBeNull();
    expect(migrated.stepGroups).toEqual([]);
  });

  it("migrates v2 to v3 and assigns null groupId", () => {
    const migrated = migrateScenarioData({
      version: 2,
      template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE" }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    expect(migrated.version).toBe(3);
    expect(migrated.template[0].groupId).toBeNull();
    expect(migrated.stepGroups).toEqual([]);
  });

  it("rejects payload with unknown step group reference", () => {
    expect(() =>
      migrateScenarioData({
        version: 3,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: "missing" }],
        stepGroups: [{ id: "g1", name: "Main", color: "#4e79a7" }],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid template data.");
  });

  it("rejects payload with invalid group color", () => {
    expect(() =>
      migrateScenarioData({
        version: 3,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: "g1" }],
        stepGroups: [{ id: "g1", name: "Main", color: "red" }],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid stepGroups data.");
  });
});
