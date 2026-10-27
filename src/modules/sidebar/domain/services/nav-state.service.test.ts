import { describe, expect, it } from "vitest";
import {
  buildTree,
  isItemActive,
  resolveActiveGroup,
  splitBottom,
} from "./nav-state.service.ts";
import { chunkBySubgroup } from "./nav-state.service.ts";

describe("buildTree", () => {
  const settings = (role: string) => {
    const g = buildTree({ email: "a@b.com", role }).find((e) => e.kind === "group" && e.id === "settings");
    return g && g.kind === "group" ? g.items : [];
  };

  it("Menu V1: módulos na ordem proposta; Configurações no fim (junto ao utilizador)", () => {
    const tree = buildTree({ email: "a@b.com", role: "manager" });
    expect(tree.map((e) => (e.kind === "item" ? e.label : e.label))).toEqual([
      "Mapa de rentabilidade", "Gestão de Stock", "Recursos Humanos", "CRM", "Financeiro", "Operação", "Configurações",
    ]);
    expect(settings("manager").map((i) => i.label)).toEqual(["Empresa e Estrutura", "Integrações"]);
  });

  it("para o Admin: Utilizadores e permissões; Integrações é um só destino (sem terceiro nível)", () => {
    const items = settings("admin");
    expect(items.map((i) => [i.label, i.path, i.subgroup ?? null])).toEqual([
      ["Empresa e Estrutura", "/empresa", null],
      ["Utilizadores e permissões", "/admin/users", null],
      ["Integrações", "/configuracoes/integracoes", null],
    ]);
  });

  it("Fichas técnicas dentro de Gestão de Stock; Fluxo de caixa no Financeiro; Receitas e Custos fora do menu", () => {
    const tree = buildTree({ email: "a@b.com", role: "admin" });
    const group = (id: string) => {
      const g = tree.find((e) => e.kind === "group" && e.id === id);
      return g && g.kind === "group" ? g.items.map((i) => i.label) : [];
    };
    expect(group("stock")).toContain("Fichas técnicas");
    expect(tree.some((e) => e.kind === "item" && e.label === "Fichas técnicas")).toBe(false);
    expect(group("financial")).toEqual(["Categorias", "Fornecedores", "Faturas", "Recorrências", "Conciliação bancária", "Fluxo de caixa", "Contabilidade"]);
    expect(group("operations")).toEqual(["Fechos de Caixa", "Declaração de Vendas", "Air Menu", "Vendus"]);
    const paths = tree.flatMap((e) => (e.kind === "item" ? [e.path] : e.items.map((i) => i.path)));
    expect(paths).not.toContain("/dre/receita-bruta");
    expect(paths).not.toContain("/dre/custos-fixos");
    expect(paths).not.toContain("/dre/custos-variaveis");
    expect(new Set(paths).size).toBe(paths.length); // sem destinos duplicados
  });

  it("admin entries are not present for non-admin roles", () => {
    for (const role of ["manager", "hr_viewer"]) {
      const paths = settings(role).map((i) => i.path);
      expect(paths).not.toContain("/admin/users");
      expect(paths).not.toContain("/admin/location-tokens");
    }
  });
});

describe("resolveActiveGroup", () => {
  const tree = buildTree({ email: "a@b.com", role: "manager" });

  it.each([
    ["/dre/fluxo-caixa", "financial"],
    ["/financial/sales-declaration", "operations"],
    ["/cash-closings", "operations"],
    ["/stock/fichas-tecnicas", "stock"],
    ["/stock/movimentacoes", "stock"],
    ["/hr", "hr"],
    ["/hr/calendar", "hr"],
    ["/crm", "crm"],
    ["/crm/customers", "crm"],
    ["/financial/cost-centers", "financial"],
    ["/financial/suppliers", "financial"],
    ["/financial/invoices", "financial"],
    ["/financial/payable-entries", "financial"],
  ])("path %s → group %s", (path, expected) => {
    expect(resolveActiveGroup(tree, path)).toBe(expected);
  });

  it.each([
    ["/empresa/locais", "settings"],
    ["/configuracoes/integracoes/faturas-por-email", "settings"],
    ["/admin/location-tokens", "settings"],
  ])("Configurações: %s → %s", (path, expected) => {
    expect(resolveActiveGroup(tree, path)).toBe(expected);
  });

  it.each(["/results", "/dre/demonstrativo", "/dre/custos-fixos"])(
    "top-level path %s → null",
    (path) => {
      expect(resolveActiveGroup(tree, path)).toBeNull();
    },
  );
});

describe("isItemActive", () => {
  it("matches exact path when end=true", () => {
    expect(isItemActive("/results", "/results", true)).toBe(true);
    expect(isItemActive("/results", "/results/other", true)).toBe(false);
  });

  it("matches exact path or sub-path when end=false", () => {
    expect(isItemActive("/cash-closings", "/cash-closings")).toBe(true);
    expect(isItemActive("/cash-closings", "/cash-closings/sub")).toBe(true);
  });

  it("does not match partial prefix", () => {
    expect(isItemActive("/results", "/results-extra")).toBe(false);
  });

  it("end=true does not match sub-paths", () => {
    expect(isItemActive("/results", "/results/sub", true)).toBe(false);
  });
});

describe("buildTree com acesso efetivo (Utilizadores & Perfis 2.0)", () => {
  it("mostra só o que o perfil pode abrir; grupos vazios desaparecem; Utilizadores só para Admin", () => {
    const tree = buildTree({
      email: "rh@example.com",
      role: "manager",
      access: { isAdmin: false, portalOnly: false, permissions: { "hr.employees": "MANAGE", "hr.schedules": "READ" } },
    });
    const paths = tree.flatMap((e) => (e.kind === "item" ? [e.path] : e.items.map((i) => i.path)));
    expect(paths).not.toContain("/configuracoes/integracoes/faturas-por-email");
    expect(paths).not.toContain("/configuracoes/integracoes");
    // RH: o Novo RH abre a quem tem permissões de RH, cada área pela sua (2026-10-20); o RH antigo saiu do menu (2026-10-22).
    expect(paths).not.toContain("/hr/antigo");
    expect(paths).toContain("/hr/novo/pessoas");
    expect(paths).toContain("/hr/novo/escalas");
    expect(paths).not.toContain("/hr/novo/assiduidade");
    expect(paths).not.toContain("/financial/invoices");
    expect(paths).not.toContain("/admin/users");
    expect(tree.some((e) => e.kind === "group" && e.id === "financial")).toBe(false);
    expect(paths).toContain("/empresa");

    const admin = buildTree({ email: "a@example.com", role: "admin", access: { isAdmin: true, portalOnly: false, permissions: {} } });
    expect(admin.some((e) => e.kind === "group" && e.items.some((i) => i.path === "/admin/users"))).toBe(true);
    const hr = admin.find((e) => e.kind === "group" && e.id === "hr");
    expect(hr && hr.kind === "group" ? hr.items.map((i) => i.label) : []).toEqual(["Visão geral", "Colaboradores", "Escalas", "Assiduidade", "Ausências", "Mais"]);
    const noHr = buildTree({ email: "x@example.com", role: "manager", access: { isAdmin: false, portalOnly: false, permissions: { "crm.customers": "READ" } } });
    expect(noHr.some((e) => e.kind === "group" && e.id === "hr")).toBe(false);
  });
});

describe("menu do Stock (task Stock inteligente V4 §1)", () => {
  it("Artigos e ingredientes, Inventário (um só item; separadores na página), Reposição e planeamento, Fichas técnicas (quarta)", () => {
    const stock = buildTree({ role: "admin", email: "a@teste.pt" } as never).find((e) => e.kind === "group" && e.id === "stock");
    if (!stock || stock.kind !== "group") throw new Error("sem grupo Stock");
    expect(chunkBySubgroup(stock.items).map((c) => (c.kind === "item" ? [c.item.label, c.item.path] : [c.label, c.items.map((i) => `${i.label} ${i.path}`)]))).toEqual([
      ["Artigos e ingredientes", "/stock/stock"],
      ["Inventário", "/stock/inventario"],
      ["Reposição e planeamento", "/stock/planeamento"],
      ["Fichas técnicas", "/stock/fichas-tecnicas"],
    ]);
  });

  it("Inventário fica ativo nos seus separadores, incluindo Compras por rever", () => {
    const stock = buildTree({ role: "admin", email: "a@teste.pt" } as never).find((e) => e.kind === "group" && e.id === "stock");
    if (!stock || stock.kind !== "group") throw new Error("sem grupo Stock");
    expect(stock.items.find((i) => i.label === "Inventário")?.match).toEqual(["/stock/movimentacoes", "/stock/historico-movimentos", "/stock/contagens", "/stock/compras-por-rever"]);
  });
});


describe("splitBottom — Configurações no fundo da barra", () => {
  it("tira Configurações da lista principal e põe-no no fundo", () => {
    const { main, bottom } = splitBottom(buildTree({ email: "a@b.com", role: "admin" }));
    expect(bottom.map((e) => (e.kind === "group" ? e.id : e.path))).toEqual(["settings"]);
    expect(main.some((e) => e.kind === "group" && e.id === "settings")).toBe(false);
    expect(main.length).toBeGreaterThan(0);
  });
  it("sem acesso a nada de Configurações, o fundo fica vazio", () => {
    const tree = buildTree({ email: "x@b.com", role: "manager", access: { isAdmin: false, portalOnly: true, permissions: {} } });
    expect(splitBottom(tree).bottom).toEqual([]);
  });
});
