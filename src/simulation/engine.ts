import type { Plan, Segment } from "../domain/types";

export function scheduleLinear(plan: Plan): Segment[] {
  const segments: Segment[] = [];

  for (const run of plan.runs) {
    let currentMin = run.startMin;

    for (const step of plan.template) {
      const segment: Segment = {
        runId: run.id,
        name: step.name,
        startMin: currentMin,
        endMin: currentMin + step.durationMin,
        kind: "step",
        requiresOperator: step.requiresOperator,
      };

      segments.push(segment);
      currentMin = segment.endMin;
    }
  }

  return segments;
}
