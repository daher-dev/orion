import { test, expect } from "@playwright/test";

test("home page loads and renders in the default locale", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("home page loads in English", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("home page loads in Portuguese", async ({ page }) => {
  await page.goto("/pt-BR");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
