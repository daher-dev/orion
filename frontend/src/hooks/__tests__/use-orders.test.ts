import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useOrders,
  useOrder,
  useCreateOrder,
  useTransitionOrderStatus,
  useDeleteOrder,
} from "@/hooks/use-orders";
import { TestProviders, makeQueryClient } from "@/__tests__/test-utils";

vi.mock("@/hooks/use-api", () => ({
  useApi: () => ({
    get: <T,>(path: string, opts?: { query?: Record<string, string> }) => {
      const url = new URL(`http://api.test${path}`);
      if (opts?.query) {
        for (const [key, value] of Object.entries(opts.query)) {
          url.searchParams.set(key, String(value));
        }
      }
      return fetch(url.toString()).then(async (r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return r.status === 204 ? (undefined as T) : ((await r.json()) as T);
      });
    },
    post: <T,>(path: string, body: unknown) =>
      fetch(`http://api.test${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return (await r.json()) as T;
      }),
    patch: <T,>(path: string, body: unknown) =>
      fetch(`http://api.test${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return (await r.json()) as T;
      }),
    delete: <T,>(path: string) =>
      fetch(`http://api.test${path}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return undefined as T;
      }),
  }),
}));

const sampleOrder = {
  id: "11111111-1111-1111-1111-111111111111",
  ad: {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Cropped Verão",
    ecommerce: "shopee" as const,
  },
  variation: {
    id: "33333333-3333-3333-3333-333333333333",
    sku: "CAM01-M-BLK",
    size: "m" as const,
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
  status: "pending" as const,
  external_order_id: "EXT-1",
  created_at: "2026-05-10T12:00:00Z",
  updated_at: "2026-05-10T12:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useOrders", () => {
  it("fetches and returns the orders page", async () => {
    server.use(
      http.get("http://api.test/v1/orders", () =>
        HttpResponse.json({
          items: [sampleOrder],
          total: 1,
          page: 1,
          page_size: 50,
          has_more: false,
        }),
      ),
    );
    const { result } = renderHook(() => useOrders(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].id).toBe(sampleOrder.id);
  });

  it("forwards status + channel filters", async () => {
    server.use(
      http.get("http://api.test/v1/orders", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("status")).toBe("paid");
        expect(url.searchParams.get("channel")).toBe("shopee");
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 50,
          has_more: false,
        });
      }),
    );
    const { result } = renderHook(
      () => useOrders({ status: "paid", channel: "shopee" }),
      { wrapper: ({ children }) => TestProviders({ children }) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useOrder", () => {
  it("fetches detail by id", async () => {
    server.use(
      http.get("http://api.test/v1/orders/:id", ({ params }) => {
        expect(params.id).toBe(sampleOrder.id);
        return HttpResponse.json(sampleOrder);
      }),
    );
    const { result } = renderHook(() => useOrder(sampleOrder.id), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(sampleOrder.id);
  });

  it("does not fire when id is null", async () => {
    let calls = 0;
    server.use(
      http.get("http://api.test/v1/orders/:id", () => {
        calls += 1;
        return HttpResponse.json(sampleOrder);
      }),
    );
    renderHook(() => useOrder(null), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBe(0);
  });
});

describe("useCreateOrder", () => {
  it("invalidates the orders list on success", async () => {
    let listCalls = 0;
    server.use(
      http.get("http://api.test/v1/orders", () => {
        listCalls += 1;
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 50,
          has_more: false,
        });
      }),
      http.post("http://api.test/v1/orders", async () =>
        HttpResponse.json(sampleOrder, { status: 201 }),
      ),
    );
    const queryClient = makeQueryClient();
    const { result } = renderHook(
      () => ({ list: useOrders(), create: useCreateOrder() }),
      { wrapper: ({ children }) => TestProviders({ children, queryClient }) },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(listCalls).toBe(1);

    await act(async () => {
      await result.current.create.mutateAsync({
        ad_id: sampleOrder.ad.id,
        variation_id: sampleOrder.variation.id,
        client_id: sampleOrder.client.id,
        quantity: 1,
        sale_price: "10.00",
        ordered_at: "2026-05-11T10:00:00Z",
      });
    });
    await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2));
  });
});

describe("useTransitionOrderStatus", () => {
  it("posts to /status and invalidates detail", async () => {
    let detailCalls = 0;
    server.use(
      http.get("http://api.test/v1/orders/:id", () => {
        detailCalls += 1;
        return HttpResponse.json(sampleOrder);
      }),
      http.post(
        "http://api.test/v1/orders/:id/status",
        async ({ request, params }) => {
          const body = (await request.json()) as { status: string };
          expect(params.id).toBe(sampleOrder.id);
          expect(body.status).toBe("paid");
          return HttpResponse.json({ ...sampleOrder, status: "paid" });
        },
      ),
    );
    const queryClient = makeQueryClient();
    const { result } = renderHook(
      () => ({
        detail: useOrder(sampleOrder.id),
        transition: useTransitionOrderStatus(),
      }),
      { wrapper: ({ children }) => TestProviders({ children, queryClient }) },
    );
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
    expect(detailCalls).toBe(1);

    await act(async () => {
      await result.current.transition.mutateAsync({
        id: sampleOrder.id,
        status: "paid",
      });
    });
    await waitFor(() => expect(detailCalls).toBeGreaterThanOrEqual(2));
  });
});

describe("useDeleteOrder", () => {
  it("invalidates list on success", async () => {
    let listCalls = 0;
    server.use(
      http.get("http://api.test/v1/orders", () => {
        listCalls += 1;
        return HttpResponse.json({
          items: [sampleOrder],
          total: 1,
          page: 1,
          page_size: 50,
          has_more: false,
        });
      }),
      http.delete(
        "http://api.test/v1/orders/:id",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const queryClient = makeQueryClient();
    const { result } = renderHook(
      () => ({ list: useOrders(), del: useDeleteOrder() }),
      { wrapper: ({ children }) => TestProviders({ children, queryClient }) },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(listCalls).toBe(1);

    await act(async () => {
      await result.current.del.mutateAsync(sampleOrder.id);
    });
    await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2));
  });
});
