import { expect, test } from "@playwright/test";

test("app loads and default plan is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Test Timeline Planner" })).toBeVisible();
  await expect(page.getByText("Current plan: Default Plan")).toBeVisible();
});
