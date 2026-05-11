import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuditLogTable } from "@/components/settings/audit/AuditLogTable";
import { TestProviders } from "@/__tests__/test-utils";
import type { AuditLogRead } from "@/lib/schemas/audit-log";

const rows: AuditLogRead[] = [
  {
    id: "row-1",
    user: { id: "u-1", name: "Joana Pires" },
    resource_type: "clients",
    resource_id: "11111111-1111-1111-1111-111111111111",
    message: "Created client Mariana Costa",
    created_at: "2026-05-10T12:00:00Z",
  },
  {
    id: "row-2",
    user: null,
    resource_type: "orders",
    resource_id: "22222222-2222-2222-2222-222222222222",
    message: "System imported 12 orders",
    created_at: "2026-05-10T11:00:00Z",
  },
];

describe("AuditLogTable", () => {
  it("renders message + actor when present", () => {
    render(
      <TestProviders>
        <AuditLogTable rows={rows} />
      </TestProviders>,
    );
    expect(screen.getByText("Created client Mariana Costa")).toBeInTheDocument();
    expect(screen.getByText("Joana Pires")).toBeInTheDocument();
  });

  it("renders the 'System' label when user is null", () => {
    render(
      <TestProviders>
        <AuditLogTable rows={rows} />
      </TestProviders>,
    );
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renders resource-type chip with localized label", () => {
    render(
      <TestProviders>
        <AuditLogTable rows={rows} />
      </TestProviders>,
    );
    // English locale (TestProviders default) → "Clients" / "Orders".
    expect(screen.getByText("Clients")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });

  it("truncates the resource id and exposes the full value via title", () => {
    render(
      <TestProviders>
        <AuditLogTable rows={rows} />
      </TestProviders>,
    );
    const shortened = screen.getByText("11111111…");
    expect(shortened).toBeInTheDocument();
    expect(shortened).toHaveAttribute("title", rows[0].resource_id);
  });

  it("renders the column headers from i18n", () => {
    render(
      <TestProviders>
        <AuditLogTable rows={rows} />
      </TestProviders>,
    );
    expect(screen.getByRole("columnheader", { name: /When/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Who/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Resource/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Target/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Detail/i })).toBeInTheDocument();
  });
});
