import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useCompletePrintOrder,
  useCreatePrintOrder,
  usePrintOrders,
  useUpdatePrintOrder,
} from "@/hooks/use-print-orders";
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
  }),
}));

const sampleOrder = {
  id: "11111111-1111-1111-1111-111111111111",
  code: "IM-ABCDEF12",
  design: { id: "d1", code: "2055", name: "Naruto", technique: "dtf", image_url: null },
  paper_roll: null,
  status: "pending",
  technique: "dtf",
  rate_m_per_piece: 0.35,
  total_planned: 8,
  total_printed: 0,
  estimated_meters: 0,
  meters_consumed: null,
  printed_at: null,
  outputs: [],
  created_at: "2026-06-14T10:00:00Z",
  updated_at: "2026-06-14T10:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("usePrintOrders", () => {
  it("fetches the list and forwards q + status filters", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/print-orders", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [sampleOrder], total: 1, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(() => usePrintOrders({ q: "naruto", status: "printing" }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].code).toBe("IM-ABCDEF12");
    expect(captured!.searchParams.get("q")).toBe("naruto");
    expect(captured!.searchParams.get("status")).toBe("printing");
  });
});

describe("useCreatePrintOrder", () => {
  it("POSTs the create payload with planned_outputs", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/print-orders", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(sampleOrder, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useCreatePrintOrder(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        print_design_id: "d1",
        paper_roll_id: null,
        planned_outputs: [{ print_design_variation_id: "v1", side: "front", planned_quantity: 8 }],
      });
    });

    expect(body).toMatchObject({ print_design_id: "d1" });
    expect((body as unknown as { planned_outputs: unknown[] }).planned_outputs).toHaveLength(1);
  });
});

describe("useUpdatePrintOrder", () => {
  it("PATCHes printed_outputs by id", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch("http://api.test/v1/print-orders/:id", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(sampleOrder);
      }),
    );

    const { result } = renderHook(() => useUpdatePrintOrder(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        id: sampleOrder.id,
        payload: { printed_outputs: [{ print_design_variation_id: "v1", side: "front", printed_quantity: 8 }] },
      });
    });

    expect((body as unknown as { printed_outputs: unknown[] }).printed_outputs).toHaveLength(1);
  });
});

describe("useCompletePrintOrder", () => {
  it("POSTs to /complete and invalidates printedTransfers + paperRolls", async () => {
    server.use(
      http.post("http://api.test/v1/print-orders/:id/complete", () =>
        HttpResponse.json({ ...sampleOrder, status: "done", printed_at: "2026-06-14T11:00:00Z" }),
      ),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCompletePrintOrder(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ id: sampleOrder.id, payload: { meters_consumed: "2.80" } });
    });

    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated).toContain(JSON.stringify(qk.printedTransfers.all()));
    expect(invalidated).toContain(JSON.stringify(qk.paperRolls.all()));
    expect(invalidated).toContain(JSON.stringify(qk.printOrders.all()));
  });
});
