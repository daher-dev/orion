import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TestProviders } from "@/__tests__/test-utils";
import type { Print } from "@/lib/schemas/print";
import type { PrintOrder } from "@/lib/schemas/print-order";

const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockComplete = vi.fn();

const design: Print = {
  id: "d1",
  company_id: "c1",
  code: "2055",
  name: "Naruto",
  image_url: null,
  cost_per_unit: "5.00",
  technique: "dtf",
  tag: null,
  has_front: true,
  has_back: true,
  image_url_front: null,
  image_url_back: null,
  width_cm: null,
  height_cm: null,
  variations: [
    {
      id: "v1",
      print_design_id: "d1",
      name: "Clássica",
      ink_hex: "#1f1f1f",
      front_file_url: "https://x/front.png",
      front_status: "ok",
      back_file_url: null,
      back_status: "pending",
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    },
  ],
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

vi.mock("@/hooks/use-prints", () => ({
  usePrints: () => ({ data: { items: [design] } }),
}));

vi.mock("@/hooks/use-paper-rolls", () => ({
  usePaperRolls: () => ({
    data: {
      items: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          received_at: "2026-06-01T00:00:00Z",
          supplier_name: "Acme",
          paper_type: "dtf_film",
          width_cm: 60,
          initial_meters: "100",
          current_meters: "80",
          consumed_meters: "20",
          min_stock: null,
          on_hand: "80",
          low_stock: false,
          created_at: "2026-06-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z",
        },
      ],
    },
  }),
}));

vi.mock("@/hooks/use-print-orders", () => ({
  useCreatePrintOrder: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdatePrintOrder: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useCompletePrintOrder: () => ({ mutateAsync: mockComplete, isPending: false }),
}));

import { PrintOrderDetailSheet } from "@/components/printing/PrintOrderDetailSheet";

const order: PrintOrder = {
  id: "o1",
  code: "IM-ABCDEF12",
  design: { id: "d1", code: "2055", name: "Naruto", technique: "dtf", image_url: null },
  paper_roll: {
    id: "11111111-1111-1111-1111-111111111111",
    code: "BP-111111",
    paper_type: "dtf_film",
  },
  status: "printing",
  technique: "dtf",
  rate_m_per_piece: 0.35,
  total_planned: 14,
  total_printed: 4,
  estimated_meters: 1.4,
  meters_consumed: null,
  printed_at: null,
  outputs: [
    {
      print_design_variation_id: "v1",
      variation: { id: "v1", name: "Clássica", ink_hex: "#1f1f1f" },
      side: "front",
      planned_quantity: 10,
      printed_quantity: 4,
    },
    {
      print_design_variation_id: "v1",
      variation: { id: "v1", name: "Clássica", ink_hex: "#1f1f1f" },
      side: "back",
      planned_quantity: 4,
      printed_quantity: 0,
    },
  ],
  created_at: "2026-06-14T10:00:00Z",
  updated_at: "2026-06-14T10:00:00Z",
};

function renderSheet(o: PrintOrder | null = order) {
  render(
    <TestProviders>
      <PrintOrderDetailSheet order={o} open onOpenChange={() => {}} />
    </TestProviders>,
  );
}

describe("PrintOrderDetailSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both side grids (front + back) hydrated from the order outputs", () => {
    renderSheet();
    expect(screen.getByTestId("print-order-side-grid")).toBeTruthy();
    expect(screen.getByTestId("print-order-side-grid-front")).toBeTruthy();
    expect(screen.getByTestId("print-order-side-grid-back")).toBeTruthy();
  });

  it("computes the paper consumption preview (previsto = rate * total_printed)", () => {
    renderSheet();
    // total_printed in the hydrated grade = 4 (front) + 0 (back); rate 0.35 → 1.4 m.
    expect(screen.getByText(/1\.4/)).toBeTruthy();
    // No consumed entered yet → Δ shows the em-dash placeholder.
    expect(screen.getByTestId("print-order-consumed-delta").textContent).toBe("—");
  });

  it("updates the Δ when a consumed value is entered", () => {
    renderSheet();
    const consumed = screen.getByTestId("print-order-consumed") as HTMLInputElement;
    fireEvent.focus(consumed);
    fireEvent.change(consumed, { target: { value: "2" } });
    fireEvent.blur(consumed);
    // 2.0 consumed − 1.4 previsto = +0.6
    expect(screen.getByTestId("print-order-consumed-delta").textContent).toContain("0.6");
  });

  it("shows the Lançar impressos button while pending and 'No estoque' once posted", () => {
    renderSheet();
    expect(screen.getByTestId("print-order-launch")).toBeTruthy();

    vi.clearAllMocks();
    renderSheet({ ...order, printed_at: "2026-06-14T12:00:00Z", status: "done" });
    expect(screen.getAllByTestId("print-order-in-stock").length).toBeGreaterThan(0);
  });
});
