import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopProductsCard } from "@/components/dashboard/TopProductsCard";
import { TestProviders } from "@/__tests__/test-utils";
import type { TopProduct } from "@/lib/schemas/dashboard";

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const items: TopProduct[] = [
  { product_id: "p1", code: "2055", name: "Camiseta 2055", pieces: 175, orders: 152 },
  { product_id: "p2", code: "2047", name: "Camiseta 2047", pieces: 94, orders: 87 },
];

describe("TopProductsCard", () => {
  it("renders ranked product rows", () => {
    render(
      <TestProviders>
        <TopProductsCard items={items} />
      </TestProviders>,
    );
    expect(screen.getByText("2055")).toBeInTheDocument();
    expect(screen.getByText("2047")).toBeInTheDocument();
    // Rank chips.
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    // Pieces render alongside the unit suffix.
    expect(screen.getByText("175", { exact: false })).toBeInTheDocument();
  });

  it("renders an empty state when there are no products", () => {
    render(
      <TestProviders>
        <TopProductsCard items={[]} />
      </TestProviders>,
    );
    expect(screen.getByText(/no products yet/i)).toBeInTheDocument();
  });
});
