import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useBatches,
  useBatchDetail,
  useCreateBatch,
  useTransitionBatch,
  useDeleteBatch,
  useAssembleBatch,
  useShipBatch,
} from "@/hooks/use-batches";
import { TestProviders, makeQueryClient } from "@/__tests__/test-utils";

/** Stable wrapper so re-renders don't mint a fresh QueryClient (loses mutation state). */
const wrap = () => {
  const queryClient = makeQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    TestProviders({ children, queryClient });
};

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

const sampleBatch = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  code: "BATCH-20260604-0001",
  name: "Manhã",
  status: "open" as const,
  total_orders: 3,
  total_pieces: 7,
  labels_printed_at: null,
  completed_at: null,
  notes: null,
  created_at: "2026-06-04T12:00:00Z",
  updated_at: "2026-06-04T12:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useBatches", () => {
  it("fetches the batches page and forwards the status filter", async () => {
    server.use(
      http.get("http://api.test/v1/batches", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("status")).toBe("open");
        return HttpResponse.json({
          items: [
            {
              id: sampleBatch.id,
              code: sampleBatch.code,
              name: sampleBatch.name,
              status: "open",
              total_orders: 3,
              total_pieces: 7,
              created_at: sampleBatch.created_at,
            },
          ],
          total: 1,
          page: 1,
          page_size: 50,
          has_more: false,
        });
      }),
    );
    const { result } = renderHook(() => useBatches({ status: "open" }), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].code).toBe(sampleBatch.code);
  });
});

const sampleDetail = {
  ...sampleBatch,
  estampas: [
    {
      design: {
        id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        code: "EST-001",
        name: "Naruto",
        technique: "dtf",
        image_url: null,
      },
      code: "EST-001",
      items: 5,
      to_print: 2,
      montado: 3,
      is_assembled: false,
      enviado: 0,
      is_shipped: false,
    },
  ],
  orders_ready: 1,
  orders_total: 3,
  pieces_total: 7,
  to_print_total: 2,
  needs_assembly: true,
  can_ship: false,
};

describe("useBatchDetail", () => {
  it("fetches the batch detail with its estampa grid + roll-ups", async () => {
    server.use(
      http.get("http://api.test/v1/batches/:id", ({ params }) => {
        expect(params.id).toBe(sampleBatch.id);
        return HttpResponse.json(sampleDetail);
      }),
    );
    const { result } = renderHook(() => useBatchDetail(sampleBatch.id), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.estampas[0].code).toBe("EST-001");
    expect(result.current.data?.to_print_total).toBe(2);
    expect(result.current.data?.needs_assembly).toBe(true);
  });
});

describe("batch mutations", () => {
  it("creates a batch from order ids", async () => {
    let captured: { order_ids: string[]; name: string | null } | undefined;
    server.use(
      http.post("http://api.test/v1/batches", async ({ request }) => {
        captured = (await request.json()) as { order_ids: string[]; name: string | null };
        return HttpResponse.json(sampleBatch);
      }),
    );
    const { result } = renderHook(() => useCreateBatch(), { wrapper: wrap() });
    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync({ order_ids: ["o1", "o2"], name: "Manhã" });
    });
    expect(captured?.order_ids).toEqual(["o1", "o2"]);
    expect(captured?.name).toBe("Manhã");
    expect((returned as { code: string }).code).toBe(sampleBatch.code);
  });

  it("transitions status", async () => {
    let body: { status?: string } | undefined;
    server.use(
      http.post("http://api.test/v1/batches/:id/status", async ({ request }) => {
        body = (await request.json()) as { status?: string };
        return HttpResponse.json({ ...sampleBatch, status: "in_production" });
      }),
    );
    const { result } = renderHook(() => useTransitionBatch(), { wrapper: wrap() });
    let returned: { status?: string } | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: sampleBatch.id, status: "in_production" });
    });
    expect(body?.status).toBe("in_production");
    expect(returned?.status).toBe("in_production");
  });

  it("deletes a batch", async () => {
    let called = false;
    server.use(
      http.delete("http://api.test/v1/batches/:id", () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { result } = renderHook(() => useDeleteBatch(), { wrapper: wrap() });
    await act(async () => {
      await result.current.mutateAsync(sampleBatch.id);
    });
    expect(called).toBe(true);
  });
});

describe("useAssembleBatch", () => {
  it("posts to the assemble endpoint and returns the recomputed grid + summary", async () => {
    let hit = false;
    server.use(
      http.post("http://api.test/v1/batches/:id/assemble", ({ params }) => {
        hit = true;
        expect(params.id).toBe(sampleBatch.id);
        return HttpResponse.json({
          batch: { ...sampleDetail, needs_assembly: false },
          assembled: [
            { variation_id: "v1", sku: "EST-001-PRT-M", quantity: 2 },
          ],
          skipped: [
            { variation_id: "v2", sku: "EST-001-PRT-G", reason: "insufficient_blank" },
          ],
        });
      }),
    );
    const { result } = renderHook(() => useAssembleBatch(), { wrapper: wrap() });
    let returned:
      | { assembled: unknown[]; skipped: { reason: string }[] }
      | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: sampleBatch.id });
    });
    expect(hit).toBe(true);
    expect(returned?.assembled).toHaveLength(1);
    expect(returned?.skipped[0].reason).toBe("insufficient_blank");
  });

  it("forwards partial-montar rows in the request body", async () => {
    let body: { rows?: unknown[] } | undefined;
    server.use(
      http.post("http://api.test/v1/batches/:id/assemble", async ({ request }) => {
        body = (await request.json()) as { rows?: unknown[] };
        return HttpResponse.json({ batch: sampleDetail, assembled: [], skipped: [] });
      }),
    );
    const { result } = renderHook(() => useAssembleBatch(), { wrapper: wrap() });
    await act(async () => {
      await result.current.mutateAsync({
        id: sampleBatch.id,
        payload: { rows: [{ design_id: "d1", quantity: 4 }] },
      });
    });
    expect(body?.rows).toEqual([{ design_id: "d1", quantity: 4 }]);
  });
});

describe("useShipBatch", () => {
  it("posts to the ship endpoint and returns the dispatched batch", async () => {
    let hit = false;
    server.use(
      http.post("http://api.test/v1/batches/:id/ship", ({ params }) => {
        hit = true;
        expect(params.id).toBe(sampleBatch.id);
        return HttpResponse.json({
          ...sampleDetail,
          status: "dispatched",
          can_ship: false,
        });
      }),
    );
    const { result } = renderHook(() => useShipBatch(), { wrapper: wrap() });
    let returned: { status?: string } | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(sampleBatch.id);
    });
    expect(hit).toBe(true);
    expect(returned?.status).toBe("dispatched");
  });

  it("surfaces a 409 when orders aren't ready", async () => {
    server.use(
      http.post("http://api.test/v1/batches/:id/ship", () =>
        HttpResponse.json({ detail: "not ready" }, { status: 409 }),
      ),
    );
    const { result } = renderHook(() => useShipBatch(), { wrapper: wrap() });
    await act(async () => {
      await expect(result.current.mutateAsync(sampleBatch.id)).rejects.toThrow();
    });
  });
});
