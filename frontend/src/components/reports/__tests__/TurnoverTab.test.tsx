import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TurnoverTab } from "@/components/reports/TurnoverTab";
import { TestProviders } from "@/__tests__/test-utils";
import type { TurnoverReport } from "@/lib/schemas/reports";

// Recharts uses ResizeObserver + getBoundingClientRect — stub
// ResponsiveContainer so the chart subtree renders deterministically in jsdom.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="rc" style={{ width: 600, height: 300 }}>
        {children}
      </div>
    ),
  };
});

const mockUseTurnoverReport = vi.fn();
vi.mock("@/hooks/use-reports", () => ({
  useTurnoverReport: () => mockUseTurnoverReport(),
}));

const sampleReport: TurnoverReport = {
  rows: [
    {
      variation_id: "v1",
      sku: "CAM01-M-BLK",
      spec_code: "CAM01",
      units_sold: 20,
      average_on_hand: 20,
      turnover_ratio: 1.0,
      days_inventory_outstanding: 30,
    },
    {
      variation_id: "v2",
      sku: "CAM01-G-WHT",
      spec_code: "CAM01",
      units_sold: 0,
      average_on_hand: 5,
      turnover_ratio: 0,
      days_inventory_outstanding: null,
    },
  ],
  period_days: 30,
  total_units_sold: 20,
  average_turnover_ratio: 0.5,
};

describe("TurnoverTab", () => {
  it("shows the card titles while the query is pending", () => {
    mockUseTurnoverReport.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    render(
      <TestProviders>
        <TurnoverTab range={{}} />
      </TestProviders>,
    );
    expect(screen.getByText("Turnover by SKU")).toBeInTheDocument();
    expect(screen.getByText("Turnover per SKU")).toBeInTheDocument();
  });

  it("renders per-SKU rows when data resolves, with em-dash for null DIO", () => {
    mockUseTurnoverReport.mockReturnValue({
      data: sampleReport,
      isPending: false,
      isError: false,
    });
    render(
      <TestProviders>
        <TurnoverTab range={{}} />
      </TestProviders>,
    );
    // Both SKUs appear in the table.
    expect(screen.getByText("CAM01-M-BLK")).toBeInTheDocument();
    expect(screen.getByText("CAM01-G-WHT")).toBeInTheDocument();
    // Units sold (20) appears at least once (also equals avg on-hand here).
    expect(screen.getAllByText("20").length).toBeGreaterThanOrEqual(1);
    // Avg on-hand of the second row (5) is unique.
    expect(screen.getByText("5")).toBeInTheDocument();
    // Turnover ratio formatted to 2 decimals.
    expect(screen.getByText("1.00")).toBeInTheDocument();
    // DIO of the second row is null -> em-dash.
    expect(screen.getByText("—")).toBeInTheDocument();
    // Column headers from translations.
    expect(screen.getByText("Units sold")).toBeInTheDocument();
    expect(screen.getByText("Avg on-hand")).toBeInTheDocument();
    expect(screen.getByText("Days inventory")).toBeInTheDocument();
  });

  it("shows the load-error message when the query errors", () => {
    mockUseTurnoverReport.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    render(
      <TestProviders>
        <TurnoverTab range={{}} />
      </TestProviders>,
    );
    expect(screen.getByText("Could not load the report.")).toBeInTheDocument();
  });
});
