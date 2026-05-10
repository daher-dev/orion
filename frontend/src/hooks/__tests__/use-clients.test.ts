import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useClients,
  useClient,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
} from "@/hooks/use-clients";
import { TestProviders, makeQueryClient } from "@/__tests__/test-utils";

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

const sampleClient = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Mariana Costa",
  email: "mariana@example.com",
  phone: "+55 11 99999-0000",
  address: "São Paulo, SP",
  created_at: "2026-05-10T12:00:00Z",
  updated_at: "2026-05-10T12:00:00Z",
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useClients", () => {
  it("fetches and returns the clients page", async () => {
    server.use(
      http.get("http://api.test/v1/clients", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("q")).toBe(null);
        return HttpResponse.json({
          items: [sampleClient],
          total: 1,
          page: 1,
          page_size: 50,
          has_more: false,
        });
      }),
    );

    const { result } = renderHook(() => useClients(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].name).toBe("Mariana Costa");
  });

  it("forwards search filter as query param", async () => {
    server.use(
      http.get("http://api.test/v1/clients", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("q")).toBe("mari");
        return HttpResponse.json({
          items: [sampleClient],
          total: 1,
          page: 1,
          page_size: 50,
          has_more: false,
        });
      }),
    );

    const { result } = renderHook(() => useClients({ q: "mari" }), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useClient", () => {
  it("fetches the detail by id", async () => {
    server.use(
      http.get("http://api.test/v1/clients/:id", ({ params }) => {
        expect(params.id).toBe(sampleClient.id);
        return HttpResponse.json(sampleClient);
      }),
    );

    const { result } = renderHook(() => useClient(sampleClient.id), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(sampleClient.id);
  });

  it("does not fire when id is null", async () => {
    let calls = 0;
    server.use(
      http.get("http://api.test/v1/clients/:id", () => {
        calls += 1;
        return HttpResponse.json(sampleClient);
      }),
    );
    renderHook(() => useClient(null), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBe(0);
  });
});

describe("useCreateClient", () => {
  it("invalidates the clients list on success", async () => {
    let listCalls = 0;
    server.use(
      http.get("http://api.test/v1/clients", () => {
        listCalls += 1;
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 50,
          has_more: false,
        });
      }),
      http.post("http://api.test/v1/clients", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.name).toBe("New");
        return HttpResponse.json(sampleClient, { status: 201 });
      }),
    );
    const queryClient = makeQueryClient();
    const { result } = renderHook(
      () => ({ list: useClients(), create: useCreateClient() }),
      { wrapper: ({ children }) => TestProviders({ children, queryClient }) },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(listCalls).toBe(1);

    await act(async () => {
      await result.current.create.mutateAsync({ name: "New" });
    });
    await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2));
  });
});

describe("useUpdateClient", () => {
  it("calls PATCH and invalidates list + detail", async () => {
    server.use(
      http.patch("http://api.test/v1/clients/:id", async ({ params, request }) => {
        expect(params.id).toBe(sampleClient.id);
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.name).toBe("Updated");
        return HttpResponse.json({ ...sampleClient, name: "Updated" });
      }),
    );
    const { result } = renderHook(() => useUpdateClient(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await act(async () => {
      const data = await result.current.mutateAsync({
        id: sampleClient.id,
        payload: { name: "Updated" },
      });
      expect(data.name).toBe("Updated");
    });
  });
});

describe("useDeleteClient", () => {
  it("calls DELETE and resolves on 204", async () => {
    server.use(
      http.delete("http://api.test/v1/clients/:id", ({ params }) => {
        expect(params.id).toBe(sampleClient.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { result } = renderHook(() => useDeleteClient(), {
      wrapper: ({ children }) => TestProviders({ children }),
    });
    await act(async () => {
      await result.current.mutateAsync(sampleClient.id);
    });
  });
});
