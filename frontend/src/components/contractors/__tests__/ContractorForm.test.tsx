import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import { ContractorForm } from "../ContractorForm";

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ContractorForm", () => {
  it("renders all three fields with labels", () => {
    renderWithIntl(<ContractorForm formId="t1" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Workshop name")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
  });

  it("blocks submit and shows validation when name is blank", async () => {
    const submit = vi.fn();
    renderWithIntl(
      <>
        <ContractorForm formId="t2" onSubmit={submit} />
        <button form="t2" type="submit">
          go
        </button>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits trimmed values with optional fields omitted when blank", async () => {
    const submit = vi.fn();
    renderWithIntl(
      <>
        <ContractorForm formId="t3" onSubmit={submit} />
        <button form="t3" type="submit">
          go
        </button>
      </>,
    );
    fireEvent.change(screen.getByLabelText("Workshop name"), {
      target: { value: "  Banca New  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0]?.[0]).toEqual({
      name: "Banca New",
      address: undefined,
      phone: undefined,
    });
  });

  it("populates fields from defaultValues", () => {
    renderWithIntl(
      <ContractorForm
        formId="t4"
        defaultValues={{ name: "Banca Esperança", address: "Rua A", phone: "999" }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>("Workshop name").value).toBe(
      "Banca Esperança",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Address").value).toBe("Rua A");
    expect(screen.getByLabelText<HTMLInputElement>("Phone").value).toBe("999");
  });

  it("renders a server error message under the name field when provided", () => {
    renderWithIntl(
      <ContractorForm
        formId="t5"
        defaultValues={{ name: "Existing" }}
        serverError="A workshop with this name already exists"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A workshop with this name already exists",
    );
  });
});
