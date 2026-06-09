import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import { PlanCatalog } from "@/components/console/plans/PlanCatalog";
import { TestProviders } from "@/__tests__/test-utils";
import type { PlanRead } from "@/lib/schemas/billing";

const plan = (overrides: Partial<PlanRead>): PlanRead => ({
  id: crypto.randomUUID(),
  slug: "pro",
  name: "Pro",
  tagline: "Growing brands",
  price: 149,
  currency: "BRL",
  max_members: 10,
  max_orders_per_month: 5000,
  max_integrations: 8,
  max_storage_gb: 10,
  is_public: true,
  sort_order: 0,
  active: true,
  ...overrides,
});

const plans: PlanRead[] = [
  plan({ slug: "free", name: "Grátis", price: 0, max_members: 2, max_orders_per_month: 50, max_integrations: 1, max_storage_gb: 1 }),
  plan({
    slug: "fabrica",
    name: "Fábrica",
    price: 349,
    max_members: null,
    max_orders_per_month: null,
    max_integrations: null,
    max_storage_gb: 50,
  }),
];

function renderCatalog(items: PlanRead[] = plans) {
  return render(
    <TestProviders>
      <PlanCatalog plans={items} />
    </TestProviders>,
  );
}

afterEach(cleanup);

describe("PlanCatalog", () => {
  it("renders one card per plan", () => {
    renderCatalog();
    expect(screen.getAllByTestId("plan-card")).toHaveLength(2);
  });

  it("renders plan name and tagline", () => {
    renderCatalog([plan({ name: "Pro", tagline: "Growing brands" })]);
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Growing brands")).toBeInTheDocument();
  });

  it("shows 'Free' for a zero-price plan", () => {
    renderCatalog();
    const free = document.querySelector('[data-slug="free"]') as HTMLElement;
    expect(within(free).getByText("Free")).toBeInTheDocument();
  });

  it("renders 'Unlimited' for null limits", () => {
    renderCatalog();
    const fabrica = document.querySelector('[data-slug="fabrica"]') as HTMLElement;
    // members, orders, and integrations are all null → three "Unlimited" rows.
    expect(within(fabrica).getAllByText("Unlimited").length).toBe(3);
  });

  it("renders the empty state when there are no plans", () => {
    renderCatalog([]);
    expect(screen.getByTestId("plan-catalog-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("plan-card")).toBeNull();
  });
});
