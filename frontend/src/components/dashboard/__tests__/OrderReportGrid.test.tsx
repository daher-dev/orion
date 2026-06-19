import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderReportGrid } from "@/components/dashboard/OrderReportGrid";
import { TestProviders } from "@/__tests__/test-utils";
import type { ConferenceTotals } from "@/lib/schemas/dashboard";

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

describe("OrderReportGrid", () => {
  it("renders eight tiles, deriving 'to check' and 'no batch'", () => {
    render(
      <TestProviders>
        <OrderReportGrid totals={totals} />
      </TestProviders>,
    );
    expect(screen.getAllByTestId("report-tile")).toHaveLength(8);
    // Direct totals.
    expect(screen.getByText("100")).toBeInTheDocument(); // orders
    expect(screen.getByText("250")).toBeInTheDocument(); // pieces
    expect(screen.getByText("200")).toBeInTheDocument(); // mapped
    expect(screen.getByText("40")).toBeInTheDocument(); // done (orders_checked)
    expect(screen.getByText("30")).toBeInTheDocument(); // inbatch (in_lote)
    // Derived: tocheck = orders - orders_checked = 60; nobatch = orders - in_lote = 70.
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
  });
});
