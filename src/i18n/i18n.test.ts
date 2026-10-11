import { describe, expect, it } from "vitest";
import { createTranslator, formatters, missingKeys } from "./i18n.ts";
import { esES } from "./messages/es-ES.ts";
import { ptPT } from "./messages/pt-PT.ts";

describe("i18n", () => {
  it("traduz com parâmetros e cai para pt-PT quando falta a tradução", () => {
    const pt = createTranslator("pt-PT");
    const es = createTranslator("es-ES");
    expect(pt("novoRh.roadmap.progress", { done: 1, total: 10 })).toBe("1 de 10 fases concluídas");
    expect(es("common.done")).toBe("Completada");
    expect(es("novoRh.phase.4")).toBe(ptPT["novoRh.phase.4"]);
  });

  it("es-ES só tem chaves que existem em pt-PT; lista as que faltam", () => {
    for (const k of Object.keys(esES)) expect(k in ptPT).toBe(true);
    expect(missingKeys("pt-PT")).toEqual([]);
    expect(missingKeys("es-ES")).toContain("novoRh.description");
  });

  it("formata no fuso do centro, não no do browser", () => {
    const instant = new Date("2026-10-25T23:30:00Z");
    expect(formatters("pt-PT", "Europe/Lisbon").time(instant)).toBe("23:30");
    expect(formatters("es-ES", "Europe/Madrid").time(instant)).toBe("00:30");
    expect(formatters("pt-PT", "Europe/Lisbon").date(instant)).toBe("25/10/2026");
  });
});
