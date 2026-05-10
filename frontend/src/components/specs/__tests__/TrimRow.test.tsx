import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/__tests__/test-utils";
import { TrimRow, type TrimRowValue } from "../TrimRow";

describe("TrimRow", () => {
  const makeValue = (over: Partial<TrimRowValue> = {}): TrimRowValue => ({
    trim_type: "label",
    unit_price: "0.50",
    quantity: 1,
    ...over,
  });

  it("renders qty and price inputs with the row's values", () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    renderWithProviders(
      <TrimRow index={0} value={makeValue()} onChange={onChange} onRemove={onRemove} />,
    );
    const qty = screen.getByTestId("trim-row-0-qty") as HTMLInputElement;
    const price = screen.getByTestId("trim-row-0-price") as HTMLInputElement;
    expect(qty.value).toBe("1");
    expect(price.value).toBe("0.50");
  });

  it("calls onChange when the quantity is edited", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TrimRow index={0} value={makeValue()} onChange={onChange} onRemove={() => {}} />,
    );
    fireEvent.change(screen.getByTestId("trim-row-0-qty"), { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
  });

  it("calls onChange when the unit price is edited", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TrimRow index={1} value={makeValue()} onChange={onChange} onRemove={() => {}} />,
    );
    fireEvent.change(screen.getByTestId("trim-row-1-price"), { target: { value: "1.25" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ unit_price: "1.25" }));
  });

  it("calls onRemove when the X button is clicked", () => {
    const onRemove = vi.fn();
    renderWithProviders(
      <TrimRow index={0} value={makeValue()} onChange={() => {}} onRemove={onRemove} />,
    );
    fireEvent.click(screen.getByTestId("trim-row-0-remove"));
    expect(onRemove).toHaveBeenCalled();
  });
});
