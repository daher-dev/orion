import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MappingTable } from "@/components/mapping/MappingTable";
import { TestProviders } from "@/__tests__/test-utils";
import type { MappingItem } from "@/lib/schemas/mapping";

// `@/i18n/routing` reaches into next-intl's navigation module (which expects a
// real Next runtime); the channel chip transitively touches it. Stub it.
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"}>{children}</a>
  ),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

// The manual "Trocar" picker lazily loads the product catalog; the table tests
// here exercise pending/linked rendering, so a no-op catalog is enough.
vi.mock("@/hooks/use-products", () => ({
  useProducts: () => ({ data: { items: [] }, isPending: false }),
}));

const pendingRow: MappingItem = {
  id: "11111111-1111-1111-1111-111111111111",
  order_id: "aaaa1111-1111-1111-1111-111111111111",
  ad_id: "bbbb1111-1111-1111-1111-111111111111",
  ad_title: "Camiseta Naruto Sennin",
  channel: "shopee",
  ad_sku: "AD-NRT-01",
  variation_text: "Preto · M",
  linked: false,
  suggestion: {
    variation_id: "cccc1111-1111-1111-1111-111111111111",
    product_id: "dddd1111-1111-1111-1111-111111111111",
    product_name: "Naruto Sennin",
    sku: "NRT-PRT-M",
    color: "Preto",
    size: "m",
    print_design_code: "EST-009",
    print_design_name: "Sennin",
    score: 4,
  },
};

const linkedRow: MappingItem = {
  id: "22222222-2222-2222-2222-222222222222",
  order_id: "aaaa2222-2222-2222-2222-222222222222",
  ad_id: "bbbb2222-2222-2222-2222-222222222222",
  ad_title: "Moletom Onda Kanagawa",
  channel: "mercado_livre",
  ad_sku: null,
  variation_text: "Branco · G",
  linked: true,
  variation_id: "cccc2222-2222-2222-2222-222222222222",
  sku: "OND-BCO-G",
  product_id: "dddd2222-2222-2222-2222-222222222222",
  product_name: "Onda Kanagawa",
  color: "Branco",
  size: "g",
  print_design_code: "EST-012",
  print_design_name: "Kanagawa",
};

describe("MappingTable", () => {
  it("renders a pending row with its suggestion card (SKU + accept button)", () => {
    render(
      <TestProviders>
        <MappingTable
          rows={[pendingRow]}
          filter="pending"
          onAccept={vi.fn()}
          onSetVariation={vi.fn()}
        />
      </TestProviders>,
    );

    expect(screen.getByText("Camiseta Naruto Sennin")).toBeInTheDocument();
    // Suggestion card shows the suggested product + internal SKU + estampa.
    expect(
      screen.getByTestId("mapping-suggestion-11111111-1111-1111-1111-111111111111"),
    ).toBeInTheDocument();
    expect(screen.getByText("Naruto Sennin")).toBeInTheDocument();
    expect(screen.getByText("NRT-PRT-M")).toBeInTheDocument();
    expect(screen.getByText("EST-009")).toBeInTheDocument();
    // Aceitar button present for a write user.
    expect(
      screen.getByTestId("mapping-accept-11111111-1111-1111-1111-111111111111"),
    ).toBeInTheDocument();
    // The marketplace variation text is surfaced.
    expect(screen.getByText("Preto · M")).toBeInTheDocument();
  });

  it("renders a linked row with its resolved SKU + estampa", () => {
    render(
      <TestProviders>
        <MappingTable
          rows={[linkedRow]}
          filter="linked"
          onAccept={vi.fn()}
          onSetVariation={vi.fn()}
        />
      </TestProviders>,
    );

    expect(
      screen.getByTestId("mapping-linked-22222222-2222-2222-2222-222222222222"),
    ).toBeInTheDocument();
    expect(screen.getByText("OND-BCO-G")).toBeInTheDocument();
    expect(screen.getByText("EST-012")).toBeInTheDocument();
    // No ad SKU → italic "no SKU in the ad" hint (en locale).
    expect(screen.getByText("no SKU in the ad")).toBeInTheDocument();
  });

  it("renders the pending empty state when there are no rows", () => {
    render(
      <TestProviders>
        <MappingTable
          rows={[]}
          filter="pending"
          onAccept={vi.fn()}
          onSetVariation={vi.fn()}
        />
      </TestProviders>,
    );
    expect(screen.getByTestId("mapping-empty")).toBeInTheDocument();
    expect(screen.getByText("No pending items")).toBeInTheDocument();
  });
});
