import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StockLevelsTable } from "@/components/stock/StockLevelsTable";
import { TestProviders } from "@/__tests__/test-utils";
import type { VariationStockRead } from "@/lib/schemas/stock";

const rows: VariationStockRead[] = [
  {
    variation_id: "11111111-1111-1111-1111-111111111111",
    sku: "CAM01-M-BLK",
    size: "m",
    color: "Preto",
    color_code: "BLK",
    product: {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Camiseta Oversized",
      code: "aaaaaaaa",
    },
    on_hand: 25,
    entries_total: 30,
    exits_total: 5,
    last_movement_at: "2026-05-09T12:00:00Z",
  },
  {
    variation_id: "22222222-2222-2222-2222-222222222222",
    sku: "CAM01-G-OFF",
    size: "g",
    color: "Off-white",
    color_code: "OFF",
    product: {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Camiseta Oversized",
      code: "aaaaaaaa",
    },
    on_hand: 2,
    entries_total: 10,
    exits_total: 8,
    last_movement_at: "2026-05-10T18:00:00Z",
  },
];

describe("StockLevelsTable", () => {
  it("renders each row's SKU, product, and on-hand quantity", () => {
    render(
      <TestProviders>
        <StockLevelsTable data={rows} threshold={5} onRowClick={() => {}} />
      </TestProviders>,
    );
    expect(screen.getByText("CAM01-M-BLK")).toBeInTheDocument();
    expect(screen.getByText("CAM01-G-OFF")).toBeInTheDocument();
    expect(screen.getAllByText("Camiseta Oversized")).toHaveLength(2);
    expect(screen.getByTestId("stock-on-hand-CAM01-M-BLK").textContent).toBe("25");
    expect(screen.getByTestId("stock-on-hand-CAM01-G-OFF").textContent).toBe("2");
  });

  it("renders an OK status pill when on_hand is above threshold", () => {
    render(
      <TestProviders>
        <StockLevelsTable data={[rows[0]]} threshold={5} onRowClick={() => {}} />
      </TestProviders>,
    );
    expect(screen.getByTestId("stock-status-pill-ok")).toBeInTheDocument();
  });

  it("renders a LOW status pill when on_hand is at or below threshold", () => {
    render(
      <TestProviders>
        <StockLevelsTable data={[rows[1]]} threshold={5} onRowClick={() => {}} />
      </TestProviders>,
    );
    expect(screen.getByTestId("stock-status-pill-low")).toBeInTheDocument();
  });

  it("invokes onRowClick with the underlying row data", () => {
    const onRowClick = vi.fn();
    render(
      <TestProviders>
        <StockLevelsTable data={rows} threshold={5} onRowClick={onRowClick} />
      </TestProviders>,
    );
    fireEvent.click(screen.getAllByTestId("stock-row")[0]);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
