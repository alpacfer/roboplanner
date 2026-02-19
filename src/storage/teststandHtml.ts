import { STEP_COLOR_PRESETS } from "../domain/colors";
import type { OperatorInvolvement, Step, StepGroup } from "../domain/types";

interface ParsedTestStandSequence {
  name: string;
  steps: string[];
}

interface SequenceMarker {
  index: number;
  name: string;
}

export interface ParsedTestStandHtml {
  sequences: ParsedTestStandSequence[];
  totalSteps: number;
}

export interface BuildTestStandScenarioOptions {
  defaultDurationMin?: number;
  defaultOperatorInvolvement?: OperatorInvolvement;
}

const SEQUENCE_PATTERN = /<b>\s*sequence:\s*([\s\S]*?)<\/b>/gi;
const STEP_PATTERN = /<b>\s*step:\s*([\s\S]*?)<\/b>/gi;

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (fullMatch, entity: string) => {
    const namedEntity = NAMED_HTML_ENTITIES[entity.toLowerCase()];
    if (namedEntity) {
      return namedEntity;
    }

    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const value = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(value) ? fullMatch : String.fromCodePoint(value);
    }

    if (entity.startsWith("#")) {
      const value = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(value) ? fullMatch : String.fromCodePoint(value);
    }

    return fullMatch;
  });
}

function normalizeName(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseSequenceMarkers(input: string): SequenceMarker[] {
  const markers: SequenceMarker[] = [];
  let match: RegExpExecArray | null = null;
  SEQUENCE_PATTERN.lastIndex = 0;

  while ((match = SEQUENCE_PATTERN.exec(input)) !== null) {
    const normalized = normalizeName(match[1] ?? "");
    markers.push({
      index: match.index,
      name: normalized || `Sequence ${markers.length + 1}`,
    });
  }

  return markers;
}

export function parseTestStandHtml(input: string): ParsedTestStandHtml {
  const sequenceMarkers = parseSequenceMarkers(input);
  if (sequenceMarkers.length === 0) {
    throw new Error("TestStand HTML does not contain any sequences.");
  }

  const sequences: ParsedTestStandSequence[] = sequenceMarkers.map((sequence, index) => {
    const next = sequenceMarkers[index + 1];
    const sequenceSlice = input.slice(sequence.index, next?.index ?? input.length);
    const steps: string[] = [];
    let stepMatch: RegExpExecArray | null = null;
    STEP_PATTERN.lastIndex = 0;

    while ((stepMatch = STEP_PATTERN.exec(sequenceSlice)) !== null) {
      const normalized = normalizeName(stepMatch[1] ?? "");
      steps.push(normalized || `Step ${steps.length + 1}`);
    }

    return {
      name: sequence.name,
      steps,
    };
  });

  const totalSteps = sequences.reduce((count, sequence) => count + sequence.steps.length, 0);
  if (totalSteps === 0) {
    throw new Error("TestStand HTML does not contain any steps.");
  }

  return {
    sequences,
    totalSteps,
  };
}

function normalizeDuration(value: number | undefined): number {
  if (!Number.isInteger(value) || value === undefined || value <= 0) {
    return 10;
  }
  return value;
}

export function buildScenarioFromTestStandHtml(
  input: string,
  options: BuildTestStandScenarioOptions = {},
): { template: Step[]; stepGroups: StepGroup[] } {
  const parsed = parseTestStandHtml(input);
  const defaultDurationMin = normalizeDuration(options.defaultDurationMin);
  const defaultOperatorInvolvement = options.defaultOperatorInvolvement ?? "NONE";

  const stepGroups: StepGroup[] = parsed.sequences.map((sequence, index) => ({
    id: `group-${index + 1}`,
    name: sequence.name,
    color: STEP_COLOR_PRESETS[index % STEP_COLOR_PRESETS.length],
  }));

  const template: Step[] = [];
  let stepIndex = 1;
  parsed.sequences.forEach((sequence, sequenceIndex) => {
    const groupId = stepGroups[sequenceIndex].id;
    sequence.steps.forEach((stepName) => {
      template.push({
        id: `step-${stepIndex}`,
        name: stepName,
        durationMin: defaultDurationMin,
        operatorInvolvement: defaultOperatorInvolvement,
        groupId,
      });
      stepIndex += 1;
    });
  });

  return { template, stepGroups };
}
