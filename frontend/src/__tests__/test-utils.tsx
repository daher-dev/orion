import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
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

export function TestProviders({ children, queryClient }: TestProvidersProps) {
  const client = queryClient ?? makeQueryClient();
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}
