import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImportExportPanel from "./ImportExportPanel";

function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "import_example", name), "utf8");
}

describe("ImportExportPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows clear error and does not apply state for invalid JSON import", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    render(
      <ImportExportPanel
        settings={{ operatorCapacity: 1, queuePolicy: "FIFO" }}
        template={[{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }]}
        stepGroups={[]}
        runs={[{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }]}
        onImport={onImport}
      />,
    );

    const input = screen.getByLabelText("Scenario import file");
    await user.upload(input, new File(["{invalid"], "scenario.json", { type: "application/json" }));

    expect(screen.getByTestId("scenario-status").textContent).toContain(
      "Scenario payload is not valid JSON.",
    );
    expect(onImport).not.toHaveBeenCalled();
  });

  it("downloads exported JSON", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const createObjectURLMock = vi.fn(() => "blob:scenario");
    const revokeObjectURLMock = vi.fn(() => undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLMock,
    });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <ImportExportPanel
        settings={{ operatorCapacity: 1, queuePolicy: "FIFO" }}
        template={[{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }]}
        stepGroups={[]}
        runs={[{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }]}
        onImport={onImport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export scenario" }));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:scenario");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("scenario-status").textContent).toContain("Scenario downloaded");
  });

  it("imports TestStand HTML as ordered sequence groups with default step settings", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const fixture = readFixture("setup_documentation.html");
    const runs = [{ id: "r1", label: "KeepRun", startMin: 5, templateId: "plan-default" }];
    const settings = { operatorCapacity: 3, queuePolicy: "FIFO" as const };

    render(
      <ImportExportPanel
        settings={settings}
        template={[{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }]}
        stepGroups={[]}
        runs={runs}
        onImport={onImport}
      />,
    );

    await user.upload(
      screen.getByLabelText("Scenario import file"),
      new File([fixture], "setup_documentation.html", { type: "text/html" }),
    );

    expect(onImport).toHaveBeenCalledTimes(1);
    const payload = onImport.mock.calls[0][0] as {
      template: Array<{
        id: string;
        name: string;
        durationMin: number;
        operatorInvolvement: string;
        groupId: string | null;
      }>;
      stepGroups: Array<{ id: string; name: string }>;
      runs: typeof runs;
      settings: typeof settings;
    };

    expect(payload.stepGroups).toHaveLength(15);
    expect(payload.template).toHaveLength(156);
    expect(payload.stepGroups[0]).toMatchObject({ id: "group-1", name: "MainSequence" });
    expect(payload.template[0]).toMatchObject({
      id: "step-1",
      name: "Add FACTS information",
      durationMin: 10,
      operatorInvolvement: "NONE",
      groupId: "group-1",
    });
    expect(payload.runs).toEqual(runs);
    expect(payload.settings).toEqual(settings);
    expect(screen.getByTestId("scenario-status").textContent).toContain(
      "Imported TestStand HTML from setup_documentation.html (15 sequences, 156 steps).",
    );
  });

  it("shows a clear message for unsupported import format", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    render(
      <ImportExportPanel
        settings={{ operatorCapacity: 1, queuePolicy: "FIFO" }}
        template={[{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }]}
        stepGroups={[]}
        runs={[{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }]}
        onImport={onImport}
      />,
    );

    await user.upload(
      screen.getByLabelText("Scenario import file"),
      new File(["plain text"], "notes.txt", { type: "text/plain" }),
    );

    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByTestId("scenario-status").textContent).toContain(
      "Unsupported import format. Please import a scenario JSON file or TestStand HTML export.",
    );
  });
});
