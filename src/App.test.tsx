import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

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

function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "import_example", name), "utf8");
}

describe("App step sequences", () => {
  it("renders utility rail and keeps viewport controls in the timeline header", () => {
    render(<App />);

    const utilityRail = screen.getByTestId("workspace-side");
    const timelinePanel = screen.getByTestId("timeline-panel");
    const timelineControls = within(timelinePanel).getByTestId("timeline-controls");

    expect(utilityRail).toBeTruthy();
    expect(within(timelineControls).getByRole("button", { name: "Zoom in" })).toBeTruthy();
    expect(within(timelineControls).getByRole("button", { name: "Zoom out" })).toBeTruthy();
    expect(within(timelineControls).getByRole("button", { name: "Fit" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Viewport" })).toBeNull();
  });

  it("exports scenario with stepGroups and step sequence assignments", async () => {
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

    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    await user.click(screen.getByRole("button", { name: "Add step to Sequence 1" }));
    await user.click(screen.getByRole("button", { name: "Export scenario" }));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const firstCreateObjectUrlCall = createObjectURLMock.mock.calls[0];
    if (!firstCreateObjectUrlCall || !(firstCreateObjectUrlCall[0] instanceof Blob)) {
      throw new Error("Expected createObjectURL to be called with a Blob.");
    }
    const scenarioBlob = firstCreateObjectUrlCall[0];
    const scenarioText = await readBlobText(scenarioBlob);
    const parsed = JSON.parse(scenarioText) as {
      version: number;
      stepGroups: Array<{ id: string }>;
      template: Array<{ groupId: string | null }>;
    };

    expect(parsed.version).toBe(3);
    expect(parsed.stepGroups).toHaveLength(1);
    expect(parsed.template.some((step) => step.groupId === parsed.stepGroups[0].id)).toBe(true);
    anchorClick.mockRestore();
  });

  it("imports scenario with sequences and updates editor state", async () => {
    const user = userEvent.setup();
    render(<App />);

    const payload = JSON.stringify(
      {
        version: 3,
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
  });

  it("uses sequence color override on timeline after simulate", async () => {
    const user = userEvent.setup();
    render(<App />);

    const payload = JSON.stringify(
      {
        version: 3,
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
    await user.click(screen.getByRole("button", { name: "Simulate" }));

    const stepRect = screen
      .getAllByTestId("timeline-rect")
      .find((node) => node.getAttribute("data-segment-kind") === "step");
    expect(stepRect?.getAttribute("fill")).toBe("#00ff00");
  });

  it("imports TestStand HTML with grouped sequences and default step settings", async () => {
    const user = userEvent.setup();
    render(<App />);
    const fixture = readFixture("setup_documentation.html");

    await user.upload(
      screen.getByLabelText("Scenario import file"),
      new File([fixture], "setup_documentation.html", { type: "text/html" }),
    );

    expect(screen.getByTestId("scenario-status").textContent).toContain(
      "Imported TestStand HTML from setup_documentation.html (15 sequences, 156 steps).",
    );
    expect(screen.getAllByTestId("template-group-card")).toHaveLength(15);
    expect((screen.getByLabelText("Step name step-1") as HTMLInputElement).value).toBe("Add FACTS information");
    expect((screen.getByLabelText("Step duration step-1") as HTMLInputElement).value).toBe("10");
    expect((screen.getByLabelText("Operator involvement step-1") as HTMLSelectElement).value).toBe("NONE");
    expect((screen.getByLabelText("Run label 1") as HTMLInputElement).value).toBe("R1");
    expect((screen.getByLabelText("Operator capacity") as HTMLInputElement).value).toBe("1");
  }, 20_000);

  it("toggles the developer tools drawer", async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = screen.getByTestId("debug-drawer-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Show developer tools")).toBeTruthy();

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Hide developer tools")).toBeTruthy();

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("clamps operator capacity to a minimum of 1", () => {
    render(<App />);

    const capacityInput = screen.getByLabelText("Operator capacity") as HTMLInputElement;
    fireEvent.change(capacityInput, { target: { value: "-7" } });
    expect(capacityInput.value).toBe("1");

    fireEvent.change(capacityInput, { target: { value: "4" } });
    expect(capacityInput.value).toBe("4");
  });

  it("toggles visibility of wait segments without re-simulating", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add run" }));
    await user.clear(screen.getByLabelText("Run start 2"));
    await user.type(screen.getByLabelText("Run start 2"), "0");
    await user.click(screen.getByRole("button", { name: "Simulate" }));

    expect(screen.getByText("3 segments visible")).toBeTruthy();
    await user.click(screen.getByLabelText("Show wait segments"));
    expect(screen.getByText("2 segments visible")).toBeTruthy();
    await user.click(screen.getByLabelText("Show wait segments"));
    expect(screen.getByText("3 segments visible")).toBeTruthy();
  });

  it("fit action resets timeline scroll position", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Simulate" }));
    const timelineBox = screen.getByTestId("timeline-box");
    const scrollToSpy = vi.fn();
    Object.defineProperty(timelineBox, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });
    Object.defineProperty(timelineBox, "clientWidth", {
      configurable: true,
      value: 900,
    });

    await user.click(screen.getByRole("button", { name: "Fit" }));
    expect(scrollToSpy).toHaveBeenCalledWith({ left: 0, top: 0, behavior: "auto" });
  });

  it("keeps zoom bounded between configured min and max scale", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Simulate" }));

    for (let index = 0; index < 24; index += 1) {
      await user.click(screen.getByRole("button", { name: "Zoom out" }));
    }
    const firstRectAtMinZoom = screen.getAllByTestId("timeline-rect")[0];
    const minWidth = Number.parseFloat(firstRectAtMinZoom.getAttribute("width") ?? "0");
    expect(minWidth).toBeCloseTo(2, 3);

    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    const widthAfterExtraZoomOut = Number.parseFloat(firstRectAtMinZoom.getAttribute("width") ?? "0");
    expect(widthAfterExtraZoomOut).toBeCloseTo(minWidth, 3);

    for (let index = 0; index < 36; index += 1) {
      await user.click(screen.getByRole("button", { name: "Zoom in" }));
    }
    const maxWidth = Number.parseFloat(firstRectAtMinZoom.getAttribute("width") ?? "0");
    expect(maxWidth).toBeCloseTo(400, 3);

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    const widthAfterExtraZoomIn = Number.parseFloat(firstRectAtMinZoom.getAttribute("width") ?? "0");
    expect(widthAfterExtraZoomIn).toBeCloseTo(maxWidth, 3);
  });

  it("clears prior simulation segments and metrics after importing a new scenario", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add run" }));
    await user.clear(screen.getByLabelText("Run start 2"));
    await user.type(screen.getByLabelText("Run start 2"), "0");
    await user.click(screen.getByRole("button", { name: "Simulate" }));

    expect(screen.getByText("3 segments visible")).toBeTruthy();
    expect(screen.getByTestId("metric-total-waiting").textContent).toBe("10");

    const payload = JSON.stringify(
      {
        version: 3,
        template: [
          {
            id: "step-1",
            name: "Imported",
            durationMin: 5,
            operatorInvolvement: "NONE",
            groupId: null,
            color: "#4e79a7",
          },
        ],
        stepGroups: [],
        runs: [{ id: "run-1", label: "OnlyRun", startMin: 3, templateId: "plan-default" }],
        settings: { operatorCapacity: 2, queuePolicy: "FIFO" },
      },
      null,
      2,
    );

    await user.upload(
      screen.getByLabelText("Scenario import file"),
      new File([payload], "replacement.json", { type: "application/json" }),
    );

    expect(screen.getByText("0 segments visible")).toBeTruthy();
    expect(screen.getByTestId("metric-makespan").textContent).toBe("0");
    expect(screen.getByTestId("metric-total-waiting").textContent).toBe("0");
    expect((screen.getByLabelText("Run label 1") as HTMLInputElement).value).toBe("OnlyRun");
    expect((screen.getByLabelText("Operator capacity") as HTMLInputElement).value).toBe("2");
  });
});
