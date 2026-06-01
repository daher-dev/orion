import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { TestProviders } from "@/__tests__/test-utils";
import type { UserRead } from "@/lib/schemas/user";

// `canManageRoles` is driven by useCanAccess("users.write"); flip it per test.
let canManageRoles = false;
vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: () => canManageRoles,
}));

const adminUser: UserRead = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Joao Daher",
  email: "joao@daher.dev",
  job: "Founder",
  is_operator: false,
  role: { id: "r1", code: "admin", name: "Administrator" },
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

vi.mock("@/hooks/use-user", () => ({
  useMyUser: () => ({ data: adminUser, isPending: false, isError: false, error: null }),
  useUpdateUserSelf: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false }),
}));

afterEach(() => {
  canManageRoles = false;
});

describe("ProfileForm — role helper copy", () => {
  it("points admins (users.write) to Settings → Members instead of nagging them", () => {
    canManageRoles = true;
    render(
      <TestProviders>
        <ProfileForm />
      </TestProviders>,
    );
    // The role field still shows the role name, read-only...
    expect(screen.getByDisplayValue("Administrator")).toBeInTheDocument();
    // ...but an admin is pointed to where they actually manage roles.
    // (TestProviders renders with the `en` message catalog.)
    expect(screen.getByText(/Manage roles for your team in Settings/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Ask an admin to change your role/i),
    ).not.toBeInTheDocument();
  });

  it("keeps the 'ask an admin' copy for users without users.write", () => {
    canManageRoles = false;
    render(
      <TestProviders>
        <ProfileForm />
      </TestProviders>,
    );
    expect(screen.getByText(/Ask an admin to change your role/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Manage roles for your team in Settings/i),
    ).not.toBeInTheDocument();
  });
});
