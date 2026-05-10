import { expect, test, type Page, type Route } from "@playwright/test";

const baseClaims = {
  user: {
    id: "11111111-1111-1111-1111-111111111111",
    name: "QA Manager",
    email: "qa-dev@orion.local",
    is_operator: false,
  },
  company: {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Acme",
    subdomain: "acme",
    main_color: "#0f766e",
  },
  role: { id: "33333333-3333-3333-3333-333333333333", code: "manager", name: "Manager" },
  permissions: ["contractors.read", "contractors.write"],
  companies: [{ id: "22222222-2222-2222-2222-222222222222", name: "Acme", role_code: "manager" }],
};

type Contractor = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

type State = {
  contractors: Contractor[];
};

function fakeId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

async function installApiMocks(page: Page, state: State, options?: { permissions?: string[] }) {
  const permissions = options?.permissions ?? baseClaims.permissions;

  await page.route("**/v1/auth/me", (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...baseClaims, permissions }),
    });
  });

  await page.route("**/v1/contractors**", async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const idMatch = path.match(/\/v1\/contractors\/([^/]+)/);
    const contractorId = idMatch?.[1];

    if (method === "GET" && !contractorId) {
      const q = url.searchParams.get("q")?.toLowerCase() ?? "";
      let items = state.contractors;
      if (q) {
        items = items.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone ?? "").toLowerCase().includes(q),
        );
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          total: items.length,
          page: 1,
          page_size: 100,
          has_more: false,
        }),
      });
      return;
    }

    if (method === "POST" && !contractorId) {
      const payload = JSON.parse(request.postData() || "{}") as Partial<Contractor>;
      const exists = state.contractors.some(
        (c) => c.name.toLowerCase() === (payload.name ?? "").toLowerCase(),
      );
      if (exists) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ detail: "A contractor with this name already exists" }),
        });
        return;
      }
      const created: Contractor = {
        id: fakeId(),
        name: payload.name ?? "",
        address: payload.address ?? null,
        phone: payload.phone ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      state.contractors = [created, ...state.contractors];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === "PATCH" && contractorId) {
      const payload = JSON.parse(request.postData() || "{}") as Partial<Contractor>;
      const target = state.contractors.find((c) => c.id === contractorId);
      if (!target) {
        await route.fulfill({ status: 404, body: JSON.stringify({ detail: "Not found" }) });
        return;
      }
      Object.assign(target, payload, { updated_at: nowIso() });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(target),
      });
      return;
    }

    if (method === "DELETE" && contractorId) {
      state.contractors = state.contractors.filter((c) => c.id !== contractorId);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });
}

async function gotoContractors(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "__orion_dev_bypass",
      JSON.stringify({ uid: "qa-dev-user", name: "QA Manager", email: "qa-dev@orion.local" }),
    );
  });
  await page.goto("/pt-BR/contractors");
}

test.describe("Contractors page", () => {
  test("empty state CTA opens create sheet", async ({ page }) => {
    const state: State = { contractors: [] };
    await installApiMocks(page, state);
    await gotoContractors(page);

    await expect(page.getByRole("heading", { name: /Bancas/ })).toBeVisible();
    await expect(page.getByText("Nenhuma banca cadastrada")).toBeVisible();

    await page.getByRole("button", { name: "Cadastrar primeira banca" }).click();
    await expect(page.getByRole("heading", { name: "Nova banca" })).toBeVisible();
  });

  test("create happy path", async ({ page }) => {
    const state: State = { contractors: [] };
    await installApiMocks(page, state);
    await gotoContractors(page);

    await page.getByRole("button", { name: "Nova banca" }).click();
    await page.getByLabel("Nome da banca").fill("Banca Esperança");
    await page.getByLabel("Endereço").fill("R. das Palmeiras, 12");
    await page.getByLabel("Telefone").fill("11 91234-5678");
    await page.getByRole("button", { name: "Cadastrar banca" }).click();

    await expect(page.getByText("Banca Esperança").first()).toBeVisible();
  });

  test("create validation blocks submit when name is empty", async ({ page }) => {
    const state: State = { contractors: [] };
    await installApiMocks(page, state);
    await gotoContractors(page);

    await page.getByRole("button", { name: "Nova banca" }).click();
    await page.getByRole("button", { name: "Cadastrar banca" }).click();
    await expect(page.getByRole("alert").first()).toContainText("Nome é obrigatório");
  });

  test("edit a banca through the row", async ({ page }) => {
    const state: State = {
      contractors: [
        {
          id: fakeId(),
          name: "Banca Lúcia",
          address: null,
          phone: "11 99999-0000",
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
    };
    await installApiMocks(page, state);
    await gotoContractors(page);

    await page.getByText("Banca Lúcia").click();
    await expect(page.getByRole("heading", { name: "Editar banca" })).toBeVisible();
    await page.getByLabel("Telefone").fill("11 88888-7777");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("11 88888-7777")).toBeVisible();
  });

  test("delete with confirm removes the banca", async ({ page }) => {
    const state: State = {
      contractors: [
        {
          id: fakeId(),
          name: "Banca Bye",
          address: null,
          phone: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
    };
    await installApiMocks(page, state);
    await gotoContractors(page);

    await page.getByText("Banca Bye").click();
    await page.getByRole("button", { name: "Excluir banca" }).first().click();
    await expect(page.getByText(/Tem certeza/)).toBeVisible();
    await page.getByRole("button", { name: "Excluir banca" }).last().click();
    await expect(page.getByText("Banca Bye")).toBeHidden();
    await expect(page.getByText("Nenhuma banca cadastrada")).toBeVisible();
  });

  test("search filters the list by name", async ({ page }) => {
    const state: State = {
      contractors: [
        {
          id: fakeId(),
          name: "Banca Esperança",
          address: null,
          phone: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        },
        {
          id: fakeId(),
          name: "Banca Lúcia",
          address: null,
          phone: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
    };
    await installApiMocks(page, state);
    await gotoContractors(page);

    await expect(page.getByText("Banca Esperança")).toBeVisible();
    await expect(page.getByText("Banca Lúcia")).toBeVisible();
    await page.getByPlaceholder("Buscar por nome ou telefone…").fill("esperan");
    await expect(page.getByText("Banca Esperança")).toBeVisible();
    await expect(page.getByText("Banca Lúcia")).toBeHidden();
  });

  test("operator without contractors.read sees forbidden state", async ({ page }) => {
    const state: State = { contractors: [] };
    await installApiMocks(page, state, { permissions: ["cutting.read", "sewing.read"] });
    await gotoContractors(page);

    await expect(page.getByTestId("contractors-forbidden")).toBeVisible();
    await expect(page.getByTestId("contractors-forbidden")).toHaveText(
      "Você não tem acesso às bancas.",
    );
  });
});
