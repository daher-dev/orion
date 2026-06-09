import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { TestProviders } from "@/__tests__/test-utils";
import type { RoleList } from "@/lib/schemas/role";

const seededRole = {
  id: "role-admin",
  code: "admin",
  name: "Administrator",
  description: "",
  company_id: null,
  is_custom: false,
  permissions: [{ code: "orders.read", description: "" }],
};

const customRole = {
  id: "role-sales",
  code: "sales",
  name: "Sales",
  description: "Sales team",
  company_id: "company-1",
  is_custom: true,
  permissions: [{ code: "clients.read", description: "" }],
};

const roles: RoleList = [seededRole, customRole];

describe("PermissionMatrix — editable custom roles", () => {
  it("renders an edit affordance only for custom-role columns when canWrite", () => {
    render(
      <TestProviders>
        <PermissionMatrix roles={roles} canWrite onEditRole={vi.fn()} />
      </TestProviders>,
    );
    expect(screen.getByTestId("matrix-edit-sales")).toBeInTheDocument();
    expect(screen.queryByTestId("matrix-edit-admin")).not.toBeInTheDocument();
  });

  it("does not render edit affordances without write permission", () => {
    render(
      <TestProviders>
        <PermissionMatrix roles={roles} canWrite={false} onEditRole={vi.fn()} />
      </TestProviders>,
    );
    expect(screen.queryByTestId("matrix-edit-sales")).not.toBeInTheDocument();
  });

  it("invokes onEditRole with the custom role when its header is clicked", () => {
    const onEditRole = vi.fn();
    render(
      <TestProviders>
        <PermissionMatrix roles={roles} canWrite onEditRole={onEditRole} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByTestId("matrix-edit-sales"));
    expect(onEditRole).toHaveBeenCalledTimes(1);
    expect(onEditRole).toHaveBeenCalledWith(expect.objectContaining({ id: "role-sales" }));
  });
});
