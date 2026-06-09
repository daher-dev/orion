import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EtiquetaCard } from "@/components/orders/separation/EtiquetaCard";
import { TestProviders } from "@/__tests__/test-utils";
import type { SeparationLabel } from "@/lib/schemas/separation";

const label: SeparationLabel = {
  item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  order_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  order_code: "ORD-ABCD1234",
  tracking_code: "ORD-ABCD1234-1-X9K2Q0",
  qr_data: "ORD-ABCD1234-1-X9K2Q0",
  item_index: 1,
  total_items: 3,
  status: "label_printed",
  sku: "CAM01-M-BLK",
  product_name: "Cropped Oversized",
  color: "Preto",
  color_code: "BLK",
  size: "m",
  mapped_print: "EST2039",
};

describe("EtiquetaCard", () => {
  it("renders the order code, item index/total, SKU and product", () => {
    render(
      <TestProviders>
        <EtiquetaCard label={label} />
      </TestProviders>,
    );

    expect(screen.getByText("ORD-ABCD1234")).toBeInTheDocument();
    expect(screen.getByText("Item 1/3")).toBeInTheDocument();
    expect(screen.getByText("SKU CAM01-M-BLK")).toBeInTheDocument();
    expect(screen.getByText("Cropped Oversized")).toBeInTheDocument();
    // Size is rendered uppercased.
    expect(screen.getByText("M")).toBeInTheDocument();
    // Estampa / mapped print.
    expect(screen.getByText("EST2039")).toBeInTheDocument();
  });

  it("renders a real QR encoding the tracking code", () => {
    render(
      <TestProviders>
        <EtiquetaCard label={label} />
      </TestProviders>,
    );

    const qr = screen.getByTestId("etiqueta-qr");
    expect(qr).toBeInTheDocument();
    expect(qr).toHaveAttribute("aria-label", `QR ${label.qr_data}`);
    // The QR draws at least one dark module (a non-empty path).
    const path = qr.querySelector("path");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("d") ?? "").not.toHaveLength(0);
  });

  it("falls back to the tracking code when SKU is missing", () => {
    render(
      <TestProviders>
        <EtiquetaCard label={{ ...label, sku: null }} />
      </TestProviders>,
    );
    expect(
      screen.getByText(`SKU ${label.tracking_code}`),
    ).toBeInTheDocument();
  });
});
