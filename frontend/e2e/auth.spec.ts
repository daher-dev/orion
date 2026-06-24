import { test, expect, type Page, type Route } from "./_support";

/**
 * E2E coverage for FEATURE-001 — Auth (invite-only login).
 *
 * The harness uses dev-bypass auth (NEXT_PUBLIC_DEV_BYPASS_AUTH=true), so the
 * login page never actually contacts Firebase. We mock the backend
 * `/v1/auth/...` calls per-test using `page.route` with `**` globs (a full-URL
 * string does NOT match in Playwright) to keep the suite hermetic — no real
 * backend or seed data required.
 */

/** Default `/v1/auth/me` mock: a provisioned manager. */
async function mockProvisionedUser(page: Page) {
  await page.route(`**/v1/auth/me`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "11111111-1111-1111-1111-111111111111",
          name: "QA Dev User",
          email: "qa-dev@orion.local",
          is_operator: false,
        },
        company: {
          id: "22222222-2222-2222-2222-222222222222",
          name: "QA Co",
          subdomain: "qa-co",
          main_color: "#2563eb",
        },
        role: { id: "33333333-3333-3333-3333-333333333333", code: "admin", name: "Admin" },
        permissions: ["companies.read", "companies.write"],
        companies: [
          { id: "22222222-2222-2222-2222-222222222222", name: "QA Co", role_code: "admin" },
        ],
      }),
    });
  });
}

/** `/v1/auth/me` with no membership — the pre-gate state. */
async function mockNoMembership(page: Page) {
  await page.route(`**/v1/auth/me`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: null,
        company: null,
        role: null,
        permissions: [],
        companies: [],
      }),
    });
  });
}

test.describe("Auth — /login", () => {
  test.beforeEach(async ({ page }) => {
    await mockProvisionedUser(page);
  });

  test("renders the auth card with Orion brand, title, and provider CTAs", async ({ page }) => {
    await page.goto("/pt-BR/login");
    // Brand mark is the product wordmark only — never a tenant name.
    // Scope to <main> so we don't collide with <title>Orion</title> in <head>.
    await expect(page.locator("main").getByText("Orion", { exact: true }).first()).toBeVisible();
    await expect(page.locator("main").getByText("Underground")).toHaveCount(0);
    await expect(page.getByText("por Orion")).toHaveCount(0);
    // Page title. The brand chip carries "Orion"; the card title is just the verb.
    await expect(page.getByRole("heading", { name: "Entrar", level: 1 })).toBeVisible();
    // Primary + social CTAs.
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar com a Apple" })).toBeVisible();
    // Forgot-password link is kept; the self-service "create account" link is gone.
    await expect(page.getByRole("link", { name: "Esqueceu a senha?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar conta" })).toHaveCount(0);
  });

  test("dev-bypass banner is visible when the env flag is on", async ({ page }) => {
    await page.goto("/pt-BR/login");
    await expect(page.getByRole("status")).toContainText("dev-bypass");
  });

  test("clicking Entrar in dev-bypass mode routes to /", async ({ page }) => {
    await page.goto("/pt-BR/login");
    await page.getByRole("button", { name: "Entrar" }).click();
    // Client-side SPA nav fires no `load` event, so waitForURL(default) hangs —
    // toHaveURL polls the URL directly. We left /login = the click worked.
    await expect(page).toHaveURL(/\/pt-BR(\/)?$/);
  });
});

test.describe("Auth — access gate", () => {
  test("uninvited identity (session 403) is redirected to /access-denied", async ({ page }) => {
    await mockNoMembership(page);
    await page.route(`**/v1/auth/session`, async (route: Route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "not_invited" }),
      });
    });

    await page.goto("/pt-BR");
    await page.waitForURL(/\/access-denied$/);
    await expect(
      page.getByRole("heading", { name: "Você não foi convidado", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar para entrar" })).toBeVisible();
  });

  test("invited identity (session 200) lands in the app", async ({ page }) => {
    // First /me has no membership; after the session call provisions the user a
    // refetch returns the membership. We flip the mock after /session succeeds.
    let provisioned = false;
    await page.route(`**/v1/auth/me`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          provisioned
            ? {
                user: {
                  id: "11111111-1111-1111-1111-111111111111",
                  name: "QA Dev User",
                  email: "qa-dev@orion.local",
                  is_operator: false,
                },
                company: {
                  id: "22222222-2222-2222-2222-222222222222",
                  name: "QA Co",
                  subdomain: "qa-co",
                  main_color: "#2563eb",
                },
                role: { id: "33333333-3333-3333-3333-333333333333", code: "admin", name: "Admin" },
                permissions: ["companies.read"],
                companies: [
                  { id: "22222222-2222-2222-2222-222222222222", name: "QA Co", role_code: "admin" },
                ],
              }
            : { user: null, company: null, role: null, permissions: [], companies: [] },
        ),
      });
    });
    await page.route(`**/v1/auth/session`, async (route: Route) => {
      provisioned = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "11111111-1111-1111-1111-111111111111",
            name: "QA Dev User",
            email: "qa-dev@orion.local",
            is_operator: false,
          },
          company: {
            id: "22222222-2222-2222-2222-222222222222",
            name: "QA Co",
            subdomain: "qa-co",
            main_color: "#2563eb",
          },
          role: { id: "33333333-3333-3333-3333-333333333333", code: "admin", name: "Admin" },
          permissions: ["companies.read"],
          companies: [
            { id: "22222222-2222-2222-2222-222222222222", name: "QA Co", role_code: "admin" },
          ],
        }),
      });
    });

    await page.goto("/pt-BR");
    // Never bounced to the gate.
    await expect(page).not.toHaveURL(/\/access-denied$/);
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("Auth — /accept-invite/[token]", () => {
  test.beforeEach(async ({ page }) => {
    await mockProvisionedUser(page);
  });

  test("invalid token → error card with link back to /login", async ({ page }) => {
    await page.route(`**/v1/auth/invites/bad-token`, async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invite not found" }),
      });
    });

    await page.goto("/pt-BR/accept-invite/bad-token");
    await expect(page.getByText("Esse convite não é mais válido.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar para entrar" })).toBeVisible();
  });

  test("valid invite → accept button calls POST and routes to /", async ({ page }) => {
    await page.route(`**/v1/auth/invites/good-token`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          email: "new@orion.local",
          company_name: "Acme Co",
          role_name: "Manager",
          expires_at: "2099-01-01T00:00:00Z",
        }),
      });
    });
    let accepted = false;
    await page.route(`**/v1/auth/invites/good-token/accept`, async (route: Route) => {
      accepted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          company: {
            id: "22222222-2222-2222-2222-222222222222",
            name: "Acme Co",
            subdomain: "acme-co",
            main_color: "#2563eb",
          },
          user: {
            id: "11111111-1111-1111-1111-111111111111",
            name: "QA Dev User",
            email: "new@orion.local",
            is_operator: false,
          },
          role: {
            id: "33333333-3333-3333-3333-333333333333",
            code: "manager",
            name: "Manager",
            description: null,
          },
        }),
      });
    });

    await page.goto("/pt-BR/accept-invite/good-token");
    await expect(page.getByText("Acme Co")).toBeVisible();
    await page.getByRole("button", { name: "Aceitar e entrar" }).click();
    await page.waitForURL(/\/pt-BR\/?$/);
    expect(accepted).toBe(true);
  });
});
