import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { InviteSheet } from "@/components/settings/members/InviteSheet";
import { TestProviders } from "@/__tests__/test-utils";

const createMutate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/use-invites", () => ({
  useCreateInvite: () => ({ mutateAsync: createMutate, isPending: false }),
}));

vi.mock("@/hooks/use-roles", () => ({
  useRoles: () => ({
    data: [
      { id: "role-admin", code: "admin", name: "Administrator", description: "", permissions: [] },
    ],
    isPending: false,
  }),
}));

describe("InviteSheet", () => {
  it("shows the email field when open", () => {
    render(
      <TestProviders>
        <InviteSheet open onOpenChange={() => {}} />
      </TestProviders>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("blocks submit when email is empty", () => {
    render(
      <TestProviders>
        <InviteSheet open onOpenChange={() => {}} />
      </TestProviders>,
    );
    const submit = screen.getByTestId("invite-submit");
    fireEvent.click(submit);
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("renders submit and cancel buttons", () => {
    render(
      <TestProviders>
        <InviteSheet open onOpenChange={() => {}} />
      </TestProviders>,
    );
    expect(screen.getByTestId("invite-submit")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
