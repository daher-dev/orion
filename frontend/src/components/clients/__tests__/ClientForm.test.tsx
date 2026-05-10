import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClientForm } from "@/components/clients/ClientForm";
import { TestProviders } from "@/__tests__/test-utils";

describe("ClientForm", () => {
  it("renders all fields with placeholders", () => {
    render(
      <TestProviders>
        <ClientForm formId="t1" onSubmit={() => {}} />
      </TestProviders>,
    );
    expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("(11) 99999-0000")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Street, number, city")).toBeInTheDocument();
  });

  it("shows the validation error when name is empty", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <TestProviders>
        <ClientForm formId="t2" onSubmit={onSubmit} />
      </TestProviders>,
    );
    const form = container.querySelector("form#t2") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the validation error when email is malformed", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <TestProviders>
        <ClientForm formId="t3" onSubmit={onSubmit} />
      </TestProviders>,
    );
    fireEvent.change(screen.getByPlaceholderText("Full name"), {
      target: { value: "Bia" },
    });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "not-an-email" },
    });
    const form = container.querySelector("form#t3") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText("Invalid email")).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a sanitized payload with optional fields stripped when empty", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <TestProviders>
        <ClientForm formId="t4" onSubmit={onSubmit} />
      </TestProviders>,
    );
    fireEvent.change(screen.getByPlaceholderText("Full name"), {
      target: { value: "Bia" },
    });
    const form = container.querySelector("form#t4") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Bia",
      email: undefined,
      phone: undefined,
      address: undefined,
    });
  });

  it("prefills values from initial when provided", () => {
    render(
      <TestProviders>
        <ClientForm
          formId="t5"
          initial={{
            id: "abc",
            name: "Existing",
            email: "ex@example.com",
            phone: "111",
            address: "X",
            created_at: "2026-05-10T12:00:00Z",
            updated_at: "2026-05-10T12:00:00Z",
          }}
          onSubmit={() => {}}
        />
      </TestProviders>,
    );
    expect(screen.getByDisplayValue("Existing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ex@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("111")).toBeInTheDocument();
    expect(screen.getByDisplayValue("X")).toBeInTheDocument();
  });
});
