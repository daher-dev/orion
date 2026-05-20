import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { BillingUsageCard } from "@/components/settings/billing/BillingUsageCard";
import { TestProviders } from "@/__tests__/test-utils";

// `useMembers` is a TanStack Query hook backed by the API client — we mock
// it at the module level so we can assert behaviour for each state (loading,
// well-under-cap, near-cap, at-cap) without touching the network.
const useMembersMock = vi.fn();
vi.mock("@/hooks/use-members", () => ({
  useMembers: () => useMembersMock(),
}));

const makeResult = (total: number) => ({
  data: { items: [], total, page: 1, page_size: 50, has_more: false },
  isPending: false,
  isError: false,
});

afterEach(() => {
  useMembersMock.mockReset();
  cleanup();
});

describe("BillingUsageCard", () => {
  it("renders the real member count from useMembers", () => {
    useMembersMock.mockReturnValue(makeResult(5));
    render(
      <TestProviders>
        <BillingUsageCard maxMembers={10} />
      </TestProviders>,
    );
    expect(screen.getByTestId("billing-usage-count")).toHaveTextContent("5");
    expect(screen.getByText("of 10 people")).toBeInTheDocument();
  });

  it("renders the plural remaining-seats copy when more than one seat is left", () => {
    useMembersMock.mockReturnValue(makeResult(5));
    render(
      <TestProviders>
        <BillingUsageCard maxMembers={10} />
      </TestProviders>,
    );
    // ICU plural — 5 of 10 → "5 seats left on this account." The number
    // lives inside a <b> so we read the parent container's text.
    const card = screen.getByTestId("billing-usage-card");
    expect(card.textContent).toMatch(/5 seats left on this account\./i);
  });

  it("renders the singular remaining-seats copy when exactly one seat is left", () => {
    useMembersMock.mockReturnValue(makeResult(9));
    render(
      <TestProviders>
        <BillingUsageCard maxMembers={10} />
      </TestProviders>,
    );
    const card = screen.getByTestId("billing-usage-card");
    expect(card.textContent).toMatch(/1 seat left on this account\./i);
    // Make sure we don't accidentally render the plural form for 1.
    expect(card.textContent).not.toMatch(/1 seats left/i);
  });

  it("renders the limit-reached copy when the cap is hit", () => {
    useMembersMock.mockReturnValue(makeResult(10));
    render(
      <TestProviders>
        <BillingUsageCard maxMembers={10} />
      </TestProviders>,
    );
    expect(screen.getByText(/limit reached/i)).toBeInTheDocument();
  });

  it("flips the progress bar to the warn color above 80% usage", () => {
    useMembersMock.mockReturnValue(makeResult(9));
    render(
      <TestProviders>
        <BillingUsageCard maxMembers={10} />
      </TestProviders>,
    );
    const fill = screen.getByTestId("billing-usage-fill");
    expect(fill.getAttribute("data-warn")).toBe("true");
  });

  it("keeps the progress bar in the accent color at or under 80%", () => {
    useMembersMock.mockReturnValue(makeResult(5));
    render(
      <TestProviders>
        <BillingUsageCard maxMembers={10} />
      </TestProviders>,
    );
    const fill = screen.getByTestId("billing-usage-fill");
    expect(fill.getAttribute("data-warn")).toBeNull();
  });

  it("exposes a progressbar role with correct ARIA values", () => {
    useMembersMock.mockReturnValue(makeResult(3));
    render(
      <TestProviders>
        <BillingUsageCard maxMembers={10} />
      </TestProviders>,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "10");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
  });

  it("falls back to a 0 count while the query is pending", () => {
    useMembersMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    render(
      <TestProviders>
        <BillingUsageCard maxMembers={10} />
      </TestProviders>,
    );
    expect(screen.getByTestId("billing-usage-count")).toHaveTextContent("0");
  });
});
