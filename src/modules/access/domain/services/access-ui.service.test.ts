import { describe, expect, it } from "vitest";
import type { CatalogModule } from "../entities/access.ts";
import {
  accessSummary,
  canOpenPath,
  effectiveOf,
  formatLastAccess,
  moduleCustomized,
  moduleStateOf,
  restoreDefault,
  setUserLevel,
  setUserModuleLevel,
} from "./access-ui.service.ts";

const FINANCE: CatalogModule = {
  key: "finance",
  label: "Financeiro",
  description: "",
  functions: [
    { key: "finance.invoices", label: "Faturas", description: "" },
    { key: "finance.suppliers", label: "Fornecedores", description: "" },
  ],
  specials: [],
};
const CATALOG = [FINANCE];

describe("permissões no frontend (só apresentação)", () => {
  it("exceção prevalece; igual ao perfil não cria exceção; Restaurar padrão volta a herdar", () => {
    const profile = { "finance.invoices": "MANAGE" as const };
    let o = setUserLevel({}, profile, "finance.invoices", "READ");
    expect(o).toEqual({ "finance.invoices": "READ" });
    expect(effectiveOf(profile, o, false, CATALOG)["finance.invoices"]).toBe("READ");
    expect(setUserLevel(o, profile, "finance.invoices", "MANAGE")).toEqual({});
    o = restoreDefault(o, "finance.invoices");
    expect(effectiveOf(profile, o, false, CATALOG)["finance.invoices"]).toBe("MANAGE");
  });

  it("módulo Sem acesso + Faturas READ → Personalizado / parcial", () => {
    const profile = { "finance.invoices": "MANAGE" as const, "finance.suppliers": "MANAGE" as const };
    let o = setUserModuleLevel({}, profile, FINANCE, "NONE");
    o = setUserLevel(o, profile, "finance.invoices", "READ");
    const eff = effectiveOf(profile, o, false, CATALOG);
    expect(moduleStateOf(FINANCE, eff)).toBe("mixed");
    expect(moduleCustomized(FINANCE, o)).toBe(true);
  });

  it("resumo da coluna Acessos", () => {
    const modules = [{ moduleKey: "hr", label: "RH", state: "manage_all" as const, granted: 9, total: 9, customized: false }];
    expect(accessSummary({ isAdmin: true, portalOnly: false, overridesCount: 0, modules })).toMatchObject({ title: "Acesso total" });
    expect(accessSummary({ isAdmin: false, portalOnly: true, overridesCount: 0, modules })).toMatchObject({ title: "Portal apenas" });
    expect(accessSummary({ isAdmin: false, portalOnly: false, overridesCount: 2, modules })).toMatchObject({ title: "Personalizado", detail: "RH · 2 alterações" });
    expect(accessSummary({ isAdmin: false, portalOnly: false, overridesCount: 0, modules })).toMatchObject({ title: "Padrão do perfil", detail: "RH" });
  });

  it("rotas do frontend: Sem acesso esconde; Utilizadores só Admin; Colaborador nunca entra na gestão", () => {
    const rh = { isAdmin: false, portalOnly: false, permissions: { "hr.employees": "MANAGE" as const } };
    expect(canOpenPath(rh, "/hr/people/123")).toBe(true);
    expect(canOpenPath(rh, "/financial/invoices")).toBe(false);
    expect(canOpenPath(rh, "/admin/users")).toBe(false);
    expect(canOpenPath(rh, "/empresa")).toBe(true);
    expect(canOpenPath({ ...rh, isAdmin: true }, "/admin/access-profiles")).toBe(true);
    expect(canOpenPath({ ...rh, portalOnly: true }, "/empresa")).toBe(false);
  });

  it("último acesso", () => {
    const now = new Date("2026-10-07T15:00:00");
    expect(formatLastAccess(null, now)).toBe("Nunca");
    expect(formatLastAccess("2026-10-07T14:32:00", now)).toMatch(/^Hoje, 14:32/);
    expect(formatLastAccess("2026-10-06T18:21:00", now)).toMatch(/^Ontem, 18:21/);
  });
});
