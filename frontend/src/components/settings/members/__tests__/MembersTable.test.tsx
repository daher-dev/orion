import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { MembersTable } from "@/components/settings/members/MembersTable";
import { TestProviders } from "@/__tests__/test-utils";
import type { MemberRead } from "@/lib/schemas/member";
import type { RoleList } from "@/lib/schemas/role";

vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: () => true,
}));

const mutateAsync = vi.fn().mockResolvedValue(undefined);
const removeMutate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/use-members", () => ({
  useUpdateMemberRole: () => ({ mutateAsync, isPending: false }),
  useRemoveMember: () => ({ mutateAsync: removeMutate, isPending: false }),
}));

vi.mock("@/hooks/use-roles", () => ({
  useRoles: () => ({ data: undefined, isPending: false }),
}));

const adminRole = {
  id: "role-admin",
  code: "admin",
  name: "Administrator",
  description: "",
  permissions: [{ code: "users.write", description: "" }],
};
const managerRole = {
  id: "role-manager",
  code: "manager",
  name: "Manager",
  description: "",
  permissions: [],
};
const roles: RoleList = [adminRole, managerRole];

const rows: MemberRead[] = [
  {
    id: "member-1",
    name: "Alfa Admin",
    email: "alfa@example.com",
    job: "Founder",
    is_operator: false,
    role: adminRole,
    created_at: "2026-05-09T12:00:00Z",
  },
  {
    id: "member-2",
    name: "Beta Manager",
    email: "beta@example.com",
    job: null,
    is_operator: false,
    role: managerRole,
    created_at: "2026-05-09T12:00:00Z",
  },
];

describe("MembersTable", () => {
  it("renders members and their emails", () => {
    render(
      <TestProviders>
        <MembersTable rows={rows} roles={roles} />
      </TestProviders>,
    );
    expect(screen.getByText("Alfa Admin")).toBeInTheDocument();
    expect(screen.getByText("alfa@example.com")).toBeInTheDocument();
    expect(screen.getByText("Beta Manager")).toBeInTheDocument();
  });

  it("opens remove confirmation when the trash icon is clicked", () => {
    render(
      <TestProviders>
        <MembersTable rows={rows} roles={roles} />
      </TestProviders>,
    );
    const removeButtons = screen.getAllByTestId("member-remove");
    fireEvent.click(removeButtons[0]);
    expect(
      screen.getByText(/Remove this member/i),
    ).toBeInTheDocument();
  });

  it("renders a role select trigger per row", () => {
    render(
      <TestProviders>
        <MembersTable rows={rows} roles={roles} />
      </TestProviders>,
    );
    const triggers = screen.getAllByTestId("role-select-trigger");
    expect(triggers.length).toBe(2);
  });
});
