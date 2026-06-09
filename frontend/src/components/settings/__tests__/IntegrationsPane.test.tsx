import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntegrationsPane } from "@/components/settings/IntegrationsPane";
import { TestProviders } from "@/__tests__/test-utils";
import type { ChannelList } from "@/lib/schemas/channel-integration";

// Permission gates — flip per test.
let canRead = true;
let canWrite = true;
vi.mock("@/hooks/use-permissions", () => ({
  useCanAccess: (code: string) =>
    code === "integrations.write" ? canWrite : canRead,
}));

// Hook data returned by the mocked list hook.
const listData: ChannelList = {
  connected: 1,
  total: 2,
  items: [
    {
      channel: "mercado_livre",
      label: "Mercado Livre",
      description: "Marketplace",
      group: "Marketplaces",
      color: "#fff159",
      fg: "#1f1f1f",
      status: "connected",
      id: "11111111-1111-1111-1111-111111111111",
      external_account_id: "acct-9",
      last_sync_at: new Date().toISOString(),
    },
    {
      channel: "whatsapp",
      label: "WhatsApp",
      description: "Comunicação",
      group: "Comunicação",
      color: "#25d366",
      fg: "#ffffff",
      status: "available",
      id: null,
    },
  ],
};

const connectMutate = vi.fn();
const disconnectMutate = vi.fn();
const syncMutate = vi.fn();

vi.mock("@/hooks/use-channel-integrations", () => ({
  useChannelIntegrations: () => ({
    data: listData,
    isPending: false,
    isError: false,
    error: null,
  }),
  useConnectChannel: () => ({ mutateAsync: connectMutate, isPending: false }),
  useDisconnectChannel: () => ({ mutateAsync: disconnectMutate, isPending: false }),
  useSyncChannel: () => ({ mutateAsync: syncMutate, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

afterEach(() => {
  canRead = true;
  canWrite = true;
  connectMutate.mockClear();
  disconnectMutate.mockClear();
  syncMutate.mockClear();
});

function renderPane() {
  return render(
    <TestProviders>
      <IntegrationsPane />
    </TestProviders>,
  );
}

describe("IntegrationsPane", () => {
  it("renders the N of M summary", () => {
    renderPane();
    // "1 of 2 integrations active" — assert the numerals are present.
    expect(screen.getByText(/integrations active/i)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders connected and available cards from hook data", () => {
    renderPane();
    const ml = screen.getByTestId("integration-card-mercado_livre");
    const wa = screen.getByTestId("integration-card-whatsapp");
    expect(ml).toHaveAttribute("data-status", "connected");
    expect(wa).toHaveAttribute("data-status", "available");
    expect(screen.getByText("Mercado Livre")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
  });

  it("shows connect action for available and disconnect for connected when writable", () => {
    renderPane();
    expect(screen.getByRole("button", { name: /^connect$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^disconnect$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sync now/i })).toBeInTheDocument();
  });

  it("hides write actions when the user lacks integrations.write", () => {
    canWrite = false;
    renderPane();
    expect(screen.queryByRole("button", { name: /^connect$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^disconnect$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sync now/i })).not.toBeInTheDocument();
    // Read-only affordance is shown instead.
    expect(screen.getAllByText(/read-only/i).length).toBeGreaterThan(0);
  });

  it("renders the forbidden message when the user lacks integrations.read", () => {
    canRead = false;
    renderPane();
    expect(screen.getByText(/don't have access to integrations/i)).toBeInTheDocument();
  });
});
