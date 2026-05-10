import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import { ContractorsTable } from "../ContractorsTable";
import type { Contractor } from "@/lib/schemas/contractor";

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

const ROWS: Contractor[] = [
  {
    id: "row-1",
    name: "Banca Esperança",
    address: "R. das Palmeiras, 12",
    phone: "11 91234-5678",
    created_at: "2026-04-15T12:00:00Z",
    updated_at: "2026-04-15T12:00:00Z",
  },
  {
    id: "row-2",
    name: "Banca Lúcia",
    address: null,
    phone: null,
    created_at: "2026-04-20T12:00:00Z",
    updated_at: "2026-04-20T12:00:00Z",
  },
];

describe("ContractorsTable", () => {
  it("renders one row per contractor", () => {
    renderWithIntl(<ContractorsTable data={ROWS} onRowClick={vi.fn()} />);
    const rows = screen.getAllByTestId("contractor-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Banca Esperança")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Banca Lúcia")).toBeInTheDocument();
  });

  it("shows em-dash for null address and phone", () => {
    renderWithIntl(<ContractorsTable data={ROWS} onRowClick={vi.fn()} />);
    const lucia = screen.getAllByTestId("contractor-row")[1];
    const dashes = within(lucia).getAllByText("—");
    expect(dashes.length).toBe(2);
  });

  it("calls onRowClick with the row's contractor", () => {
    const handler = vi.fn();
    renderWithIntl(<ContractorsTable data={ROWS} onRowClick={handler} />);
    fireEvent.click(screen.getAllByTestId("contractor-row")[0]);
    expect(handler).toHaveBeenCalledWith(ROWS[0]);
  });

  it("renders the column headers from translations", () => {
    renderWithIntl(<ContractorsTable data={ROWS} onRowClick={vi.fn()} />);
    const headers = screen
      .getAllByRole("columnheader")
      .map((node) => node.textContent?.trim())
      .filter((text) => !!text && text !== "Actions");
    expect(headers).toEqual(["Name", "Address", "Phone", "Created"]);
  });
});
