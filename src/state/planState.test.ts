import { describe, expect, it } from "vitest";
import { defaultPlan } from "./planState";

describe("default plan", () => {
  it("matches expected object shape", () => {
    expect(defaultPlan).toMatchInlineSnapshot(`
      {
        "id": "plan-default",
        "name": "Default Plan",
        "runs": [
          {
            "id": "run-1",
            "label": "R1",
            "startMin": 0,
            "templateId": "plan-default",
          },
        ],
        "settings": {
          "operatorCapacity": 1,
          "queuePolicy": "FIFO",
        },
        "template": [
          {
            "color": "#4f7cff",
            "durationMin": 10,
            "id": "step-1",
            "name": "Prep",
            "requiresOperator": true,
          },
        ],
      }
    `);
  });
});
