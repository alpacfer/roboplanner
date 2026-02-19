import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
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
  it("exports scenario with stepGroups and step sequence assignments", async () => {
    const user = userEvent.setup();
    render(<App />);
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
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await user.click(screen.getByRole("button", { name: "Add sequence" }));
    await user.click(screen.getByRole("button", { name: "Move step 1 to previous sequence" }));
    await user.click(screen.getByRole("button", { name: "Export scenario" }));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const scenarioBlob = createObjectURLMock.mock.calls[0][0] as Blob;
    const scenarioText = await readBlobText(scenarioBlob);
    const parsed = JSON.parse(scenarioText) as {
      version: number;
      stepGroups: Array<{ id: string }>;
      template: Array<{ groupId: string | null }>;
    };

    expect(parsed.version).toBe(3);
    expect(parsed.stepGroups).toHaveLength(1);
    expect(parsed.template[0].groupId).toBe(parsed.stepGroups[0].id);
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
});
