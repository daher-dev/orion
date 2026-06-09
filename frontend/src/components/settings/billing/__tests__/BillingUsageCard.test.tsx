import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { BillingUsageCard } from "@/components/settings/billing/BillingUsageCard";
import { TestProviders } from "@/__tests__/test-utils";

// The card is now plan-driven: `count` + `maxMembers` come straight from the
// billing summary (no `useMembers` hook), so we exercise it purely via props.

afterEach(cleanup);

describe("BillingUsageCard", () => {
  it("renders the member count and the cap caption", () => {
    render(
      <TestProviders>
        <BillingUsageCard count={5} maxMembers={10} />
      </TestProviders>,
    );
    expect(screen.getByTestId("billing-usage-count")).toHaveTextContent("5");
    expect(screen.getByText("of 10 people")).toBeInTheDocument();
  });

  it("renders the plural remaining-seats copy when more than one seat is left", () => {
    render(
      <TestProviders>
        <BillingUsageCard count={5} maxMembers={10} />
      </TestProviders>,
    );
    const card = screen.getByTestId("billing-usage-card");
    expect(card.textContent).toMatch(/5 seats left on this account\./i);
  });

  it("renders the singular remaining-seats copy when exactly one seat is left", () => {
    render(
      <TestProviders>
        <BillingUsageCard count={9} maxMembers={10} />
      </TestProviders>,
    );
    const card = screen.getByTestId("billing-usage-card");
    expect(card.textContent).toMatch(/1 seat left on this account\./i);
    expect(card.textContent).not.toMatch(/1 seats left/i);
  });

  it("renders the limit-reached copy when the cap is hit", () => {
    render(
      <TestProviders>
        <BillingUsageCard count={10} maxMembers={10} />
      </TestProviders>,
    );
    expect(screen.getByText(/limit reached/i)).toBeInTheDocument();
  });

  it("flips the progress bar to the warn color above 80% usage", () => {
    render(
      <TestProviders>
        <BillingUsageCard count={9} maxMembers={10} />
      </TestProviders>,
    );
    expect(screen.getByTestId("billing-usage-fill").getAttribute("data-warn")).toBe("true");
  });

  it("keeps the progress bar in the accent color at or under 80%", () => {
    render(
      <TestProviders>
        <BillingUsageCard count={5} maxMembers={10} />
      </TestProviders>,
    );
    expect(screen.getByTestId("billing-usage-fill").getAttribute("data-warn")).toBeNull();
  });

  it("exposes a progressbar role with correct ARIA values", () => {
    render(
      <TestProviders>
        <BillingUsageCard count={3} maxMembers={10} />
      </TestProviders>,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "10");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
  });

  it("renders the unlimited (null cap) state without remaining-seat copy", () => {
    render(
      <TestProviders>
        <BillingUsageCard count={42} maxMembers={null} />
      </TestProviders>,
    );
    expect(screen.getByTestId("billing-usage-count")).toHaveTextContent("42");
    const card = screen.getByTestId("billing-usage-card");
    expect(card.textContent).not.toMatch(/seat/i);
    // The bar is muted for unlimited plans.
    expect(screen.getByTestId("billing-usage-fill").getAttribute("data-warn")).toBeNull();
  });
});
