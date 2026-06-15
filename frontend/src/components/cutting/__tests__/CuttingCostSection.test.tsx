import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/__tests__/test-utils";
import { CuttingCostSection } from "../CuttingCostSection";
import type { CuttingOrder, CuttingRunCost } from "@/lib/schemas/cutting";

// Mock the data hook so the component renders against a fixed payload
// without an API/auth context.
const useCuttingCostMock = vi.fn();
vi.mock("@/hooks/use-cutting", () => ({
  useCuttingCost: (...args: unknown[]) => useCuttingCostMock(...args),
}));

const ORDER_ID = "11111111-1111-1111-1111-111111111111";

function makeOrder(status: CuttingOrder["status"]): CuttingOrder {
  return {
    id: ORDER_ID,
    spec: { id: "p1", code: "CRP01", name: "Cropped" },
    color: "Preto",
    color_code: "PRT",
    body_roll: { id: "b1", code: "BB-AAAAAA" },
    rib_roll: null,
    status,
    planned_outputs: [],
    actual_outputs: [],
    cut_at: null,
    created_at: "2026-05-01T12:00:00Z",
    updated_at: "2026-05-01T12:00:00Z",
  };
}

const COST: CuttingRunCost = {
  cutting_order_id: ORDER_ID,
  total_pieces: 30,
  body_fabric_kg: 7.5,
  ribana_kg: 0,
  body_price_per_kg: 38,
  rib_price_per_kg: null,
  fabric_cost: 285,
  ribana_cost: 0,
  trims_cost: 25,
  labor_cost: 360,
  total_cost: 670,
  cost_per_piece: 22.3333,
  yield_pieces_per_kg: 4,
};

describe("CuttingCostSection", () => {
  it("renders BRL rows, total, per-piece and yield for a done order with cost", () => {
    useCuttingCostMock.mockReturnValue({ data: COST });
    renderWithProviders(<CuttingCostSection order={makeOrder("done")} />);

    expect(screen.getByTestId("cutting-cost-section")).toBeInTheDocument();
    // Component labels (en.json: cutting.cost.*).
    expect(screen.getByText("Fabric")).toBeInTheDocument();
    expect(screen.getByText("Trims")).toBeInTheDocument();
    expect(screen.getByText("Labor")).toBeInTheDocument();
    expect(screen.getByText("Total cost")).toBeInTheDocument();

    // BRL-formatted values (Intl, en locale → "R$").
    expect(screen.getByText("R$285.00")).toBeInTheDocument();
    expect(screen.getByText("R$360.00")).toBeInTheDocument();
    expect(screen.getByText("R$670.00")).toBeInTheDocument();

    // Per-piece footnote + yield.
    expect(screen.getByText("R$22.33 per piece")).toBeInTheDocument();
    expect(screen.getByText("4.000 pieces/kg")).toBeInTheDocument();
  });

  it("hides the ribana row when no ribana was consumed", () => {
    useCuttingCostMock.mockReturnValue({ data: COST });
    renderWithProviders(<CuttingCostSection order={makeOrder("done")} />);
    expect(screen.queryByText("Ribana")).not.toBeInTheDocument();
  });

  it("shows the ribana row when ribana was consumed", () => {
    useCuttingCostMock.mockReturnValue({
      data: { ...COST, ribana_kg: 1.5, ribana_cost: 75, rib_price_per_kg: 50 },
    });
    renderWithProviders(<CuttingCostSection order={makeOrder("done")} />);
    expect(screen.getByText("Ribana")).toBeInTheDocument();
    expect(screen.getByText("R$75.00")).toBeInTheDocument();
  });

  it("renders nothing for a non-done order", () => {
    useCuttingCostMock.mockReturnValue({ data: undefined });
    const { container } = renderWithProviders(<CuttingCostSection order={makeOrder("cutting")} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the cost has not been computed (404 / no data)", () => {
    useCuttingCostMock.mockReturnValue({ data: undefined });
    const { container } = renderWithProviders(<CuttingCostSection order={makeOrder("done")} />);
    expect(container).toBeEmptyDOMElement();
  });
});
