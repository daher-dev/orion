import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useOrderItems,
  useGenerateLabels,
  useScanCheck,
} from "@/hooks/use-separation";
import { TestProviders, makeQueryClient } from "@/__tests__/test-utils";

const wrap = () => {
  const queryClient = makeQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    TestProviders({ children, queryClient });
};

vi.mock("@/hooks/use-api", () => ({
  useApi: () => ({
    get: <T,>(path: string) =>
      fetch(`http://api.test${path}`).then(async (r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return (await r.json()) as T;
      }),
    post: <T,>(path: string, body: unknown) =>
      fetch(`http://api.test${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) {
          const err = new Error(`Request failed with ${r.status}`) as Error & {
            status?: number;
          };
          err.status = r.status;
          throw err;
        }
        return (await r.json()) as T;
      }),
  }),
}));

const ORDER_ID = "11111111-1111-1111-1111-111111111111";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("use-separation", () => {
  it("useOrderItems fetches an order's pieces", async () => {
    server.use(
      http.get(`http://api.test/v1/orders/${ORDER_ID}/items`, () =>
        HttpResponse.json([
          {
            id: "aaaa",
            order_id: ORDER_ID,
            variation_id: null,
            tracking_code: "ORD-X-1-ABC123",
            status: "label_printed",
            checked_at: null,
            checked_by: null,
            mapped_print: null,
            item_index: 1,
            total_items: 2,
          },
        ]),
      ),
    );

    const { result } = renderHook(() => useOrderItems(ORDER_ID), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].tracking_code).toBe("ORD-X-1-ABC123");
  });

  it("useGenerateLabels POSTs to the labels endpoint and returns labels", async () => {
    server.use(
      http.post(`http://api.test/v1/orders/${ORDER_ID}/labels`, () =>
        HttpResponse.json({
          order_id: ORDER_ID,
          order_code: "ORD-X",
          total_items: 1,
          labels: [
            {
              item_id: "aaaa",
              order_id: ORDER_ID,
              order_code: "ORD-X",
              tracking_code: "ORD-X-1-ABC123",
              qr_data: "ORD-X-1-ABC123",
              item_index: 1,
              total_items: 1,
              status: "label_printed",
              sku: "CAM01-M-BLK",
              product_name: "Cropped",
              color: "Preto",
              color_code: "BLK",
              size: "m",
              mapped_print: null,
            },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useGenerateLabels(), {
      wrapper: wrap(),
    });
    const res = await result.current.mutateAsync(ORDER_ID);
    expect(res.total_items).toBe(1);
    expect(res.labels[0].tracking_code).toBe("ORD-X-1-ABC123");
  });

  it("useScanCheck surfaces the HTTP status on error (e.g. 404)", async () => {
    server.use(
      http.post("http://api.test/v1/orders/separation/scan", () =>
        HttpResponse.json({ detail: "not found" }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useScanCheck(), { wrapper: wrap() });
    await expect(
      result.current.mutateAsync({ tracking_code: "nope" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
