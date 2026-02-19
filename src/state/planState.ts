import type { Plan } from "../domain/types";

export const defaultPlan: Plan = {
  id: "plan-default",
  name: "Default Plan",
  template: [
    {
      id: "step-1",
      name: "Prep",
      durationMin: 10,
      requiresOperator: true,
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
