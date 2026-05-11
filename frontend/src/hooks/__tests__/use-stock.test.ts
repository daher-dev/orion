import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useStockLevels,
  useStockMovements,
  useCreateStockEntry,
  useCreateStockExit,
} from "@/hooks/use-stock";
import { TestProviders } from "@/__tests__/test-utils";

vi.mock("@/hooks/use-api", () => ({
  useApi: () => ({
    get: <T,>(path: string, opts?: { query?: Record<string, string | number | boolean> }) => {
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
    delete: <T,>(path: string) =>
      fetch(`http://api.test${path}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return undefined as T;
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
  }),
}));

const sampleRow = {
  variation_id: "11111111-1111-1111-1111-111111111111",
  sku: "CAM01-M-BLK",
  size: "m",
  color: "Preto",
  color_code: "BLK",
  product: {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    name: "Camiseta",
    code: "aaaaaaaa",
  },
  on_hand: 12,
  entries_total: 15,
  exits_total: 3,
  last_movement_at: "2026-05-10T12:00:00Z",
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useStockLevels", () => {
  it("fetches the levels page", async () => {
    server.use(
      http.get("http://api.test/v1/stock/levels", () =>
        HttpResponse.json({
          items: [sampleRow],
          total: 1,
          page: 1,
          page_size: 50,
          has_more: false,
        }),
      ),
    );
    const { result } = renderHook(() => useStockLevels(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].sku).toBe("CAM01-M-BLK");
  });

  it("forwards low_stock_only as a query param", async () => {
    server.use(
      http.get("http://api.test/v1/stock/levels", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("low_stock_only")).toBe("true");
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 50,
          has_more: false,
        });
      }),
    );
    const { result } = renderHook(() => useStockLevels({ low_stock_only: true }), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useStockMovements", () => {
  it("forwards variation_id when filtering", async () => {
    server.use(
      http.get("http://api.test/v1/stock/movements", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("variation_id")).toBe("vid-1");
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 50,
          has_more: false,
        });
      }),
    );
    const { result } = renderHook(() => useStockMovements({ variation_id: "vid-1" }), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreateStockEntry", () => {
  it("POSTs the entry payload", async () => {
    server.use(
      http.post("http://api.test/v1/stock/entries", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.variation_id).toBe("vid-1");
        return HttpResponse.json(
          {
            id: "eid",
            variation_id: "vid-1",
            sku: "CAM01-M-BLK",
            source: "adjustment",
            quantity: 5,
            notes: null,
            created_at: "2026-05-10T12:00:00Z",
            shipment: null,
          },
          { status: 201 },
        );
      }),
    );
    const { result } = renderHook(() => useCreateStockEntry(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await act(async () => {
      const data = await result.current.mutateAsync({
        variation_id: "vid-1",
        quantity: 5,
        source: "adjustment",
      });
      expect(data.id).toBe("eid");
    });
  });
});

describe("useCreateStockExit", () => {
  it("POSTs the exit payload", async () => {
    server.use(
      http.post("http://api.test/v1/stock/exits", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.variation_id).toBe("vid-1");
        return HttpResponse.json(
          {
            id: "xid",
            variation_id: "vid-1",
            sku: "CAM01-M-BLK",
            reason: "loss",
            quantity: 3,
            notes: null,
            created_at: "2026-05-10T12:00:00Z",
            order: null,
          },
          { status: 201 },
        );
      }),
    );
    const { result } = renderHook(() => useCreateStockExit(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await act(async () => {
      const data = await result.current.mutateAsync({
        variation_id: "vid-1",
        quantity: 3,
        reason: "loss",
      });
      expect(data.id).toBe("xid");
    });
  });
});
