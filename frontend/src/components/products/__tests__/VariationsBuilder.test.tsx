import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TestProviders } from "@/__tests__/test-utils";
import {
  VariationsBuilder,
  buildVariationItems,
  type VariationsBuilderValue,
} from "@/components/products/VariationsBuilder";

function setup(initial: VariationsBuilderValue, specCode = "CAM01", printCode: string | null = null) {
  const onChange = vi.fn<(next: VariationsBuilderValue) => void>();
  let value = initial;
  function controlled(next: VariationsBuilderValue) {
    value = next;
    onChange(next);
  }
  const utils = render(
    <TestProviders>
      <VariationsBuilder
        value={value}
        onChange={controlled}
        specCode={specCode}
        printCode={printCode}
      />
    </TestProviders>,
  );
  return { ...utils, onChange, getValue: () => value };
}

describe("VariationsBuilder", () => {
  it("toggles a size when clicked", () => {
    const { onChange } = setup({ sizes: [], colors: [] });
    fireEvent.click(screen.getByTestId("size-toggle-m"));
    expect(onChange).toHaveBeenCalledWith({ sizes: ["m"], colors: [] });
  });

  it("adds a preset color from the palette", () => {
    const { onChange } = setup({ sizes: [], colors: [] });
    // The first preset chip is the default "Preto".
    fireEvent.click(screen.getByText("Preto"));
    expect(onChange).toHaveBeenCalledWith({
      sizes: [],
      colors: [{ name: "Preto", hex: "#1f1f1f", color_code: "PRT" }],
    });
  });

  it("previews SKUs derived from spec/size/color/print", () => {
    setup(
      {
        sizes: ["p", "m"],
        colors: [{ name: "Preto", color_code: "PRT" }],
      },
      "CAM01",
      "FLR03",
    );
    expect(screen.getByText("CAM01-P-PRT-FLR03")).toBeInTheDocument();
    expect(screen.getByText("CAM01-M-PRT-FLR03")).toBeInTheDocument();
  });

  it("falls back to the no-preview message when no sizes are picked", () => {
    setup({ sizes: [], colors: [] });
    expect(
      screen.getByText("Pick at least one size and one color to preview SKUs."),
    ).toBeInTheDocument();
  });
});

describe("buildVariationItems", () => {
  it("expands the cross product (size × color) into items", () => {
    const items = buildVariationItems({
      sizes: ["p", "m"],
      colors: [
        { name: "Preto", color_code: "PRT" },
        { name: "Off-white", color_code: "OFF" },
      ],
    });
    expect(items).toHaveLength(4);
    expect(items.map((v) => v.size + v.color_code).sort()).toEqual([
      "mOFF",
      "mPRT",
      "pOFF",
      "pPRT",
    ]);
  });

  it("drops rows with missing name or non-3-letter codes", () => {
    const items = buildVariationItems({
      sizes: ["m"],
      colors: [
        { name: "Preto", color_code: "PRT" },
        { name: "", color_code: "OFF" }, // missing name
        { name: "Marrom", color_code: "MA" }, // short code
      ],
    });
    expect(items.map((v) => v.color_code)).toEqual(["PRT"]);
  });
});
