import { expect, test } from "@playwright/test";

test("app loads and default plan is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Test Timeline Planner" })).toBeVisible();
  await expect(page.getByText("Current plan: Default Plan")).toBeVisible();
});

test("user creates 3 template steps and sees state update", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByRole("button", { name: "Add step" }).click();

  await page.getByLabel("Name 2").fill("Soak");
  await page.getByLabel("Duration 2").fill("30");

  await page.getByLabel("Name 3").fill("Measure");
  await page.getByLabel("Duration 3").fill("20");

  await expect(page.getByTestId("step-row")).toHaveCount(3);
  await expect(page.getByTestId("template-state")).toContainText('"name":"Soak"');
  await expect(page.getByTestId("template-state")).toContainText('"name":"Measure"');
});

test("create template and run baseline simulation shows 3 bars", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Name 1").fill("Prep");
  await page.getByLabel("Duration 1").fill("10");
  await page.getByLabel("Operator involvement 1").selectOption("WHOLE");

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Name 2").fill("Soak");
  await page.getByLabel("Duration 2").fill("30");

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Name 3").fill("Measure");
  await page.getByLabel("Duration 3").fill("20");
  await page.getByLabel("Operator involvement 3").selectOption("WHOLE");

  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByTestId("timeline-rect")).toHaveCount(3);
});

test("add R2 and timeline updates with 2 lanes", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Name 1").fill("Prep");
  await page.getByLabel("Duration 1").fill("10");
  await page.getByLabel("Operator involvement 1").selectOption("WHOLE");

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Name 2").fill("Soak");
  await page.getByLabel("Duration 2").fill("30");

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Name 3").fill("Measure");
  await page.getByLabel("Duration 3").fill("20");
  await page.getByLabel("Operator involvement 3").selectOption("WHOLE");

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

  await page.getByLabel("Duration 1").fill("20");
  await page.getByLabel("Operator involvement 1").selectOption("WHOLE");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Name 2").fill("Finish");
  await page.getByLabel("Duration 2").fill("1");
  await page.getByLabel("Operator involvement 2").selectOption("END");

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

  await page.getByRole("button", { name: "Export scenario" }).click();

  const scenarioTextArea = page.getByTestId("scenario-json");
  const exportedText = await scenarioTextArea.inputValue();
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

  await scenarioTextArea.fill(JSON.stringify(editedPayload, null, 2));
  await page.getByRole("button", { name: "Import scenario" }).click();

  await expect(page.getByTestId("scenario-status")).toContainText("Scenario imported.");
  await expect(page.getByLabel("Run label 1")).toHaveValue("ImportedR1");
  await expect(page.getByLabel("Run start 1")).toHaveValue("5");
  await expect(page.getByLabel("Name 1")).toHaveValue("ImportedPrep");
  await expect(page.getByLabel("Operator capacity")).toHaveValue("2");
});

test("copy JSON button copies exported payload", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-write"], {
    origin: "http://127.0.0.1:4173",
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Export scenario" }).click();
  await page.getByRole("button", { name: "Copy JSON" }).click();
  await expect(page.getByTestId("scenario-status")).toContainText("Scenario JSON copied.");
});

test("zoom in makes bars wider", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Duration 1").fill("50");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Duration 2").fill("30");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Duration 3").fill("20");

  await page.getByRole("button", { name: "Simulate" }).click();

  const firstRect = page.getByTestId("timeline-rect").first();
  const widthBefore = Number(await firstRect.getAttribute("width"));
  await page.getByRole("button", { name: "Zoom in" }).click();
  const widthAfter = Number(await firstRect.getAttribute("width"));

  expect(widthAfter).toBeGreaterThan(widthBefore);
});

test("timeline box scrolls horizontally when content is wider than viewport", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Duration 1").fill("50");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Duration 2").fill("30");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Duration 3").fill("20");

  await page.getByRole("button", { name: "Simulate" }).click();

  const timelineBox = page.getByTestId("timeline-box");
  await page.getByLabel("Zoom (px/min)").fill("40");

  const scrollMetrics = await timelineBox.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
});

test("fit to window reduces zoom so bars get narrower", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Duration 1").fill("50");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Duration 2").fill("30");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Duration 3").fill("20");

  await page.getByRole("button", { name: "Simulate" }).click();

  await page.getByLabel("Zoom (px/min)").fill("40");
  const firstRect = page.getByTestId("timeline-rect").first();
  const widthBefore = Number(await firstRect.getAttribute("width"));

  await page.getByRole("button", { name: "Fit to window" }).click();
  const widthAfter = Number(await firstRect.getAttribute("width"));

  expect(widthAfter).toBeLessThan(widthBefore);
});

test("fit to window handles timelines longer than 500 minutes", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Duration 1").fill("600");
  await page.getByRole("button", { name: "Simulate" }).click();

  await page.getByLabel("Zoom (px/min)").fill("40");
  await page.getByRole("button", { name: "Fit to window" }).click();

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
  await page.getByLabel("Duration 1").fill("600");
  await page.getByRole("button", { name: "Simulate" }).click();

  await expect(page.getByTestId("timeline-axis")).toBeVisible();
  await expect(page.locator(".axis-label", { hasText: /^0 min$/ })).toBeVisible();
  await expect(page.locator(".axis-label", { hasText: /^100 min$/ })).toBeVisible();
});

test("step label is hidden when text does not fit segment width", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name 1").fill("VeryLongStepNameThatCannotFit");
  await page.getByLabel("Duration 1").fill("5");
  await page.getByRole("button", { name: "Simulate" }).click();

  const labelCount = await page
    .locator('[data-testid="timeline-svg"] .segment-label', { hasText: "VeryLongStepNameThatCannotFit" })
    .count();
  expect(labelCount).toBe(0);
});

test("step color picker controls bar color and operator uses grid pattern overlay", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name 1").fill("Prep");
  await page.getByLabel("Duration 1").fill("20");
  await page.getByLabel("Color 1").fill("#00ff00");
  await page.getByLabel("Operator involvement 1").selectOption("WHOLE");
  await page.getByRole("button", { name: "Simulate" }).click();

  const prepRect = page.locator('[data-testid="timeline-rect"][data-segment-name="Prep"]').first();
  await expect(prepRect).toHaveAttribute("fill", "#00ff00");
  await expect(page.getByTestId("timeline-operator-pattern").first()).toBeVisible();
  await expect(page.locator('[data-testid="timeline-svg"] .segment-label', { hasText: /^Prep$/ })).toBeVisible();
});

test("start+end involvement renders endpoint markers", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Operator involvement 1").selectOption("START_END");
  await page.getByRole("button", { name: "Simulate" }).click();

  await expect(page.getByTestId("timeline-operator-start-checkpoint").first()).toBeVisible();
  await expect(page.getByTestId("timeline-operator-end-checkpoint").first()).toBeVisible();
});

