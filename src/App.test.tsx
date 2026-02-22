import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { STEP_COLOR_PRESETS } from "./domain/colors";
import { SCENARIO_SCHEMA_VERSION } from "./storage/schema";

async function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") {
    return blob.text();
  }
  if (typeof blob.arrayBuffer === "function") {
    const buffer = await blob.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(new Error("Could not read exported blob."));
    };
    reader.readAsText(blob);
  });
}

describe("App", () => {
  it("renders template first, utility two-column row, and metrics below timeline", () => {
    render(<App />);

    const workspaceMain = screen.getByTestId("workspace-main");
    const utilityRow = screen.getByTestId("workspace-side");
    expect(workspaceMain.compareDocumentPosition(utilityRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const timelinePanel = screen.getByTestId("timeline-panel");
    const timelineControls = within(timelinePanel).getByTestId("timeline-controls");
    expect(within(timelineControls).getByLabelText("Show wait segments")).toBeTruthy();
    expect(within(timelineControls).getByRole("button", { name: "Zoom in" })).toBeTruthy();
    expect(within(timelineControls).getByRole("button", { name: "Zoom out" })).toBeTruthy();
    expect(within(timelineControls).getByRole("button", { name: "Fit" })).toBeTruthy();

    const metricsCard = screen.getByTestId("utility-metrics-card");
    expect(timelinePanel.compareDocumentPosition(metricsCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows schema version badge in the header", () => {
    render(<App />);

    expect(screen.getByText(`Version ${SCENARIO_SCHEMA_VERSION}`)).toBeTruthy();
  });

  it("keeps legacy portability and modal wrapper classes out of key panels", () => {
    render(<App />);

    const bannedLegacyClasses = [
      "portability-panel",
      "portability-layout",
      "portability-actions",
      "portability-info",
      "confirm-modal-overlay",
    ];
    const keyPanels = [
      screen.getByTestId("workspace-main"),
      screen.getByTestId("workspace-side"),
      screen.getByTestId("timeline-panel"),
      screen.getByTestId("utility-settings-card"),
      screen.getByTestId("utility-metrics-card"),
    ];

    for (const panel of keyPanels) {
      for (const className of bannedLegacyClasses) {
        expect(panel.querySelector(`.${className}`)).toBeNull();
      }
    }
  });

  it("disables simulate when no steps and enables after adding a step", async () => {
    const user = userEvent.setup();
    render(<App />);

    const simulateButton = screen.getByTestId("simulate-button") as HTMLButtonElement;
    expect(simulateButton.disabled).toBe(true);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add step at top level position 1" }));
    expect(simulateButton.disabled).toBe(false);
  });

  it("uses template import button to trigger hidden file picker", async () => {
    const user = userEvent.setup();
    const fileInputClickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Import scenario" }));
    expect(fileInputClickSpy).toHaveBeenCalledTimes(1);
  });

  it("exports scenario from template footer", async () => {
    const user = userEvent.setup();
    render(<App />);

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
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add sequence at top level position 1" }));
    await user.click(screen.getByRole("button", { name: "Export scenario" }));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const createUrlCall = createObjectURLMock.mock.calls[0];
    if (!createUrlCall || !(createUrlCall[0] instanceof Blob)) {
      throw new Error("Expected createObjectURL to receive a Blob.");
    }

    const scenarioText = await readBlobText(createUrlCall[0]);
    const parsed = JSON.parse(scenarioText) as {
      version: number;
      stepGroups: Array<{ id: string }>;
      template: Array<{ groupId: string | null }>;
    };

    expect(parsed.version).toBe(SCENARIO_SCHEMA_VERSION);
    expect(parsed.stepGroups).toHaveLength(1);
    expect(parsed.template.some((step) => step.groupId === parsed.stepGroups[0]?.id)).toBe(true);
    expect(screen.getByTestId("scenario-status").textContent).toContain("Scenario downloaded");

    anchorClick.mockRestore();
  });

  it("imports scenario and updates template editor state", async () => {
    const user = userEvent.setup();
    render(<App />);

    const payload = JSON.stringify(
      {
        version: SCENARIO_SCHEMA_VERSION,
        template: [
          {
            id: "step-1",
            name: "Prep",
            durationMin: 10,
            operatorInvolvement: "WHOLE",
            groupId: "g1",
            color: "#ff0000",
          },
        ],
        stepGroups: [{ id: "g1", name: "Main", color: "#00ff00" }],
        runs: [{ id: "run-1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      },
      null,
      2,
    );

    await user.upload(
      screen.getByLabelText("Scenario import file"),
      new File([payload], "scenario.json", { type: "application/json" }),
    );

    expect(screen.getAllByTestId("template-group-card")).toHaveLength(1);
    expect(screen.getByTestId("template-state").textContent).toContain('"groupId":"g1"');
    expect(screen.getByTestId("scenario-status").textContent).toContain("Scenario imported from scenario.json.");
  });

  it("assigns default sequence colors in order after import", async () => {
    const user = userEvent.setup();
    render(<App />);

    const payload = JSON.stringify(
      {
        version: SCENARIO_SCHEMA_VERSION,
        template: [
          {
            id: "step-1",
            name: "Prep",
            durationMin: 10,
            operatorInvolvement: "WHOLE",
            groupId: "g1",
            color: "#ff0000",
          },
          {
            id: "step-2",
            name: "Measure",
            durationMin: 5,
            operatorInvolvement: "NONE",
            groupId: "g2",
            color: "#00ff00",
          },
        ],
        stepGroups: [
          { id: "g1", name: "Main", color: "#00ff00" },
          { id: "g2", name: "Second", color: "#ff00ff" },
        ],
        runs: [{ id: "run-1", label: "R1", startMin: 0, templateId: "plan-default" }],
        settings: { operatorCapacity: 1, queuePolicy: "FIFO" },
      },
      null,
      2,
    );

    await user.upload(
      screen.getByLabelText("Scenario import file"),
      new File([payload], "scenario.json", { type: "application/json" }),
    );

    await user.click(screen.getByRole("button", { name: "Open sequence color menu Main" }));
    expect((screen.getByLabelText("Sequence color Main") as HTMLInputElement).value).toBe(STEP_COLOR_PRESETS[0]);
    await user.click(screen.getByRole("button", { name: "Open sequence color menu Second" }));
    expect((screen.getByLabelText("Sequence color Second") as HTMLInputElement).value).toBe(STEP_COLOR_PRESETS[1]);
  });

  it("normalizes operator capacity input and keeps min value 1", async () => {
    const user = userEvent.setup();
    render(<App />);

    const capacityInput = screen.getByLabelText("Operator capacity") as HTMLInputElement;
    await user.clear(capacityInput);
    await user.type(capacityInput, "0000");
    fireEvent.blur(capacityInput);
    expect(capacityInput.value).toBe("1");

    await user.clear(capacityInput);
    await user.type(capacityInput, "004");
    fireEvent.blur(capacityInput);
    expect(capacityInput.value).toBe("4");
  });

  it("toggles the developer tools drawer", async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = screen.getByTestId("debug-drawer-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("auto-sizes timeline height to run count without vertical scrolling", async () => {
    const user = userEvent.setup();
    render(<App />);

    const timelineBox = screen.getByTestId("timeline-box");
    const initialHeight = Number.parseInt((timelineBox as HTMLDivElement).style.height, 10);
    expect(initialHeight).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Add test" }));
    const nextHeight = Number.parseInt((screen.getByTestId("timeline-box") as HTMLDivElement).style.height, 10);
    expect(nextHeight).toBeGreaterThan(initialHeight);
  });
});
