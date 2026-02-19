import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ImportExportPanel from "./ImportExportPanel";

describe("ImportExportPanel", () => {
  it("shows clear error and does not apply state for invalid JSON import", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    render(
      <ImportExportPanel
        settings={{ operatorCapacity: 1, queuePolicy: "FIFO" }}
        template={[{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE" }]}
        runs={[{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }]}
        onImport={onImport}
      />,
    );

    await user.click(screen.getByLabelText("Scenario JSON"));
    await user.paste("{invalid");
    await user.click(screen.getByRole("button", { name: "Import scenario" }));

    expect(screen.getByTestId("scenario-status").textContent).toContain(
      "Scenario payload is not valid JSON.",
    );
    expect(onImport).not.toHaveBeenCalled();
  });

  it("copies exported JSON to clipboard", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <ImportExportPanel
        settings={{ operatorCapacity: 1, queuePolicy: "FIFO" }}
        template={[{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE" }]}
        runs={[{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }]}
        onImport={onImport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export scenario" }));
    await user.click(screen.getByRole("button", { name: "Copy JSON" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("scenario-status").textContent).toContain("Scenario JSON copied.");
  });
});
