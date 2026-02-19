import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { Step } from "../../domain/types";
import TemplateEditor from "./TemplateEditor";

const initialSteps: Step[] = [
  {
    id: "step-1",
    name: "Prep",
    durationMin: 10,
    requiresOperator: true,
  },
];

function TestHarness() {
  const [steps, setSteps] = useState<Step[]>(initialSteps);

  return (
    <>
      <TemplateEditor steps={steps} onChange={setSteps} />
      <pre data-testid="steps-state">{JSON.stringify(steps)}</pre>
    </>
  );
}

describe("TemplateEditor", () => {
  it("adding a step adds a row", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    expect(screen.getAllByTestId("step-row")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Add step" }));
    expect(screen.getAllByTestId("step-row")).toHaveLength(2);
  });

  it("editing duration updates state", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    const durationInput = screen.getByLabelText("Duration 1") as HTMLInputElement;
    await user.clear(durationInput);
    await user.type(durationInput, "25");

    expect(durationInput.value).toBe("25");
    expect(screen.getByTestId("steps-state").textContent).toContain('"durationMin":25');
  });

  it("invalid duration shows error", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    const durationInput = screen.getByLabelText("Duration 1") as HTMLInputElement;
    await user.clear(durationInput);
    await user.type(durationInput, "0");

    expect(screen.getByText("Step durationMin must be an integer greater than 0.")).toBeTruthy();
  });
});
