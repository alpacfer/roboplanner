import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Run } from "../../domain/types";
import RunsEditor from "./RunsEditor";

const initialRuns: Run[] = [
  {
    id: "run-1",
    label: "R1",
    startMin: 0,
    templateId: "plan-default",
  },
];

function TestHarness() {
  const [runs, setRuns] = useState<Run[]>(initialRuns);

  return (
    <>
      <RunsEditor runs={runs} templateId="plan-default" onChange={setRuns} />
      <pre data-testid="runs-state">{JSON.stringify(runs)}</pre>
    </>
  );
}

describe("RunsEditor", () => {
  const readRuns = () => JSON.parse(screen.getByTestId("runs-state").textContent ?? "[]") as Run[];

  it("adds a run with default values", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add run" }));

    const runs = readRuns();
    expect(runs).toHaveLength(2);
    expect(runs[1]).toMatchObject({
      id: "run-2",
      label: "R2",
      startMin: 0,
      templateId: "plan-default",
    });
  });

  it("updates label and start minute fields", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.clear(screen.getByLabelText("Run label 1"));
    await user.type(screen.getByLabelText("Run label 1"), "Device-1");
    await user.clear(screen.getByLabelText("Run start 1"));
    await user.type(screen.getByLabelText("Run start 1"), "12");

    expect(readRuns()[0]).toMatchObject({
      label: "Device-1",
      startMin: 12,
    });
  });

  it("coerces empty numeric input to 0", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.clear(screen.getByLabelText("Run start 1"));

    expect(readRuns()[0]?.startMin).toBe(0);
  });

  it("disables delete when only one run exists", () => {
    render(<TestHarness />);

    expect(screen.getByRole("button", { name: "Delete run 1" }).getAttribute("disabled")).not.toBeNull();
  });

  it("deletes runs when there are multiple", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add run" }));
    await user.click(screen.getByRole("button", { name: "Delete run 2" }));

    expect(readRuns()).toHaveLength(1);
    expect(readRuns()[0]?.id).toBe("run-1");
  });

  it("shows inline validation when label is empty", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.clear(screen.getByLabelText("Run label 1"));

    expect(screen.getByText("Run label is required.")).toBeTruthy();
  });
});
