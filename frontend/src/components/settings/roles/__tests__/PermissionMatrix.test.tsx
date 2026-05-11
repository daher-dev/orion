import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { TestProviders } from "@/__tests__/test-utils";
import type { RoleList } from "@/lib/schemas/role";

const allPerms = (role: string) => {
  const domains = [
    "ads", "clients", "companies", "contractors", "cutting", "fabric",
    "orders", "prints", "products", "roles", "sewing", "specs", "stock", "users",
  ];
  if (role === "admin") {
    return domains.flatMap((d) => [
      { code: `${d}.read`, description: "" },
      { code: `${d}.write`, description: "" },
    ]);
  }
  if (role === "operator") {
    return [
      { code: "cutting.read", description: "" },
      { code: "cutting.write", description: "" },
      { code: "fabric.read", description: "" },
    ];
  }
  return [];
};

const roles: RoleList = [
  {
    id: "role-admin",
    code: "admin",
    name: "Administrator",
    description: "",
    permissions: allPerms("admin"),
  },
  {
    id: "role-manager",
    code: "manager",
    name: "Manager",
    description: "",
    permissions: [
      { code: "clients.read", description: "" },
      { code: "clients.write", description: "" },
      { code: "users.read", description: "" },
    ],
  },
  {
    id: "role-operator",
    code: "operator",
    name: "Operator",
    description: "",
    permissions: allPerms("operator"),
  },
];

describe("PermissionMatrix", () => {
  it("renders one column per role", () => {
    render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeInTheDocument();
  });

  it("renders all permission domains as rows", () => {
    render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const rows = screen.getAllByTestId("matrix-row");
    expect(rows.length).toBe(14);
  });

  it("shows read+write for admin in users domain", () => {
    const { container } = render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const cell = container.querySelector(
      '[data-domain="users"][data-role-code="admin"]',
    ) as HTMLElement | null;
    expect(cell).toBeTruthy();
    expect(within(cell!).getByTestId("cell-read")).toBeInTheDocument();
    expect(within(cell!).getByTestId("cell-write")).toBeInTheDocument();
  });

  it("shows empty cell for operator on orders", () => {
    const { container } = render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const cell = container.querySelector(
      '[data-domain="orders"][data-role-code="operator"]',
    ) as HTMLElement | null;
    expect(cell).toBeTruthy();
    expect(within(cell!).getByTestId("cell-empty")).toBeInTheDocument();
  });

  it("shows read-only for manager on users", () => {
    const { container } = render(
      <TestProviders>
        <PermissionMatrix roles={roles} />
      </TestProviders>,
    );
    const cell = container.querySelector(
      '[data-domain="users"][data-role-code="manager"]',
    ) as HTMLElement | null;
    expect(cell).toBeTruthy();
    expect(within(cell!).getByTestId("cell-read")).toBeInTheDocument();
    expect(within(cell!).queryByTestId("cell-write")).toBeNull();
  });
});
