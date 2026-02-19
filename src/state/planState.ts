import type { Plan } from "../domain/types";
import { DEFAULT_STEP_COLOR } from "../domain/colors";

export const defaultPlan: Plan = {
  id: "plan-default",
  name: "Default Plan",
  template: [
    {
      id: "step-1",
      name: "Prep",
      durationMin: 10,
      operatorInvolvement: "WHOLE",
      groupId: null,
      color: DEFAULT_STEP_COLOR,
    },
  ],
  stepGroups: [],
  runs: [
    {
      id: "run-1",
      label: "R1",
      startMin: 0,
      templateId: "plan-default",
    },
  ],
  settings: {
    operatorCapacity: 1,
    queuePolicy: "FIFO",
  },
};

function clonePlan(plan: Plan): Plan {
  return {
    ...plan,
    template: plan.template.map((step) => ({ ...step })),
    stepGroups: plan.stepGroups.map((group) => ({ ...group })),
    runs: plan.runs.map((run) => ({ ...run })),
    settings: { ...plan.settings },
  };
}

export function createInitialPlans(): Plan[] {
  return [clonePlan(defaultPlan)];
}
