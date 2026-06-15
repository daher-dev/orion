import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AlertTriangle, MinusCircle, PlusCircle } from "lucide-react";
import { UnitMoveSheet, type UnitMoveType } from "@/components/inventory/UnitMoveSheet";
import { TestProviders } from "@/__tests__/test-utils";

// Mirrors the blank-pieces move types: Ajuste (+)/(−) → adjustment; Avaria → exit.
const MOVE_TYPES: readonly UnitMoveType[] = [
  { id: "in-ajuste", dir: "+", kind: "adjustment", i18nKey: "entryAdjustment", icon: PlusCircle },
  { id: "out-ajuste", dir: "-", kind: "adjustment", i18nKey: "exitAdjustment", icon: MinusCircle },
  { id: "out-avaria", dir: "-", kind: "exit", i18nKey: "damage", icon: AlertTriangle },
] as const;

const item = { label: "Camiseta · Preto · M", on_hand: 6, min_stock: 40 };

function renderSheet(onApply = vi.fn()) {
  render(
    <TestProviders>
      <UnitMoveSheet
        open
        onOpenChange={() => {}}
        item={item}
        moveTypes={MOVE_TYPES}
        i18nNamespace="blankPieces"
        testIdPrefix="blank-pieces"
        onApply={onApply}
      />
    </TestProviders>,
  );
  return onApply;
}

describe("UnitMoveSheet", () => {
  it("renders the current on-hand and computes a credit preview (current + qty)", () => {
    renderSheet();
    // Default tile is the first (Ajuste +, a credit). on_hand 6 + qty 1 = 7.
    expect(screen.getByTestId("blank-pieces-preview-final").textContent).toBe("7");

    const qty = screen.getByTestId("blank-pieces-quantity") as HTMLInputElement;
    fireEvent.change(qty, { target: { value: "5" } });
    expect(screen.getByTestId("blank-pieces-preview-final").textContent).toBe("11");
  });

  it("computes a debit preview and shows the negative warning when it crosses zero", () => {
    renderSheet();
    // Pick the Avaria (exit) tile, then ask for more than on-hand.
    fireEvent.click(screen.getByTestId("blank-pieces-movetype-out-avaria"));
    const qty = screen.getByTestId("blank-pieces-quantity") as HTMLInputElement;
    fireEvent.change(qty, { target: { value: "10" } });
    // 6 − 10 = −4
    expect(screen.getByTestId("blank-pieces-preview-final").textContent).toBe("-4");
    expect(screen.getByTestId("blank-pieces-negative-warning")).toBeTruthy();
  });

  it("applies the selected move type + quantity", async () => {
    const onApply = renderSheet();
    fireEvent.click(screen.getByTestId("blank-pieces-movetype-out-avaria"));
    const qty = screen.getByTestId("blank-pieces-quantity") as HTMLInputElement;
    fireEvent.change(qty, { target: { value: "2" } });
    fireEvent.click(screen.getByTestId("blank-pieces-submit"));

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    const [moveType, quantity] = onApply.mock.calls[0];
    expect(moveType.kind).toBe("exit");
    expect(moveType.id).toBe("out-avaria");
    expect(quantity).toBe(2);
  });

  it("blocks apply when quantity is zero", () => {
    const onApply = renderSheet();
    const qty = screen.getByTestId("blank-pieces-quantity") as HTMLInputElement;
    fireEvent.change(qty, { target: { value: "0" } });
    fireEvent.click(screen.getByTestId("blank-pieces-submit"));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("surfaces a server error passed by the page (409 insufficient)", () => {
    render(
      <TestProviders>
        <UnitMoveSheet
          open
          onOpenChange={() => {}}
          item={item}
          moveTypes={MOVE_TYPES}
          i18nNamespace="blankPieces"
          testIdPrefix="blank-pieces"
          serverError="Only 6 in stock for this exit."
          onApply={vi.fn()}
        />
      </TestProviders>,
    );
    expect(screen.getByTestId("blank-pieces-server-error").textContent).toContain("6");
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
