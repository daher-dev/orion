import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * E2E coverage for FEATURE-001 — Auth & Onboarding.
 *
 * The harness uses dev-bypass auth (NEXT_PUBLIC_DEV_BYPASS_AUTH=true), so
 * the login page never actually contacts Firebase. We mock the backend
 * `/v1/auth/...` calls per-test using `page.route` to keep the suite
 * hermetic — no real backend or seed data required.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Default `/v1/auth/me` mock: an onboarded manager. Tests override this
 * before navigation when they need the "no user row" state.
 */
async function mockOnboardedUser(page: Page) {
  await page.route(`${API_URL}/v1/auth/me`, async (route: Route) => {
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
        role: { id: "33333333-3333-3333-3333-333333333333", code: "owner", name: "Owner" },
        permissions: ["companies.read", "companies.write"],
        companies: [
          { id: "22222222-2222-2222-2222-222222222222", name: "QA Co", role_code: "owner" },
        ],
      }),
    });
  });
}

async function mockNoUserRow(page: Page) {
  await page.route(`${API_URL}/v1/auth/me`, async (route: Route) => {
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
    await mockOnboardedUser(page);
  });

  test("renders the auth card with brand mark, title, and CTAs", async ({ page }) => {
    await page.goto("/pt-BR/login");
    // Brand mark + wordmark.
    await expect(page.getByText("Orion", { exact: true })).toBeVisible();
    await expect(page.getByText("por Underground")).toBeVisible();
    // Page title.
    await expect(page.getByRole("heading", { name: "Entrar no Orion", level: 1 })).toBeVisible();
    // Primary + secondary CTAs.
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible();
    // Forgot-password + signup links.
    await expect(page.getByRole("link", { name: "Esqueceu a senha?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar conta" })).toBeVisible();
  });

  test("dev-bypass banner is visible when the env flag is on", async ({ page }) => {
    await page.goto("/pt-BR/login");
    await expect(page.getByRole("status")).toContainText("dev-bypass");
  });

  test("clicking Entrar in dev-bypass mode routes to /", async ({ page }) => {
    await page.goto("/pt-BR/login");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/pt-BR\/?$/);
    // AppShell renders something (heading or skeleton) — assert we left /login.
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("Auth — /onboarding", () => {
  test.beforeEach(async ({ page }) => {
    // Force the "no user row" path so the page renders rather than getting
    // bounced by the AppShell.
    await mockNoUserRow(page);
  });

  test("renders the wizard with auto-derived subdomain and the 6 color presets", async ({
    page,
  }) => {
    await page.goto("/pt-BR/onboarding");
    await expect(
      page.getByRole("heading", { name: "Criar sua empresa", level: 1 }),
    ).toBeVisible();

    const name = page.getByLabel("Nome da empresa");
    await name.fill("Underground Apparel");
    // Subdomain auto-derives from the name.
    await expect(page.getByLabel("Subdomínio")).toHaveValue("underground-apparel");

    // 6 swatches in the color radio group.
    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(6);
  });

  test("color preset selection updates aria-checked", async ({ page }) => {
    await page.goto("/pt-BR/onboarding");
    const terracotta = page.getByRole("radio", { name: "Terracotta" });
    await terracotta.click();
    await expect(terracotta).toHaveAttribute("aria-checked", "true");
  });

  test("happy path: submit calls POST /onboarding and routes to /", async ({ page }) => {
    let posted: unknown = null;
    await page.route(
      `${API_URL}/v1/auth/onboarding/companies`,
      async (route: Route) => {
        posted = JSON.parse(route.request().postData() ?? "{}");
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            company: {
              id: "22222222-2222-2222-2222-222222222222",
              name: "Underground",
              subdomain: "underground",
              main_color: "#2563eb",
            },
            user: {
              id: "11111111-1111-1111-1111-111111111111",
              name: "QA Dev User",
              email: "qa-dev@orion.local",
              is_operator: false,
            },
            role: {
              id: "33333333-3333-3333-3333-333333333333",
              code: "owner",
              name: "Owner",
              description: null,
            },
          }),
        });
      },
    );

    await page.goto("/pt-BR/onboarding");
    await page.getByLabel("Nome da empresa").fill("Underground");
    await page.getByRole("button", { name: "Criar empresa" }).click();
    await page.waitForURL(/\/pt-BR\/?$/);
    expect(posted).toMatchObject({ company_name: "Underground", subdomain: "underground" });
  });

  test("409 from /onboarding surfaces inline subdomain error", async ({ page }) => {
    await page.route(
      `${API_URL}/v1/auth/onboarding/companies`,
      async (route: Route) => {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Subdomain already taken" }),
        });
      },
    );

    await page.goto("/pt-BR/onboarding");
    await page.getByLabel("Nome da empresa").fill("Taken");
    await page.getByRole("button", { name: "Criar empresa" }).click();
    await expect(page.getByText("Este subdomínio já está em uso.")).toBeVisible();
  });
});

test.describe("Auth — /accept-invite/[token]", () => {
  test.beforeEach(async ({ page }) => {
    await mockOnboardedUser(page);
  });

  test("invalid token → error card with link back to /login", async ({ page }) => {
    await page.route(
      `${API_URL}/v1/auth/invites/bad-token`,
      async (route: Route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Invite not found" }),
        });
      },
    );

    await page.goto("/pt-BR/accept-invite/bad-token");
    await expect(page.getByText("Esse convite não é mais válido.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar para entrar" })).toBeVisible();
  });

  test("valid invite → accept button calls POST and routes to /", async ({ page }) => {
    await page.route(
      `${API_URL}/v1/auth/invites/good-token`,
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            email: "new@orion.local",
            company_name: "Underground",
            role_name: "Manager",
            expires_at: "2099-01-01T00:00:00Z",
          }),
        });
      },
    );
    let accepted = false;
    await page.route(
      `${API_URL}/v1/auth/invites/good-token/accept`,
      async (route: Route) => {
        accepted = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            company: {
              id: "22222222-2222-2222-2222-222222222222",
              name: "Underground",
              subdomain: "underground",
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
      },
    );

    await page.goto("/pt-BR/accept-invite/good-token");
    await expect(page.getByText("Underground")).toBeVisible();
    await page.getByRole("button", { name: "Aceitar e entrar" }).click();
    await page.waitForURL(/\/pt-BR\/?$/);
    expect(accepted).toBe(true);
  });
});
