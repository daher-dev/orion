import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BillingHero } from "@/components/settings/billing/BillingHero";
import { TestProviders } from "@/__tests__/test-utils";

describe("BillingHero", () => {
  it("renders the plan name passed in props", () => {
    render(
      <TestProviders>
        <BillingHero planName="Pro" />
      </TestProviders>,
    );
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("renders the current plan eyebrow", () => {
    render(
      <TestProviders>
        <BillingHero planName="Pro" />
      </TestProviders>,
    );
    expect(screen.getByText(/current plan/i)).toBeInTheDocument();
  });

  it("renders the Private beta pill", () => {
    render(
      <TestProviders>
        <BillingHero planName="Pro" />
      </TestProviders>,
    );
    expect(screen.getByText(/private beta/i)).toBeInTheDocument();
  });

  it("renders the explanatory body copy about billing not being enabled", () => {
    render(
      <TestProviders>
        <BillingHero planName="Pro" />
      </TestProviders>,
    );
    expect(
      screen.getByText(/billing isn't enabled yet/i),
    ).toBeInTheDocument();
  });
});
