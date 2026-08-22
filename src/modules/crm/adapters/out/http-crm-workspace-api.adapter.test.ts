import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiPatch, apiPatchNoContent, apiPost } from "../../../../lib/api.ts";
import { HttpCrmWorkspaceApiAdapter } from "./http-crm-workspace-api.adapter.ts";

vi.mock("../../../../lib/api.ts", () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPatchNoContent: vi.fn(),
  apiPost: vi.fn(),
}));

const get = vi.mocked(apiGet);
const patch = vi.mocked(apiPatch);
const patchNoContent = vi.mocked(apiPatchNoContent);
const post = vi.mocked(apiPost);

describe("HttpCrmWorkspaceApiAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(undefined);
    patch.mockResolvedValue(undefined);
    patchNoContent.mockResolvedValue(undefined);
    post.mockResolvedValue(undefined);
  });

  it("envia paginação padrão ao listar clientes", async () => {
    const adapter = new HttpCrmWorkspaceApiAdapter();

    await adapter.listCustomers({});

    expect(get).toHaveBeenCalledWith("/api/crm/customer-table?page=1&pageSize=10");
  });

  it("serializa filtros, tags e ordenação sem parâmetros vazios", async () => {
    const adapter = new HttpCrmWorkspaceApiAdapter();

    await adapter.listCustomers({
      status: "vip",
      activity: "active",
      tags: ["feedback", "prioridade"],
      tagMode: "all",
      lastScriptCode: "boas_vindas",
      search: "",
      sortBy: "orderCount",
      sortDirection: "desc",
      page: 2,
      pageSize: 25,
    });

    expect(get).toHaveBeenCalledWith(
      "/api/crm/customer-table?page=2&pageSize=25&status=vip&activity=active&tags=feedback%2Cprioridade&tagMode=all&lastScriptCode=boas_vindas&sortBy=orderCount&sortDirection=desc",
    );
  });

  it("carrega o catálogo de scripts para o filtro", async () => {
    const adapter = new HttpCrmWorkspaceApiAdapter();

    await adapter.listScripts();

    expect(get).toHaveBeenCalledWith("/api/crm/scripts?includeInactive=true");
  });

  it("codifica identificadores nos endpoints de tipos, ações e histórico", async () => {
    const adapter = new HttpCrmWorkspaceApiAdapter();

    await adapter.updateActionType("pós venda/telefone", { name: "Pós-venda" });
    await adapter.completeAction("action/id", "2026-08-22T10:00:00.000Z");
    await adapter.listCustomerActions("C 001/externo", "20");

    expect(patch).toHaveBeenNthCalledWith(1, "/api/crm/action-types/p%C3%B3s%20venda%2Ftelefone", { name: "Pós-venda" });
    expect(patch).toHaveBeenNthCalledWith(2, "/api/crm/actions/action%2Fid/complete", { completedAt: "2026-08-22T10:00:00.000Z" });
    expect(get).toHaveBeenCalledWith("/api/crm/customers/C%20001%2Fexterno/actions?limit=20&cursor=20");
  });

  it("envia a conclusão em massa no formato esperado pelo backend", async () => {
    const adapter = new HttpCrmWorkspaceApiAdapter();
    const actions = [
      { id: "a1", completedAt: "2026-08-22T10:00:00.000Z" },
      { id: "a2", completedAt: "2026-08-22T11:00:00.000Z" },
    ];

    await adapter.completeActions(actions);

    expect(patch).toHaveBeenCalledWith("/api/crm/actions/complete-bulk", { actions });
  });

  it("usa endpoints sem conteúdo para atualizar tags e inatividade", async () => {
    const adapter = new HttpCrmWorkspaceApiAdapter();
    const tags = { customerIds: ["C001", "C002"], add: ["vip"], remove: ["novo"] };

    await adapter.updateTags(tags);
    await adapter.setInactive({ customerIds: ["C001"], inactive: true });

    expect(patchNoContent).toHaveBeenNthCalledWith(1, "/api/crm/customers/tags", tags);
    expect(patchNoContent).toHaveBeenNthCalledWith(2, "/api/crm/customers/inactive", { customerIds: ["C001"], inactive: true });
  });
});
