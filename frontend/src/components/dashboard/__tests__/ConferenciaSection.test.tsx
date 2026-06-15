import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ConferenciaSection } from "@/components/dashboard/ConferenciaSection";
import { TestProviders } from "@/__tests__/test-utils";
import type { ConferenceSummary } from "@/lib/schemas/dashboard";

const pushMock = vi.fn();
vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const conference: ConferenceSummary = {
  totals: {
    orders: 120,
    pieces: 340,
    mapped: 300,
    pending: 40,
    checked: 90,
    to_check: 25,
    in_lote: 18,
    mapped_pct: 88,
  },
  pipeline: {
    mapeamento: 12,
    producao: 30,
    separacao: 45,
    envio: 18,
  },
  batches: { open: 3, in_production: 1, dispatched: 2 },
};

function renderSection() {
  return render(
    <TestProviders>
      <ConferenciaSection conference={conference} />
    </TestProviders>,
  );
}

describe("ConferenciaSection", () => {
  it("renders the four conference KPIs with totals + mapped %", () => {
    renderSection();
    const section = screen.getByTestId("dashboard-conference");
    expect(within(section).getByText("Total orders")).toBeInTheDocument();
    expect(within(section).getByText("120")).toBeInTheDocument();
    expect(within(section).getByText("340")).toBeInTheDocument();
    // mapped pct (value + % suffix rendered separately)
    expect(within(section).getByText("88")).toBeInTheDocument();
  });

  it("renders the order-pipeline strip with all four column counts", () => {
    renderSection();
    const strip = screen.getByTestId("order-pipeline-strip");
    expect(
      within(within(strip).getByTestId("order-pipeline-mapeamento")).getByText("12"),
    ).toBeInTheDocument();
    expect(
      within(within(strip).getByTestId("order-pipeline-producao")).getByText("30"),
    ).toBeInTheDocument();
    expect(
      within(within(strip).getByTestId("order-pipeline-separacao")).getByText("45"),
    ).toBeInTheDocument();
    expect(
      within(within(strip).getByTestId("order-pipeline-envio")).getByText("18"),
    ).toBeInTheDocument();
  });

  it("renders the two progress panels (orders + pieces checked)", () => {
    renderSection();
    const panels = screen.getAllByTestId("conf-prog");
    expect(panels).toHaveLength(2);
    // orders checked = 90 / 120 → 75%
    expect(within(panels[0]).getByText("75%")).toBeInTheDocument();
  });
});
