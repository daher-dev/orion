import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useAvailableCuts,
  useCreateCuttingOrder,
  useCuttingOrders,
} from "@/hooks/use-cutting";
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

const sampleOrder = {
  id: "11111111-1111-1111-1111-111111111111",
  spec: { id: "spec-1", code: "CAM01", name: "Camiseta Basic" },
  color: "Preto",
  color_code: "PRT",
  body_roll: { id: "roll-1", code: "BB-AAAAAA" },
  rib_roll: null,
  status: "done",
  planned_outputs: [{ size: "m", quantity: 10 }],
  actual_outputs: [{ size: "m", quantity: 10 }],
  cut_at: null,
  created_at: "2026-06-10T09:00:00Z",
  updated_at: "2026-06-12T09:00:00Z",
};

const sampleAvailable = {
  cutting_order_id: sampleOrder.id,
  code: "CO-11111111",
  spec: { id: "spec-1", code: "CAM01", name: "Camiseta Basic" },
  color: "Preto",
  color_code: "PRT",
  sizes: [
    { size: "m", available: 8 },
    { size: "g", available: 4 },
  ],
  total_available: 12,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useCuttingOrders", () => {
  it("forwards spec_id (not product_id) and surfaces the spec-keyed row", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/cutting", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [sampleOrder], total: 1, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(() => useCuttingOrders({ q: "cam", spec_id: "spec-1" }), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured!.searchParams.get("spec_id")).toBe("spec-1");
    expect(captured!.searchParams.get("product_id")).toBeNull();
    expect(result.current.data?.items[0].spec.code).toBe("CAM01");
    expect(result.current.data?.items[0].color).toBe("Preto");
  });
});

describe("useAvailableCuts", () => {
  it("fetches /cutting/available and forwards q + spec_id", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/cutting/available", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [sampleAvailable], total: 1, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(() => useAvailableCuts({ q: "cam", spec_id: "spec-1" }), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured!.searchParams.get("q")).toBe("cam");
    expect(captured!.searchParams.get("spec_id")).toBe("spec-1");
    expect(result.current.data?.items[0].total_available).toBe(12);
    expect(result.current.data?.items[0].sizes).toHaveLength(2);
  });
});

describe("useCreateCuttingOrder", () => {
  it("POSTs the spec+color payload to the root", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/cutting", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(sampleOrder, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useCreateCuttingOrder(), { wrapper: TestProviders });

    await act(async () => {
      await result.current.mutateAsync({
        spec_id: "spec-1",
        color: "Preto",
        color_code: "PRT",
        body_roll_id: "roll-1",
        planned_outputs: [{ size: "m", quantity: 10 }],
      });
    });

    expect(body).toMatchObject({ spec_id: "spec-1", color: "Preto", color_code: "PRT" });
    expect(body).not.toHaveProperty("product_id");
  });
});
