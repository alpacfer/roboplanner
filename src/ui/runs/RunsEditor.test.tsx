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

    await user.click(screen.getByRole("button", { name: "Add test" }));

    const runs = readRuns();
    expect(runs).toHaveLength(2);
    expect(runs[1]).toMatchObject({
      id: "run-2",
      label: "R2",
      startMin: 0,
      templateId: "plan-default",
    });
  });

  it("normalizes integer start minute input on blur", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.clear(screen.getByLabelText("Run start 1"));
    await user.type(screen.getByLabelText("Run start 1"), "0012");
    await user.tab();

    expect(readRuns()[0]?.startMin).toBe(12);
  });

  it("opens delete confirmation for runs and supports cancel + confirm", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add test" }));
    await user.click(screen.getByRole("button", { name: "Delete run 2" }));

    expect(screen.getByRole("dialog", { name: "Delete run?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel Delete run?" }));
    expect(readRuns()).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Delete run 2" }));
    await user.click(screen.getByRole("button", { name: "Confirm Delete run?" }));
    expect(readRuns()).toHaveLength(1);
  });

  it("disables delete when only one run exists", () => {
    render(<TestHarness />);

    expect(screen.getByRole("button", { name: "Delete run 1" }).getAttribute("disabled")).not.toBeNull();
  });

  it("keeps table semantics and stable headers after migration", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Label" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Start (min)" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add test" }));
    expect(screen.getAllByTestId("run-row")).toHaveLength(2);
  });
});
