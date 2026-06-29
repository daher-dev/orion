import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImportResolver } from "@/components/orders-import/ImportResolver";
import { TestProviders } from "@/__tests__/test-utils";
import type { UpsellerImportError } from "@/lib/schemas/orders-import";

// Isolate the component's grouping/render logic from the network: the pickers
// just need stable, empty data so the rows mount.
vi.mock("@/hooks/use-ads", () => ({
  useAds: () => ({ data: { items: [] }, isLoading: false }),
}));
vi.mock("@/hooks/use-products", () => ({
  useProducts: () => ({ data: { items: [] } }),
}));
vi.mock("@/hooks/use-orders-import", () => ({
  useUpsertSkuMapping: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function err(over: Partial<UpsellerImportError>): UpsellerImportError {
  return {
    row_index: 0,
    message: "ambiguous variation match (size/color)",
    marketplace: "shopee",
    sku: "ABC-1",
    ...over,
  };
}

describe("ImportResolver", () => {
  it("collapses unmatched lines into one row per marketplace SKU", () => {
    render(
      <TestProviders>
        <ImportResolver
          errors={[
            err({ row_index: 0, sku: "ABC-1" }),
            err({ row_index: 1, sku: "ABC-1" }), // same SKU → same row
            err({ row_index: 2, sku: "XYZ-9" }), // distinct SKU → its own row
          ]}
          onResolved={vi.fn()}
        />
      </TestProviders>,
    );

    // Two pinnable groups, not three lines.
    expect(screen.getByTestId("import-resolver")).toBeInTheDocument();
    expect(screen.getByTestId("resolver-row-shopee::abc-1")).toBeInTheDocument();
    expect(screen.getByTestId("resolver-row-shopee::xyz-9")).toBeInTheDocument();
    // Header reflects the group count (2), and the multi-line group shows it.
    expect(screen.getByText(/Resolve unmatched SKUs · 2/)).toBeInTheDocument();
    expect(screen.getByText(/2 lines/)).toBeInTheDocument();
  });

  it("counts lines without a SKU as unpinnable", () => {
    render(
      <TestProviders>
        <ImportResolver
          errors={[
            err({ row_index: 0, sku: "ABC-1" }),
            err({ row_index: 1, sku: null, message: "no matching ad for title/SKU" }),
          ]}
          onResolved={vi.fn()}
        />
      </TestProviders>,
    );

    expect(screen.getByTestId("resolver-row-shopee::abc-1")).toBeInTheDocument();
    expect(screen.getByText(/1 line has no SKU/)).toBeInTheDocument();
  });
});
