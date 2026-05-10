import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";
import enMessages from "../../messages/en.json";

/**
 * Test-only provider stack — minimal subset of the production layout so
 * components that lean on next-intl + TanStack Query can render in jsdom.
 *
 * Auth + Company providers are intentionally skipped: hooks that depend on
 * them are mocked at the module level via `vi.mock`.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export type TestProvidersProps = {
  children: ReactNode;
  queryClient?: QueryClient;
};

/**
 * Provider wrapper component — use directly when you need to compose with
 * other providers or to render imperatively.
 */
export function TestProviders({ children, queryClient }: TestProvidersProps) {
  const client = queryClient ?? makeQueryClient();
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

/**
 * Convenience: render a component inside `TestProviders`. Returns the
 * RTL render result plus the QueryClient so tests can prime the cache.
 */
export function renderWithProviders(ui: ReactElement) {
  const client = makeQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return <TestProviders queryClient={client}>{children}</TestProviders>;
  }

  return { ...render(ui, { wrapper: Wrapper }), client };
}
