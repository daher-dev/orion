import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TestProviders } from "@/__tests__/test-utils";

const { mockCreateCutting, mockCreatePrint, mockRefetch, toastSuccess, toastWarning, toastError, perms } =
  vi.hoisted(() => ({
    mockCreateCutting: vi.fn(),
    mockCreatePrint: vi.fn(),
    mockRefetch: vi.fn(),
    toastSuccess: vi.fn(),
    toastWarning: vi.fn(),
    toastError: vi.fn(),
    perms: { canWrite: true },
  }));

const suggestions = {
  skus: [],
  cortes: [
    {
      key: "spec1|PRT",
      spec: { id: "spec1", code: "CAM01", name: "Camiseta Box" },
      product_type: "tshirt",
      color: "Preto",
      color_code: "PRT",
      total: 12,
      demand: 8,
      stock: 4,
      order_count: 3,
      grade_rows: [
        { size: "p", qty: 4, demand_qty: 2, stock_qty: 2 },
        { size: "m", qty: 8, demand_qty: 6, stock_qty: 2 },
      ],
      sources: ["demanda", "estoque"],
    },
  ],
  impressoes: [
    {
      key: "design1",
      design: { id: "design1", code: "2055", name: "Naruto", technique: "dtf", image_url: null },
      total: 10,
      demand: 10,
      stock: 0,
      order_count: 3,
      png: "ok",
      sources: ["demanda"],
    },
  ],
  totals: { toCut: 12, toPrint: 10, cortes: 1, impressoes: 1, demandDriven: 2, stockDriven: 1 },
};

vi.mock("@/hooks/use-planning", () => ({
  usePlanningSuggestions: () => ({
    data: suggestions,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: mockRefetch,
  }),
  useCreateCuttingOrders: () => ({ mutateAsync: mockCreateCutting, isPending: false }),
  useCreatePrintOrders: () => ({ mutateAsync: mockCreatePrint, isPending: false }),
}));

vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: (code: string) => (code === "planning.write" ? perms.canWrite : true),
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, warning: toastWarning, error: toastError },
}));

import PlanningPage from "@/app/[locale]/(app)/planning/page";

function renderPage() {
  return render(
    <TestProviders>
      <PlanningPage />
    </TestProviders>,
  );
}

describe("PlanningPage", () => {
  beforeEach(() => {
    perms.canWrite = true;
    mockCreateCutting.mockResolvedValue({
      created: [{ key: "spec1|PRT", cutting_order_id: "co1", code: "CO-AAA11111", total: 12 }],
      skipped: [],
      created_count: 1,
    });
    mockCreatePrint.mockResolvedValue({
      created: [{ key: "design1", print_order_id: "po1", code: "IM-BBB22222", total: 10 }],
      skipped: [],
      created_count: 1,
    });
  });
  afterEach(() => vi.clearAllMocks());

  it("renders both suggestion columns with their rows", () => {
    renderPage();
    expect(screen.getByTestId("planning-cortes-list")).toBeTruthy();
    expect(screen.getByTestId("planning-impressoes-list")).toBeTruthy();
    expect(screen.getByTestId("planning-cut-row-spec1|PRT")).toBeTruthy();
    expect(screen.getByTestId("planning-print-row-design1")).toBeTruthy();
    // Grade chips + the demand order count badge.
    expect(screen.getByText("Camiseta Box")).toBeTruthy();
    expect(screen.getByText("Naruto")).toBeTruthy();
  });

  it("selects every suggestion by default — create button shows the full total", () => {
    renderPage();
    const button = screen.getByTestId("planning-create-button");
    // 1 corte + 1 impressão = 2.
    expect(button.textContent).toContain("2");
  });

  it("toggling a row off lowers the create count", () => {
    renderPage();
    const row = screen.getByTestId("planning-cut-row-spec1|PRT");
    const checkbox = row.querySelector("input[type=checkbox]") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    // Only the impressão remains selected → "Create 1 order".
    expect(screen.getByTestId("planning-create-button").textContent).toContain("1");
  });

  it("creating posts both selected corte + impressão keys and shows the banner", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("planning-create-button"));

    await waitFor(() => expect(mockCreateCutting).toHaveBeenCalledWith({ keys: ["spec1|PRT"] }));
    expect(mockCreatePrint).toHaveBeenCalledWith({ keys: ["design1"] });
    expect(toastSuccess).toHaveBeenCalled();

    // The created banner surfaces the created order codes.
    await waitFor(() => expect(screen.getByTestId("planning-created-banner")).toBeTruthy());
    expect(screen.getByTestId("planning-created-banner").textContent).toContain("CO-AAA11111");
    expect(screen.getByTestId("planning-created-banner").textContent).toContain("IM-BBB22222");
  });

  it("only posts the endpoint that has selected keys", async () => {
    renderPage();
    // Deselect the impressão; only the corte should be created.
    const printRow = screen.getByTestId("planning-print-row-design1");
    fireEvent.click(printRow.querySelector("input[type=checkbox]") as HTMLInputElement);

    fireEvent.click(screen.getByTestId("planning-create-button"));

    await waitFor(() => expect(mockCreateCutting).toHaveBeenCalledWith({ keys: ["spec1|PRT"] }));
    expect(mockCreatePrint).not.toHaveBeenCalled();
  });

  it("filtering to Estoque baixo hides demand-only impressões", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("planning-filter-estoque"));
    // The corte has stock>0 (stays); the impressão is demand-only (drops).
    expect(screen.getByTestId("planning-cut-row-spec1|PRT")).toBeTruthy();
    expect(screen.queryByTestId("planning-print-row-design1")).toBeNull();
  });

  it("hides the action bar for read-only users", () => {
    perms.canWrite = false;
    renderPage();
    expect(screen.queryByTestId("planning-create-button")).toBeNull();
    // Checkboxes are disabled for read-only users.
    const row = screen.getByTestId("planning-cut-row-spec1|PRT");
    expect((row.querySelector("input[type=checkbox]") as HTMLInputElement).disabled).toBe(true);
  });
});
