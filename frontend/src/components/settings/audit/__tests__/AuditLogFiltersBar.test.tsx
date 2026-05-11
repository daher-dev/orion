import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AuditLogFiltersBar } from "@/components/settings/audit/AuditLogFiltersBar";
import { TestProviders } from "@/__tests__/test-utils";

function noop() {}

function renderBar(overrides: Partial<React.ComponentProps<typeof AuditLogFiltersBar>> = {}) {
  const props: React.ComponentProps<typeof AuditLogFiltersBar> = {
    q: "",
    onQChange: noop,
    resourceType: "",
    onResourceTypeChange: noop,
    userId: "",
    onUserIdChange: noop,
    userOptions: [],
    dateFrom: "",
    onDateFromChange: noop,
    dateTo: "",
    onDateToChange: noop,
    onClear: noop,
    canClear: false,
    ...overrides,
  };
  return render(
    <TestProviders>
      <AuditLogFiltersBar {...props} />
    </TestProviders>,
  );
}

describe("AuditLogFiltersBar", () => {
  it("renders the search input with the localized placeholder", () => {
    renderBar();
    expect(
      screen.getByPlaceholderText("Search message or resource…"),
    ).toBeInTheDocument();
  });

  it("emits onQChange when the user types", () => {
    const onQChange = vi.fn();
    renderBar({ onQChange });
    fireEvent.change(screen.getByPlaceholderText("Search message or resource…"), {
      target: { value: "mariana" },
    });
    expect(onQChange).toHaveBeenCalledWith("mariana");
  });

  it("hides the Clear button while no filter is active", () => {
    renderBar({ canClear: false });
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("shows the Clear button and triggers onClear", () => {
    const onClear = vi.fn();
    renderBar({ canClear: true, onClear });
    const clear = screen.getByRole("button", { name: /Clear/i });
    expect(clear).toBeInTheDocument();
    fireEvent.click(clear);
    expect(onClear).toHaveBeenCalled();
  });

  it("propagates date-from and date-to changes", () => {
    const onDateFromChange = vi.fn();
    const onDateToChange = vi.fn();
    renderBar({ onDateFromChange, onDateToChange });

    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-05-01" },
    });
    expect(onDateFromChange).toHaveBeenCalledWith("2026-05-01");

    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-05-09" },
    });
    expect(onDateToChange).toHaveBeenCalledWith("2026-05-09");
  });
});
