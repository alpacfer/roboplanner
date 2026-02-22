import { mapLegacyRequiresOperator } from "../domain/operator";
import type { OperatorInvolvement, PlanSettings, Run, SharedResource, Step, StepGroup } from "../domain/types";

export const SCENARIO_SCHEMA_VERSION = 3;

export interface ScenarioDataV2 {
  version: 2;
  template: Array<Omit<Step, "groupId">>;
  runs: Run[];
  settings: PlanSettings;
}

export interface ScenarioDataV3 {
  version: typeof SCENARIO_SCHEMA_VERSION;
  template: Step[];
  stepGroups: StepGroup[];
  runs: Run[];
  settings: PlanSettings;
  sharedResources: SharedResource[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidOperatorInvolvement(value: unknown): value is OperatorInvolvement {
  return (
    value === "NONE" ||
    value === "WHOLE" ||
    value === "START" ||
    value === "END" ||
    value === "START_END"
  );
}

function isValidHexColor(value: unknown): boolean {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isValidStepV2(value: unknown): value is Omit<Step, "groupId"> {
  if (!isObject(value)) {
    return false;
  }

  const colorValid = typeof value.color === "undefined" || isValidHexColor(value.color);
  return (
    typeof value.id === "string" &&
    isNonEmptyString(value.name) &&
    isInteger(value.durationMin) &&
    value.durationMin > 0 &&
    isValidOperatorInvolvement(value.operatorInvolvement) &&
    colorValid
  );
}

function isValidStepV3(value: unknown): value is Step {
  if (!isObject(value) || !isValidStepV2(value)) {
    return false;
  }

  const groupId = (value as Record<string, unknown>).groupId;
  return groupId === null || typeof groupId === "string";
}

function isValidStepGroup(value: unknown): value is StepGroup {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.id === "string" && isNonEmptyString(value.name) && isValidHexColor(value.color);
}

function isValidRun(value: unknown): value is Run {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    isNonEmptyString(value.label) &&
    isInteger(value.startMin) &&
    value.startMin >= 0 &&
    typeof value.templateId === "string"
  );
}

function isValidPlanSettings(value: unknown): value is PlanSettings {
  if (!isObject(value)) {
    return false;
  }
  return (
    isInteger(value.operatorCapacity) &&
    value.operatorCapacity > 0 &&
    value.queuePolicy === "FIFO"
  );
}

function isValidSharedResource(value: unknown): value is SharedResource {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.id === "string" && isNonEmptyString(value.name) && isInteger(value.quantity) && value.quantity > 0;
}

export function serializeScenarioData(input: Omit<ScenarioDataV3, "version">): string {
  const payload: ScenarioDataV3 = {
    version: SCENARIO_SCHEMA_VERSION,
    template: input.template,
    stepGroups: input.stepGroups,
    runs: input.runs,
    settings: input.settings,
    sharedResources: input.sharedResources,
  };

  return JSON.stringify(payload, null, 2);
}

function isLegacyStep(value: unknown): value is Omit<Step, "operatorInvolvement" | "groupId"> & {
  requiresOperator: boolean;
} {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    isNonEmptyString(value.name) &&
    isInteger(value.durationMin) &&
    value.durationMin > 0 &&
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
    groupId: null,
    color: step.color,
  }));
}

function normalizeTemplateWithFallback(template: Step[] | Array<Omit<Step, "groupId">>): Step[] {
  return template.map((step) => ({
    ...step,
    operatorInvolvement: (step.operatorInvolvement ?? "NONE") as OperatorInvolvement,
    groupId:
      "groupId" in step && (typeof step.groupId === "string" || step.groupId === null) ? step.groupId : null,
  }));
}

function hasUniqueIds<T extends { id: string }>(records: T[]): boolean {
  return new Set(records.map((record) => record.id)).size === records.length;
}

function ensureValidScenarioReferences(
  template: Step[],
  stepGroups: StepGroup[],
  runs: Run[],
  sharedResources: SharedResource[],
) {
  if (!hasUniqueIds(template)) {
    throw new Error("Scenario payload has duplicate template step ids.");
  }

  if (!hasUniqueIds(stepGroups)) {
    throw new Error("Scenario payload has duplicate step group ids.");
  }

  if (!hasUniqueIds(runs)) {
    throw new Error("Scenario payload has duplicate run ids.");
  }

  if (!hasUniqueIds(sharedResources)) {
    throw new Error("Scenario payload has duplicate shared resource ids.");
  }

  const groupIds = new Set(stepGroups.map((group) => group.id));
  for (const step of template) {
    if (step.groupId !== null && !groupIds.has(step.groupId)) {
      throw new Error("Scenario payload has invalid template data.");
    }
  }
}

export function migrateScenarioData(raw: unknown): ScenarioDataV3 {
  if (!isObject(raw)) {
    throw new Error("Scenario payload must be a JSON object.");
  }

  const { template, runs, settings } = raw;
  const version = raw.version;
  if (version !== 1 && version !== 2 && version !== SCENARIO_SCHEMA_VERSION) {
    throw new Error(`Unsupported scenario version: ${String(raw.version)}.`);
  }

  let normalizedTemplate: Step[];
  let stepGroups: StepGroup[] = [];
  let sharedResources: SharedResource[] = [];

  if (version === 1) {
    if (!Array.isArray(template)) {
      throw new Error("Scenario payload has invalid template data.");
    }
    normalizedTemplate = migrateLegacyTemplate(template);
  } else if (version === 2) {
    if (!Array.isArray(template) || !template.every((step) => isValidStepV2(step))) {
      throw new Error("Scenario payload has invalid template data.");
    }
    normalizedTemplate = normalizeTemplateWithFallback(template);
  } else {
    if (!Array.isArray(template) || !template.every((step) => isValidStepV3(step))) {
      throw new Error("Scenario payload has invalid template data.");
    }
    if (!Array.isArray(raw.stepGroups) || !raw.stepGroups.every((group) => isValidStepGroup(group))) {
      throw new Error("Scenario payload has invalid stepGroups data.");
    }
    normalizedTemplate = normalizeTemplateWithFallback(template);
    stepGroups = raw.stepGroups;

    if (typeof raw.sharedResources !== "undefined") {
      if (!Array.isArray(raw.sharedResources) || !raw.sharedResources.every((resource) => isValidSharedResource(resource))) {
        throw new Error("Scenario payload has invalid sharedResources data.");
      }
      sharedResources = raw.sharedResources;
    }
  }

  if (version !== SCENARIO_SCHEMA_VERSION && normalizedTemplate.length === 0) {
    throw new Error("Scenario payload has invalid template data.");
  }

  if (!Array.isArray(runs) || !runs.every((run) => isValidRun(run))) {
    throw new Error("Scenario payload has invalid runs data.");
  }

  if (runs.length === 0) {
    throw new Error("Scenario payload has invalid runs data.");
  }

  if (!isValidPlanSettings(settings)) {
    throw new Error("Scenario payload has invalid settings data.");
  }

  ensureValidScenarioReferences(normalizedTemplate, stepGroups, runs, sharedResources);

  return {
    version: SCENARIO_SCHEMA_VERSION,
    template: normalizedTemplate,
    stepGroups,
    runs,
    settings,
    sharedResources,
  };
}

export function deserializeScenarioData(input: string): ScenarioDataV3 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Scenario payload is not valid JSON.");
  }

  return migrateScenarioData(parsed);
}
