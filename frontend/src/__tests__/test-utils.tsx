import type { ReactElement, ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import enMessages from "../../messages/en.json";

/**
 * Wrapper that mounts a component inside the providers it normally needs in
 * the live app:
 *   - NextIntlClientProvider (English by default — the messages file is the
 *     source of truth for translation key shape; we test labels by key, never
 *     by translated string)
 *   - QueryClientProvider with a fresh isolated client per render
 */
export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper }), client };
}
