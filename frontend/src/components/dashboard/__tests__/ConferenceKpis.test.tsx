import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConferenceKpis } from "@/components/dashboard/ConferenceKpis";
import { TestProviders } from "@/__tests__/test-utils";
import type { ConferenceTotals } from "@/lib/schemas/dashboard";

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const totals: ConferenceTotals = {
  orders: 120,
  pieces: 340,
  mapped: 300,
  pending: 40,
  mapped_pct: 88,
  in_lote: 30,
  orders_checked: 40,
  orders_partial: 25,
  orders_untouched: 55,
  pieces_checked: 180,
};

describe("ConferenceKpis", () => {
  it("renders the four conference KPIs with their values", () => {
    render(
      <TestProviders>
        <ConferenceKpis totals={totals} />
      </TestProviders>,
    );
    expect(screen.getAllByTestId("conf-kpi")).toHaveLength(4);
    expect(screen.getByText("120")).toBeInTheDocument(); // orders
    expect(screen.getByText("340")).toBeInTheDocument(); // pieces
    // The "%" suffix is a sibling <span>, so the value node's own text is "88".
    expect(screen.getByText("88")).toBeInTheDocument(); // mapped_pct
    expect(screen.getByText("40")).toBeInTheDocument(); // pending
  });
});
