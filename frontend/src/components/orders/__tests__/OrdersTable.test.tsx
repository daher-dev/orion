import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { TestProviders } from "@/__tests__/test-utils";
import type { Order } from "@/lib/schemas/order";

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: () => true,
}));

vi.mock("@/hooks/use-orders", () => ({
  useDeleteOrder: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

const baseOrder: Order = {
  id: "11111111-1111-1111-1111-111111111111",
  ad: {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Cropped Verão",
    ecommerce: "shopee",
  },
  variation: {
    id: "33333333-3333-3333-3333-333333333333",
    sku: "CAM01-M-BLK",
    size: "m",
    color: "Preto",
    color_code: "BLK",
    product: {
      id: "44444444-4444-4444-4444-444444444444",
      name: "Cropped Oversized",
      code: "CAM01",
    },
  },
  client: {
    id: "55555555-5555-5555-5555-555555555555",
    name: "Mariana Costa",
    email: "mariana@example.com",
  },
  quantity: 2,
  sale_price: "149.00",
  ordered_at: "2026-05-10T12:00:00Z",
  status: "pending",
  external_order_id: "EXT-1",
  created_at: "2026-05-10T12:00:00Z",
  updated_at: "2026-05-10T12:00:00Z",
};

const secondOrder: Order = {
  ...baseOrder,
  id: "66666666-6666-6666-6666-666666666666",
  status: "shipped",
  ad: { ...baseOrder.ad, ecommerce: "instagram", title: "IG Drop" },
  client: { ...baseOrder.client, name: "Felipe Andrade", email: null },
  external_order_id: null,
};

describe("OrdersTable", () => {
  it("renders order code, client, channel chip and status pill", () => {
    render(
      <TestProviders>
        <OrdersTable rows={[baseOrder]} />
      </TestProviders>,
    );
    // Order code is derived from the first 8 hex chars of the uuid.
    expect(screen.getByText("ORD-11111111")).toBeInTheDocument();
    expect(screen.getByText("Mariana Costa")).toBeInTheDocument();
    expect(screen.getByText("Cropped Oversized")).toBeInTheDocument();
    // Status pill
    expect(screen.getByTestId("order-status-pending")).toBeInTheDocument();
    // Channel chip with `SH` short code (terracotta + white)
    expect(screen.getByTestId("channel-chip-shopee")).toBeInTheDocument();
  });

  it("renders the external order id under the code when present", () => {
    render(
      <TestProviders>
        <OrdersTable rows={[baseOrder, secondOrder]} />
      </TestProviders>,
    );
    expect(screen.getByText("EXT-1")).toBeInTheDocument();
  });

  it("opens the delete confirmation when delete is clicked", () => {
    render(
      <TestProviders>
        <OrdersTable rows={[baseOrder]} />
      </TestProviders>,
    );
    const deleteButtons = screen.getAllByLabelText("Delete");
    fireEvent.click(deleteButtons[0]);
    expect(
      screen.getByText("Delete this order? This cannot be undone."),
    ).toBeInTheDocument();
  });

  it("renders a different channel chip per row", () => {
    render(
      <TestProviders>
        <OrdersTable rows={[baseOrder, secondOrder]} />
      </TestProviders>,
    );
    expect(screen.getByTestId("channel-chip-shopee")).toBeInTheDocument();
    expect(screen.getByTestId("channel-chip-instagram")).toBeInTheDocument();
  });
});
