import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CrmProvider } from "../../crm.module.tsx";
import { CrmWorkspaceService } from "../../application/crm-workspace.service.ts";
import type { CrmTableItem, CustomerTableResult } from "../../domain/entities/crm-workspace.ts";
import type { CrmWorkspaceApiPort } from "../../domain/ports/out/crm-workspace-api.port.ts";
import { CrmCustomersView } from "./CrmCustomersView.tsx";

const customer = (overrides: Partial<CrmTableItem> = {}): CrmTableItem => ({
  id: "C001",
  firstName: "Ana",
  lastName: "Silva",
  fullName: "Ana Silva",
  phone: "+351900000001",
  status: { relationship: "new", inactive: false, inactiveReason: null },
  orderCount: 1,
  ltv: 25,
  avgTicket: 25,
  lastOrderDate: "2026-08-20",
  metricsSource: "eatz_snapshot",
  lastAction: null,
  nextAction: null,
  followUpDate: null,
  tags: [],
  lastScript: null,
  ...overrides,
});

function result(items: CrmTableItem[] = [customer()]): CustomerTableResult {
  return { items, total: items.length, page: 1, pageSize: 10 };
}

function fakeApi(items: CrmTableItem[] = [customer()]): CrmWorkspaceApiPort & { listCustomers: ReturnType<typeof vi.fn> } {
  return {
    listCustomers: vi.fn().mockImplementation(async (filters) => ({ ...result(items), page: filters.page ?? 1, pageSize: filters.pageSize ?? 10 })),
    listTags: vi.fn().mockResolvedValue([]),
    createTag: vi.fn(),
    listActionTypes: vi.fn().mockResolvedValue([]),
    listScripts: vi.fn().mockResolvedValue([]),
    createActionType: vi.fn(),
    updateActionType: vi.fn(),
    createActions: vi.fn().mockResolvedValue(undefined),
    completeAction: vi.fn().mockResolvedValue(undefined),
    completeActions: vi.fn().mockResolvedValue(undefined),
    listCustomerActions: vi.fn().mockResolvedValue({ pending: null, history: [], total: 0, nextCursor: null }),
    updateTags: vi.fn().mockResolvedValue(undefined),
    setInactive: vi.fn().mockResolvedValue(undefined),
  };
}

function renderView(api: CrmWorkspaceApiPort) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <CrmProvider service={new CrmWorkspaceService(api)}>
          <CrmCustomersView />
        </CrmProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("CrmCustomersView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("carrega a primeira página com 10 clientes por padrão", async () => {
    const api = fakeApi();
    renderView(api);

    await waitFor(() => expect(screen.getAllByText("Ana Silva").length).toBeGreaterThan(0));
    expect(api.listCustomers).toHaveBeenCalledWith({ tagMode: "any", page: 1, pageSize: 10 });
  });

  it("alterna a ordenação de cliente entre ascendente, descendente e original", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderView(api);
    await waitFor(() => expect(screen.getAllByText("Ana Silva").length).toBeGreaterThan(0));

    const header = screen.getByRole("button", { name: /Cliente/ });
    await user.click(header);
    await waitFor(() => expect(api.listCustomers).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "customerId", sortDirection: "asc" })));

    await user.click(header);
    await waitFor(() => expect(api.listCustomers).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "customerId", sortDirection: "desc" })));

    await user.click(header);
    await waitFor(() => expect(api.listCustomers).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: undefined, sortDirection: undefined })));
  });

  it("altera o tamanho da página e volta à primeira página", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderView(api);
    await waitFor(() => expect(screen.getAllByText("Ana Silva").length).toBeGreaterThan(0));

    await user.selectOptions(screen.getByDisplayValue("10"), "25");

    await waitFor(() => expect(api.listCustomers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 25 })));
  });

  it("filtra clientes pelo último script selecionado", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    vi.mocked(api.listScripts).mockResolvedValue([{ code: "S1", name: "Boas-vindas", active: true }]);
    renderView(api);

    await screen.findByRole("option", { name: "Boas-vindas" });
    await user.selectOptions(screen.getByLabelText("Último script"), "S1");

    await waitFor(() => expect(api.listCustomers).toHaveBeenLastCalledWith(expect.objectContaining({ lastScriptCode: "S1", page: 1 })));
  });

  it("abre o agendamento ao clicar numa próxima ação vazia", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderView(api);
    await waitFor(() => expect(screen.getAllByText("+ Agendar ação").length).toBeGreaterThan(0));

    await user.click(screen.getAllByText("+ Agendar ação")[0]!);

    expect(await screen.findByRole("heading", { name: "Agendar ação · 1 cliente(s)" })).toBeInTheDocument();
    expect(screen.getByText("Tipo de ação")).toBeInTheDocument();
    expect(screen.getByText("Data de follow-up")).toBeInTheDocument();
  });

  it("abre a confirmação quando já existe uma próxima ação", async () => {
    const user = userEvent.setup();
    const api = fakeApi([customer({
      nextAction: { id: "a1", typeCode: "call", typeName: "Telefonar", scheduledFor: "2026-08-25T10:30:00.000Z", notes: null, scriptCode: null, source: "manual" },
      followUpDate: "2026-08-25T10:30:00.000Z",
    })]);
    renderView(api);
    await waitFor(() => expect(screen.getAllByText("Telefonar").length).toBeGreaterThan(0));

    await user.click(screen.getAllByText("Telefonar")[0]!);

    const modal = await screen.findByRole("heading", { name: "Concluir próxima ação · 1 cliente(s)" });
    const input = within(modal.closest("section")!).getByLabelText("Data e hora de conclusão") as HTMLInputElement;
    expect(input.value).toContain("2026-08-25T");
  });

  it("abre o editor contextual com as tags atuais selecionadas", async () => {
    const user = userEvent.setup();
    const tag = { name: "importante", label: "Importante", color: "#2563eb", category: "geral", active: true };
    const api = fakeApi([customer({ tags: [tag] })]);
    vi.mocked(api.listTags).mockResolvedValue([tag]);
    renderView(api);
    await waitFor(() => expect(screen.getAllByText("Importante").length).toBeGreaterThan(0));

    await user.click(screen.getByTitle("Adicionar ou remover tags"));

    const checkbox = await screen.findByRole("checkbox", { name: /Importante/ });
    expect(checkbox).toBeChecked();
  });
});
