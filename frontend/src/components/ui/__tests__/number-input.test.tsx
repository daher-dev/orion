import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NumberInput } from "@/components/ui/number-input";

describe("NumberInput", () => {
  it("renders the pt-BR formatted value when not focused", () => {
    render(
      <NumberInput
        value={4.2}
        decimals={2}
        prefix="R$"
        onChange={() => {}}
        data-testid="n"
      />,
    );
    const input = screen.getByTestId("n") as HTMLInputElement;
    expect(input.value).toBe("4,20");
  });

  it("emits a canonical dot-decimal string on blur", () => {
    const onChange = vi.fn();
    render(
      <NumberInput
        value={0}
        decimals={2}
        onChange={onChange}
        data-testid="n"
      />,
    );
    const input = screen.getByTestId("n");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12,50" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("12.5");
  });

  it("clamps to min on blur", () => {
    const onChange = vi.fn();
    render(
      <NumberInput
        value={5}
        min={3}
        decimals={0}
        onChange={onChange}
        data-testid="n"
      />,
    );
    const input = screen.getByTestId("n");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("3");
  });

  it("bumps with ArrowUp / ArrowDown by step", () => {
    const onChange = vi.fn();
    render(
      <NumberInput
        value={10}
        step={5}
        decimals={0}
        onChange={onChange}
        data-testid="n"
      />,
    );
    const input = screen.getByTestId("n");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith("15");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith("5");
  });

  it("emits empty string when blanked", () => {
    const onChange = vi.fn();
    render(
      <NumberInput
        value={5}
        decimals={0}
        onChange={onChange}
        data-testid="n"
      />,
    );
    const input = screen.getByTestId("n");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
