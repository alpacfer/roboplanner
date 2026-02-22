import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { SharedResource } from "@/domain/types";
import SharedResourcesEditor from "./SharedResourcesEditor";

const initialResources: SharedResource[] = [
  {
    id: "resource-1",
    name: "Fixture",
    quantity: 2,
  },
];

function TestHarness() {
  const [resources, setResources] = useState<SharedResource[]>(initialResources);

  return (
    <>
      <SharedResourcesEditor resources={resources} onChange={setResources} />
      <pre data-testid="resources-state">{JSON.stringify(resources)}</pre>
    </>
  );
}

describe("SharedResourcesEditor", () => {
  const readResources =
    () => JSON.parse(screen.getByTestId("resources-state").textContent ?? "[]") as SharedResource[];

  it("adds a shared resource with defaults", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Add shared resource" }));

    const resources = readResources();
    expect(resources).toHaveLength(2);
    expect(resources[1]).toMatchObject({
      id: "resource-2",
      name: "Resource 2",
      quantity: 1,
    });
  });

  it("normalizes quantity on blur", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.clear(screen.getByLabelText("Shared resource count 1"));
    await user.type(screen.getByLabelText("Shared resource count 1"), "0009");
    await user.tab();

    expect(readResources()[0]?.quantity).toBe(9);
  });

  it("opens delete confirmation and deletes on confirm", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole("button", { name: "Delete shared resource 1" }));
    expect(screen.getByRole("dialog", { name: "Delete shared resource?" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Confirm Delete shared resource?" }));
    expect(readResources()).toHaveLength(0);
  });

  it("keeps table headers and row test ids", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Count" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add shared resource" }));
    expect(screen.getAllByTestId("resource-row")).toHaveLength(2);
  });

  it("shows guidance when no shared resources exist", () => {
    render(<SharedResourcesEditor resources={[]} onChange={() => undefined} />);

    expect(screen.getByText("No shared resources yet.")).toBeTruthy();
  });
});
