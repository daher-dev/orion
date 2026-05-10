import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useApi: () => ({
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  }),
}));

import {
  useContractor,
  useContractors,
  useCreateContractor,
  useDeleteContractor,
  useUpdateContractor,
} from "@/hooks/use-contractors";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = "QueryWrapper";
  return Wrapper;
}

const PAGE = {
  items: [
    {
      id: "ab1",
      name: "Banca A",
      address: null,
      phone: null,
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-01T00:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  page_size: 50,
  has_more: false,
};

describe("useContractors", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    mockDelete.mockReset();
  });

  it("calls /v1/contractors with optional query params", async () => {
    mockGet.mockResolvedValueOnce(PAGE);
    const { result } = renderHook(
      () => useContractors({ q: "banca", page: 2, page_size: 25 }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith("/v1/contractors", {
      query: { q: "banca", page: 2, page_size: 25 },
    });
    expect(result.current.data).toEqual(PAGE);
  });

  it("uses empty filters by default", async () => {
    mockGet.mockResolvedValueOnce(PAGE);
    const { result } = renderHook(() => useContractors(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith("/v1/contractors", {
      query: { q: undefined, page: undefined, page_size: undefined },
    });
  });
});

describe("useContractor", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("does not fetch when id is null", async () => {
    const { result } = renderHook(() => useContractor(null), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("fetches detail when id is provided", async () => {
    const detail = PAGE.items[0];
    mockGet.mockResolvedValueOnce(detail);
    const { result } = renderHook(() => useContractor("ab1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith("/v1/contractors/ab1");
    expect(result.current.data).toEqual(detail);
  });
});

describe("useCreateContractor", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("POSTs the payload and resolves with the created row", async () => {
    const created = PAGE.items[0];
    mockPost.mockResolvedValueOnce(created);
    const { result } = renderHook(() => useCreateContractor(), { wrapper: makeWrapper() });
    const created2 = await result.current.mutateAsync({ name: "Banca A" });
    expect(mockPost).toHaveBeenCalledWith("/v1/contractors", { name: "Banca A" });
    expect(created2).toEqual(created);
  });
});

describe("useUpdateContractor", () => {
  beforeEach(() => {
    mockPatch.mockReset();
  });

  it("PATCHes /v1/contractors/{id} with the payload", async () => {
    mockPatch.mockResolvedValueOnce(PAGE.items[0]);
    const { result } = renderHook(() => useUpdateContractor(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ id: "ab1", payload: { name: "Banca New" } });
    expect(mockPatch).toHaveBeenCalledWith("/v1/contractors/ab1", { name: "Banca New" });
  });
});

describe("useDeleteContractor", () => {
  beforeEach(() => {
    mockDelete.mockReset();
  });

  it("DELETEs /v1/contractors/{id}", async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeleteContractor(), { wrapper: makeWrapper() });
    await result.current.mutateAsync("ab1");
    expect(mockDelete).toHaveBeenCalledWith("/v1/contractors/ab1");
  });
});
