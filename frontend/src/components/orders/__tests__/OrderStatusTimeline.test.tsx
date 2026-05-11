import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OrderStatusTimeline } from "@/components/orders/OrderStatusTimeline";
import { TestProviders } from "@/__tests__/test-utils";

describe("OrderStatusTimeline", () => {
  it("renders the four phases", () => {
    render(
      <TestProviders>
        <OrderStatusTimeline status="paid" />
      </TestProviders>,
    );
    expect(screen.getByTestId("timeline-step-pending")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-step-paid")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-step-shipped")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-step-delivered")).toBeInTheDocument();
  });

  it("marks the current phase via data-current", () => {
    render(
      <TestProviders>
        <OrderStatusTimeline status="paid" />
      </TestProviders>,
    );
    expect(screen.getByTestId("timeline-step-paid").getAttribute("data-current")).toBe(
      "true",
    );
    expect(screen.getByTestId("timeline-step-pending").getAttribute("data-done")).toBe(
      "true",
    );
    expect(
      screen.getByTestId("timeline-step-shipped").getAttribute("data-done"),
    ).toBeNull();
  });

  it("calls onSelect when a valid forward step is clicked", () => {
    const onSelect = vi.fn();
    render(
      <TestProviders>
        <OrderStatusTimeline status="paid" onSelect={onSelect} />
      </TestProviders>,
    );
    // From PAID, the SHIPPED step is reachable
    fireEvent.click(screen.getByTestId("timeline-step-shipped"));
    expect(onSelect).toHaveBeenCalledWith("shipped");
  });

  it("disables the step button when the transition is not allowed", () => {
    const onSelect = vi.fn();
    render(
      <TestProviders>
        <OrderStatusTimeline status="pending" onSelect={onSelect} />
      </TestProviders>,
    );
    // From PENDING, DELIVERED is not reachable in one hop.
    const deliveredButton = screen.getByTestId("timeline-step-delivered");
    fireEvent.click(deliveredButton);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
