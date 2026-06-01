import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthCard } from "@/components/auth/AuthCard";
import { TestProviders } from "@/__tests__/test-utils";

describe("AuthCard", () => {
  it("renders title, optional sub and children", () => {
    render(
      <TestProviders>
        <AuthCard title="Hello" sub="World">
          <button type="button">child</button>
        </AuthCard>
      </TestProviders>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Hello" })).toBeInTheDocument();
    expect(screen.getByText("World")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "child" })).toBeInTheDocument();
  });

  it("renders the Orion brand mark + wordmark (no tenant name)", () => {
    render(
      <TestProviders>
        <AuthCard title="t">x</AuthCard>
      </TestProviders>,
    );
    // The wordmark is exposed as an image named "Orion" (the Or/i/on spans
    // carry the belt-"i"); the tile mark beside it is decorative.
    expect(screen.getByRole("img", { name: "Orion" })).toBeInTheDocument();
    expect(screen.queryByText("Underground")).not.toBeInTheDocument();
    expect(screen.queryByText("by Orion")).not.toBeInTheDocument();
  });

  it("renders a banner when provided", () => {
    render(
      <TestProviders>
        <AuthCard title="t" banner={<div role="status">banner here</div>}>
          x
        </AuthCard>
      </TestProviders>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("banner here");
  });

  it("omits the sub paragraph when sub is undefined", () => {
    render(
      <TestProviders>
        <AuthCard title="Only title">x</AuthCard>
      </TestProviders>,
    );
    expect(screen.queryByText(/Only title/)).toBeInTheDocument();
    // No <p> sibling means no sub line rendered.
    const paragraphs = document.querySelectorAll("p");
    expect(paragraphs.length).toBe(0);
  });
});
