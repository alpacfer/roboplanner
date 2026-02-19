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
  await page.getByLabel("Requires operator 1").check();

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Name 2").fill("Soak");
  await page.getByLabel("Duration 2").fill("30");

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Name 3").fill("Measure");
  await page.getByLabel("Duration 3").fill("20");
  await page.getByLabel("Requires operator 3").check();

  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByTestId("timeline-rect")).toHaveCount(3);
});

test("add R2 and timeline updates with 2 lanes", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Name 1").fill("Prep");
  await page.getByLabel("Duration 1").fill("10");
  await page.getByLabel("Requires operator 1").check();

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Name 2").fill("Soak");
  await page.getByLabel("Duration 2").fill("30");

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Name 3").fill("Measure");
  await page.getByLabel("Duration 3").fill("20");
  await page.getByLabel("Requires operator 3").check();

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
  await expect(page.getByText("wait: operator")).toBeVisible();
});

test("export readable scenario JSON and import edited JSON", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add run" }).click();
  await page.getByLabel("Run label 2").fill("R2");
  await page.getByLabel("Run start 2").fill("15");

  await page.getByRole("button", { name: "Export scenario" }).click();

  const scenarioTextArea = page.getByTestId("scenario-json");
  const exportedText = await scenarioTextArea.inputValue();
  expect(exportedText).toContain('"version": 1');
  expect(exportedText).toContain('"template"');
  expect(exportedText).toContain('"runs"');
  expect(exportedText).toContain('"settings"');

  const editedPayload = JSON.parse(exportedText) as {
    version: number;
    template: Array<{ id: string; name: string; durationMin: number; requiresOperator: boolean }>;
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
