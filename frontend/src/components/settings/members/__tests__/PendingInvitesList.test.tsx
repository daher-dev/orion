import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { PendingInvitesList } from "@/components/settings/members/PendingInvitesList";
import { TestProviders } from "@/__tests__/test-utils";
import type { InviteRead } from "@/lib/schemas/invite";

vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: () => true,
}));

const mutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/use-invites", () => ({
  useRevokeInvite: () => ({ mutateAsync, isPending: false }),
}));

const adminRole = {
  id: "role-admin",
  code: "admin",
  name: "Administrator",
  description: "",
  permissions: [],
};
const baseInvite: InviteRead = {
  id: "invite-1",
  email: "ana@example.com",
  role: adminRole,
  invited_by: { id: "u1", name: "Alfa Admin" },
  token: "tok-1234567890",
  accepted_at: null,
  expires_at: "2026-06-09T12:00:00Z",
  created_at: "2026-05-09T12:00:00Z",
};

describe("PendingInvitesList", () => {
  it("renders empty message when no pending invites", () => {
    render(
      <TestProviders>
        <PendingInvitesList rows={[]} />
      </TestProviders>,
    );
    expect(screen.getByTestId("pending-empty")).toBeInTheDocument();
  });

  it("filters out accepted invites", () => {
    const accepted: InviteRead = {
      ...baseInvite,
      id: "invite-accepted",
      email: "old@example.com",
      accepted_at: "2026-05-10T12:00:00Z",
    };
    render(
      <TestProviders>
        <PendingInvitesList rows={[accepted]} />
      </TestProviders>,
    );
    expect(screen.getByTestId("pending-empty")).toBeInTheDocument();
  });

  it("renders pending invite rows with email and role", () => {
    render(
      <TestProviders>
        <PendingInvitesList rows={[baseInvite]} />
      </TestProviders>,
    );
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });

  it("opens revoke confirmation on click", () => {
    render(
      <TestProviders>
        <PendingInvitesList rows={[baseInvite]} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByTestId("invite-revoke"));
    expect(screen.getByText(/Revoke this invite/i)).toBeInTheDocument();
  });
});
