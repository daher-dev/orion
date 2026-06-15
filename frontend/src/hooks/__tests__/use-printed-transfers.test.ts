import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useCreatePrintedMovement,
  usePrintedTransferLevels,
  usePrintedTransferMovements,
} from "@/hooks/use-printed-transfers";
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
  printed_transfer_id: "44444444-4444-4444-4444-444444444444",
  print_design_id: "55555555-5555-5555-5555-555555555555",
  design: { id: "55555555-5555-5555-5555-555555555555", code: "2055", name: "Naruto", image_url: null },
  side: "front",
  min_stock: 15,
  on_hand: 41,
  in_production: 0,
  low_stock: false,
  entries_total: 50,
  exits_total: 9,
  last_movement_at: "2026-06-10T12:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("usePrintedTransferLevels", () => {
  it("fetches levels and forwards print_design_id + side filters", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/printed-transfers/levels", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [sampleLevel], total: 1, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(
      () => usePrintedTransferLevels({ print_design_id: sampleLevel.print_design_id, side: "front" }),
      { wrapper: TestProviders },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].side).toBe("front");
    expect(captured!.searchParams.get("print_design_id")).toBe(sampleLevel.print_design_id);
    expect(captured!.searchParams.get("side")).toBe("front");
  });
});

describe("usePrintedTransferMovements", () => {
  it("forwards printed_transfer_id + kind filters", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/printed-transfers/movements", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(
      () => usePrintedTransferMovements({ printed_transfer_id: sampleLevel.printed_transfer_id, kind: "entry" }),
      { wrapper: TestProviders },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured!.searchParams.get("printed_transfer_id")).toBe(sampleLevel.printed_transfer_id);
    expect(captured!.searchParams.get("kind")).toBe("entry");
  });
});

describe("useCreatePrintedMovement", () => {
  it("POSTs the movement payload keyed by printed_transfer_id", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/printed-transfers/movements", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: "66666666-6666-6666-6666-666666666666",
            printed_transfer_id: sampleLevel.printed_transfer_id,
            design: null,
            side: "front",
            kind: "exit",
            quantity: 3,
            notes: "Refugo",
            created_at: "2026-06-14T10:00:00Z",
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useCreatePrintedMovement(), { wrapper: TestProviders });

    await act(async () => {
      await result.current.mutateAsync({
        printed_transfer_id: sampleLevel.printed_transfer_id,
        kind: "exit",
        quantity: 3,
        notes: "Refugo",
      });
    });

    expect(body).toMatchObject({ printed_transfer_id: sampleLevel.printed_transfer_id, kind: "exit", quantity: 3 });
  });
});
