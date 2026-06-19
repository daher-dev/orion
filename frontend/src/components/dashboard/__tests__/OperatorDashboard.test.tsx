import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperatorDashboard } from "@/components/dashboard/OperatorDashboard";
import { TestProviders } from "@/__tests__/test-utils";
import type { OperatorSummary } from "@/lib/schemas/dashboard";

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { name: "Joana Pires", email: "joana@x.com" } } }),
}));

const operator: OperatorSummary = {
  cuts_in_queue: 3,
  shipments_incoming: 2,
  pieces_today: 86,
  cutting_queue: [
    { id: "c1", code: "CO-209", color: "Preto", status: "pending" },
    { id: "c2", code: "CO-210", color: "Branco", status: "cutting" },
  ],
};

function renderOp(props: Partial<React.ComponentProps<typeof OperatorDashboard>> = {}) {
  return render(
    <TestProviders>
      <OperatorDashboard
        operator={operator}
        isPending={false}
        isError={false}
        errorMessage="Could not load"
        {...props}
      />
    </TestProviders>,
  );
}

describe("OperatorDashboard", () => {
  it("renders the three floor KPIs, the cutting queue, and quick actions", () => {
    renderOp();
    expect(screen.getByTestId("operator-kpis")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // cuts_in_queue
    expect(screen.getByText("2")).toBeInTheDocument(); // shipments_incoming
    expect(screen.getByText("86")).toBeInTheDocument(); // pieces_today
    // Queue rows.
    expect(screen.getByText("CO-209")).toBeInTheDocument();
    expect(screen.getByText("Preto")).toBeInTheDocument();
    // Quick actions (en labels).
    expect(screen.getByText("Register cut output")).toBeInTheDocument();
    expect(screen.getByText("Adjust stock")).toBeInTheDocument();
  });

  it("shows a skeleton (no KPIs) while pending", () => {
    renderOp({ operator: undefined, isPending: true });
    expect(screen.queryByTestId("operator-kpis")).not.toBeInTheDocument();
  });

  it("shows the error message on error", () => {
    renderOp({ operator: undefined, isError: true, errorMessage: "Boom" });
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
