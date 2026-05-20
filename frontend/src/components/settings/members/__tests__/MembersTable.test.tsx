import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { MembersTable } from "@/components/settings/members/MembersTable";
import { TestProviders } from "@/__tests__/test-utils";
import type { MemberRead } from "@/lib/schemas/member";

vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: () => true,
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
    const onView = vi.fn();
    render(
      <TestProviders>
        <MembersTable rows={rows} onView={onView} />
      </TestProviders>,
    );
    expect(screen.getByText("Alfa Admin")).toBeInTheDocument();
    expect(screen.getByText("alfa@example.com")).toBeInTheDocument();
    expect(screen.getByText("Beta Manager")).toBeInTheDocument();
  });

  it("renders the role name in the row instead of a select", () => {
    const onView = vi.fn();
    render(
      <TestProviders>
        <MembersTable rows={rows} onView={onView} />
      </TestProviders>,
    );
    // Role select moved into MemberDetailSheet; the row now shows the name.
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.queryByTestId("role-select-trigger")).toBeNull();
  });

  it("calls onView with the clicked member", () => {
    const onView = vi.fn();
    render(
      <TestProviders>
        <MembersTable rows={rows} onView={onView} />
      </TestProviders>,
    );
    const rowsRendered = screen.getAllByTestId("members-row");
    fireEvent.click(rowsRendered[0]);
    expect(onView).toHaveBeenCalledWith(rows[0]);
  });

  it("does not render an inline trash / remove button", () => {
    const onView = vi.fn();
    render(
      <TestProviders>
        <MembersTable rows={rows} onView={onView} />
      </TestProviders>,
    );
    // Delete moved into the detail drawer; the row only shows a chevron.
    expect(screen.queryByTestId("member-remove")).toBeNull();
  });
});
