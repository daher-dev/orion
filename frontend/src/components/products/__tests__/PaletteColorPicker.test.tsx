import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TestProviders } from "@/__tests__/test-utils";
import { DEFAULT_CATALOG_CONFIG } from "@/lib/schemas/company-settings";
import { PaletteColorPicker } from "@/components/products/PaletteColorPicker";
import type { ColorRow } from "@/components/products/VariationsBuilder";

const mutateAsync = vi.fn().mockResolvedValue({ config: DEFAULT_CATALOG_CONFIG });

vi.mock("@/hooks/use-catalog-config", () => ({
  useCatalogConfig: () => ({ data: { config: DEFAULT_CATALOG_CONFIG } }),
  useUpdateCatalogConfig: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => mutateAsync.mockClear());

function setup(initial: ColorRow[] = []) {
  const onChange = vi.fn<(next: ColorRow[]) => void>();
  render(
    <TestProviders>
      <PaletteColorPicker value={initial} onChange={onChange} />
    </TestProviders>,
  );
  return { onChange };
}

describe("PaletteColorPicker", () => {
  it("renders a chip per palette color", () => {
    setup();
    for (const c of DEFAULT_CATALOG_CONFIG.productColors) {
      expect(screen.getByTestId(`palette-chip-${c.code}`)).toBeInTheDocument();
    }
  });

  it("selects a palette color on chip click", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByTestId("palette-chip-OFF"));
    expect(onChange).toHaveBeenCalledWith([
      { name: "Off-white", hex: "#f4f1ea", color_code: "OFF" },
    ]);
  });

  it("registers a new color inline: derives a unique code, persists, and selects it", async () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByTestId("add-color-button"));
    fireEvent.change(screen.getByTestId("new-color-name"), { target: { value: "Ciano" } });

    // Code auto-derives from the name (Ciano → CIA, not already taken).
    expect((screen.getByTestId("new-color-code") as HTMLInputElement).value).toBe("CIA");

    fireEvent.click(screen.getByTestId("new-color-confirm"));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mutateAsync.mock.calls[0][0] as {
      config: { productColors: { name: string; code?: string }[] };
    };
    const added = arg.config.productColors.at(-1);
    expect(added).toMatchObject({ name: "Ciano", code: "CIA" });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([{ name: "Ciano", hex: "#1f1f1f", color_code: "CIA" }]),
    );
  });
});
