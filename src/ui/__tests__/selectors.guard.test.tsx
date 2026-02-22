import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("selector guard", () => {
  it("preserves critical selectors and accessibility hooks used by tests", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Test Timeline Planner" })).toBeTruthy();
    expect(screen.getByTestId("workspace-main")).toBeTruthy();
    expect(screen.getByTestId("workspace-side")).toBeTruthy();
    expect(screen.getByTestId("utility-shared-resources-card")).toBeTruthy();
    expect(screen.getByTestId("utility-settings-card")).toBeTruthy();
    expect(screen.getByTestId("utility-metrics-card")).toBeTruthy();
    expect(screen.getByTestId("simulate-button")).toBeTruthy();
    expect(screen.getByTestId("timeline-panel")).toBeTruthy();
    expect(screen.getByTestId("timeline-controls")).toBeTruthy();
    expect(screen.getByTestId("timeline-box")).toBeTruthy();
    expect(screen.getByTestId("scenario-file-input")).toBeTruthy();
    expect(screen.getByTestId("scenario-status")).toBeTruthy();
    expect(screen.getByTestId("debug-drawer-toggle")).toBeTruthy();
    expect(screen.getByTestId("template-state")).toBeTruthy();
    expect(screen.getByTestId("runs-state")).toBeTruthy();

    expect(screen.getByRole("button", { name: "Import scenario" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export scenario" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simulate" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add test" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add shared resource" })).toBeTruthy();
    expect(screen.getByLabelText("Operator capacity")).toBeTruthy();
    expect(screen.getByLabelText("Scenario import file")).toBeTruthy();

    await user.hover(screen.getByTestId("top-level-insert-0"));
    await user.click(screen.getByRole("button", { name: "Add step at top level position 1" }));

    const operatorInvolvement = screen.getByLabelText(/^Operator involvement step-\d+$/);
    expect(operatorInvolvement).toBeTruthy();
    expect(operatorInvolvement.tagName).toBe("INPUT");

    await user.click(screen.getByRole("button", { name: "Simulate" }));

    const timelinePanel = screen.getByTestId("timeline-panel");
    expect(within(timelinePanel).getByTestId("timeline-axis")).toBeTruthy();
    expect(within(timelinePanel).getAllByTestId("timeline-lane").length).toBeGreaterThan(0);
    expect(within(timelinePanel).getAllByTestId("timeline-rect").length).toBeGreaterThan(0);
  });
});
