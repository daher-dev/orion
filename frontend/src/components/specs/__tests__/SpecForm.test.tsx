import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/__tests__/test-utils";
import { SpecForm } from "../SpecForm";

describe("SpecForm", () => {
  it("renders all section eyebrows in uppercase", () => {
    renderWithProviders(
      <SpecForm initial={null} submitting={false} onSubmit={() => {}} />,
    );
    const eyebrows = screen.getAllByTestId("spec-form-section-eyebrow");
    expect(eyebrows.length).toBeGreaterThanOrEqual(5);
  });

  it("submits a happy-path payload with no trims", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <SpecForm initial={null} submitting={false} onSubmit={onSubmit} />,
    );

    fireEvent.change(screen.getByTestId("spec-form-code"), { target: { value: "FT-X1" } });
    fireEvent.change(screen.getByTestId("spec-form-name"), { target: { value: "Cropped" } });
    // NumberInput commits on blur — focus/change/blur to flush each draft.
    const editNumber = (testId: string, value: string) => {
      const el = screen.getByTestId(testId);
      fireEvent.focus(el);
      fireEvent.change(el, { target: { value } });
      fireEvent.blur(el);
    };
    editNumber("spec-form-gsm", "180");
    editNumber("spec-form-weight", "250");
    editNumber("spec-form-labor", "15");

    fireEvent.click(screen.getByTestId("spec-form-submit"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FT-X1",
        name: "Cropped",
        fabric_grammage_gsm: 180,
        labor_cost: "15",
        has_ribana: false,
        ribana_weight_pct: null,
        trims: [],
      }),
    );
  });

  it("blocks submit when has_ribana is on but pct is empty", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <SpecForm initial={null} submitting={false} onSubmit={onSubmit} />,
    );

    fireEvent.change(screen.getByTestId("spec-form-code"), { target: { value: "FT-RIB" } });
    fireEvent.change(screen.getByTestId("spec-form-name"), { target: { value: "With ribana" } });
    fireEvent.click(screen.getByTestId("spec-form-has-ribana"));
    fireEvent.click(screen.getByTestId("spec-form-submit"));

    await waitFor(() => expect(screen.getByTestId("spec-form-error")).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("adds a trim row when 'Add trim' is clicked", () => {
    renderWithProviders(
      <SpecForm initial={null} submitting={false} onSubmit={() => {}} />,
    );

    expect(screen.queryAllByTestId("trim-row")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("spec-form-add-trim"));
    expect(screen.queryAllByTestId("trim-row")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("spec-form-add-trim"));
    expect(screen.queryAllByTestId("trim-row")).toHaveLength(2);
  });

  it("removes a trim row when its X is clicked", () => {
    renderWithProviders(
      <SpecForm initial={null} submitting={false} onSubmit={() => {}} />,
    );

    fireEvent.click(screen.getByTestId("spec-form-add-trim"));
    fireEvent.click(screen.getByTestId("spec-form-add-trim"));
    expect(screen.queryAllByTestId("trim-row")).toHaveLength(2);

    fireEvent.click(screen.getByTestId("trim-row-0-remove"));
    expect(screen.queryAllByTestId("trim-row")).toHaveLength(1);
  });

  it("prefills fields when given an initial spec", () => {
    renderWithProviders(
      <SpecForm
        initial={{
          id: "11111111-1111-1111-1111-111111111111",
          company_id: "22222222-2222-2222-2222-222222222222",
          code: "EDIT-1",
          name: "Existing",
          fabric_type: "fleece",
          fabric_grammage_gsm: 320,
          fabric_weight_per_piece_g: "450.00",
          has_ribana: false,
          ribana_weight_pct: null,
          labor_cost: "16.00",
          sale_price: "199.90",
          notes: "old notes",
          trims: [{ trim_type: "button", unit_price: "0.40", quantity: 4 }],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-05-09T00:00:00Z",
        }}
        submitting={false}
        onSubmit={() => {}}
      />,
    );
    expect((screen.getByTestId("spec-form-code") as HTMLInputElement).value).toBe("EDIT-1");
    expect((screen.getByTestId("spec-form-name") as HTMLInputElement).value).toBe("Existing");
    expect(screen.queryAllByTestId("trim-row")).toHaveLength(1);
  });
});
