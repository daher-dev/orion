import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { RoleTilesGrid } from "@/components/settings/roles/RoleTilesGrid";
import { TestProviders } from "@/__tests__/test-utils";
import type { RoleList } from "@/lib/schemas/role";
import type { MemberRead } from "@/lib/schemas/member";

const roles: RoleList = [
  { id: "r-admin", code: "admin", name: "Administrator", description: "", permissions: [] },
  { id: "r-manager", code: "manager", name: "Manager", description: "", permissions: [] },
  { id: "r-operator", code: "operator", name: "Operator", description: "", permissions: [] },
];

function member(role: (typeof roles)[number], idSuffix: string): MemberRead {
  return {
    id: `m-${idSuffix}`,
    name: `Member ${idSuffix}`,
    email: `${idSuffix}@example.com`,
    job: null,
    is_operator: role.code === "operator",
    role,
    created_at: "2026-05-09T12:00:00Z",
  };
}

describe("RoleTilesGrid", () => {
  it("renders one tile per role", () => {
    render(
      <TestProviders>
        <RoleTilesGrid roles={roles} members={[]} />
      </TestProviders>,
    );
    expect(screen.getAllByTestId("role-tile")).toHaveLength(3);
  });

  it("counts members assigned to each role", () => {
    const members: MemberRead[] = [
      member(roles[0], "1"), // admin
      member(roles[1], "2"), // manager
      member(roles[1], "3"), // manager
      member(roles[2], "4"), // operator
      member(roles[2], "5"), // operator
    ];
    render(
      <TestProviders>
        <RoleTilesGrid roles={roles} members={members} />
      </TestProviders>,
    );
    const tiles = screen.getAllByTestId("role-tile");
    expect(within(tiles[0]!).getByTestId("role-member-count").textContent).toContain("1 person");
    expect(within(tiles[1]!).getByTestId("role-member-count").textContent).toContain("2 people");
    expect(within(tiles[2]!).getByTestId("role-member-count").textContent).toContain("2 people");
  });

  it("falls back to 0 when a role has no assigned members", () => {
    render(
      <TestProviders>
        <RoleTilesGrid roles={roles} members={[]} />
      </TestProviders>,
    );
    const tiles = screen.getAllByTestId("role-tile");
    for (const tile of tiles) {
      expect(within(tile).getByTestId("role-member-count").textContent).toContain("0");
    }
  });
});
