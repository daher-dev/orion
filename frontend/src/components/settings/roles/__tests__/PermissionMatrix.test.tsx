import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { TestProviders } from "@/__tests__/test-utils";
import type { RoleList } from "@/lib/schemas/role";

/**
 * Build a deterministic `RoleList` mirroring the seed migration:
 *  - admin   → *.read + *.write
 *  - manager → ops read/write + companies.read + users.read + roles.read
 *  - operator → cutting + sewing + stock write; fabric/products/specs/prints read
 *
 * Kept inline so the tests stay self-contained — if the seed migration ever
 * changes the matrix is the right place to catch the drift.
 */
const SEEDED_DOMAINS = [
  "ads",
  "clients",
  "companies",
  "contractors",
  "cutting",
  "fabric",
  "orders",
  "prints",
  "products",
  "roles",
  "sewing",
  "specs",
  "stock",
  "users",
] as const;

const allPerms = SEEDED_DOMAINS.flatMap((d) => [
  { code: `${d}.read`, description: "" },
  { code: `${d}.write`, description: "" },
]);

const adminRole = {
  id: "role-admin",
  code: "admin",
  name: "Administrator",
  description: "",
  permissions: allPerms,
};

const managerRole = {
  id: "role-manager",
  code: "manager",
  name: "Manager",
  description: "",
  permissions: [
    "clients.read",
    "clients.write",
    "contractors.read",
    "contractors.write",
    "prints.read",
    "prints.write",
    "specs.read",
    "specs.write",
    "products.read",
    "products.write",
    "ads.read",
    "ads.write",
    "fabric.read",
    "fabric.write",
    "cutting.read",
    "cutting.write",
    "sewing.read",
    "sewing.write",
    "stock.read",
    "stock.write",
    "orders.read",
    "orders.write",
    "companies.read",
    "users.read",
    "roles.read",
  ].map((code) => ({ code, description: "" })),
};

const operatorRole = {
  id: "role-operator",
  code: "operator",
  name: "Operator",
  description: "",
  permissions: [
    "fabric.read",
    "cutting.read",
    "cutting.write",
    "sewing.read",
    "sewing.write",
    "stock.read",
    "stock.write",
    "products.read",
    "specs.read",
    "prints.read",
  ].map((code) => ({ code, description: "" })),
};

const roles: RoleList = [adminRole, managerRole, operatorRole];

function cellFor(container: HTMLElement, capability: string, code: string) {
  const row = container.querySelector(`[data-capability="${capability}"]`);
  if (!row) return null;
  return row.querySelector(`[data-role-code="${code}"]`);
}

describe("PermissionMatrix", () => {
  beforeEach(() => {
    // Components render with the static role list; nothing to reset.
  });

  it("renders the design's five capability groups", () => {
    render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    // Group headers come from `roles.matrix.groups.*`.
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Production")).toBeInTheDocument();
    // Both the group and the capability "Stock" share a label — multiple
    // matches are expected. Verify the group row carries the right testid.
    const groups = screen.getAllByTestId("matrix-group");
    expect(groups).toHaveLength(5);
  });

  it("emits one column header per role", () => {
    render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeInTheDocument();
  });

  it("renders the 16 capability rows from the design source", () => {
    render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const rows = screen.getAllByTestId("matrix-row");
    expect(rows.length).toBe(16);
  });

  it("admin gets 'all' for every capability (full r/w + system extras)", () => {
    const { container } = render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const adminCells = container.querySelectorAll(
      '[data-testid="matrix-row"] [data-role-code="admin"]',
    );
    for (const cell of adminCells) {
      expect(cell.getAttribute("data-cell-kind")).toBe("all");
    }
  });

  it("operator shows 'all' on cutting capability and 'none' on orders capability", () => {
    const { container } = render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const cuttingCell = cellFor(container, "cuttingOpen", "operator");
    expect(cuttingCell?.getAttribute("data-cell-kind")).toBe("all");

    const ordersCell = cellFor(container, "ordersWrite", "operator");
    expect(ordersCell?.getAttribute("data-cell-kind")).toBe("none");
  });

  it("manager shows 'view' on team management (users.read only)", () => {
    const { container } = render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const teamCell = cellFor(container, "teamManage", "manager");
    expect(teamCell?.getAttribute("data-cell-kind")).toBe("view");
  });

  it("manager shows 'none' on billing (admin-only static row)", () => {
    const { container } = render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const billingCell = cellFor(container, "billing", "manager");
    expect(billingCell?.getAttribute("data-cell-kind")).toBe("none");
  });

  it("operator shows 'view' on workshops (contractors.read seeded for read-only)", () => {
    const { container } = render(
      <TestProviders>
        <PermissionMatrix
          roles={[
            adminRole,
            managerRole,
            // Augment the operator with a contractors.read perm (regression
            // guard for future seeding changes).
            {
              ...operatorRole,
              permissions: [
                ...operatorRole.permissions,
                { code: "contractors.read", description: "" },
              ],
            },
          ]}
        />
      </TestProviders>,
    );
    const cell = cellFor(container, "contractorsManage", "operator");
    expect(cell?.getAttribute("data-cell-kind")).toBe("view");
  });

  it("PermCell renders a check icon for `all` cells", () => {
    const { container } = render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const adminCell = cellFor(container, "ordersWrite", "admin") as HTMLElement;
    const chip = within(adminCell).getByTestId("perm-cell");
    expect(chip.getAttribute("data-kind")).toBe("all");
    // Lucide check icon renders an svg with a polyline.
    expect(chip.querySelector("svg")).toBeTruthy();
  });
});
