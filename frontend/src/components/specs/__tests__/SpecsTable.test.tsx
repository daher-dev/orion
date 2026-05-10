import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/__tests__/test-utils";
import { SpecsTable } from "../SpecsTable";
import type { SpecRead } from "@/lib/schemas/spec";

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"} {...rest}>
      {children}
    </a>
  ),
}));

const FIXTURE: SpecRead[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    company_id: "22222222-2222-2222-2222-222222222222",
    code: "FT-001",
    name: "Cropped Jersey",
    fabric_type: "jersey",
    fabric_grammage_gsm: 180,
    fabric_weight_per_piece_g: "250.00",
    has_ribana: true,
    ribana_weight_pct: "10.00",
    labor_cost: "12.00",
    sale_price: "99.00",
    notes: null,
    trims: [],
    created_at: "2026-05-01T12:00:00Z",
    updated_at: "2026-05-09T12:00:00Z",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    company_id: "22222222-2222-2222-2222-222222222222",
    code: "FT-002",
    name: "Box Tee",
    fabric_type: "fleece",
    fabric_grammage_gsm: 320,
    fabric_weight_per_piece_g: "450.00",
    has_ribana: false,
    ribana_weight_pct: null,
    labor_cost: "18.50",
    sale_price: null,
    notes: null,
    trims: [],
    created_at: "2026-04-01T12:00:00Z",
    updated_at: "2026-04-15T12:00:00Z",
  },
];

describe("SpecsTable", () => {
  it("renders a row per spec with code in mono and name in ink", () => {
    renderWithProviders(<SpecsTable items={FIXTURE} />);
    expect(screen.getByText("FT-001")).toBeInTheDocument();
    expect(screen.getByText("Cropped Jersey")).toBeInTheDocument();
    expect(screen.getByText("FT-002")).toBeInTheDocument();
  });

  it("displays an empty hint when items are empty", () => {
    renderWithProviders(<SpecsTable items={[]} />);
    expect(screen.getByTestId("specs-table-empty")).toBeInTheDocument();
  });

  it("renders the GSM as a tabular-nums string", () => {
    renderWithProviders(<SpecsTable items={FIXTURE} />);
    expect(screen.getByText("180")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
  });

  it("renders fabric type translations", () => {
    renderWithProviders(<SpecsTable items={FIXTURE} />);
    expect(screen.getByText("Jersey")).toBeInTheDocument();
    expect(screen.getByText("Fleece")).toBeInTheDocument();
  });

  it("each row links to the spec detail page", () => {
    renderWithProviders(<SpecsTable items={FIXTURE} />);
    const links = screen.getAllByRole("link");
    expect(links.some((a) => a.getAttribute("href")?.endsWith(FIXTURE[0]!.id))).toBe(true);
  });
});
