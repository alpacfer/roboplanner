import type { PlanSettings, Run, Step } from "../domain/types";

export interface ScenarioDataV1 {
  version: 1;
  template: Step[];
  runs: Run[];
  settings: PlanSettings;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidStep(value: unknown): value is Step {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.durationMin === "number" &&
    typeof value.requiresOperator === "boolean"
  );
}

function isValidRun(value: unknown): value is Run {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.startMin === "number" &&
    typeof value.templateId === "string"
  );
}

function isValidPlanSettings(value: unknown): value is PlanSettings {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.operatorCapacity === "number" &&
    (value.queuePolicy === "FIFO" || value.queuePolicy === "SPT" || value.queuePolicy === "PRIORITY")
  );
}

export function serializeScenarioData(input: Omit<ScenarioDataV1, "version">): string {
  const payload: ScenarioDataV1 = {
    version: 1,
    template: input.template,
    runs: input.runs,
    settings: input.settings,
  };

  return JSON.stringify(payload, null, 2);
}

export function migrateScenarioData(raw: unknown): ScenarioDataV1 {
  if (!isObject(raw)) {
    throw new Error("Scenario payload must be a JSON object.");
  }

  if (raw.version !== 1) {
    throw new Error(`Unsupported scenario version: ${String(raw.version)}.`);
  }

  const { template, runs, settings } = raw;

  if (!Array.isArray(template) || !template.every((step) => isValidStep(step))) {
    throw new Error("Scenario payload has invalid template data.");
  }

  if (!Array.isArray(runs) || !runs.every((run) => isValidRun(run))) {
    throw new Error("Scenario payload has invalid runs data.");
  }

  if (!isValidPlanSettings(settings)) {
    throw new Error("Scenario payload has invalid settings data.");
  }

  return {
    version: 1,
    template,
    runs,
    settings,
  };
}

export function deserializeScenarioData(input: string): ScenarioDataV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Scenario payload is not valid JSON.");
  }

  return migrateScenarioData(parsed);
}
