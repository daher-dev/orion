import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PermissionLegend } from "@/components/settings/roles/PermissionLegend";
import { TestProviders } from "@/__tests__/test-utils";

describe("PermissionLegend", () => {
  it("renders all three legend labels in the design's order", () => {
    render(
      <TestProviders>
        <PermissionLegend />
      </TestProviders>,
    );
    const legend = screen.getByTestId("permission-legend");
    const text = legend.textContent ?? "";
    // EN labels from roles.legend.{all,view,none}.
    expect(text).toContain("Can edit");
    expect(text).toContain("View only");
    expect(text).toContain("No access");
  });

  it("renders one PermCell per legend item (3 total)", () => {
    render(
      <TestProviders>
        <PermissionLegend />
      </TestProviders>,
    );
    const cells = screen.getAllByTestId("perm-cell");
    expect(cells).toHaveLength(3);
    expect(cells[0]!.getAttribute("data-kind")).toBe("all");
    expect(cells[1]!.getAttribute("data-kind")).toBe("view");
    expect(cells[2]!.getAttribute("data-kind")).toBe("none");
  });
});
