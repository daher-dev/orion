import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PresetColorPicker } from "@/components/auth/PresetColorPicker";
import { TestProviders } from "@/__tests__/test-utils";
import { colorPresets } from "@/lib/schemas/company";

describe("PresetColorPicker", () => {
  it("renders all six presets as a radio group", () => {
    render(
      <TestProviders>
        <PresetColorPicker
          value="#2563eb"
          onChange={() => {}}
          label="Main color"
        />
      </TestProviders>,
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(colorPresets.length);
  });

  it("marks the active swatch as checked (case-insensitively)", () => {
    render(
      <TestProviders>
        <PresetColorPicker value="#2563EB" onChange={() => {}} label="L" />
      </TestProviders>,
    );
    const indigo = screen.getByRole("radio", { name: "Indigo" });
    expect(indigo).toHaveAttribute("aria-checked", "true");
    const terracotta = screen.getByRole("radio", { name: "Terracotta" });
    expect(terracotta).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the hex when a swatch is clicked", () => {
    const onChange = vi.fn();
    render(
      <TestProviders>
        <PresetColorPicker value="#2563eb" onChange={onChange} label="L" />
      </TestProviders>,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Terracotta" }));
    expect(onChange).toHaveBeenCalledWith("#c2410c");
  });

  it("disables every swatch when disabled is true", () => {
    render(
      <TestProviders>
        <PresetColorPicker
          value="#2563eb"
          onChange={() => {}}
          disabled
          label="L"
        />
      </TestProviders>,
    );
    for (const r of screen.getAllByRole("radio")) {
      expect(r).toBeDisabled();
    }
  });

  it("hides the label row when label is omitted", () => {
    render(
      <TestProviders>
        <PresetColorPicker value="#2563eb" onChange={() => {}} />
      </TestProviders>,
    );
    expect(screen.queryByText("Main color")).not.toBeInTheDocument();
  });
});
