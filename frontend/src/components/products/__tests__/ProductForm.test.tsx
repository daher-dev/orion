import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TestProviders } from "@/__tests__/test-utils";
import { DEFAULT_CATALOG_CONFIG } from "@/lib/schemas/company-settings";
import { ProductForm } from "@/components/products/ProductForm";

vi.mock("@/hooks/use-catalog-config", () => ({
  useCatalogConfig: () => ({ data: { config: DEFAULT_CATALOG_CONFIG } }),
  useUpdateCatalogConfig: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/use-specs", () => ({
  useSpecs: () => ({
    data: {
      items: [
        { id: "spec-1", code: "CAM01", name: "Cropped Jersey" },
        { id: "spec-2", code: "REG02", name: "Regata Bali" },
      ],
    },
  }),
  useSpec: () => ({ data: null, isPending: false }),
}));

vi.mock("@/hooks/use-prints", () => ({
  usePrints: () => ({
    data: {
      items: [{ id: "print-1", code: "FLR03", name: "Floral" }],
    },
  }),
  usePrint: () => ({ data: null, isPending: false }),
}));

describe("ProductForm", () => {
  it("blocks submission when name is empty", async () => {
    const onSubmit = vi.fn();
    render(
      <TestProviders>
        <ProductForm formId="t1" onSubmit={onSubmit} />
      </TestProviders>,
    );
    fireEvent.submit(document.getElementById("t1") as HTMLFormElement);
    await waitFor(() =>
      expect(screen.getByTestId("product-form-error")).toHaveTextContent(
        /Name is required/i,
      ),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submission when no variations are selected", async () => {
    const onSubmit = vi.fn();
    render(
      <TestProviders>
        <ProductForm formId="t2" onSubmit={onSubmit} />
      </TestProviders>,
    );
    fireEvent.change(screen.getByTestId("product-form-name"), {
      target: { value: "Cropped" },
    });
    // Spec is required next — open the picker and pick one.
    fireEvent.click(screen.getByTestId("product-form-spec-trigger"));
    fireEvent.click(screen.getByTestId("spec-option-CAM01"));

    fireEvent.submit(document.getElementById("t2") as HTMLFormElement);
    await waitFor(() =>
      expect(screen.getByTestId("product-form-error")).toHaveTextContent(
        /at least one size and one color/i,
      ),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a valid payload when all fields are filled", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TestProviders>
        <ProductForm formId="t3" onSubmit={onSubmit} />
      </TestProviders>,
    );

    fireEvent.change(screen.getByTestId("product-form-name"), {
      target: { value: "Cropped Oversized" },
    });
    // Pick spec
    fireEvent.click(screen.getByTestId("product-form-spec-trigger"));
    fireEvent.click(screen.getByTestId("spec-option-CAM01"));

    // Toggle size M + add preset Preto.
    fireEvent.click(screen.getByTestId("size-toggle-m"));
    fireEvent.click(screen.getByText("Preto"));

    fireEvent.submit(document.getElementById("t3") as HTMLFormElement);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Cropped Oversized",
          spec_id: "spec-1",
          variations: [
            { size: "m", color: "Preto", color_code: "PRT" },
          ],
        }),
      ),
    );
  });
});
