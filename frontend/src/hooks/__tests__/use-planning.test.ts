import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useCreateCuttingOrders,
  useCreatePrintOrders,
  usePlanningSuggestions,
} from "@/hooks/use-planning";
import { qk } from "@/lib/query-keys";

function makeWrapper(client?: QueryClient) {
  const c =
    client ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: c }, children);
  Wrapper.displayName = "QueryWrapper";
  return Wrapper;
}

vi.mock("@/hooks/use-api", () => ({
  useApi: () => ({
    get: <T,>(path: string, opts?: { query?: Record<string, string | number | boolean> }) => {
      const url = new URL(`http://api.test${path}`);
      if (opts?.query) {
        for (const [key, value] of Object.entries(opts.query)) url.searchParams.set(key, String(value));
      }
      return fetch(url.toString()).then(async (r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return (await r.json()) as T;
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
  }),
}));

const sampleSuggestions = {
  skus: [],
  cortes: [
    {
      key: "spec1|PRT",
      spec: { id: "spec1", code: "CAM01", name: "Camiseta" },
      product_type: "tshirt",
      color: "Preto",
      color_code: "PRT",
      total: 12,
      demand: 8,
      stock: 4,
      order_count: 3,
      grade_rows: [{ size: "m", qty: 12, demand_qty: 8, stock_qty: 4 }],
      sources: ["demanda", "estoque"],
    },
  ],
  impressoes: [
    {
      key: "design1",
      design: { id: "design1", code: "2055", name: "Naruto", technique: "dtf", image_url: null },
      total: 10,
      demand: 10,
      stock: 0,
      order_count: 3,
      png: "ok",
      sources: ["demanda"],
    },
  ],
  totals: { toCut: 12, toPrint: 10, cortes: 1, impressoes: 1, demandDriven: 2, stockDriven: 1 },
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("usePlanningSuggestions", () => {
  it("GETs the suggestions model", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/planning/suggestions", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json(sampleSuggestions);
      }),
    );

    const { result } = renderHook(() => usePlanningSuggestions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totals.toCut).toBe(12);
    expect(result.current.data?.cortes[0].key).toBe("spec1|PRT");
    expect(result.current.data?.impressoes[0].key).toBe("design1");
    expect(captured!.pathname).toBe("/v1/planning/suggestions");
  });
});

describe("useCreateCuttingOrders", () => {
  it("POSTs the selected keys and invalidates planning + cutting + blankStock", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/planning/cutting-orders", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            created: [{ key: "spec1|PRT", cutting_order_id: "co1", code: "CO-ABCDEF12", total: 12 }],
            skipped: [],
            created_count: 1,
          },
          { status: 201 },
        );
      }),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateCuttingOrders(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ keys: ["spec1|PRT"] });
    });

    expect(body).toEqual({ keys: ["spec1|PRT"] });

    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated).toContain(JSON.stringify(qk.planning.suggestions()));
    expect(invalidated).toContain(JSON.stringify(qk.cutting.all()));
    expect(invalidated).toContain(JSON.stringify(qk.blankStock.all()));
  });
});

describe("useCreatePrintOrders", () => {
  it("POSTs the selected keys and invalidates planning + printOrders + printedTransfers", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/planning/print-orders", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            created: [{ key: "design1", print_order_id: "po1", code: "IM-ABCDEF12", total: 10 }],
            skipped: [],
            created_count: 1,
          },
          { status: 201 },
        );
      }),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreatePrintOrders(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ keys: ["design1"] });
    });

    expect(body).toEqual({ keys: ["design1"] });

    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated).toContain(JSON.stringify(qk.planning.suggestions()));
    expect(invalidated).toContain(JSON.stringify(qk.printOrders.all()));
    expect(invalidated).toContain(JSON.stringify(qk.printedTransfers.all()));
  });
});
