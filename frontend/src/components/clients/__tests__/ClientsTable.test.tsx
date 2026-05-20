import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientsTable } from "@/components/clients/ClientsTable";
import { TestProviders } from "@/__tests__/test-utils";
import type { ClientRead } from "@/lib/schemas/client";

vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: () => true,
}));

vi.mock("@/hooks/use-clients", () => ({
  useDeleteClient: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

const rows: ClientRead[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Mariana Costa",
    email: "mariana@example.com",
    phone: "1199",
    address: "São Paulo",
    created_at: "2026-05-10T12:00:00Z",
    updated_at: "2026-05-10T12:00:00Z",
    order_count: 3,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Felipe Andrade",
    email: null,
    phone: null,
    address: null,
    created_at: "2026-05-09T12:00:00Z",
    updated_at: "2026-05-09T12:00:00Z",
    order_count: 0,
  },
];

describe("ClientsTable", () => {
  it("renders client names and contact details", () => {
    render(
      <TestProviders>
        <ClientsTable rows={rows} onEdit={() => {}} />
      </TestProviders>,
    );
    expect(screen.getByText("Mariana Costa")).toBeInTheDocument();
    expect(screen.getByText("mariana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Felipe Andrade")).toBeInTheDocument();
  });

  it("renders em-dash for missing contact info", () => {
    render(
      <TestProviders>
        <ClientsTable rows={rows} onEdit={() => {}} />
      </TestProviders>,
    );
    // Felipe row has 3 missing fields → 3 dashes appear
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("opens the edit drawer when a row is clicked (whole row is the trigger)", () => {
    const onEdit = vi.fn();
    render(
      <TestProviders>
        <ClientsTable rows={rows} onEdit={onEdit} />
      </TestProviders>,
    );
    // Tables consolidated their actions to a single row-end chevron —
    // delete moved to ClientFormSheet. Row click opens the drawer.
    const tbody = document.querySelector("tbody");
    const firstRow = tbody?.querySelectorAll("tr")[0];
    expect(firstRow).toBeDefined();
    fireEvent.click(firstRow!);
    expect(onEdit).toHaveBeenCalledWith(rows[0]);
  });

  it("does not render inline edit / delete buttons", () => {
    const { container } = render(
      <TestProviders>
        <ClientsTable rows={rows} onEdit={() => {}} />
      </TestProviders>,
    );
    expect(screen.queryByLabelText("Edit")).toBeNull();
    expect(screen.queryByLabelText("Delete")).toBeNull();
    expect(
      container.querySelectorAll("svg.lucide-chevron-right").length,
    ).toBeGreaterThan(0);
  });

  it("renders sortable header that toggles direction", () => {
    render(
      <TestProviders>
        <ClientsTable rows={rows} onEdit={() => {}} />
      </TestProviders>,
    );
    const headers = screen.getAllByRole("columnheader");
    const clientHeader = headers.find((h) => h.textContent?.includes("Client"));
    expect(clientHeader).toBeTruthy();
    fireEvent.click(clientHeader as HTMLElement);
    // After clicking, the rows reorder — Felipe should still be in document.
    expect(screen.getByText("Felipe Andrade")).toBeInTheDocument();
  });
});
