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
      requiresOperator: true,
      color: DEFAULT_STEP_COLOR,
    },
  ],
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

export function createInitialPlans(): Plan[] {
  return [defaultPlan];
}
