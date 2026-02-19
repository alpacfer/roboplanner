import type { PlanSettings, Run, Step, StepGroup } from "./types";
import { normalizeOperatorInvolvement } from "./operator";

export function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function isNonEmptyName(value: string): boolean {
  return value.trim().length > 0;
}

export function validateStep(step: Step): string[] {
  const errors: string[] = [];

  if (!isNonEmptyName(step.name)) {
    errors.push("Step name is required.");
  }

  if (!isPositiveInteger(step.durationMin)) {
    errors.push("Step durationMin must be an integer greater than 0.");
  }

  const involvement = normalizeOperatorInvolvement(step);
  if (!["NONE", "WHOLE", "START", "END", "START_END"].includes(involvement)) {
    errors.push("Step operator involvement is invalid.");
  }

  return errors;
}

export function validateTemplateSteps(steps: Step[]): string[][] {
  const nameCounts = new Map<string, number>();

  for (const step of steps) {
    const normalizedName = step.name.trim().toLowerCase();
    if (!normalizedName) {
      continue;
    }
    nameCounts.set(normalizedName, (nameCounts.get(normalizedName) ?? 0) + 1);
  }

  return steps.map((step) => {
    const errors = validateStep(step);
    const normalizedName = step.name.trim().toLowerCase();

    if (normalizedName && (nameCounts.get(normalizedName) ?? 0) > 1) {
      errors.push("Step name must be unique.");
    }

    return errors;
  });
}

export function validateStepGroups(groups: StepGroup[]): string[][] {
  const nameCounts = new Map<string, number>();

  for (const group of groups) {
    const normalizedName = group.name.trim().toLowerCase();
    if (!normalizedName) {
      continue;
    }
    nameCounts.set(normalizedName, (nameCounts.get(normalizedName) ?? 0) + 1);
  }

  return groups.map((group) => {
    const errors: string[] = [];
    const normalizedName = group.name.trim().toLowerCase();

    if (!normalizedName) {
      errors.push("Group name is required.");
    }

    if (normalizedName && (nameCounts.get(normalizedName) ?? 0) > 1) {
      errors.push("Group name must be unique.");
    }

    return errors;
  });
}

export function validateRun(run: Run): string[] {
  const errors: string[] = [];

  if (!isNonEmptyName(run.label)) {
    errors.push("Run label is required.");
  }

  if (!isNonNegativeInteger(run.startMin)) {
    errors.push("Run startMin must be an integer greater than or equal to 0.");
  }

  return errors;
}

export function validatePlanSettings(settings: PlanSettings): string[] {
  const errors: string[] = [];

  if (!isPositiveInteger(settings.operatorCapacity)) {
    errors.push("Operator capacity must be an integer greater than or equal to 1.");
  }

  return errors;
}
