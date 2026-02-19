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
