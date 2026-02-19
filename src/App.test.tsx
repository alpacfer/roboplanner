import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App step groups", () => {
  it("exports scenario with stepGroups and step group assignments", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add group" }));
    await user.click(screen.getByRole("button", { name: "Move step 1 to previous group" }));
    await user.click(screen.getByRole("button", { name: "Export scenario" }));

    const scenarioText = (screen.getByLabelText("Scenario JSON") as HTMLTextAreaElement).value;
    const parsed = JSON.parse(scenarioText) as {
      version: number;
      stepGroups: Array<{ id: string }>;
      template: Array<{ groupId: string | null }>;
    };

    expect(parsed.version).toBe(3);
    expect(parsed.stepGroups).toHaveLength(1);
    expect(parsed.template[0].groupId).toBe(parsed.stepGroups[0].id);
  });

  it("imports scenario with groups and updates editor state", async () => {
    const user = userEvent.setup();
    render(<App />);

    const payload = JSON.stringify(
      {
        version: 3,
        template: [
          {
            id: "step-1",
            name: "Prep",
            durationMin: 10,
            operatorInvolvement: "WHOLE",
            groupId: "g1",
            color: "#ff0000",
          },
        ],
        stepGroups: [{ id: "g1", name: "Main", color: "#00ff00" }],
        runs: [{ id: "run-1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      },
      null,
      2,
    );

    await user.click(screen.getByLabelText("Scenario JSON"));
    await user.paste(payload);
    await user.click(screen.getByRole("button", { name: "Import scenario" }));

    expect(screen.getAllByTestId("template-group-card")).toHaveLength(1);
    expect(screen.getByTestId("template-state").textContent).toContain('"groupId":"g1"');
  });

  it("uses group color override on timeline after simulate", async () => {
    const user = userEvent.setup();
    render(<App />);

    const payload = JSON.stringify(
      {
        version: 3,
        template: [
          {
            id: "step-1",
            name: "Prep",
            durationMin: 10,
            operatorInvolvement: "WHOLE",
            groupId: "g1",
            color: "#ff0000",
          },
        ],
        stepGroups: [{ id: "g1", name: "Main", color: "#00ff00" }],
        runs: [{ id: "run-1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      },
      null,
      2,
    );

    await user.click(screen.getByLabelText("Scenario JSON"));
    await user.paste(payload);
    await user.click(screen.getByRole("button", { name: "Import scenario" }));
    await user.click(screen.getByRole("button", { name: "Simulate" }));

    const stepRect = screen
      .getAllByTestId("timeline-rect")
      .find((node) => node.getAttribute("data-segment-kind") === "step");
    expect(stepRect?.getAttribute("fill")).toBe("#00ff00");
  });
});
