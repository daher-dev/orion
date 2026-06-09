import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import { BillingUsageGrid } from "@/components/settings/billing/BillingUsageGrid";
import { TestProviders } from "@/__tests__/test-utils";
import type { UsageMetric } from "@/lib/schemas/billing";

const usage: UsageMetric[] = [
  { key: "members", used: 5, limit: 10, tracked: true },
  { key: "orders_month", used: 9, limit: 10, tracked: true },
  { key: "integrations", used: 0, limit: 3, tracked: false },
  { key: "storage", used: 0, limit: null, tracked: false },
];

function renderGrid(metrics: UsageMetric[] = usage) {
  return render(
    <TestProviders>
      <BillingUsageGrid usage={metrics} />
    </TestProviders>,
  );
}

afterEach(cleanup);

describe("BillingUsageGrid", () => {
  it("renders one card per usage metric", () => {
    renderGrid();
    expect(screen.getAllByTestId("billing-usage-card")).toHaveLength(4);
  });

  it("renders the real count and cap for a tracked metric", () => {
    renderGrid();
    const card = document.querySelector('[data-metric="members"]') as HTMLElement;
    expect(within(card).getByTestId("billing-usage-count")).toHaveTextContent("5");
    expect(within(card).getByText("of 10")).toBeInTheDocument();
  });

  it("warns above 80% usage on a tracked metric", () => {
    renderGrid();
    const orders = document.querySelector('[data-metric="orders_month"]') as HTMLElement;
    expect(within(orders).getByTestId("billing-usage-fill").getAttribute("data-warn")).toBe("true");
    const members = document.querySelector('[data-metric="members"]') as HTMLElement;
    expect(within(members).getByTestId("billing-usage-fill").getAttribute("data-warn")).toBeNull();
  });

  it("renders 'not tracked' for untracked metrics instead of a number", () => {
    renderGrid();
    const integrations = document.querySelector('[data-metric="integrations"]') as HTMLElement;
    expect(within(integrations).queryByTestId("billing-usage-count")).toBeNull();
    expect(within(integrations).getByTestId("billing-usage-untracked")).toHaveTextContent(
      /not tracked yet/i,
    );
  });

  it("labels an unlimited cap as unlimited for a tracked metric", () => {
    renderGrid([{ key: "members", used: 100, limit: null, tracked: true }]);
    const card = document.querySelector('[data-metric="members"]') as HTMLElement;
    expect(within(card).getByText("of unlimited")).toBeInTheDocument();
    expect(within(card).getByTestId("billing-usage-fill").getAttribute("data-unlimited")).toBe("true");
  });
});
