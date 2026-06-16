import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CatalogConfigPane } from "@/components/settings/catalog/CatalogConfigPane";
import { TestProviders } from "@/__tests__/test-utils";
import { DEFAULT_CATALOG_CONFIG } from "@/lib/schemas/company-settings";

let canWrite = true;
vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: (code: string) => (code === "companies.write" ? canWrite : true),
}));

const mutateAsync = vi.fn().mockResolvedValue({ config: DEFAULT_CATALOG_CONFIG });
vi.mock("@/hooks/use-catalog-config", () => ({
  useCatalogConfig: () => ({
    data: { config: DEFAULT_CATALOG_CONFIG },
    isPending: false,
    isError: false,
  }),
  useUpdateCatalogConfig: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  canWrite = true;
  mutateAsync.mockClear();
});

function renderPane() {
  return render(
    <TestProviders>
      <CatalogConfigPane />
    </TestProviders>,
  );
}

describe("CatalogConfigPane", () => {
  it("renders the palettes, sizes, garment types and string lists", () => {
    renderPane();
    expect(screen.getByTestId("catalog-config-pane")).toBeInTheDocument();
    // Product + print color rows from the default config.
    expect(screen.getAllByTestId("product-colors-row").length).toBe(
      DEFAULT_CATALOG_CONFIG.productColors.length,
    );
    expect(screen.getAllByTestId("print-colors-row").length).toBe(
      DEFAULT_CATALOG_CONFIG.printColors.length,
    );
    // Sizes chips + garment rows.
    expect(screen.getAllByTestId("sizes-chip").length).toBe(
      DEFAULT_CATALOG_CONFIG.sizes.length,
    );
    expect(screen.getAllByTestId("garment-row").length).toBe(
      DEFAULT_CATALOG_CONFIG.garmentTypes.length,
    );
  });

  it("keeps Save disabled until the draft changes, then saves the full config", async () => {
    renderPane();
    const save = screen.getByTestId("catalog-config-save");
    expect(save).toBeDisabled();

    // Editing an existing color name makes the draft dirty (and stays valid).
    const nameInput = screen.getByTestId("product-colors-name-0");
    fireEvent.change(nameInput, { target: { value: "Carvão" } });
    await waitFor(() => expect(save).not.toBeDisabled());

    fireEvent.click(save);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mutateAsync.mock.calls[0][0] as {
      config: { productColors: { name: string }[] };
    };
    // The full config blob is sent with the renamed color.
    expect(arg.config.productColors[0].name).toBe("Carvão");
    expect(arg.config.productColors.length).toBe(
      DEFAULT_CATALOG_CONFIG.productColors.length,
    );
  });

  it("hides save and disables editors when the user lacks companies.write", () => {
    canWrite = false;
    renderPane();
    expect(screen.queryByTestId("catalog-config-save")).not.toBeInTheDocument();
    // Editors still render (read-only) but their controls are disabled.
    expect(screen.getByTestId("techniques-add")).toBeDisabled();
  });
});
