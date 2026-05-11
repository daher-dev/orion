import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SalesTab } from "@/components/reports/SalesTab";
import { TestProviders } from "@/__tests__/test-utils";
import type { SalesReport } from "@/lib/schemas/reports";

// Recharts internally uses ResizeObserver + getBoundingClientRect — we stub
// ResponsiveContainer so the chart subtree renders at a deterministic size
// in jsdom. The Cartesian/Bar/Line children stay real so the assertion can
// still inspect tooltip/legend formatter outputs if it wants to.
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

const mockUseSalesReport = vi.fn();
vi.mock("@/hooks/use-reports", () => ({
  useSalesReport: () => mockUseSalesReport(),
}));

const sampleReport: SalesReport = {
  by_channel: [
    { channel: "shopee", count: 12, revenue: 4800 },
    { channel: "instagram", count: 6, revenue: 2100 },
  ],
  by_status: [
    { status: "pending", count: 4 },
    { status: "paid", count: 10 },
    { status: "shipped", count: 4 },
  ],
  by_day: [
    { day: "2026-05-01", count: 3, revenue: 1200 },
    { day: "2026-05-02", count: 5, revenue: 2000 },
  ],
  total_count: 18,
  total_revenue: 6900,
};

describe("SalesTab", () => {
  it("renders a skeleton-like loading state while the query is pending", () => {
    mockUseSalesReport.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    render(
      <TestProviders>
        <SalesTab range={{}} />
      </TestProviders>,
    );
    // The two KPI tiles render the em-dash placeholder while loading.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    // Card titles are visible regardless of loading state.
    expect(screen.getByText("Orders by channel")).toBeInTheDocument();
    expect(screen.getByText("Orders by status")).toBeInTheDocument();
    expect(screen.getByText("Revenue by day")).toBeInTheDocument();
  });

  it("renders KPI totals and chart titles when data resolves", () => {
    mockUseSalesReport.mockReturnValue({
      data: sampleReport,
      isPending: false,
      isError: false,
    });
    render(
      <TestProviders>
        <SalesTab range={{}} />
      </TestProviders>,
    );
    // Total revenue formatted as USD (en locale) — 6900 → $6,900.
    expect(screen.getByText("$6,900")).toBeInTheDocument();
    // Total orders formatted as int.
    expect(screen.getByText("18")).toBeInTheDocument();
    // KPI labels surface from translations.
    expect(screen.getByText("Total revenue")).toBeInTheDocument();
    expect(screen.getByText("Total orders")).toBeInTheDocument();
  });

  it("shows the load-error message when the query errors", () => {
    mockUseSalesReport.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    render(
      <TestProviders>
        <SalesTab range={{}} />
      </TestProviders>,
    );
    expect(screen.getByText("Could not load the report.")).toBeInTheDocument();
  });
});
