import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceChip } from "@/components/orders-import/ConfidenceChip";
import { TestProviders } from "@/__tests__/test-utils";

describe("ConfidenceChip", () => {
  it.each([
    [0.95, "confidence-high", "95%"],
    [0.6, "confidence-medium", "60%"],
    [0.2, "confidence-low", "20%"],
    [0, "confidence-none", "0%"],
  ] as const)(
    "renders the %p score in the %s bucket as %s",
    (score, testId, label) => {
      render(
        <TestProviders>
          <ConfidenceChip score={score} />
        </TestProviders>,
      );
      expect(screen.getByTestId(testId)).toHaveTextContent(label);
    },
  );

  it("falls back to 'none' for a missing score", () => {
    render(
      <TestProviders>
        <ConfidenceChip score={null} />
      </TestProviders>,
    );
    expect(screen.getByTestId("confidence-none")).toHaveTextContent("—");
  });
});
