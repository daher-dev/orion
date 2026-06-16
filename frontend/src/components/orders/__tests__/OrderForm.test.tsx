import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrderForm } from "@/components/orders/OrderForm";
import { TestProviders } from "@/__tests__/test-utils";

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({
    data: {
      items: [
        {
          id: "client-1",
          name: "Mariana Costa",
          email: "mariana@example.com",
          phone: null,
          address: null,
          created_at: "2026-05-10T12:00:00Z",
          updated_at: "2026-05-10T12:00:00Z",
        },
      ],
    },
  }),
}));

vi.mock("@/hooks/use-ads", () => ({
  useAds: () => ({
    data: {
      items: [
        {
          id: "ad-1",
          title: "Cropped Verão",
          ecommerce: "shopee",
          external_id: null,
          products: [{ id: "product-1", name: "Cropped Oversized", code: "CAM01" }],
          created_at: "2026-05-10T12:00:00Z",
          updated_at: "2026-05-10T12:00:00Z",
        },
      ],
    },
  }),
}));

vi.mock("@/hooks/use-products", () => ({
  useProducts: () => ({
    data: {
      items: [
        {
          id: "product-1",
          company_id: "co-1",
          name: "Cropped Oversized",
          product_type: "camiseta",
          spec_id: "spec-1",
          print_id: null,
          variations: [
            {
              id: "var-1",
              size: "m",
              color: "Preto",
              color_code: "BLK",
              sku: "CAM01-M-BLK",
              created_at: "2026-05-10T12:00:00Z",
              updated_at: "2026-05-10T12:00:00Z",
            },
          ],
          created_at: "2026-05-10T12:00:00Z",
          updated_at: "2026-05-10T12:00:00Z",
        },
      ],
    },
  }),
}));

describe("OrderForm", () => {
  it("renders client / ad / variation labels", () => {
    render(
      <TestProviders>
        <OrderForm formId="t1" onSubmit={() => {}} />
      </TestProviders>,
    );
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Ad")).toBeInTheDocument();
    expect(screen.getByText("Variation")).toBeInTheDocument();
    expect(screen.getByText("Quantity")).toBeInTheDocument();
    expect(screen.getByText("Unit price")).toBeInTheDocument();
    expect(screen.getByText("Order date")).toBeInTheDocument();
  });

  it("does not submit when required references are empty", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <TestProviders>
        <OrderForm formId="t2" onSubmit={onSubmit} />
      </TestProviders>,
    );
    const form = container.querySelector("form#t2") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => {
      // Multiple validation errors should appear (client, ad, variation)
      const errors = container.querySelectorAll('[role="alert"]');
      expect(errors.length).toBeGreaterThan(0);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefills with initial values", () => {
    render(
      <TestProviders>
        <OrderForm
          formId="t3"
          initial={{
            id: "11111111-1111-1111-1111-111111111111",
            ad: { id: "ad-1", title: "Cropped Verão", ecommerce: "shopee" },
            variation: {
              id: "var-1",
              sku: "CAM01-M-BLK",
              size: "m",
              color: "Preto",
              color_code: "BLK",
              product: { id: "product-1", name: "Cropped Oversized", code: "CAM01" },
            },
            client: { id: "client-1", name: "Mariana Costa", email: "mariana@example.com" },
            quantity: 3,
            sale_price: "149.00",
            ordered_at: "2026-05-10T12:00:00Z",
            status: "pending",
            external_order_id: "EXT-1",
            batch_id: null,
            ready: false,
            on_hand: 0,
            has_unmapped_items: false,
            created_at: "2026-05-10T12:00:00Z",
            updated_at: "2026-05-10T12:00:00Z",
          }}
          onSubmit={() => {}}
        />
      </TestProviders>,
    );
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
    // sale_price renders through NumberInput with decimals=2 → pt-BR "149,00".
    expect(screen.getByDisplayValue("149,00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("EXT-1")).toBeInTheDocument();
  });
});
