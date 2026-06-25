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
  { name: "2055", image_url: "https://example.test/2055.png", pieces: 175, orders: 152 },
  { name: "Punisher", image_url: null, pieces: 94, orders: 87 },
];

describe("TopProductsCard", () => {
  it("renders ranked design rows", () => {
    const { container } = render(
      <TestProviders>
        <TopProductsCard items={items} />
      </TestProviders>,
    );
    expect(screen.getByText("2055")).toBeInTheDocument();
    expect(screen.getByText("Punisher")).toBeInTheDocument();
    // Rank chips.
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    // Pieces render alongside the unit suffix.
    expect(screen.getByText("175", { exact: false })).toBeInTheDocument();
    // The design with artwork renders its thumbnail (decorative alt="" → no img role).
    const thumb = container.querySelector('img[src="https://example.test/2055.png"]');
    expect(thumb).not.toBeNull();
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
