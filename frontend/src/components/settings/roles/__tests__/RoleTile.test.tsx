import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { RoleTile } from "@/components/settings/roles/RoleTile";
import { TestProviders } from "@/__tests__/test-utils";

describe("RoleTile", () => {
  it("renders the friendly admin name from i18n (not the raw backend name)", () => {
    render(
      <TestProviders>
        <RoleTile code="admin" memberCount={1} tone="#7c5cff" />
      </TestProviders>,
    );
    // EN locale resolves to "Admin" from roles.tiles.byCode.admin.name.
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("singularises the member count via ICU plural", () => {
    render(
      <TestProviders>
        <RoleTile code="manager" memberCount={1} tone="#0ea5e9" />
      </TestProviders>,
    );
    expect(screen.getByTestId("role-member-count").textContent).toContain("1 person");
  });

  it("pluralises the member count via ICU plural", () => {
    render(
      <TestProviders>
        <RoleTile code="operator" memberCount={2} tone="#10b981" />
      </TestProviders>,
    );
    expect(screen.getByTestId("role-member-count").textContent).toContain("2 people");
  });

  it("renders the description from i18n", () => {
    render(
      <TestProviders>
        <RoleTile code="manager" memberCount={2} tone="#0ea5e9" />
      </TestProviders>,
    );
    expect(
      screen.getByText(/Runs sales, catalog, production and stock\./),
    ).toBeInTheDocument();
  });

  it("exposes the role code as a data attribute", () => {
    render(
      <TestProviders>
        <RoleTile code="admin" memberCount={1} tone="#7c5cff" />
      </TestProviders>,
    );
    expect(screen.getByTestId("role-tile").getAttribute("data-role-code")).toBe("admin");
  });

  it("renders an unknown role code as its bare label (no crash)", () => {
    render(
      <TestProviders>
        <RoleTile code="custom-role" memberCount={0} tone="#10b981" />
      </TestProviders>,
    );
    expect(screen.getByText("custom-role")).toBeInTheDocument();
  });
});
