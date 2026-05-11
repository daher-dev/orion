import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionTab } from "@/components/reports/ProductionTab";
import { TestProviders } from "@/__tests__/test-utils";
import type { ProductionReport } from "@/lib/schemas/reports";

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

const mockUseProductionReport = vi.fn();
vi.mock("@/hooks/use-reports", () => ({
  useProductionReport: () => mockUseProductionReport(),
}));

const sample: ProductionReport = {
  cutting_throughput: [
    { day: "2026-05-01", pieces_cut: 120 },
    { day: "2026-05-02", pieces_cut: 95 },
  ],
  sewing_throughput: [
    { day: "2026-05-01", pieces_received: 80 },
    { day: "2026-05-02", pieces_received: 110 },
  ],
  scrap_pct: 4.2,
};

describe("ProductionTab", () => {
  it("renders both throughput cards and the scrap KPI", () => {
    mockUseProductionReport.mockReturnValue({
      data: sample,
      isPending: false,
      isError: false,
    });
    render(
      <TestProviders>
        <ProductionTab range={{}} />
      </TestProviders>,
    );
    expect(screen.getByText("Cutting throughput")).toBeInTheDocument();
    expect(screen.getByText("Sewing throughput")).toBeInTheDocument();
    expect(screen.getByText("Scrap rate")).toBeInTheDocument();
    expect(screen.getByText("4.2%")).toBeInTheDocument();
    // Summed cutting pieces (120 + 95 = 215) renders in the KPI tile.
    expect(screen.getByText("215")).toBeInTheDocument();
  });

  it("renders the error fallback when the query fails", () => {
    mockUseProductionReport.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    render(
      <TestProviders>
        <ProductionTab range={{}} />
      </TestProviders>,
    );
    expect(screen.getByText("Could not load the report.")).toBeInTheDocument();
  });
});
