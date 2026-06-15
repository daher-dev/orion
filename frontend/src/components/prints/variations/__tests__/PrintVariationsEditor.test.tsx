import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PrintVariationsEditor } from "@/components/prints/variations/PrintVariationsEditor";
import { TestProviders } from "@/__tests__/test-utils";
import { DEFAULT_CATALOG_CONFIG } from "@/lib/schemas/company-settings";
import type { Print } from "@/lib/schemas/print";

const updatePrint = vi.fn().mockResolvedValue({});
const createVariation = vi.fn().mockResolvedValue({});
const deleteVariation = vi.fn().mockResolvedValue(undefined);
const uploadArtwork = vi.fn().mockResolvedValue({});

vi.mock("@/hooks/use-prints", () => ({
  useUpdatePrint: () => ({ mutateAsync: updatePrint, isPending: false }),
  useCreateVariation: () => ({ mutateAsync: createVariation, isPending: false }),
  useDeleteVariation: () => ({ mutateAsync: deleteVariation, isPending: false }),
  useUploadArtwork: () => ({ mutateAsync: uploadArtwork, isPending: false }),
}));

vi.mock("@/hooks/use-catalog-config", () => ({
  useCatalogConfig: () => ({ data: { config: DEFAULT_CATALOG_CONFIG } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  updatePrint.mockClear();
  createVariation.mockClear();
  deleteVariation.mockClear();
  uploadArtwork.mockClear();
});

const basePrint: Print = {
  id: "p1",
  company_id: "c1",
  code: "EST01",
  name: "Aurora",
  image_url: null,
  cost_per_unit: "4.20",
  technique: "dtf",
  tag: null,
  has_front: true,
  has_back: false,
  image_url_front: null,
  image_url_back: null,
  width_cm: null,
  height_cm: null,
  variations: [
    {
      id: "v1",
      print_design_id: "p1",
      name: "Preto",
      ink_hex: "#1f1f1f",
      front_file_url: null,
      front_status: "pending",
      back_file_url: null,
      back_status: "pending",
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    },
  ],
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

function renderEditor(print: Print = basePrint, canWrite = true) {
  return render(
    <TestProviders>
      <PrintVariationsEditor print={print} canWrite={canWrite} />
    </TestProviders>,
  );
}

describe("PrintVariationsEditor", () => {
  it("renders one variation row with a single (front-only) side tile when has_back is false", () => {
    renderEditor();
    expect(screen.getByTestId("print-variations-editor")).toBeInTheDocument();
    expect(screen.getAllByTestId("variation-row").length).toBe(1);
    // front side tile present, back absent (has_back=false).
    expect(screen.getByTestId("side-tile-v1-front")).toBeInTheDocument();
    expect(screen.queryByTestId("side-tile-v1-back")).not.toBeInTheDocument();
  });

  it("toggling the back side calls useUpdatePrint with has_back=true", async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId("side-add-back"));
    await waitFor(() =>
      expect(updatePrint).toHaveBeenCalledWith({ id: "p1", payload: { has_back: true } }),
    );
  });

  it("uploads a PNG through the multipart artwork hook", async () => {
    renderEditor();
    const file = new File([new Uint8Array([1, 2, 3])], "art.png", { type: "image/png" });
    const input = screen.getByTestId("side-tile-v1-front-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadArtwork).toHaveBeenCalledTimes(1));
    const arg = uploadArtwork.mock.calls[0][0] as {
      variationId: string;
      side: string;
      file: File;
    };
    expect(arg.variationId).toBe("v1");
    expect(arg.side).toBe("front");
    expect(arg.file.name).toBe("art.png");
  });

  it("rejects a non-PNG upload without calling the hook", async () => {
    renderEditor();
    const file = new File(["x"], "art.jpg", { type: "image/jpeg" });
    const input = screen.getByTestId("side-tile-v1-front-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadArtwork).not.toHaveBeenCalled());
  });

  it("adds a color variation from the ink palette", async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId("variation-add"));
    // Pick an available ink color (Branco #f4f1ea is in printColors and unused).
    fireEvent.click(screen.getByTestId("variation-ink-#f4f1ea"));
    await waitFor(() => expect(createVariation).toHaveBeenCalledTimes(1));
    const arg = createVariation.mock.calls[0][0] as { name: string; ink_hex: string };
    expect(arg.ink_hex).toBe("#f4f1ea");
  });

  it("removes a variation", async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId("variation-remove-v1"));
    await waitFor(() => expect(deleteVariation).toHaveBeenCalledWith("v1"));
  });

  it("renders read-only (no add/upload) without prints.write", () => {
    renderEditor(basePrint, false);
    expect(screen.queryByTestId("variation-add")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sides-selector")).not.toBeInTheDocument();
  });
});
