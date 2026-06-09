import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { RoleEditorSheet } from "@/components/settings/roles/RoleEditorSheet";
import { TestProviders } from "@/__tests__/test-utils";
import type { RoleRead } from "@/lib/schemas/role";

// --- mocks ---

const createAsync = vi.fn();
const updateAsync = vi.fn();
const deleteAsync = vi.fn();

vi.mock("@/hooks/use-roles", () => ({
  useCreateRole: () => ({ mutateAsync: createAsync, isPending: false }),
  useUpdateRole: () => ({ mutateAsync: updateAsync, isPending: false }),
  useDeleteRole: () => ({ mutateAsync: deleteAsync, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const customRole: RoleRead = {
  id: "role-sales",
  code: "sales",
  name: "Sales",
  description: "Sales team",
  company_id: "company-1",
  is_custom: true,
  permissions: [{ code: "clients.read", description: "" }],
};

describe("RoleEditorSheet", () => {
  beforeEach(() => {
    createAsync.mockReset();
    updateAsync.mockReset();
    deleteAsync.mockReset();
    createAsync.mockResolvedValue({ id: "new", code: "x", name: "X", permissions: [] });
    updateAsync.mockResolvedValue({ id: "role-sales", code: "sales", name: "X", permissions: [] });
    deleteAsync.mockResolvedValue(undefined);
  });

  it("create mode shows a code field and submits the chosen permissions", async () => {
    render(
      <TestProviders>
        <RoleEditorSheet open onOpenChange={vi.fn()} />
      </TestProviders>,
    );

    expect(screen.getByTestId("role-code-input")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("role-name-input"), { target: { value: "Sales" } });
    fireEvent.change(screen.getByTestId("role-code-input"), { target: { value: "sales" } });
    // Toggle clients READ on, then orders WRITE on (write implies read).
    fireEvent.click(screen.getByTestId("perm-clients-read"));
    fireEvent.click(screen.getByTestId("perm-orders-write"));

    fireEvent.click(screen.getByTestId("role-save-button"));

    await waitFor(() => expect(createAsync).toHaveBeenCalledTimes(1));
    const payload = createAsync.mock.calls[0][0];
    expect(payload.code).toBe("sales");
    expect(payload.name).toBe("Sales");
    expect(new Set(payload.permission_codes)).toEqual(
      new Set(["clients.read", "orders.read", "orders.write"]),
    );
  });

  it("edit mode hides the code field and pre-fills existing values + permissions", async () => {
    render(
      <TestProviders>
        <RoleEditorSheet open onOpenChange={vi.fn()} initial={customRole} />
      </TestProviders>,
    );

    expect(screen.queryByTestId("role-code-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("role-name-input")).toHaveValue("Sales");
    // Pre-filled permission: clients.read switch should be checked.
    expect(screen.getByTestId("perm-clients-read")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByTestId("role-save-button"));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(1));
    expect(updateAsync.mock.calls[0][0].id).toBe("role-sales");
  });

  it("turning off read also clears write for the same domain", () => {
    const roleWithWrite: RoleRead = {
      ...customRole,
      permissions: [
        { code: "clients.read", description: "" },
        { code: "clients.write", description: "" },
      ],
    };
    render(
      <TestProviders>
        <RoleEditorSheet open onOpenChange={vi.fn()} initial={roleWithWrite} />
      </TestProviders>,
    );

    expect(screen.getByTestId("perm-clients-write")).toHaveAttribute("aria-checked", "true");
    // Turn read off → write should follow off.
    fireEvent.click(screen.getByTestId("perm-clients-read"));
    expect(screen.getByTestId("perm-clients-read")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("perm-clients-write")).toHaveAttribute("aria-checked", "false");
  });

  it("edit mode exposes a delete affordance that calls the delete mutation", async () => {
    render(
      <TestProviders>
        <RoleEditorSheet open onOpenChange={vi.fn()} initial={customRole} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByTestId("role-delete-button"));
    // Confirm in the alert dialog.
    const confirm = await screen.findByRole("button", { name: /delete role/i });
    fireEvent.click(confirm);
    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith("role-sales"));
  });
});
