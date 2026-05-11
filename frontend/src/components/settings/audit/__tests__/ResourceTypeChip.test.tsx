import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResourceTypeChip } from "@/components/settings/audit/ResourceTypeChip";
import { TestProviders } from "@/__tests__/test-utils";

describe("ResourceTypeChip", () => {
  it("renders the localized label for known types", () => {
    render(
      <TestProviders>
        <ResourceTypeChip resourceType="clients" />
      </TestProviders>,
    );
    expect(screen.getByText("Clients")).toBeInTheDocument();
  });

  it("sets the data-resource-type attribute for downstream styling", () => {
    const { container } = render(
      <TestProviders>
        <ResourceTypeChip resourceType="orders" />
      </TestProviders>,
    );
    const chip = container.querySelector('[data-resource-type="orders"]');
    expect(chip).toBeInTheDocument();
  });

  it("falls back to the raw value when the type is unknown", () => {
    render(
      <TestProviders>
        <ResourceTypeChip resourceType="custom-thing" />
      </TestProviders>,
    );
    expect(screen.getByText("custom-thing")).toBeInTheDocument();
  });

  it("applies the sales brand color to orders/clients/ads", () => {
    const { container } = render(
      <TestProviders>
        <ResourceTypeChip resourceType="orders" />
      </TestProviders>,
    );
    const chip = container.querySelector("[data-resource-type]") as HTMLElement;
    expect(chip.style.getPropertyValue("--chip-color")).toBe(
      "var(--brand-sales)",
    );
  });

  it("applies the catalog brand color to products/specs/prints", () => {
    const { container } = render(
      <TestProviders>
        <ResourceTypeChip resourceType="product_specs" />
      </TestProviders>,
    );
    const chip = container.querySelector("[data-resource-type]") as HTMLElement;
    expect(chip.style.getPropertyValue("--chip-color")).toBe(
      "var(--brand-catalog)",
    );
  });

  it("applies the settings brand color to user/role rows", () => {
    const { container } = render(
      <TestProviders>
        <ResourceTypeChip resourceType="users" />
      </TestProviders>,
    );
    const chip = container.querySelector("[data-resource-type]") as HTMLElement;
    expect(chip.style.getPropertyValue("--chip-color")).toBe(
      "var(--brand-settings)",
    );
  });
});
