import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ImportDropZone } from "@/components/orders-import/ImportDropZone";
import { TestProviders } from "@/__tests__/test-utils";

function setupFile(name: string, size: number, type = "application/pdf") {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("ImportDropZone", () => {
  it("calls onAnalyze with the picked file after the user clicks Analyze", () => {
    const onAnalyze = vi.fn();
    render(
      <TestProviders>
        <ImportDropZone onAnalyze={onAnalyze} />
      </TestProviders>,
    );

    const file = setupFile("orders.pdf", 1024);
    const input = screen
      .getByTestId("import-dropzone")
      .querySelector("input[type='file']") as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("orders.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /analyze/i }));
    expect(onAnalyze).toHaveBeenCalledWith(file);
  });

  it("rejects unsupported file types without calling onAnalyze", () => {
    const onAnalyze = vi.fn();
    render(
      <TestProviders>
        <ImportDropZone onAnalyze={onAnalyze} />
      </TestProviders>,
    );

    const file = setupFile("orders.docx", 1024, "application/msword");
    const input = screen
      .getByTestId("import-dropzone")
      .querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole("alert")).toHaveTextContent(/PDF and CSV/i);
    expect(onAnalyze).not.toHaveBeenCalled();
  });
});
