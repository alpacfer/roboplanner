import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { Step } from "../../domain/types";
import TemplateEditor from "./TemplateEditor";

const initialSteps: Step[] = [
  {
    id: "step-1",
    name: "Prep",
    durationMin: 10,
    operatorInvolvement: "WHOLE",
    color: "#4e79a7",
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

  it("editing color updates state", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    const colorInput = screen.getByLabelText("Color 1") as HTMLInputElement;
    await user.click(colorInput);
    fireEvent.input(colorInput, { target: { value: "#00ff00" } });

    expect(screen.getByTestId("steps-state").textContent).toContain('"color":"#00ff00"');
  });

  it("keeps table body column order aligned with headers", () => {
    render(<TestHarness />);

    const row = screen.getAllByTestId("step-row")[0];
    const cells = row.querySelectorAll("td");
    const durationInput = cells[1].querySelector('input[type="number"]');
    const operatorInput = cells[2].querySelector("select");
    const colorInput = cells[3].querySelector('input[type="color"]');

    expect(durationInput).toBeTruthy();
    expect(operatorInput).toBeTruthy();
    expect(colorInput).toBeTruthy();
  });

  it("selecting a preset color updates state", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByLabelText("Preset 1 #4e79a7"));
    expect(screen.getByTestId("steps-state").textContent).toContain('"color":"#4e79a7"');
  });

  it("operator involvement dropdown persists selection", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.selectOptions(screen.getByLabelText("Operator involvement 1"), "START_END");
    expect(screen.getByTestId("steps-state").textContent).toContain('"operatorInvolvement":"START_END"');
  });
});
