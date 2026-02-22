import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCENARIO_SCHEMA_VERSION } from "../../storage/schema";
import { detectImportFormat, exportScenarioAsDownload, importScenarioFromFile, readFileAsText } from "./portability";

function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "import_example", name), "utf8");
}

const baseScenario = {
  template: [{ id: "s1", name: "Prep", durationMin: 10, operatorInvolvement: "WHOLE" as const, groupId: null }],
  stepGroups: [] as Array<{ id: string; name: string; color: string }>,
  runs: [{ id: "r1", label: "R1", startMin: 0, templateId: "plan-default" }],
  settings: { operatorCapacity: 1, queuePolicy: "FIFO" as const },
  sharedResources: [{ id: "resource-1", name: "Robot arm", quantity: 2 }],
};

describe("portability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("detects import format by extension and content", () => {
    expect(detectImportFormat("scenario.json", "plain")).toBe("json");
    expect(detectImportFormat("scenario.html", "plain")).toBe("teststand_html");
    expect(detectImportFormat("scenario.txt", " {\"version\":3 }")).toBe("json");
    expect(detectImportFormat("scenario.txt", "<html><b>Sequence: Main</b></html>")).toBe("teststand_html");
    expect(detectImportFormat("scenario.txt", "plain text")).toBe("unknown");
  });

  it("exports using blob URL when createObjectURL is available", () => {
    const createObjectURLMock = vi.fn<(blob: Blob) => string>(() => "blob:scenario");
    const revokeObjectURLMock = vi.fn(() => undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLMock,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const fileName = exportScenarioAsDownload(baseScenario);

    expect(fileName.endsWith(".json")).toBe(true);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:scenario");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to data URL export when createObjectURL is unavailable", () => {
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

    const fileName = exportScenarioAsDownload(baseScenario);

    expect(fileName.endsWith(".json")).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickedHref.startsWith("data:application/json;charset=utf-8,")).toBe(true);

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: previousCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: previousRevokeObjectURL,
    });
  });

  it("imports JSON scenario successfully", async () => {
    const payload = JSON.stringify({
      version: SCENARIO_SCHEMA_VERSION,
      ...baseScenario,
    });

    const imported = await importScenarioFromFile({
      file: new File([payload], "scenario.json", { type: "application/json" }),
      runs: baseScenario.runs,
      settings: baseScenario.settings,
      sharedResources: baseScenario.sharedResources,
    });

    expect(imported.template).toEqual(baseScenario.template);
    expect(imported.stepGroups).toEqual(baseScenario.stepGroups);
    expect(imported.runs).toEqual(baseScenario.runs);
    expect(imported.settings).toEqual(baseScenario.settings);
    expect(imported.sharedResources).toEqual(baseScenario.sharedResources);
    expect(imported.statusMessage).toBe("Scenario imported from scenario.json.");
  });

  it("throws clear error for invalid JSON import", async () => {
    await expect(
      importScenarioFromFile({
        file: new File(["{invalid"], "scenario.json", { type: "application/json" }),
        runs: baseScenario.runs,
        settings: baseScenario.settings,
        sharedResources: baseScenario.sharedResources,
      }),
    ).rejects.toThrow("Scenario payload is not valid JSON.");
  });

  it("throws clear error for unsupported import format", async () => {
    await expect(
      importScenarioFromFile({
        file: new File(["plain text"], "notes.txt", { type: "text/plain" }),
        runs: baseScenario.runs,
        settings: baseScenario.settings,
        sharedResources: baseScenario.sharedResources,
      }),
    ).rejects.toThrow(
      "Unsupported import format. Please import a scenario JSON file or TestStand HTML export.",
    );
  });

  it("imports TestStand HTML and preserves current runs/settings/resources", async () => {
    const fixture = readFixture("setup_documentation.html");
    const runs = [{ id: "r2", label: "KeepRun", startMin: 5, templateId: "plan-default" }];
    const settings = { operatorCapacity: 3, queuePolicy: "FIFO" as const };
    const sharedResources = [{ id: "resource-2", name: "Fixture", quantity: 1 }];

    const imported = await importScenarioFromFile({
      file: new File([fixture], "setup_documentation.html", { type: "text/html" }),
      runs,
      settings,
      sharedResources,
    });

    expect(imported.stepGroups).toHaveLength(15);
    expect(imported.template).toHaveLength(156);
    expect(imported.stepGroups[0]).toMatchObject({ id: "group-1", name: "MainSequence" });
    expect(imported.template[0]).toMatchObject({
      id: "step-1",
      name: "Add FACTS information",
      durationMin: 10,
      operatorInvolvement: "NONE",
      groupId: "group-1",
    });
    expect(imported.runs).toEqual(runs);
    expect(imported.settings).toEqual(settings);
    expect(imported.sharedResources).toEqual(sharedResources);
    expect(imported.statusMessage).toBe(
      "Imported TestStand HTML from setup_documentation.html (15 sequences, 156 steps).",
    );
  });

  it("throws clear error for malformed TestStand HTML", async () => {
    await expect(
      importScenarioFromFile({
        file: new File(["<html><body>No sequence markers</body></html>"], "setup.html", { type: "text/html" }),
        runs: baseScenario.runs,
        settings: baseScenario.settings,
        sharedResources: baseScenario.sharedResources,
      }),
    ).rejects.toThrow("TestStand HTML does not contain any sequences.");
  });

  it("reads file text via FileReader fallback when file.text is unavailable", async () => {
    const file = new File(["{\"ok\":true}"], "scenario.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      configurable: true,
      value: undefined,
    });

    await expect(readFileAsText(file)).resolves.toBe('{"ok":true}');
  });

  it("throws clear error when FileReader fallback fails", async () => {
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

    const file = new File(["{}"], "scenario.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      configurable: true,
      value: undefined,
    });

    await expect(readFileAsText(file)).rejects.toThrow("Could not read selected file.");
    vi.stubGlobal("FileReader", OriginalFileReader);
  });
});
