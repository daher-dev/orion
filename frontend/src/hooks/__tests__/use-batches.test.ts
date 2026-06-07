import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useBatches,
  useBatch,
  useCreateBatch,
  useSaveBatchAdjustments,
  useTransitionBatch,
  useSendBatchToMontador,
  useDeleteBatch,
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
  prints_sent_at: null,
  completed_at: null,
  notes: null,
  created_at: "2026-06-04T12:00:00Z",
  updated_at: "2026-06-04T12:00:00Z",
  adjustments: [
    {
      print_design_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      print_design_code: "EST01",
      print_design_name: "Caveira",
      product_color: "Preto",
      qty_needed: 7,
      qty_stock: 0,
      qty_to_print: 7,
      prints_sent: false,
    },
  ],
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

describe("useBatch", () => {
  it("fetches a batch detail with adjustments", async () => {
    server.use(
      http.get("http://api.test/v1/batches/:id", ({ params }) => {
        expect(params.id).toBe(sampleBatch.id);
        return HttpResponse.json(sampleBatch);
      }),
    );
    const { result } = renderHook(() => useBatch(sampleBatch.id), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.adjustments[0].qty_needed).toBe(7);
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

  it("saves adjustments to the right endpoint", async () => {
    let url: string | undefined;
    let body: unknown;
    server.use(
      http.patch("http://api.test/v1/batches/:id/adjustments", async ({ request }) => {
        url = request.url;
        body = await request.json();
        return HttpResponse.json(sampleBatch);
      }),
    );
    const { result } = renderHook(() => useSaveBatchAdjustments(), { wrapper: wrap() });
    await act(async () => {
      await result.current.mutateAsync({
        id: sampleBatch.id,
        payload: { adjustments: [{ print_design_id: "d1", qty_to_print: 5 }] },
      });
    });
    expect(url).toContain(`/v1/batches/${sampleBatch.id}/adjustments`);
    expect(body).toEqual({ adjustments: [{ print_design_id: "d1", qty_to_print: 5 }] });
  });

  it("transitions status", async () => {
    let body: { status?: string } | undefined;
    server.use(
      http.post("http://api.test/v1/batches/:id/status", async ({ request }) => {
        body = (await request.json()) as { status?: string };
        return HttpResponse.json({ ...sampleBatch, status: "printed" });
      }),
    );
    const { result } = renderHook(() => useTransitionBatch(), { wrapper: wrap() });
    let returned: { status?: string } | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: sampleBatch.id, status: "printed" });
    });
    expect(body?.status).toBe("printed");
    expect(returned?.status).toBe("printed");
  });

  it("sends to montador", async () => {
    let url: string | undefined;
    let returned: { succeeded?: number } | undefined;
    server.use(
      http.post("http://api.test/v1/batches/:id/send-to-montador", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ total: 2, succeeded: 2, failed: 0, results: [] });
      }),
    );
    const { result } = renderHook(() => useSendBatchToMontador(), { wrapper: wrap() });
    await act(async () => {
      returned = await result.current.mutateAsync(sampleBatch.id);
    });
    expect(url).toContain(`/v1/batches/${sampleBatch.id}/send-to-montador`);
    expect(returned?.succeeded).toBe(2);
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
