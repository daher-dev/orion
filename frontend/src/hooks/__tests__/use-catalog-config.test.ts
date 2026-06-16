import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCatalogConfig, useUpdateCatalogConfig } from "@/hooks/use-catalog-config";
import { DEFAULT_CATALOG_CONFIG } from "@/lib/schemas/company-settings";
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
    put: <T,>(path: string, body: unknown) =>
      fetch(`http://api.test${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return (await r.json()) as T;
      }),
  }),
}));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useCatalogConfig", () => {
  it("fetches the company settings config from /v1/company/settings", async () => {
    server.use(
      http.get("http://api.test/v1/company/settings", () =>
        HttpResponse.json({ config: DEFAULT_CATALOG_CONFIG }),
      ),
    );
    const { result } = renderHook(() => useCatalogConfig(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.config.sizes).toEqual(["P", "M", "G", "GG", "U"]);
    expect(result.current.data?.config.stockThresholds.blank.unit).toBe("qty");
  });
});

describe("useUpdateCatalogConfig", () => {
  it("PUTs the full config blob", async () => {
    let body: { config?: unknown } | undefined;
    server.use(
      http.put("http://api.test/v1/company/settings", async ({ request }) => {
        body = (await request.json()) as { config?: unknown };
        return HttpResponse.json({ config: DEFAULT_CATALOG_CONFIG });
      }),
    );
    const next = {
      ...DEFAULT_CATALOG_CONFIG,
      techniques: ["DTF"],
    };
    const { result } = renderHook(() => useUpdateCatalogConfig(), { wrapper: wrap() });
    let returned: { config?: { sizes: string[] } } | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ config: next });
    });
    expect((body?.config as { techniques: string[] }).techniques).toEqual(["DTF"]);
    expect(returned?.config?.sizes).toEqual(["P", "M", "G", "GG", "U"]);
  });
});
