import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StockAlertsForm } from "@/components/settings/StockAlertsForm";
import { TestProviders } from "@/__tests__/test-utils";

// Permission gate — flip per test. The form reads stock.read (gate) and
// stock.write (save button) through useCanAccess.
let canWrite = true;
vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: (code: string) => (code === "stock.write" ? canWrite : true),
}));

const mutateAsync = vi.fn().mockResolvedValue({ low_stock_threshold: 25 });
vi.mock("@/hooks/use-stock-settings", () => ({
  useStockSettings: () => ({
    data: { low_stock_threshold: 10 },
    isPending: false,
    isError: false,
    error: null,
  }),
  useUpdateStockSettings: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  canWrite = true;
  mutateAsync.mockClear();
});

describe("StockAlertsForm", () => {
  it("renders the current configured threshold", () => {
    render(
      <TestProviders>
        <StockAlertsForm />
      </TestProviders>,
    );
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  it("submits the new threshold value", async () => {
    render(
      <TestProviders>
        <StockAlertsForm />
      </TestProviders>,
    );
    const input = screen.getByLabelText(/threshold/i);
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.submit(screen.getByTestId("stock-alerts-form"));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ low_stock_threshold: 25 });
    });
  });

  it("hides the save button when the user lacks stock.write", () => {
    canWrite = false;
    render(
      <TestProviders>
        <StockAlertsForm />
      </TestProviders>,
    );
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });
});
