import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VincularSheet } from "@/components/mapping/VincularSheet";
import { TestProviders } from "@/__tests__/test-utils";
import type { Order } from "@/lib/schemas/order";
import type { MappingItem } from "@/lib/schemas/mapping";

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const acceptMock = vi.fn().mockResolvedValue({ sku: "EST-001-PRT-M" });
const setVariationMock = vi.fn().mockResolvedValue({ sku: "EST-001-PRT-G" });

const items: MappingItem[] = [
  {
    id: "item-1",
    order_id: "order-1",
    ad_id: "ad-1",
    ad_title: "Camiseta Naruto Sennin",
    channel: "shopee",
    ad_sku: "AD-NRT-01",
    variation_text: "Preto · M",
    linked: false,
    suggestion: {
      variation_id: "v-1",
      product_id: "p-1",
      product_name: "Naruto Sennin",
      sku: "EST-001-PRT-M",
      color: "Preto",
      size: "m",
      print_design_code: "EST-001",
      print_design_name: "Sennin",
      score: 4,
    },
  },
  // an item belonging to a different order — must be filtered out
  {
    id: "item-other",
    order_id: "order-2",
    ad_id: "ad-2",
    ad_title: "Other order item",
    channel: "shopee",
    ad_sku: null,
    variation_text: null,
    linked: false,
    suggestion: null,
  },
];

vi.mock("@/hooks/use-mapping", () => ({
  useMappingItems: () => ({ data: { items }, isPending: false, isError: false }),
  useAcceptSuggestion: () => ({ mutateAsync: acceptMock, isPending: false }),
  useSetVariation: () => ({ mutateAsync: setVariationMock, isPending: false }),
}));

vi.mock("@/hooks/use-products", () => ({
  useProducts: () => ({
    data: {
      items: [
        {
          id: "p-1",
          name: "Naruto Sennin",
          variations: [
            { id: "v-2", sku: "EST-001-PRT-G", color: "Preto", size: "g", color_code: "PRT" },
          ],
        },
      ],
    },
    isPending: false,
  }),
}));

const order: Order = {
  id: "order-1",
  ad: { id: "ad-1", title: "Camiseta Naruto", ecommerce: "shopee" },
  variation: {
    id: "var-1",
    sku: "EST-001-PRT-M",
    size: "m",
    color: "Preto",
    color_code: "PRT",
    product: { id: "p-1", name: "Naruto", code: "EST-001" },
  },
  client: null,
  quantity: 1,
  sale_price: null,
  ordered_at: "2026-06-10T12:00:00Z",
  status: "pending",
  external_order_id: "EXT-1",
  batch_id: null,
  ready: false,
  on_hand: 0,
  has_unmapped_items: true,
  created_at: "2026-06-10T12:00:00Z",
  updated_at: "2026-06-10T12:00:00Z",
};

afterEach(() => {
  acceptMock.mockClear();
  setVariationMock.mockClear();
});

describe("VincularSheet", () => {
  it("lists only the order's own pending items", () => {
    render(
      <TestProviders>
        <VincularSheet order={order} open onOpenChange={() => {}} />
      </TestProviders>,
    );
    expect(screen.getByTestId("vincular-item-item-1")).toBeInTheDocument();
    // item from a different order is filtered out
    expect(screen.queryByTestId("vincular-item-item-other")).toBeNull();
  });

  it("accepts the system suggestion via the Usar button", async () => {
    render(
      <TestProviders>
        <VincularSheet order={order} open onOpenChange={() => {}} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByTestId("vincular-use-item-1"));
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith("item-1"));
  });

  it("manually links via the product → variation picker (POSTs the chosen variation)", async () => {
    render(
      <TestProviders>
        <VincularSheet order={order} open onOpenChange={() => {}} />
      </TestProviders>,
    );
    // open the product select and pick the product
    fireEvent.click(screen.getByTestId("vincular-product-item-1"));
    fireEvent.click(await screen.findByText("Naruto Sennin"));
    // the variation select now appears; pick the variation
    fireEvent.click(screen.getByTestId("vincular-variation-item-1"));
    fireEvent.click(await screen.findByText(/EST-001-PRT-G/));
    await waitFor(() =>
      expect(setVariationMock).toHaveBeenCalledWith({
        itemId: "item-1",
        payload: { variation_id: "v-2" },
      }),
    );
  });
});
