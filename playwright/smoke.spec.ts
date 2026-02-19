import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function addStepButton(page: Page) {
  return page.getByRole("button", { name: /Add (unsequenced )?step/i });
}

function stepNameField(page: Page, index: number) {
  return page.getByLabel(new RegExp(`^Step name step-${index}$`));
}

function stepDurationField(page: Page, index: number) {
  return page.getByLabel(new RegExp(`^Step duration step-${index}$`));
}

function stepInvolvementField(page: Page, index: number) {
  return page.getByLabel(new RegExp(`^Operator involvement step-${index}$`));
}

function stepColorField(page: Page, index: number) {
  return page.getByLabel(new RegExp(`^Step color step-${index}$`));
}

test("app loads and default plan is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Test Timeline Planner" })).toBeVisible();
  await expect(page.getByText("Current plan: Default Plan")).toBeVisible();
});

test("user creates 3 template steps and sees state update", async ({ page }) => {
  await page.goto("/");

  await addStepButton(page).click();
  await addStepButton(page).click();

  await stepNameField(page, 2).fill("Soak");
  await stepDurationField(page, 2).fill("30");

  await stepNameField(page, 3).fill("Measure");
  await stepDurationField(page, 3).fill("20");

  await expect(page.getByTestId("step-item")).toHaveCount(3);
  await expect(page.getByTestId("template-state")).toContainText('"name":"Soak"');
  await expect(page.getByTestId("template-state")).toContainText('"name":"Measure"');
});

test("create template and run baseline simulation shows 3 bars", async ({ page }) => {
  await page.goto("/");

  await stepNameField(page, 1).fill("Prep");
  await stepDurationField(page, 1).fill("10");
  await stepInvolvementField(page, 1).selectOption("WHOLE");

  await addStepButton(page).click();
  await stepNameField(page, 2).fill("Soak");
  await stepDurationField(page, 2).fill("30");

  await addStepButton(page).click();
  await stepNameField(page, 3).fill("Measure");
  await stepDurationField(page, 3).fill("20");
  await stepInvolvementField(page, 3).selectOption("WHOLE");

  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByTestId("timeline-rect")).toHaveCount(3);
});

test("add R2 and timeline updates with 2 lanes", async ({ page }) => {
  await page.goto("/");

  await stepNameField(page, 1).fill("Prep");
  await stepDurationField(page, 1).fill("10");
  await stepInvolvementField(page, 1).selectOption("WHOLE");

  await addStepButton(page).click();
  await stepNameField(page, 2).fill("Soak");
  await stepDurationField(page, 2).fill("30");

  await addStepButton(page).click();
  await stepNameField(page, 3).fill("Measure");
  await stepDurationField(page, 3).fill("20");
  await stepInvolvementField(page, 3).selectOption("WHOLE");

  await page.getByRole("button", { name: "Add run" }).click();
  await page.getByLabel("Run label 2").fill("R2");
  await page.getByLabel("Run start 2").fill("15");

  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByTestId("timeline-lane")).toHaveCount(2);
});

test("capacity=1 with same start shows R2 wait block from 0 to 10", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Operator capacity").fill("1");
  await page.getByRole("button", { name: "Add run" }).click();
  await page.getByLabel("Run label 2").fill("R2");
  await page.getByLabel("Run start 2").fill("0");

  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByTestId("timeline-lane")).toHaveCount(2);
  await expect(page.locator('[data-testid="timeline-rect"][data-segment-kind="wait"]')).toHaveCount(1);
});

test("end-only involvement delays completion when operator unavailable at step end", async ({ page }) => {
  await page.goto("/");

  await stepDurationField(page, 1).fill("20");
  await stepInvolvementField(page, 1).selectOption("WHOLE");
  await addStepButton(page).click();
  await stepNameField(page, 2).fill("Finish");
  await stepDurationField(page, 2).fill("1");
  await stepInvolvementField(page, 2).selectOption("END");

  await page.getByRole("button", { name: "Add run" }).click();
  await page.getByLabel("Run label 2").fill("R2");
  await page.getByLabel("Run start 2").fill("10");
  await page.getByLabel("Operator capacity").fill("1");

  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.locator('[data-testid="timeline-rect"][data-segment-kind="wait"]')).toHaveCount(2);
});

test("export readable scenario JSON and import edited JSON", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add run" }).click();
  await page.getByLabel("Run label 2").fill("R2");
  await page.getByLabel("Run start 2").fill("15");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export scenario" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("Expected a downloaded JSON file path.");
  }
  const exportedText = await readFile(downloadPath, "utf8");
  expect(exportedText).toContain('"version": 3');
  expect(exportedText).toContain('"template"');
  expect(exportedText).toContain('"runs"');
  expect(exportedText).toContain('"settings"');

  const editedPayload = JSON.parse(exportedText) as {
    version: number;
    template: Array<{ id: string; name: string; durationMin: number; operatorInvolvement: string }>;
    runs: Array<{ id: string; label: string; startMin: number; templateId: string }>;
    settings: { operatorCapacity: number; queuePolicy: string };
  };
  editedPayload.runs = [{ ...editedPayload.runs[0], label: "ImportedR1", startMin: 5 }];
  editedPayload.settings = { ...editedPayload.settings, operatorCapacity: 2 };
  editedPayload.template[0] = { ...editedPayload.template[0], name: "ImportedPrep" };

  await page.getByTestId("scenario-file-input").setInputFiles({
    name: "edited-scenario.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(editedPayload, null, 2), "utf8"),
  });

  await expect(page.getByTestId("scenario-status")).toContainText(
    "Scenario imported from edited-scenario.json.",
  );
  await expect(page.getByLabel("Run label 1")).toHaveValue("ImportedR1");
  await expect(page.getByLabel("Run start 1")).toHaveValue("5");
  await expect(stepNameField(page, 1)).toHaveValue("ImportedPrep");
  await expect(page.getByLabel("Operator capacity")).toHaveValue("2");
});

test("export scenario downloads JSON file", async ({ page }) => {
  await page.goto("/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export scenario" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^scenario-.*\.json$/);
  await expect(page.getByTestId("scenario-status")).toContainText("Scenario downloaded");
});

test("import TestStand HTML creates ordered sequences with default step values", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Run label 1").fill("KeepRun");
  await page.getByLabel("Operator capacity").fill("3");

  await page
    .getByTestId("scenario-file-input")
    .setInputFiles(resolve(process.cwd(), "import_example", "setup_documentation.html"));

  await expect(page.getByTestId("scenario-status")).toContainText(
    "Imported TestStand HTML from setup_documentation.html (15 sequences, 156 steps).",
  );
  await expect(stepNameField(page, 1)).toHaveValue("Add FACTS information");
  await expect(stepDurationField(page, 1)).toHaveValue("10");
  await expect(stepInvolvementField(page, 1)).toHaveValue("NONE");
  await expect(page.getByTestId("template-group-card")).toHaveCount(15);
  await expect(stepNameField(page, 27)).toHaveValue("TODO - Scan/enter PCB SN number");
  await expect(page.getByLabel("Run label 1")).toHaveValue("KeepRun");
  await expect(page.getByLabel("Operator capacity")).toHaveValue("3");
});

test("zoom in makes bars wider", async ({ page }) => {
  await page.goto("/");

  await stepDurationField(page, 1).fill("50");
  await addStepButton(page).click();
  await stepDurationField(page, 2).fill("30");
  await addStepButton(page).click();
  await stepDurationField(page, 3).fill("20");

  await page.getByRole("button", { name: "Simulate" }).click();

  const firstRect = page.getByTestId("timeline-rect").first();
  const widthBefore = Number(await firstRect.getAttribute("width"));
  await page.getByRole("button", { name: "Zoom in" }).click();
  const widthAfter = Number(await firstRect.getAttribute("width"));

  expect(widthAfter).toBeGreaterThan(widthBefore);
});

test("timeline box scrolls horizontally when content is wider than viewport", async ({ page }) => {
  await page.goto("/");

  await stepDurationField(page, 1).fill("50");
  await addStepButton(page).click();
  await stepDurationField(page, 2).fill("30");
  await addStepButton(page).click();
  await stepDurationField(page, 3).fill("20");

  await page.getByRole("button", { name: "Simulate" }).click();

  const timelineBox = page.getByTestId("timeline-box");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();

  const scrollMetrics = await timelineBox.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
});

test("fit to window reduces zoom so bars get narrower", async ({ page }) => {
  await page.goto("/");

  await stepDurationField(page, 1).fill("50");
  await addStepButton(page).click();
  await stepDurationField(page, 2).fill("30");
  await addStepButton(page).click();
  await stepDurationField(page, 3).fill("20");

  await page.getByRole("button", { name: "Simulate" }).click();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  const firstRect = page.getByTestId("timeline-rect").first();
  const widthBefore = Number(await firstRect.getAttribute("width"));

  await page.getByRole("button", { name: /Fit( to window)?/ }).click();
  const widthAfter = Number(await firstRect.getAttribute("width"));

  expect(widthAfter).toBeLessThan(widthBefore);
});

test("fit to window handles timelines longer than 500 minutes", async ({ page }) => {
  await page.goto("/");
  await stepDurationField(page, 1).fill("600");
  await page.getByRole("button", { name: "Simulate" }).click();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: /Fit( to window)?/ }).click();

  const timelineBox = page.getByTestId("timeline-box");
  const metrics = await timelineBox.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
});

test("hovering a timeline step shows tooltip details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Simulate" }).click();

  const firstRect = page.getByTestId("timeline-rect").first();
  await firstRect.hover();

  const tooltip = page.getByTestId("timeline-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Prep");
  await expect(tooltip).toContainText("Start: 0 min, End: 10 min");
  await expect(tooltip).toContainText("Requires operator: Yes");
});

test("timeline shows auto-scaled horizontal minute axis", async ({ page }) => {
  await page.goto("/");
  await stepDurationField(page, 1).fill("600");
  await page.getByRole("button", { name: "Simulate" }).click();

  await expect(page.getByTestId("timeline-axis")).toBeVisible();
  await expect(page.locator(".axis-label", { hasText: /^0 min$/ })).toBeVisible();
  await expect(page.locator(".axis-label", { hasText: /^100 min$/ })).toBeVisible();
});

test("step label is hidden when text does not fit segment width", async ({ page }) => {
  await page.goto("/");
  await stepNameField(page, 1).fill("VeryLongStepNameThatCannotFit");
  await stepDurationField(page, 1).fill("5");
  await page.getByRole("button", { name: "Simulate" }).click();

  const labelCount = await page
    .locator('[data-testid="timeline-svg"] .segment-label', { hasText: "VeryLongStepNameThatCannotFit" })
    .count();
  expect(labelCount).toBe(0);
});

test("step color picker controls bar color and operator uses grid pattern overlay", async ({ page }) => {
  await page.goto("/");
  await stepNameField(page, 1).fill("Prep");
  await stepDurationField(page, 1).fill("20");
  await stepColorField(page, 1).fill("#00ff00");
  await stepInvolvementField(page, 1).selectOption("WHOLE");
  await page.getByRole("button", { name: "Simulate" }).click();

  const prepRect = page.locator('[data-testid="timeline-rect"][data-segment-name="Prep"]').first();
  await expect(prepRect).toHaveAttribute("fill", "#00ff00");
  await expect(page.getByTestId("timeline-operator-pattern").first()).toBeVisible();
  await expect(page.locator('[data-testid="timeline-svg"] .segment-label', { hasText: /^Prep$/ })).toBeVisible();
});

test("start+end involvement renders endpoint markers", async ({ page }) => {
  await page.goto("/");
  await stepInvolvementField(page, 1).selectOption("START_END");
  await page.getByRole("button", { name: "Simulate" }).click();

  await expect(page.getByTestId("timeline-operator-start-checkpoint").first()).toBeVisible();
  await expect(page.getByTestId("timeline-operator-end-checkpoint").first()).toBeVisible();
});
