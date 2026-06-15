import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useConsumePaperRoll,
  useCreatePaperRoll,
  usePaperRollMovements,
  usePaperRolls,
} from "@/hooks/use-paper-rolls";
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

const sampleRoll = {
  id: "33333333-3333-3333-3333-333333333333",
  received_at: "2026-06-04",
  supplier_name: "DTF Brasil",
  paper_type: "dtf_film",
  width_cm: 60,
  initial_meters: "100.00",
  current_meters: "64.00",
  consumed_meters: "36.00",
  min_stock: null,
  on_hand: "64.00",
  low_stock: false,
  created_at: "2026-06-04T09:00:00Z",
  updated_at: "2026-06-07T09:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("usePaperRolls", () => {
  it("fetches rolls and forwards filters; Decimal meters stay strings", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/paper-rolls", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [sampleRoll], total: 1, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(() => usePaperRolls({ q: "dtf", paper_type: "dtf_film" }), {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].current_meters).toBe("64.00");
    expect(captured!.searchParams.get("q")).toBe("dtf");
    expect(captured!.searchParams.get("paper_type")).toBe("dtf_film");
  });
});

describe("usePaperRollMovements", () => {
  it("forwards paper_roll_id + kind filters", async () => {
    let captured: URL | null = null;
    server.use(
      http.get("http://api.test/v1/paper-rolls/movements", ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 50, has_more: false });
      }),
    );

    const { result } = renderHook(
      () => usePaperRollMovements({ paper_roll_id: sampleRoll.id, kind: "exit" }),
      { wrapper: TestProviders },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured!.searchParams.get("paper_roll_id")).toBe(sampleRoll.id);
    expect(captured!.searchParams.get("kind")).toBe("exit");
  });
});

describe("useCreatePaperRoll", () => {
  it("POSTs the receive payload to the root", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("http://api.test/v1/paper-rolls", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(sampleRoll, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useCreatePaperRoll(), { wrapper: TestProviders });

    await act(async () => {
      await result.current.mutateAsync({
        received_at: "2026-06-14",
        supplier_name: "DTF Brasil",
        paper_type: "dtf_film",
        width_cm: 60,
        initial_meters: "100",
      });
    });

    expect(body).toMatchObject({ paper_type: "dtf_film", width_cm: 60, initial_meters: "100" });
  });
});

describe("useConsumePaperRoll", () => {
  it("POSTs to /{id}/consume with a Decimal-string quantity", async () => {
    let body: Record<string, unknown> | null = null;
    let hitPath: string | null = null;
    server.use(
      http.post("http://api.test/v1/paper-rolls/:id/consume", async ({ request, params }) => {
        hitPath = params.id as string;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...sampleRoll, current_meters: "59.00" });
      }),
    );

    const { result } = renderHook(() => useConsumePaperRoll(), { wrapper: TestProviders });

    await act(async () => {
      await result.current.mutateAsync({ id: sampleRoll.id, payload: { quantity: "5" } });
    });

    expect(hitPath).toBe(sampleRoll.id);
    expect(body).toMatchObject({ quantity: "5" });
  });
});
