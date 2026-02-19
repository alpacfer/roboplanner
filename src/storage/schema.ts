import { mapLegacyRequiresOperator } from "../domain/operator";
import type { OperatorInvolvement, PlanSettings, Run, Step } from "../domain/types";

export interface ScenarioDataV2 {
  version: 2;
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
  const involvementValid =
    value.operatorInvolvement === "NONE" ||
    value.operatorInvolvement === "WHOLE" ||
    value.operatorInvolvement === "START" ||
    value.operatorInvolvement === "END" ||
    value.operatorInvolvement === "START_END";

  const colorValid =
    typeof value.color === "undefined" ||
    (typeof value.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(value.color));
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.durationMin === "number" &&
    involvementValid &&
    colorValid
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

export function serializeScenarioData(input: Omit<ScenarioDataV2, "version">): string {
  const payload: ScenarioDataV2 = {
    version: 2,
    template: input.template,
    runs: input.runs,
    settings: input.settings,
  };

  return JSON.stringify(payload, null, 2);
}

function isLegacyStep(value: unknown): value is Omit<Step, "operatorInvolvement"> & { requiresOperator: boolean } {
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

function migrateLegacyTemplate(template: unknown[]): Step[] {
  if (!template.every((step) => isLegacyStep(step))) {
    throw new Error("Scenario payload has invalid template data.");
  }

  return template.map((step) => ({
    id: step.id,
    name: step.name,
    durationMin: step.durationMin,
    operatorInvolvement: mapLegacyRequiresOperator(step.requiresOperator),
    color: step.color,
  }));
}

export function migrateScenarioData(raw: unknown): ScenarioDataV2 {
  if (!isObject(raw)) {
    throw new Error("Scenario payload must be a JSON object.");
  }

  const { template, runs, settings } = raw;

  if (raw.version !== 1 && raw.version !== 2) {
    throw new Error(`Unsupported scenario version: ${String(raw.version)}.`);
  }

  let normalizedTemplate: Step[];
  if (raw.version === 1) {
    if (!Array.isArray(template)) {
      throw new Error("Scenario payload has invalid template data.");
    }
    normalizedTemplate = migrateLegacyTemplate(template);
  } else {
    if (!Array.isArray(template) || !template.every((step) => isValidStep(step))) {
      throw new Error("Scenario payload has invalid template data.");
    }
    normalizedTemplate = template;
  }

  const normalizedTemplateWithFallback = normalizedTemplate.map((step) => ({
    ...step,
    operatorInvolvement: (step.operatorInvolvement ?? "NONE") as OperatorInvolvement,
  }));

  if (!Array.isArray(runs) || !runs.every((run) => isValidRun(run))) {
    throw new Error("Scenario payload has invalid runs data.");
  }

  if (!isValidPlanSettings(settings)) {
    throw new Error("Scenario payload has invalid settings data.");
  }

  return {
    version: 2,
    template: normalizedTemplateWithFallback,
    runs,
    settings,
  };
}

export function deserializeScenarioData(input: string): ScenarioDataV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Scenario payload is not valid JSON.");
  }

  return migrateScenarioData(parsed);
}
