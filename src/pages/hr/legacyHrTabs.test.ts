import { describe, expect, it } from "vitest";
import { hrHomeFor, legacyTabsFor } from "./legacyHrTabs.ts";

const user = (isAdmin: boolean, permissions: Record<string, "NONE" | "READ" | "MANAGE">) => ({ isAdmin, portalOnly: false, permissions }) as never;

describe("RH antigo", () => {
  it("separadores lado a lado, só os que o perfil abre", () => {
    expect(legacyTabsFor(user(true, {})).map((t) => t.label)).toEqual(["Visão Geral", "Colaboradores", "Escalas & Turnos", "Férias & Ausências", "Assiduidade", "Caixa de pedidos", "Histórico de alterações"]);
    expect(legacyTabsFor(user(false, { "hr.leave": "READ" })).map((t) => t.path)).toEqual(["/hr/ferias"]);
  });

  it("/hr abre o Novo RH para quem pode; senão o primeiro ecrã antigo permitido", () => {
    expect(hrHomeFor(user(true, {}))).toBe("/hr/novo");
    expect(hrHomeFor(user(false, { "hr.attendance": "READ" }))).toBe("/hr/assiduidade");
    expect(hrHomeFor(user(true, {}), true)).toBe("/hr/overview");
    expect(hrHomeFor(null)).toBe("/hr/overview");
  });
});
