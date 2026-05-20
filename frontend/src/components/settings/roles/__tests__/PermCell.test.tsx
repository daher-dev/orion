import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PermCell } from "@/components/settings/roles/PermCell";

describe("PermCell", () => {
  it("renders an `all` chip with a check icon", () => {
    render(<PermCell kind="all" />);
    const chip = screen.getByTestId("perm-cell");
    expect(chip.getAttribute("data-kind")).toBe("all");
    expect(chip.querySelector("svg")).toBeTruthy();
  });

  it("renders a `view` chip with an eye icon", () => {
    render(<PermCell kind="view" />);
    const chip = screen.getByTestId("perm-cell");
    expect(chip.getAttribute("data-kind")).toBe("view");
  });

  it("renders a `none` chip with a lock icon and reduced opacity", () => {
    render(<PermCell kind="none" />);
    const chip = screen.getByTestId("perm-cell");
    expect(chip.getAttribute("data-kind")).toBe("none");
    // The icon SVG is rendered inside the chip with opacity 0.65 inline.
    const svg = chip.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("style")).toContain("0.65");
  });

  it("forwards the `label` prop to the title attribute (a11y tooltip)", () => {
    render(<PermCell kind="all" label="Pode editar" />);
    const chip = screen.getByTestId("perm-cell");
    expect(chip.getAttribute("title")).toBe("Pode editar");
  });

  it("is 24×24 in size (matches the design source's PermCell)", () => {
    render(<PermCell kind="all" />);
    const chip = screen.getByTestId("perm-cell");
    expect(chip.className).toContain("h-6");
    expect(chip.className).toContain("w-6");
  });
});
