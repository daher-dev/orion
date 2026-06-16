import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCreateShipment, useReceiveShipment, useShipments } from "@/hooks/use-sewing";
import { TestProviders } from "@/__tests__/test-utils";

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
    post: <T,>(path: string, body?: unknown) =>
      fetch(`http://api.test${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return (await r.json()) as T;
      }),
  }),
}));

const sampleShipment = {
  id: "22222222-2222-2222-2222-222222222222",
  cutting_order: { id: "co-1", code: "CO-00000001" },
  contractor: { id: "ct-1", name: "Banca Lima" },
  status: "partial",
  sent_at: "2026-06-10",
  received_at: "2026-06-12",
  items: [
    { id: "it-m", size: "m", requested_quantity: 10, received_quantity: 6, credited_quantity: 6 },
    { id: "it-g", size: "g", requested_quantity: 5, received_quantity: 0, credited_quantity: 0 },
  ],
  created_at: "2026-06-10T09:00:00Z",
  updated_at: "2026-06-12T09:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useShipments", () => {
  it("surfaces credited_quantity per item", async () => {
    server.use(
      http.get("http://api.test/v1/sewing", () =>
        HttpResponse.json({ items: [sampleShipment], total: 1, page: 1, page_size: 50, has_more: false }),
      ),
    );

    const { result } = renderHook(() => useShipments(), { wrapper: TestProviders });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].items[0].credited_quantity).toBe(6);
  });
});

describe("useCreateShipment", () => {
  it("POSTs the requested-by-size items", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/sewing", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(sampleShipment, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useCreateShipment(), { wrapper: TestProviders });

    await act(async () => {
      await result.current.mutateAsync({
        cutting_order_id: "co-1",
        contractor_id: "ct-1",
        sent_at: "2026-06-10",
        items: [{ size: "m", requested_quantity: 10 }],
      });
    });

    expect(body).toMatchObject({ cutting_order_id: "co-1", contractor_id: "ct-1" });
    expect((body as unknown as { items: unknown[] }).items).toHaveLength(1);
  });
});

describe("useReceiveShipment", () => {
  it("POSTs to /{id}/receive with the received-by-size delta payload", async () => {
    let body: Record<string, unknown> | null = null;
    let hitId: string | null = null;
    server.use(
      http.post("http://api.test/v1/sewing/:id/receive", async ({ request, params }) => {
        hitId = params.id as string;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(sampleShipment);
      }),
    );

    const { result } = renderHook(() => useReceiveShipment(), { wrapper: TestProviders });

    await act(async () => {
      await result.current.mutateAsync({
        id: sampleShipment.id,
        payload: { received_at: "2026-06-12", items: [{ size: "m", received_quantity: 6 }] },
      });
    });

    expect(hitId).toBe(sampleShipment.id);
    expect(body).toMatchObject({ received_at: "2026-06-12" });
    expect(
      (body as unknown as { items: Array<{ size: string; received_quantity: number }> }).items[0],
    ).toMatchObject({
      size: "m",
      received_quantity: 6,
    });
  });
});
