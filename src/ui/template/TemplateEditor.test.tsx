import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Step, StepGroup } from "../../domain/types";
import TemplateEditor from "./TemplateEditor";

const initialSteps: Step[] = [
  {
    id: "step-1",
    name: "Prep",
    durationMin: 10,
    operatorInvolvement: "WHOLE",
    groupId: null,
    resourceIds: [],
    color: "#4e79a7",
  },
];

const initialStepGroups: StepGroup[] = [];
const sharedResources = [
  { id: "resource-1", name: "Robot arm", quantity: 2 },
  { id: "resource-2", name: "Fixture", quantity: 3 },
];

function TestHarness() {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [stepGroups, setStepGroups] = useState<StepGroup[]>(initialStepGroups);

  return (
    <>
      <TemplateEditor
        portabilityStatus=""
        sharedResources={sharedResources}
        stepGroups={stepGroups}
        steps={steps}
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

  it("renders standalone steps without unsequenced card", () => {
    render(<TestHarness />);

    expect(screen.queryByTestId("template-ungrouped-card")).toBeNull();
    expect(screen.getAllByTestId("step-item")).toHaveLength(1);
  });

  it("supports adding sequence and standalone step through top-level insertion rails", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));
    expect(readGroups()).toHaveLength(1);

    await user.hover(screen.getByTestId("top-level-insert-2"));
    await user.click(screen.getByRole("button", { name: "Add step at top level position 3" }));
    expect(readSteps()).toHaveLength(3);
  });

  it("inside sequences shows step insertion only", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));

    expect(screen.getByRole("button", { name: "Add step in Sequence 1 at position 1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add sequence in Sequence/ })).toBeNull();
  });

  it("expands a collapsed sequence when clicking the card surface", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));
    await user.click(screen.getByRole("button", { name: "Collapse sequence Sequence 1" }));
    expect(screen.queryByTestId("group-body-group-1")).toBeNull();

    fireEvent.click(screen.getByTestId("template-group-card"));
    expect(await screen.findByTestId("group-body-group-1")).toBeTruthy();
  });

  it("collapses an expanded sequence when clicking the header surface", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));
    expect(screen.getByTestId("group-body-group-1")).toBeTruthy();

    fireEvent.click(screen.getByTestId("group-header-group-1"));
    expect(screen.queryByTestId("group-body-group-1")).toBeNull();
  });

  it("sequence move arrows reorder against standalone blocks", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));
    await user.click(screen.getByRole("button", { name: "Move sequence Sequence 1 down" }));

    expect(readSteps()[0]?.groupId).toBeNull();
  });

  it("step delete confirmation cascades sequence delete when removing last grouped step", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));
    await user.click(screen.getByRole("button", { name: "Delete step 1" }));
    await user.click(screen.getByRole("button", { name: "Confirm Delete step?" }));

    expect(readGroups()).toHaveLength(0);
    expect(readSteps()).toHaveLength(1);
    expect(readSteps()[0]?.groupId).toBeNull();
  });

  it("sequence delete confirmation removes grouped steps", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));
    await user.hover(screen.getByTestId("group-group-1-insert-1"));
    await user.click(screen.getByRole("button", { name: "Add step in Sequence 1 at position 2" }));
    await user.click(screen.getByRole("button", { name: "Delete sequence Sequence 1" }));
    await user.click(screen.getByRole("button", { name: "Confirm Delete sequence?" }));

    expect(readGroups()).toHaveLength(0);
    expect(readSteps().every((step) => step.groupId === null)).toBe(true);
  });

  it("delete all removes all steps and sequences", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));
    await user.hover(screen.getByTestId("top-level-insert-2"));
    await user.click(screen.getByRole("button", { name: "Add step at top level position 3" }));

    await user.click(screen.getByRole("button", { name: "Delete all steps and sequences" }));
    await user.click(screen.getByRole("button", { name: "Confirm Delete all steps and sequences?" }));

    expect(readGroups()).toHaveLength(0);
    expect(readSteps()).toHaveLength(0);
  });

  it("shows issue status only when issues exist", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));

    expect(screen.queryByText("No issues")).toBeNull();
    expect(screen.queryByText("1 issues")).toBeNull();

    await user.clear(screen.getByLabelText("Sequence name Sequence 1"));
    expect(screen.getByText("1 issues")).toBeTruthy();
  });

  it("opens step color popover, updates color, and closes on outside click", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Open step color menu step-1" }));
    expect(screen.getByLabelText("Step color menu step-1")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Step color step-1"), { target: { value: "#112233" } });
    expect(readSteps()[0]?.color).toBe("#112233");

    await user.click(screen.getByText("Template Steps"));
    expect(screen.queryByLabelText("Step color menu step-1")).toBeNull();
  });

  it("opens sequence color popover, updates color, and closes on escape", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));
    await user.click(screen.getByRole("button", { name: "Open sequence color menu Sequence 1" }));
    expect(screen.getByLabelText("Sequence color menu Sequence 1")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Sequence color Sequence 1"), { target: { value: "#445566" } });
    expect(readGroups()[0]?.color).toBe("#445566");

    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Sequence color menu Sequence 1")).toBeNull();
  });

  it("renders operator involvement as a select trigger", () => {
    render(<TestHarness />);

    const involvement = screen.getByLabelText("Operator involvement step-1");
    expect(involvement.tagName).toBe("BUTTON");
  });

  it("supports selecting multiple shared resources for a step", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByLabelText("Resources step-1"));
    await user.click(screen.getByRole("option", { name: "Robot arm" }));
    await user.click(screen.getByRole("option", { name: "Fixture" }));

    expect(readSteps()[0]?.resourceIds).toEqual(["resource-1", "resource-2"]);
  });

  it("hides shared resource placeholder after at least one resource is selected", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    expect(screen.getByPlaceholderText("Add a shared resource.")).toBeTruthy();

    await user.click(screen.getByLabelText("Resources step-1"));
    await user.click(screen.getByRole("option", { name: "Robot arm" }));

    expect(screen.queryByPlaceholderText("Add a shared resource.")).toBeNull();
  });
});
