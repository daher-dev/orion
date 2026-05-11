import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductsTable } from "@/components/products/ProductsTable";
import { TestProviders } from "@/__tests__/test-utils";
import type { Product } from "@/lib/schemas/product";

vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: () => true,
}));

vi.mock("@/hooks/use-products", async () => {
  return {
    useDeleteProduct: () => ({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    }),
  };
});

const fixture: Product[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    company_id: "comp-1",
    name: "Cropped Oversized",
    product_type: "tshirt",
    spec_id: "spec-1",
    print_id: "print-1",
    variations: [
      {
        id: "v1",
        size: "p",
        color: "Preto",
        color_code: "PRT",
        sku: "CAM01-P-PRT-FLR03",
        created_at: "2026-05-10T12:00:00Z",
        updated_at: "2026-05-10T12:00:00Z",
      },
    ],
    created_at: "2026-05-10T12:00:00Z",
    updated_at: "2026-05-10T12:00:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    company_id: "comp-1",
    name: "Box Tee",
    product_type: "tanktop",
    spec_id: "spec-2",
    print_id: null,
    variations: [],
    created_at: "2026-05-10T12:00:00Z",
    updated_at: "2026-05-10T12:00:00Z",
  },
];

const specCodeById = { "spec-1": "CAM01", "spec-2": "REG02" };
const printCodeById = { "print-1": "FLR03" };

describe("ProductsTable", () => {
  it("renders product name + spec code + print code", () => {
    render(
      <TestProviders>
        <ProductsTable
          rows={fixture}
          specCodeById={specCodeById}
          printCodeById={printCodeById}
          onEdit={() => {}}
        />
      </TestProviders>,
    );
    expect(screen.getByText("Cropped Oversized")).toBeInTheDocument();
    expect(screen.getByText("CAM01")).toBeInTheDocument();
    expect(screen.getByText("FLR03")).toBeInTheDocument();
    expect(screen.getByText("Box Tee")).toBeInTheDocument();
  });

  it("shows em-dash when product has no print", () => {
    render(
      <TestProviders>
        <ProductsTable
          rows={fixture}
          specCodeById={specCodeById}
          printCodeById={printCodeById}
          onEdit={() => {}}
        />
      </TestProviders>,
    );
    // Box Tee row has no print_id → em-dash visible.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("invokes onEdit when the edit button is clicked", () => {
    const onEdit = vi.fn();
    render(
      <TestProviders>
        <ProductsTable
          rows={fixture}
          specCodeById={specCodeById}
          printCodeById={printCodeById}
          onEdit={onEdit}
        />
      </TestProviders>,
    );
    fireEvent.click(screen.getAllByLabelText("Edit")[0]);
    expect(onEdit).toHaveBeenCalledWith(fixture[0]);
  });

  it("opens the confirm-delete dialog when delete is clicked", () => {
    render(
      <TestProviders>
        <ProductsTable
          rows={fixture}
          specCodeById={specCodeById}
          printCodeById={printCodeById}
          onEdit={() => {}}
        />
      </TestProviders>,
    );
    fireEvent.click(screen.getAllByLabelText("Delete")[0]);
    expect(
      screen.getByText("Delete this product? This cannot be undone."),
    ).toBeInTheDocument();
  });

  it("renders the variation count column", () => {
    render(
      <TestProviders>
        <ProductsTable
          rows={fixture}
          specCodeById={specCodeById}
          printCodeById={printCodeById}
          onEdit={() => {}}
        />
      </TestProviders>,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
