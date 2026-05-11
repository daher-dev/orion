import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StockAdjustDialog } from "@/components/stock/StockAdjustDialog";
import { TestProviders } from "@/__tests__/test-utils";
import { ApiError } from "@/lib/api-client";
import type { VariationStockRead } from "@/lib/schemas/stock";

// --- mocks ---

const mutateAsyncEntry = vi.fn();
const mutateAsyncExit = vi.fn();

vi.mock("@/hooks/use-stock", () => ({
  useCreateStockEntry: () => ({ mutateAsync: mutateAsyncEntry, isPending: false }),
  useCreateStockExit: () => ({ mutateAsync: mutateAsyncExit, isPending: false }),
}));

const sampleVariation: VariationStockRead = {
  variation_id: "11111111-1111-1111-1111-111111111111",
  sku: "CAM01-M-BLK",
  size: "m",
  color: "Preto",
  color_code: "BLK",
  product: {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    name: "Camiseta Oversized",
    code: "aaaaaaaa",
  },
  on_hand: 6,
  entries_total: 10,
  exits_total: 4,
  last_movement_at: "2026-05-10T18:00:00Z",
};

describe("StockAdjustDialog", () => {
  beforeEach(() => {
    mutateAsyncEntry.mockReset();
    mutateAsyncExit.mockReset();
  });

  it("submits an entry with the entered quantity", async () => {
    mutateAsyncEntry.mockResolvedValue({ id: "ok" });
    render(
      <TestProviders>
        <StockAdjustDialog
          open
          onOpenChange={() => {}}
          variation={sampleVariation}
          defaultDirection="entry"
        />
      </TestProviders>,
    );

    const qty = screen.getByTestId("stock-adjust-quantity") as HTMLInputElement;
    fireEvent.change(qty, { target: { value: "12" } });
    fireEvent.click(screen.getByTestId("stock-adjust-submit"));

    await waitFor(() => expect(mutateAsyncEntry).toHaveBeenCalledTimes(1));
    expect(mutateAsyncEntry.mock.calls[0][0]).toMatchObject({
      variation_id: sampleVariation.variation_id,
      quantity: 12,
      source: "adjustment",
    });
  });

  it("switches to exit mutation when direction = exit", async () => {
    mutateAsyncExit.mockResolvedValue({ id: "ok" });
    render(
      <TestProviders>
        <StockAdjustDialog
          open
          onOpenChange={() => {}}
          variation={sampleVariation}
          defaultDirection="exit"
        />
      </TestProviders>,
    );

    const qty = screen.getByTestId("stock-adjust-quantity") as HTMLInputElement;
    fireEvent.change(qty, { target: { value: "3" } });
    fireEvent.click(screen.getByTestId("stock-adjust-submit"));

    await waitFor(() => expect(mutateAsyncExit).toHaveBeenCalledTimes(1));
    expect(mutateAsyncEntry).not.toHaveBeenCalled();
    expect(mutateAsyncExit.mock.calls[0][0]).toMatchObject({
      variation_id: sampleVariation.variation_id,
      quantity: 3,
      reason: "adjustment",
    });
  });

  it("surfaces an insufficient-stock error from the server", async () => {
    mutateAsyncExit.mockRejectedValueOnce(new ApiError(409, "Insufficient stock — available: 6"));
    render(
      <TestProviders>
        <StockAdjustDialog
          open
          onOpenChange={() => {}}
          variation={sampleVariation}
          defaultDirection="exit"
        />
      </TestProviders>,
    );
    const qty = screen.getByTestId("stock-adjust-quantity") as HTMLInputElement;
    fireEvent.change(qty, { target: { value: "10" } });
    fireEvent.click(screen.getByTestId("stock-adjust-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("stock-adjust-server-error").textContent).toContain("6"),
    );
  });

  it("blocks submission when quantity is zero", async () => {
    render(
      <TestProviders>
        <StockAdjustDialog
          open
          onOpenChange={() => {}}
          variation={sampleVariation}
          defaultDirection="entry"
        />
      </TestProviders>,
    );
    const qty = screen.getByTestId("stock-adjust-quantity") as HTMLInputElement;
    fireEvent.change(qty, { target: { value: "0" } });
    fireEvent.click(screen.getByTestId("stock-adjust-submit"));
    // Mutation never fires.
    expect(mutateAsyncEntry).not.toHaveBeenCalled();
  });
});
