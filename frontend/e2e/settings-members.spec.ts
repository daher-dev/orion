import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for FEATURE-002 — Settings: Members & Roles (members tab).
 *
 * Uses the dev-bypass auth path and assumes the test DB has been reset.
 * Each test owns its own data: a clean company, an admin (qa-dev-user),
 * and any extra members/invites required for the scenario.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const QA_HEADERS = {
  "X-Dev-Bypass-Uid": "qa-dev-user",
  "X-Dev-Bypass-Name": "QA Dev User",
  "X-Dev-Bypass-Email": "qa-dev@orion.local",
};

async function gotoMembers(page: Page) {
  await page.goto("/pt-BR/settings/members");
  await expect(page.getByText("Membros", { exact: true }).first()).toBeVisible();
}

async function listInvites(page: Page) {
  const r = await page.request.get(`${API_URL}/v1/invites`, { headers: QA_HEADERS });
  if (!r.ok()) return [] as Array<{ id: string }>;
  const body = await r.json();
  return body.items ?? [];
}

async function revokeAllInvites(page: Page) {
  for (const inv of await listInvites(page)) {
    await page.request.delete(`${API_URL}/v1/invites/${inv.id}`, { headers: QA_HEADERS });
  }
}

async function listRoles(page: Page) {
  const r = await page.request.get(`${API_URL}/v1/roles`, { headers: QA_HEADERS });
  if (!r.ok()) return [] as Array<{ id: string; code: string }>;
  return r.json();
}

test.describe("Settings: Members & Invites", () => {
  test.beforeEach(async ({ page }) => {
    await revokeAllInvites(page);
  });

  test("members page renders current member with role select", async ({ page }) => {
    await gotoMembers(page);
    await expect(page.getByTestId("members-table")).toBeVisible();
    await expect(page.getByTestId("members-row").first()).toBeVisible();
    // The role select now lives in the member detail sheet, opened by clicking a row.
    await page.getByTestId("members-row").first().click();
    await expect(page.getByTestId("role-select-trigger").first()).toBeVisible();
  });

  test("invite happy path adds an invite to the pending list", async ({ page }) => {
    await gotoMembers(page);
    await page.getByTestId("invite-open").click();
    await page.getByLabel("E-mail").fill("nova-pessoa@example.com");
    await page.getByTestId("invite-submit").click();
    await expect(page.getByText("Convite enviado")).toBeVisible();
    await expect(page.getByText("nova-pessoa@example.com")).toBeVisible();
  });

  test("revoking a pending invite removes its row", async ({ page }) => {
    const roles = await listRoles(page);
    const admin = roles.find((r) => r.code === "admin");
    expect(admin).toBeTruthy();
    await page.request.post(`${API_URL}/v1/invites`, {
      headers: QA_HEADERS,
      data: { email: "doomed@example.com", role_id: admin!.id },
    });
    await gotoMembers(page);
    const row = page.locator('[data-invite-email="doomed@example.com"]');
    await expect(row).toBeVisible();
    await row.getByTestId("invite-revoke").click();
    await page.getByTestId("invite-revoke-confirm").click();
    await expect(page.getByText("Convite revogado")).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test("last-admin guard surfaces the localized error", async ({ page }) => {
    const roles = await listRoles(page);
    const manager = roles.find((r) => r.code === "manager");
    expect(manager).toBeTruthy();
    await gotoMembers(page);
    // The current user is the only admin — attempting to demote them must fail.
    // Role changes happen in the member detail sheet, opened by clicking the row.
    await page.getByTestId("members-row").first().click();
    const trigger = page.getByTestId("role-select-trigger").first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.getByRole("option", { name: /Manager/i }).click();
    await expect(page.getByText("Não é possível remover o último administrador.")).toBeVisible();
  });
});
