import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  usePrintStockLevels,
  usePrintStockMovements,
  useCreatePrintStockEntry,
  useCreatePrintStockExit,
} from "@/hooks/use-print-stock";
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

const sampleLevel = {
  print_design_id: "11111111-1111-1111-1111-111111111111",
  product_color: "Preto",
  design: { id: "11111111-1111-1111-1111-111111111111", code: "EST01", name: "Estampa", image_url: null },
  on_hand: 11,
  entries_total: 15,
  exits_total: 4,
  last_movement_at: "2026-05-10T12:00:00Z",
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("usePrintStockLevels", () => {
  it("fetches the levels page", async () => {
    server.use(
      http.get("http://api.test/v1/print-stock/levels", () =>
        HttpResponse.json({ items: [sampleLevel], total: 1, page: 1, page_size: 50, has_more: false }),
      ),
    );
    const { result } = renderHook(() => usePrintStockLevels(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].design.code).toBe("EST01");
  });

  it("forwards print_design_id as a query param", async () => {
    server.use(
      http.get("http://api.test/v1/print-stock/levels", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("print_design_id")).toBe("did-1");
        return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 50, has_more: false });
      }),
    );
    const { result } = renderHook(() => usePrintStockLevels({ print_design_id: "did-1" }), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("usePrintStockMovements", () => {
  it("forwards direction when filtering", async () => {
    server.use(
      http.get("http://api.test/v1/print-stock/movements", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("direction")).toBe("exit");
        return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 50, has_more: false });
      }),
    );
    const { result } = renderHook(() => usePrintStockMovements({ direction: "exit" }), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreatePrintStockEntry", () => {
  it("POSTs the entry payload", async () => {
    server.use(
      http.post("http://api.test/v1/print-stock/entries", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.print_design_id).toBe("did-1");
        expect(body.product_color).toBe("Preto");
        return HttpResponse.json(
          {
            id: "mid",
            print_design_id: "did-1",
            product_color: "Preto",
            direction: "entry",
            quantity: 5,
            notes: null,
            created_at: "2026-05-10T12:00:00Z",
          },
          { status: 201 },
        );
      }),
    );
    const { result } = renderHook(() => useCreatePrintStockEntry(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await act(async () => {
      const data = await result.current.mutateAsync({
        print_design_id: "did-1",
        product_color: "Preto",
        quantity: 5,
      });
      expect(data.id).toBe("mid");
      expect(data.direction).toBe("entry");
    });
  });
});

describe("useCreatePrintStockExit", () => {
  it("POSTs the exit payload", async () => {
    server.use(
      http.post("http://api.test/v1/print-stock/exits", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.print_design_id).toBe("did-1");
        return HttpResponse.json(
          {
            id: "xid",
            print_design_id: "did-1",
            product_color: "Preto",
            direction: "exit",
            quantity: 3,
            notes: null,
            created_at: "2026-05-10T12:00:00Z",
          },
          { status: 201 },
        );
      }),
    );
    const { result } = renderHook(() => useCreatePrintStockExit(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await act(async () => {
      const data = await result.current.mutateAsync({
        print_design_id: "did-1",
        product_color: "Preto",
        quantity: 3,
      });
      expect(data.id).toBe("xid");
      expect(data.direction).toBe("exit");
    });
  });
});
