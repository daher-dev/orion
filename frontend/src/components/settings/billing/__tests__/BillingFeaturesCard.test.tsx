import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BillingFeaturesCard } from "@/components/settings/billing/BillingFeaturesCard";
import { TestProviders } from "@/__tests__/test-utils";

describe("BillingFeaturesCard", () => {
  it("renders the title and the plan-aware subtitle", () => {
    render(
      <TestProviders>
        <BillingFeaturesCard planName="Pro" />
      </TestProviders>,
    );
    expect(screen.getByText(/what's included/i)).toBeInTheDocument();
    expect(
      screen.getByText(/features available on the Pro plan/i),
    ).toBeInTheDocument();
  });

  it("renders every feature from the i18n bundle as a list item", () => {
    render(
      <TestProviders>
        <BillingFeaturesCard planName="Pro" />
      </TestProviders>,
    );
    const list = screen.getByRole("list");
    const items = list.querySelectorAll("li");
    // The English bundle ships exactly 5 features for the Pro plan.
    expect(items.length).toBe(5);
    expect(screen.getByText("Unlimited members")).toBeInTheDocument();
    expect(screen.getByText("Marketplace integrations")).toBeInTheDocument();
    expect(screen.getByText("NFe and tax invoicing")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp support")).toBeInTheDocument();
    expect(
      screen.getByText("Advanced reports and export"),
    ).toBeInTheDocument();
  });
});
