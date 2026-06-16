import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCreateFabricMovement, useFabricMovements } from "@/hooks/use-fabric";
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

const sampleMovement = {
  id: "44444444-4444-4444-4444-444444444444",
  fabric_roll_id: "roll-1",
  fabric_roll: { id: "roll-1", fabric_type: "jersey", supplier_name: "Malharia SP", color: "Preto" },
  kind: "exit",
  quantity: "2.500",
  cutting_order_id: "co-1",
  notes: null,
  created_at: "2026-06-12T09:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useFabricMovements", () => {
  it("forwards fabric_roll_id + kind and keeps Decimal kg + provenance", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/fabric/movements", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [sampleMovement], total: 1, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(() => useFabricMovements({ fabric_roll_id: "roll-1", kind: "exit" }), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured!.searchParams.get("fabric_roll_id")).toBe("roll-1");
    expect(captured!.searchParams.get("kind")).toBe("exit");
    expect(result.current.data?.items[0].quantity).toBe("2.500");
    expect(result.current.data?.items[0].cutting_order_id).toBe("co-1");
  });
});

describe("useCreateFabricMovement", () => {
  it("POSTs a manual movement with a Decimal-string quantity", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/fabric/movements", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...sampleMovement, kind: "entry", cutting_order_id: null }, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useCreateFabricMovement(), { wrapper: TestProviders });

    await act(async () => {
      await result.current.mutateAsync({ fabric_roll_id: "roll-1", kind: "entry", quantity: "5" });
    });

    expect(body).toMatchObject({ fabric_roll_id: "roll-1", kind: "entry", quantity: "5" });
  });
});
