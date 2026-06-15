import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useAssemble, useBuildable } from "@/hooks/use-assembly";
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

const sampleRow = {
  printed_transfer_id: "pt1",
  design: { id: "d1", code: "2055", name: "Naruto", technique: "dtf", image_url: null },
  side: "front",
  printed_on_hand: 12,
  blank: {
    blank_piece_id: "bp1",
    spec: { id: "s1", code: "CAM01", name: "Camiseta" },
    size: "m",
    color: "Preto",
    color_code: "PRT",
    on_hand: 9,
  },
  sku: "CAM01-M-PRT-2055",
  max_buildable: 9,
  product_type: "tshirt",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useBuildable", () => {
  it("fetches the buildable list and forwards print_design_id + spec_id filters", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/assembly/buildable", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [sampleRow], total: 1, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(() => useBuildable({ print_design_id: "d1", spec_id: "s1" }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].max_buildable).toBe(9);
    expect(captured!.searchParams.get("print_design_id")).toBe("d1");
    expect(captured!.searchParams.get("spec_id")).toBe("s1");
  });
});

describe("useAssemble", () => {
  it("POSTs the assemble body and invalidates blankStock + printedTransfers + stock", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/assembly", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: "run1",
            blank_piece_id: "bp1",
            printed_transfer_id: "pt1",
            variation: { id: "var1", sku: "CAM01-M-PRT-2055", size: "m", color: "Preto", color_code: "PRT" },
            sku: "CAM01-M-PRT-2055",
            quantity: 5,
            created_new_variation: true,
            batch_id: null,
            created_at: "2026-06-14T12:00:00Z",
          },
          { status: 201 },
        );
      }),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useAssemble(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ blank_piece_id: "bp1", printed_transfer_id: "pt1", quantity: 5 });
    });

    expect(body).toMatchObject({ blank_piece_id: "bp1", printed_transfer_id: "pt1", quantity: 5 });

    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated).toContain(JSON.stringify(qk.blankStock.all()));
    expect(invalidated).toContain(JSON.stringify(qk.printedTransfers.all()));
    expect(invalidated).toContain(JSON.stringify(qk.stock.all()));
    expect(invalidated).toContain(JSON.stringify(qk.assembly.buildable()));
  });
});
