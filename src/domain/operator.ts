import type { OperatorInvolvement, Step } from "./types";

export function mapLegacyRequiresOperator(requiresOperator: boolean | undefined): OperatorInvolvement {
  return requiresOperator ? "WHOLE" : "NONE";
}

export function normalizeOperatorInvolvement(step: Pick<Step, "operatorInvolvement" | "requiresOperator">): OperatorInvolvement {
  return step.operatorInvolvement ?? mapLegacyRequiresOperator(step.requiresOperator);
}

export function requiresOperator(involvement: OperatorInvolvement): boolean {
  return involvement !== "NONE";
}

export function needsStartCheckpoint(involvement: OperatorInvolvement): boolean {
  return involvement === "WHOLE" || involvement === "START" || involvement === "START_END";
}

export function needsEndCheckpoint(involvement: OperatorInvolvement): boolean {
  return involvement === "WHOLE" || involvement === "END" || involvement === "START_END";
}
