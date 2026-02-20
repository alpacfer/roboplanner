import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../storage/schema";
import ImportExportPanel from "./ImportExportPanel";

function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "import_example", name), "utf8");
}

describe("ImportExportPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it("falls back to data URL download when createObjectURL is unavailable", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const previousCreateObjectURL = URL.createObjectURL;
    const previousRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: undefined,
    });
    let clickedHref = "";
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function mockClick(this: HTMLAnchorElement) {
        clickedHref = this.href;
      });

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

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickedHref.startsWith("data:application/json;charset=utf-8,")).toBe(true);
    expect(screen.getByTestId("scenario-status").textContent).toContain("Scenario downloaded");

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: previousCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: previousRevokeObjectURL,
    });
  });

  it("shows clear error when export serialization fails", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    vi.spyOn(schema, "serializeScenarioData").mockImplementation(() => {
      throw new Error("boom");
    });

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
    expect(screen.getByTestId("scenario-status").textContent).toContain("Export failed.");
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

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });
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

  it("detects JSON format from content when extension is unknown", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const payload = JSON.stringify({
      version: 3,
      template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
      stepGroups: [],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

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
      new File([`   ${payload}`], "scenario.txt", { type: "text/plain" }),
    );

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("scenario-status").textContent).toContain("Scenario imported from scenario.txt.");
  });

  it("detects TestStand format from content when extension is unknown", async () => {
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
      new File(["<html><b>Sequence: Main</b><b>Step: Prep</b></html>"], "setup.txt", { type: "text/plain" }),
    );

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("scenario-status").textContent).toContain(
      "Imported TestStand HTML from setup.txt (1 sequences, 1 steps).",
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

  it("shows a clear message when no file is selected", () => {
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

    fireEvent.change(screen.getByLabelText("Scenario import file"), { target: { files: [] } });
    expect(screen.getByTestId("scenario-status").textContent).toContain("No file selected.");
  });

  it("clicking import button opens file selector", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const fileInputClickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);

    render(
      <ImportExportPanel
        settings={{ operatorCapacity: 1, queuePolicy: "FIFO" }}
        template={[{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }]}
        stepGroups={[]}
        runs={[{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }]}
        onImport={onImport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Import scenario" }));
    expect(fileInputClickSpy).toHaveBeenCalledTimes(1);
  });

  it("uses FileReader fallback when file.text is unavailable", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const payload = JSON.stringify({
      version: 3,
      template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }],
      stepGroups: [],
      runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
      settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
    });

    render(
      <ImportExportPanel
        settings={{ operatorCapacity: 1, queuePolicy: "FIFO" }}
        template={[{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }]}
        stepGroups={[]}
        runs={[{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }]}
        onImport={onImport}
      />,
    );

    const file = new File([payload], "scenario.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      configurable: true,
      value: undefined,
    });

    await user.upload(screen.getByLabelText("Scenario import file"), file);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it("shows file read error when FileReader fails", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const OriginalFileReader = globalThis.FileReader;

    class FailingFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, event: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, event: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsText() {
        this.onerror?.call(
          this as unknown as FileReader,
          new ProgressEvent("error") as unknown as ProgressEvent<FileReader>,
        );
      }
    }

    vi.stubGlobal("FileReader", FailingFileReader);

    render(
      <ImportExportPanel
        settings={{ operatorCapacity: 1, queuePolicy: "FIFO" }}
        template={[{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE", groupId: null }]}
        stepGroups={[]}
        runs={[{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }]}
        onImport={onImport}
      />,
    );

    const file = new File(["{}"], "scenario.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      configurable: true,
      value: undefined,
    });

    await user.upload(screen.getByLabelText("Scenario import file"), file);
    expect(screen.getByTestId("scenario-status").textContent).toContain("Could not read selected file.");
    expect(onImport).not.toHaveBeenCalled();
    vi.stubGlobal("FileReader", OriginalFileReader);
  });

  it("shows generic import error when non-Error is thrown", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    vi.spyOn(schema, "deserializeScenarioData").mockImplementation(() => {
      throw "not-an-error";
    });

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
      new File(["{}"], "scenario.json", { type: "application/json" }),
    );

    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByTestId("scenario-status").textContent).toContain("Import failed.");
  });
});
