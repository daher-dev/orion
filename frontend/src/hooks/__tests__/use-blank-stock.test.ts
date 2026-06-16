import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useBlankStockLevels,
  useBlankStockMovements,
  useCreateBlankMovement,
} from "@/hooks/use-blank-stock";
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

const sampleLevel = {
  blank_piece_id: "11111111-1111-1111-1111-111111111111",
  spec_id: "22222222-2222-2222-2222-222222222222",
  spec: { id: "22222222-2222-2222-2222-222222222222", code: "FT-014", name: "Camiseta" },
  size: "m",
  color: "Preto",
  color_code: "PRT",
  min_stock: 40,
  on_hand: 96,
  in_production: 0,
  low_stock: false,
  entries_total: 100,
  exits_total: 4,
  last_movement_at: "2026-06-10T12:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useBlankStockLevels", () => {
  it("fetches the levels page and forwards filters as query params", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/blank-stock/levels", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [sampleLevel], total: 1, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(
      () => useBlankStockLevels({ q: "cam", size: "m", low_stock_only: true }),
      { wrapper: TestProviders },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].on_hand).toBe(96);
    expect(captured!.searchParams.get("q")).toBe("cam");
    expect(captured!.searchParams.get("size")).toBe("m");
    expect(captured!.searchParams.get("low_stock_only")).toBe("true");
  });
});

describe("useBlankStockMovements", () => {
  it("forwards blank_piece_id + kind filters", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/blank-stock/movements", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(
      () => useBlankStockMovements({ blank_piece_id: sampleLevel.blank_piece_id, kind: "exit" }),
      { wrapper: TestProviders },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured!.searchParams.get("blank_piece_id")).toBe(sampleLevel.blank_piece_id);
    expect(captured!.searchParams.get("kind")).toBe("exit");
  });
});

describe("useCreateBlankMovement", () => {
  it("POSTs the movement payload to /movements", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/blank-stock/movements", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: "99999999-9999-9999-9999-999999999999",
            blank_piece_id: sampleLevel.blank_piece_id,
            blank_piece: null,
            kind: "adjustment",
            quantity: 5,
            notes: null,
            created_at: "2026-06-14T10:00:00Z",
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateBlankMovement(), { wrapper: TestProviders });

    await act(async () => {
      await result.current.mutateAsync({
        blank_piece_id: sampleLevel.blank_piece_id,
        kind: "adjustment",
        quantity: 5,
        notes: null,
      });
    });

    expect(body).toMatchObject({ kind: "adjustment", quantity: 5 });
  });
});
