import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PedidosBoard } from "@/components/orders/PedidosBoard";
import { TestProviders } from "@/__tests__/test-utils";
import type { Order } from "@/lib/schemas/order";
import type { BatchListItem } from "@/lib/schemas/batch";

// `@/i18n/routing` reaches into next-intl navigation (needs a real Next
// runtime); the channel chip + router transitively touch it. Stub it.
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// The board mounts OrderDetailSheet/VincularSheet/EtiquetaModal lazily; their
// hooks must not hit the network. They render closed (no open order), so
// no-op data is enough.
vi.mock("@/hooks/use-orders", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    useOrder: () => ({ data: null, isPending: false, isError: false }),
    useDeleteOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useTransitionOrderStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock("@/hooks/use-mapping", () => ({
  useMappingItems: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useAcceptSuggestion: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetVariation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-products", () => ({
  useProducts: () => ({ data: { items: [] }, isPending: false }),
}));

// OrderDetailSheet/VincularSheet (mounted closed by the board) reach for
// permissions, which transitively needs the AuthProvider. Stub it.
vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: () => true,
}));

const createBatchMock = vi.fn();
vi.mock("@/hooks/use-batches", () => ({
  useCreateBatch: () => ({ mutateAsync: createBatchMock, isPending: false }),
}));

const generateMock = vi.fn();
vi.mock("@/hooks/use-separation", () => ({
  useGenerateLabels: () => ({ mutateAsync: generateMock, isPending: false }),
}));

let counter = 0;
function makeOrder(over: Partial<Order>): Order {
  counter += 1;
  return {
    id: `order-${counter}-0000-0000-0000-000000000000`,
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
    quantity: 2,
    sale_price: null,
    ordered_at: "2026-06-10T12:00:00Z",
    status: "pending",
    external_order_id: `EXT-${counter}`,
    batch_id: null,
    ready: false,
    on_hand: 0,
    has_unmapped_items: false,
    created_at: "2026-06-10T12:00:00Z",
    updated_at: "2026-06-10T12:00:00Z",
    ...over,
  };
}

const sampleBatch: BatchListItem = {
  id: "batch-1",
  code: "BATCH-20260610-0001",
  name: null,
  status: "open",
  total_orders: 1,
  total_pieces: 2,
  created_at: "2026-06-10T13:00:00Z",
};

function renderBoard(orders: Order[], batches: BatchListItem[] = []) {
  return render(
    <TestProviders>
      <PedidosBoard orders={orders} batches={batches} canWrite />
    </TestProviders>,
  );
}

describe("PedidosBoard readiness gating", () => {
  it("buckets an order with unmapped items into Mapeamento", () => {
    const order = makeOrder({ has_unmapped_items: true });
    renderBoard([order]);
    const col = screen.getByTestId("board-column-mapeamento");
    expect(within(col).getByTestId(`order-card-${order.id}`)).toBeInTheDocument();
    // and not in Separação
    const sep = screen.getByTestId("board-column-separacao");
    expect(within(sep).queryByTestId(`order-card-${order.id}`)).toBeNull();
  });

  it("buckets a not-ready, mapped order into Produção", () => {
    const order = makeOrder({ ready: false, on_hand: 0, has_unmapped_items: false });
    renderBoard([order]);
    const col = screen.getByTestId("board-column-producao");
    expect(within(col).getByTestId(`order-card-${order.id}`)).toBeInTheDocument();
  });

  it("buckets a ready, unbatched order into Separação and shows its label action", () => {
    const order = makeOrder({ ready: true, on_hand: 2, has_unmapped_items: false });
    renderBoard([order]);
    const col = screen.getByTestId("board-column-separacao");
    expect(within(col).getByTestId(`order-card-${order.id}`)).toBeInTheDocument();
    // Separação cards expose the "print labels" footer action + a select box.
    expect(
      within(col).getByTestId(`order-card-etiquetas-${order.id}`),
    ).toBeInTheDocument();
    expect(
      within(col).getByTestId(`order-card-select-${order.id}`),
    ).toBeInTheDocument();
  });

  it("keeps a batched order out of the three order columns (it lives in Envio as a lote)", () => {
    const order = makeOrder({ ready: true, batch_id: "batch-1" });
    renderBoard([order], [sampleBatch]);
    for (const stage of ["mapeamento", "producao", "separacao"]) {
      const col = screen.getByTestId(`board-column-${stage}`);
      expect(within(col).queryByTestId(`order-card-${order.id}`)).toBeNull();
    }
    const envio = screen.getByTestId("board-column-envio");
    expect(within(envio).getByTestId(`board-lote-${sampleBatch.id}`)).toBeInTheDocument();
  });

  it("shows the Vincular action only on Mapeamento cards", () => {
    const unmapped = makeOrder({ has_unmapped_items: true });
    const ready = makeOrder({ ready: true, on_hand: 2 });
    renderBoard([unmapped, ready]);
    expect(
      screen.getByTestId(`order-card-vincular-${unmapped.id}`),
    ).toBeInTheDocument();
    // the ready (Separação) card has no Vincular button
    expect(
      screen.queryByTestId(`order-card-vincular-${ready.id}`),
    ).toBeNull();
  });
});
