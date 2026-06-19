import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConferenceSummaryCard } from "@/components/dashboard/ConferenceSummaryCard";
import { TestProviders } from "@/__tests__/test-utils";
import type { ConferenceTotals } from "@/lib/schemas/dashboard";

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const totals: ConferenceTotals = {
  orders: 100,
  pieces: 250,
  mapped: 200,
  pending: 50,
  mapped_pct: 80,
  in_lote: 30,
  orders_checked: 40,
  orders_partial: 25,
  orders_untouched: 35,
  pieces_checked: 180,
};

describe("ConferenceSummaryCard", () => {
  it("renders two progress panels with DISTINCT order/piece percentages", () => {
    render(
      <TestProviders>
        <ConferenceSummaryCard totals={totals} />
      </TestProviders>,
    );
    expect(screen.getAllByTestId("conf-prog")).toHaveLength(2);
    // ordersDone = orders_checked/orders = 40/100 = 40%
    expect(screen.getByText("40%")).toBeInTheDocument();
    // piecesDone = pieces_checked/pieces = 180/250 = 72% — proves the two
    // panels no longer share a single `checked` value (the prior bug).
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("renders the three sub-tiles (partial / problems stub / a conferir)", () => {
    render(
      <TestProviders>
        <ConferenceSummaryCard totals={totals} />
      </TestProviders>,
    );
    const subtiles = screen.getAllByTestId("conf-subtile");
    expect(subtiles).toHaveLength(3);
    expect(screen.getByText("25")).toBeInTheDocument(); // partial
    expect(screen.getByText("35")).toBeInTheDocument(); // untouched (A conferir)
    expect(screen.getByText("0")).toBeInTheDocument(); // problems stub
  });
});
