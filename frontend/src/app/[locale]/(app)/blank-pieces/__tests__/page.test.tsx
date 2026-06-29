import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "@/__tests__/test-utils";
import BlankPiecesPage from "@/app/[locale]/(app)/blank-pieces/page";
import type { BlankPieceLevelRead } from "@/lib/schemas/blank-stock";

// `@/i18n/routing` reaches into next-intl's navigation module (which expects a
// real Next runtime); the page's "Full ledger" Link transitively touches it.
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"}>{children}</a>
  ),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

const rows: BlankPieceLevelRead[] = [
  {
    blank_piece_id: "11111111-1111-1111-1111-111111111111",
    spec_id: "22222222-2222-2222-2222-222222222222",
    spec: { id: "22222222-2222-2222-2222-222222222222", code: "FT-014", name: "Camiseta" },
    size: "m",
    color: "Preto",
    color_code: "PRT",
    min_stock: 40,
    on_hand: 96,
    in_production: 0,
    low_stock: false,
    entries_total: 100,
    exits_total: 4,
    last_movement_at: "2026-06-10T12:00:00Z",
  },
  {
    blank_piece_id: "33333333-3333-3333-3333-333333333333",
    spec_id: "22222222-2222-2222-2222-222222222222",
    spec: { id: "22222222-2222-2222-2222-222222222222", code: "FT-014", name: "Camiseta" },
    size: "gg",
    color: "Preto",
    color_code: "PRT",
    min_stock: 30,
    on_hand: 9,
    in_production: 0,
    low_stock: true,
    entries_total: 9,
    exits_total: 0,
    last_movement_at: null,
  },
];

// Stable mock — levels resolved, movements empty, write access granted.
vi.mock("@/hooks/use-blank-stock", () => ({
  useBlankStockLevels: () => ({ data: { items: rows, total: 2, page: 1, page_size: 50, has_more: false }, isPending: false, isError: false }),
  // Tenant-wide KPI totals come from the server summary (every SKU), not a reduce
  // over the page: 96 + 9 = 105 on-hand, 1 SKU below min.
  useBlankStockLevelsSummary: () => ({ data: { total_on_hand: 105, below_min: 1, sku_count: 2 }, isPending: false, isError: false }),
  useBlankStockMovements: () => ({ data: { items: [], total: 0, page: 1, page_size: 50, has_more: false }, isPending: false, isError: false }),
  useCreateBlankMovement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateBlankPiece: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: () => true,
}));

describe("BlankPiecesPage", () => {
  it("renders the title, KPIs and one row per blank piece", () => {
    render(
      <TestProviders>
        <BlankPiecesPage />
      </TestProviders>,
    );

    // Page head title (en: "Blank pieces").
    expect(screen.getAllByText(/Blank/i).length).toBeGreaterThan(0);

    // KPI strip present, showing the server summary total (105), not a page reduce.
    expect(screen.getByTestId("inventory-kpis").textContent).toContain("105");

    // One row per blank piece.
    expect(screen.getAllByTestId("blank-pieces-row")).toHaveLength(2);

    // On-hand values surface in their dedicated cells.
    expect(screen.getByTestId("blank-pieces-on-hand-11111111-1111-1111-1111-111111111111").textContent).toContain("96");
    expect(screen.getByTestId("blank-pieces-on-hand-33333333-3333-3333-3333-333333333333").textContent).toContain("9");
  });
});
