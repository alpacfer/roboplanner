import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { Step, StepGroup } from "../../domain/types";
import TemplateEditor from "./TemplateEditor";

const initialSteps: Step[] = [
  {
    id: "step-1",
    name: "Prep",
    durationMin: 10,
    operatorInvolvement: "WHOLE",
    groupId: null,
    color: "#4e79a7",
  },
];

const initialStepGroups: StepGroup[] = [];

function TestHarness() {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [stepGroups, setStepGroups] = useState<StepGroup[]>(initialStepGroups);

  return (
    <>
      <TemplateEditor
        steps={steps}
        stepGroups={stepGroups}
        onChange={({ steps: nextSteps, stepGroups: nextStepGroups }) => {
          setSteps(nextSteps);
          setStepGroups(nextStepGroups);
        }}
      />
      <pre data-testid="steps-state">{JSON.stringify(steps)}</pre>
      <pre data-testid="groups-state">{JSON.stringify(stepGroups)}</pre>
    </>
  );
}

describe("TemplateEditor", () => {
  const readGroups = () => JSON.parse(screen.getByTestId("groups-state").textContent ?? "[]") as StepGroup[];
  const readSteps = () => JSON.parse(screen.getByTestId("steps-state").textContent ?? "[]") as Step[];

  it("renders sequence cards and unsequenced card", () => {
    render(<TestHarness />);

    expect(screen.getByTestId("template-ungrouped-card")).toBeTruthy();
    expect(screen.getAllByTestId("step-item")).toHaveLength(1);
  });

  it("adding a sequence creates a sequence card", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    expect(screen.queryAllByTestId("template-group-card")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    expect(screen.getAllByTestId("template-group-card")).toHaveLength(1);
  });

  it("adding a step inside a sequence appends it to that sequence", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    await user.click(screen.getByRole("button", { name: "Add step to Sequence 1" }));

    const groups = readGroups();
    const steps = readSteps();
    const addedStep = steps.find((step) => step.id === "step-2");
    expect(addedStep?.groupId).toBe(groups[0]?.id);
  });

  it("keyboard fallback moves step across sequences", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    const groupId = readGroups()[0]?.id;

    await user.click(screen.getByRole("button", { name: "Move step 1 to previous sequence" }));
    expect(readSteps()[0]?.groupId).toBe(groupId);
  });

  it("collapse hides grouped steps and expand restores them", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    await user.click(screen.getByRole("button", { name: "Move step 1 to previous sequence" }));

    expect(screen.getAllByTestId("step-item")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Collapse sequence Sequence 1" }));
    expect(screen.queryAllByTestId("step-item")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Expand sequence Sequence 1" }));
    expect(screen.getAllByTestId("step-item")).toHaveLength(1);
  });

  it("deleting sequence unassigns grouped steps", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    await user.click(screen.getByRole("button", { name: "Move step 1 to previous sequence" }));
    await user.click(screen.getByRole("button", { name: "Delete sequence 1" }));

    expect(screen.getByTestId("groups-state").textContent).toBe("[]");
    expect(screen.getByTestId("steps-state").textContent).toContain('"groupId":null');
  });

  it("grouped step hides step color picker and keeps step color unchanged", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    const colorInput = screen.getByLabelText("Step color step-1") as HTMLInputElement;
    await user.click(colorInput);
    fireEvent.input(colorInput, { target: { value: "#00ff00" } });
    expect(screen.getByTestId("steps-state").textContent).toContain('"color":"#00ff00"');

    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    await user.click(screen.getByRole("button", { name: "Move step 1 to previous sequence" }));

    expect(screen.getByText("Step color is inherited from the sequence.")).toBeTruthy();
    expect(screen.queryByLabelText("Step color step-1")).toBeNull();
    expect(screen.getByTestId("steps-state").textContent).toContain('"color":"#00ff00"');
  });

  it("group color can be reset to default", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    const groupColorInput = screen.getByLabelText("Sequence color 1") as HTMLInputElement;

    fireEvent.input(groupColorInput, { target: { value: "#00ff00" } });
    expect(screen.getByTestId("groups-state").textContent).toContain('"color":"#00ff00"');

    await user.click(screen.getByRole("button", { name: "Reset sequence color 1 to default" }));
    expect(screen.getByTestId("groups-state").textContent).toContain('"color":"#4e79a7"');
  });

  it("group color supports preset swatches", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    await user.click(screen.getByRole("button", { name: "Sequence preset 1 #f28e2b" }));

    expect(screen.getByTestId("groups-state").textContent).toContain('"color":"#f28e2b"');
  });

  it("shows inline and group summary validation", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.clear(screen.getByLabelText("Step name step-1"));
    expect(screen.getByText("Step name is required.")).toBeTruthy();
    expect(screen.getByText("1 issues")).toBeTruthy();
  });
});
