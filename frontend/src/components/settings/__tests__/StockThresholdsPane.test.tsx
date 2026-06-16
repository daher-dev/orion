import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StockThresholdsPane } from "@/components/settings/StockThresholdsPane";
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
      <StockThresholdsPane />
    </TestProviders>,
  );
}

describe("StockThresholdsPane", () => {
  it("renders all five inventory tiers", () => {
    renderPane();
    for (const id of ["fabric", "paper", "blank", "printed", "product"]) {
      expect(screen.getByTestId(`threshold-tier-${id}`)).toBeInTheDocument();
    }
  });

  it("shows the unit segmented control only for tiers with multiple units", () => {
    renderPane();
    // fabric allows pct|kg → both unit buttons exist.
    expect(screen.getByTestId("threshold-unit-fabric-pct")).toBeInTheDocument();
    expect(screen.getByTestId("threshold-unit-fabric-kg")).toBeInTheDocument();
    // blank is qty-only → no unit toggle rendered.
    expect(screen.queryByTestId("threshold-unit-blank-qty")).not.toBeInTheDocument();
  });

  it("toggling a tier off makes the draft dirty and saves the whole config", async () => {
    renderPane();
    const save = screen.getByTestId("thresholds-save");
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByTestId("threshold-toggle-product"));
    await waitFor(() => expect(save).not.toBeDisabled());

    fireEvent.click(save);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mutateAsync.mock.calls[0][0] as {
      config: { stockThresholds: { product: { enabled: boolean } } };
    };
    expect(arg.config.stockThresholds.product.enabled).toBe(false);
  });

  it("hides the save button when the user lacks companies.write", () => {
    canWrite = false;
    renderPane();
    expect(screen.queryByTestId("thresholds-save")).not.toBeInTheDocument();
  });
});
