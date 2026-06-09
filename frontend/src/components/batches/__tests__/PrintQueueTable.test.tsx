import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrintQueueTable } from "@/components/batches/PrintQueueTable";
import { TestProviders } from "@/__tests__/test-utils";
import type { PrintQueueItem } from "@/lib/schemas/batch";

const rows: PrintQueueItem[] = [
  {
    print_design_id: "11111111-1111-1111-1111-111111111111",
    product_color: "Preto",
    design: {
      id: "11111111-1111-1111-1111-111111111111",
      code: "EST-001",
      name: "Caveira",
      image_url: null,
    },
    qty_needed: 10,
    qty_stock: 3,
    qty_to_print: 7,
    batch_count: 2,
  },
  {
    print_design_id: "22222222-2222-2222-2222-222222222222",
    product_color: "Branco",
    design: {
      id: "22222222-2222-2222-2222-222222222222",
      code: "EST-002",
      name: "Onda",
      image_url: null,
    },
    qty_needed: 4,
    qty_stock: 0,
    qty_to_print: 4,
    batch_count: 1,
  },
];

describe("PrintQueueTable", () => {
  it("renders aggregated queue rows with needed/on-hand/to-print", () => {
    render(
      <TestProviders>
        <PrintQueueTable rows={rows} />
      </TestProviders>,
    );

    expect(screen.getByText("EST-001")).toBeInTheDocument();
    expect(screen.getByText("EST-002")).toBeInTheDocument();
    expect(screen.getByText("Preto")).toBeInTheDocument();
    expect(screen.getByText("Branco")).toBeInTheDocument();

    const row = screen.getByTestId(
      "print-queue-row-11111111-1111-1111-1111-111111111111-Preto",
    );
    // needed, on-hand, to-print, batches all present in the row.
    expect(row).toHaveTextContent("10");
    expect(row).toHaveTextContent("3");
    expect(row).toHaveTextContent("7");
    expect(row).toHaveTextContent("2");
  });

  it("renders an empty state when there is nothing to print", () => {
    render(
      <TestProviders>
        <PrintQueueTable rows={[]} />
      </TestProviders>,
    );
    expect(screen.getByTestId("print-queue-empty")).toBeInTheDocument();
    expect(screen.getByText("Nothing to print")).toBeInTheDocument();
  });
});
