import { describe, expect, it } from "vitest";
import { SCENARIO_SCHEMA_VERSION, deserializeScenarioData, migrateScenarioData, serializeScenarioData } from "./schema";

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
      sharedResources: [{ id: "resource-1", name: "Robot arm", quantity: 2 }],
    });

    const parsed = deserializeScenarioData(serialized);

    expect(parsed).toEqual({
      version: SCENARIO_SCHEMA_VERSION,
      template: [
        { id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: "g1" },
        { id: "s2", name: "Measure", durationMin: 5, operatorInvolvement: "NONE", groupId: null },
      ],
      stepGroups: [{ id: "g1", name: "Main", color: "#4e79a7" }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      sharedResources: [{ id: "resource-1", name: "Robot arm", quantity: 2 }],
    });
  });

  it("migrates v1 requiresOperator to v3 with no groups", () => {
    const migrated = migrateScenarioData({
      version: 1,
      template: [{ id: "s1", name: "Prep", durationMin: 10, requiresOperator: true }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    expect(migrated.version).toBe(SCENARIO_SCHEMA_VERSION);
    expect(migrated.template[0].operatorInvolvement).toBe("WHOLE");
    expect(migrated.template[0].groupId).toBeNull();
    expect(migrated.stepGroups).toEqual([]);
    expect(migrated.sharedResources).toEqual([]);
  });

  it("migrates v2 to v3 and assigns null groupId", () => {
    const migrated = migrateScenarioData({
      version: 2,
      template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE" }],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    expect(migrated.version).toBe(SCENARIO_SCHEMA_VERSION);
    expect(migrated.template[0].groupId).toBeNull();
    expect(migrated.stepGroups).toEqual([]);
    expect(migrated.sharedResources).toEqual([]);
  });

  it("rejects payload with invalid sharedResources data", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
        sharedResources: [{ id: "resource-1", name: "Robot arm", quantity: 0 }],
      }),
    ).toThrow("Scenario payload has invalid sharedResources data.");
  });

  it("rejects payload with duplicate shared resource ids", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
        sharedResources: [
          { id: "resource-1", name: "Robot arm", quantity: 1 },
          { id: "resource-1", name: "Fixture", quantity: 1 },
        ],
      }),
    ).toThrow("Scenario payload has duplicate shared resource ids.");
  });

  it("rejects payload with unknown step group reference", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
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
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: "g1" }],
        stepGroups: [{ id: "g1", name: "Main", color: "red" }],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid stepGroups data.");
  });

  it("rejects payload with non-integer step duration", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10.5, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid template data.");
  });

  it("rejects payload with non-integer run start", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [{ id: "r1", label: "R1", startMin: 0.25, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid runs data.");
  });

  it("rejects payload with non-integer operator capacity", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1.5, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid settings data.");
  });

  it("rejects payload with queuePolicy values other than FIFO", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "SPT" },
      }),
    ).toThrow("Scenario payload has invalid settings data.");
  });

  it("accepts v3 payload with empty template", () => {
    const migrated = migrateScenarioData({
      version: SCENARIO_SCHEMA_VERSION,
      template: [],
      stepGroups: [],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    expect(migrated.template).toEqual([]);
  });

  it("rejects payload with empty runs", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid runs data.");
  });

  it("rejects payload with duplicate step ids", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [
          { id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null },
          { id: "s1", name: "Measure", durationMin: 10, operatorInvolvement: "NONE", groupId: null },
        ],
        stepGroups: [],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has duplicate template step ids.");
  });

  it("rejects payload with duplicate run ids", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [
          { id: "r1", label: "R1", startMin: 0, templateId: "plan-default" },
          { id: "r1", label: "R2", startMin: 1, templateId: "plan-default" },
        ],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has duplicate run ids.");
  });

  it("rejects payload with empty names", () => {
    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: " ", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid template data.");

    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
        stepGroups: [],
        runs: [{ id: "r1", label: " ", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid runs data.");

    expect(() =>
      migrateScenarioData({
        version: SCENARIO_SCHEMA_VERSION,
        template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: "g1" }],
        stepGroups: [{ id: "g1", name: " ", color: "#4e79a7" }],
        runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      }),
    ).toThrow("Scenario payload has invalid stepGroups data.");
  });
});
