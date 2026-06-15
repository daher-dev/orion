import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ShipmentReceiveDialog } from "@/components/sewing/ShipmentReceiveDialog";
import { TestProviders } from "@/__tests__/test-utils";
import type { Shipment } from "@/lib/schemas/sewing";

// Spy on the receive mutation so we can assert the delta payload the dialog
// sends without a network round-trip.
const mutateAsync = vi.fn().mockResolvedValue({});
vi.mock("@/hooks/use-sewing", () => ({
  useReceiveShipment: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// A partially-received shipment: M has 6 received / 6 already credited, G has
// 3 received / 0 credited (operator just received G but it isn't posted yet).
const shipment: Shipment = {
  id: "ship-1",
  cutting_order: { id: "co-1", code: "CO-00000001" },
  contractor: { id: "ct-1", name: "Banca Lima" },
  status: "partial",
  sent_at: "2026-06-10",
  received_at: "2026-06-11",
  items: [
    { id: "it-m", size: "m", requested_quantity: 10, received_quantity: 6, credited_quantity: 6 },
    { id: "it-g", size: "g", requested_quantity: 8, received_quantity: 3, credited_quantity: 0 },
  ],
  created_at: "2026-06-10T09:00:00Z",
  updated_at: "2026-06-11T09:00:00Z",
};

function renderDialog() {
  render(
    <TestProviders>
      <ShipmentReceiveDialog open shipment={shipment} onOpenChange={() => {}} />
    </TestProviders>,
  );
}

afterEach(() => vi.clearAllMocks());

describe("ShipmentReceiveDialog (partial receive)", () => {
  it("renders sent / received / credited per size", () => {
    renderDialog();
    expect(screen.getByTestId("receive-sent-m").textContent).toBe("10");
    expect(screen.getByTestId("receive-credited-m").textContent).toBe("6");
    expect(screen.getByTestId("receive-sent-g").textContent).toBe("8");
    expect(screen.getByTestId("receive-credited-g").textContent).toBe("0");
  });

  it("defaults the Received input to the current received_quantity (re-receives top up)", () => {
    renderDialog();
    // M defaults to its existing received count (6), not its requested (10).
    expect((screen.getByTestId("receive-size-m") as HTMLInputElement).value).toBe("6");
    expect((screen.getByTestId("receive-size-g") as HTMLInputElement).value).toBe("3");
  });

  it("shows the delta hint = Σ max(0, received − credited)", () => {
    renderDialog();
    // M: 6 − 6 = 0; G: 3 − 0 = 3 → total delta 3.
    const hint = screen.getByTestId("receive-delta-hint");
    expect(within(hint).getByText(/3/)).toBeTruthy();

    // Bump M up to 9 → delta becomes (9−6)+(3−0) = 6. NumberInput commits its
    // draft on blur, so blur after typing to flush the value to the form.
    const mInput = screen.getByTestId("receive-size-m");
    fireEvent.change(mInput, { target: { value: "9" } });
    fireEvent.blur(mInput);
    expect(within(screen.getByTestId("receive-delta-hint")).getByText(/6/)).toBeTruthy();
  });

  it("submits only {size, received_quantity} (delta computed server-side)", async () => {
    renderDialog();
    // Receive 2 more of G (3 → 5). Blur to commit the NumberInput draft.
    const gInput = screen.getByTestId("receive-size-g");
    fireEvent.change(gInput, { target: { value: "5" } });
    fireEvent.blur(gInput);
    fireEvent.click(screen.getByTestId("receive-submit"));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mutateAsync.mock.calls[0][0] as {
      id: string;
      payload: { items: Array<{ size: string; received_quantity: number }> };
    };
    expect(arg.id).toBe("ship-1");
    const g = arg.payload.items.find((i) => i.size === "g");
    expect(g?.received_quantity).toBe(5);
    // The payload carries received counts, not credited/delta — the backend
    // derives the delta. Item shape is exactly {size, received_quantity}.
    expect(Object.keys(g ?? {}).sort()).toEqual(["received_quantity", "size"]);
  });
});
