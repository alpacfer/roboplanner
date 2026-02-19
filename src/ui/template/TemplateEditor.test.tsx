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
  const readFirstGroupId = () => {
    const raw = screen.getByTestId("groups-state").textContent ?? "[]";
    const parsed = JSON.parse(raw) as StepGroup[];
    return parsed[0]?.id;
  };

  it("adding a step adds a row", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    expect(screen.getAllByTestId("step-row")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Add step" }));
    expect(screen.getAllByTestId("step-row")).toHaveLength(2);
  });

  it("adding a group creates a group row", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    expect(screen.queryAllByTestId("step-group-row")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Add group" }));
    expect(screen.getAllByTestId("step-group-row")).toHaveLength(1);
  });

  it("assigning and unassigning a step updates groupId", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add group" }));
    const groupId = readFirstGroupId();
    await user.selectOptions(screen.getByLabelText("Group 1"), groupId ?? "");
    expect(screen.getByTestId("steps-state").textContent).toContain(`"groupId":"${groupId}"`);

    await user.selectOptions(screen.getByLabelText("Group 1"), "");
    expect(screen.getByTestId("steps-state").textContent).toContain('"groupId":null');
  });

  it("collapse hides grouped steps and expand restores them", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add group" }));
    const groupId = readFirstGroupId();
    await user.selectOptions(screen.getByLabelText("Group 1"), groupId ?? "");

    expect(screen.getAllByTestId("step-row")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Collapse group Group 1" }));
    expect(screen.queryAllByTestId("step-row")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Expand group Group 1" }));
    expect(screen.getAllByTestId("step-row")).toHaveLength(1);
  });

  it("deleting group unassigns grouped steps", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add group" }));
    const groupId = readFirstGroupId();
    await user.selectOptions(screen.getByLabelText("Group 1"), groupId ?? "");
    await user.click(screen.getByRole("button", { name: "Delete group 1" }));

    expect(screen.getByTestId("groups-state").textContent).toBe("[]");
    expect(screen.getByTestId("steps-state").textContent).toContain('"groupId":null');
  });

  it("grouped step shows color override indicator and keeps step color unchanged", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add group" }));
    const colorInput = screen.getByLabelText("Color 1") as HTMLInputElement;
    await user.click(colorInput);
    fireEvent.input(colorInput, { target: { value: "#00ff00" } });
    expect(screen.getByTestId("steps-state").textContent).toContain('"color":"#00ff00"');

    const groupId = readFirstGroupId();
    await user.selectOptions(screen.getByLabelText("Group 1"), groupId ?? "");
    expect(screen.getByText("Color overridden by group")).toBeTruthy();
    expect((screen.getByLabelText("Color 1") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId("steps-state").textContent).toContain('"color":"#00ff00"');
  });
});
