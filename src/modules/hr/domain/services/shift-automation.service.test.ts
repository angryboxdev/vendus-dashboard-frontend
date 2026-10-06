import { describe, expect, it } from "vitest";
import { audienceLabel, firstGenerationWindow, generationSummary, recurrenceLabel, weekdaysLabel } from "./shift-automation.service.ts";

describe("shift-automation.service (RH 2.0)", () => {
  it("recorrência como no mockup", () => {
    expect(recurrenceLabel({ weekdays: [5, 6], endDate: null })).toBe("Semanal");
    expect(recurrenceLabel({ weekdays: [0, 1, 2, 3, 4, 5, 6], endDate: null })).toBe("Diária");
    expect(recurrenceLabel({ weekdays: [0], endDate: "2026-09-30" })).toBe("Período fixo");
  });

  it("dias da semana compactos", () => {
    expect(weekdaysLabel([0, 1, 2, 3, 4])).toBe("Seg – Sex");
    expect(weekdaysLabel([5, 6])).toBe("Sáb, Dom");
    expect(weekdaysLabel([0, 2, 4])).toBe("Seg, Qua, Sex");
  });

  it("público legível", () => {
    const names = { position: () => "Preparador", location: () => "MBS", employee: () => "Carlos Andrés" };
    expect(audienceLabel({ kind: "position", positionId: "p" }, names)).toBe("Cargo · Preparador");
    expect(audienceLabel({ kind: "employees", employeeIds: ["a", "b"] }, names)).toBe("2 colaboradores");
    expect(audienceLabel({ kind: "all" }, names)).toBe("Todos os colaboradores");
  });

  it("1.ª janela igual à do backend: de max(início, hoje) a min(fim, hoje + horizonte)", () => {
    expect(firstGenerationWindow("2026-11-01", null, 2, "2026-11-02")).toEqual({ from: "2026-11-02", to: "2026-11-15" });
    expect(firstGenerationWindow("2026-11-10", "2026-11-12", 4, "2026-11-02")).toEqual({ from: "2026-11-10", to: "2026-11-12" });
    expect(firstGenerationWindow("2027-03-01", null, 4, "2026-11-02")).toBeNull();
  });

  it("resumo da geração", () => {
    expect(generationSummary({ automationId: "a", window: { from: "x", to: "y" }, created: 8, alreadyExisting: 2, issues: 1 })).toBe(
      "8 turno(s) criado(s) · 2 já existiam · 1 por resolver em Alertas e ações",
    );
    expect(generationSummary({ automationId: "a", window: null, created: 0, alreadyExisting: 0, issues: 0 })).toMatch(/Nada por gerar/);
  });
});
