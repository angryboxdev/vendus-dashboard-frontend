import { describe, expect, it, vi } from "vitest";
import { hoursLabel, missingAnswers } from "../../domain/entities/portal-engagement.ts";
import type { PortalEngagementApiPort } from "../../domain/ports/out/portal-engagement-api.port.ts";
import { PortalEngagementUseCase } from "./portal-engagement.use-cases.ts";

// Dados fictícios (RGPD).
function api(over: Partial<PortalEngagementApiPort> = {}): PortalEngagementApiPort {
  return {
    announcements: vi.fn(async () => []),
    markAnnouncementRead: vi.fn(),
    confirmAnnouncement: vi.fn(),
    distributions: vi.fn(async () => []),
    distributionUrl: vi.fn(),
    confirmDistribution: vi.fn(),
    tasks: vi.fn(async () => []),
    toggleItem: vi.fn(),
    completeTask: vi.fn(),
    forms: vi.fn(async () => []),
    customRequests: vi.fn(async () => []),
    submitCustomRequest: vi.fn(),
    whosIn: vi.fn(),
    timeBank: vi.fn(),
    ...over,
  };
}

const ann = (id: string, publishedAt: string, x: { requiresConfirmation: boolean; readAt: string | null; confirmedAt: string | null }) => ({ id, title: id, body: "", version: 1, publishedAt, ...x });
const FORM = {
  id: "f1",
  title: "Fardamento",
  responseDays: 3,
  fields: [
    { id: "size", title: "Tamanho", type: "single" as const, options: ["S", "M"], required: true },
    { id: "notes", title: "Notas", type: "text" as const, options: [], required: false },
    { id: "items", title: "Peças", type: "multiple" as const, options: ["Calças", "Casaco"], required: true },
  ],
};

describe("Portal — comunicados, tarefas e solicitações (onda 6)", () => {
  it("o que pede ação aparece primeiro; contagem para o separador Mais", async () => {
    const a = api({
      announcements: vi.fn(async () => [
        ann("lido", "2026-10-12T10:00:00Z", { requiresConfirmation: false, readAt: "2026-10-12T11:00:00Z", confirmedAt: null }),
        ann("por-confirmar", "2026-10-01T10:00:00Z", { requiresConfirmation: true, readAt: "2026-10-02T10:00:00Z", confirmedAt: null }),
      ]),
      distributions: vi.fn(async () => [{ id: "d1", title: "Normas", fileName: "n.pdf", requiresConfirmation: true, createdAt: "2026-10-10T09:00:00Z", readAt: null, confirmedAt: null }]),
      tasks: vi.fn(async () => [
        { id: "t-done", title: "Fecho", description: null, dueAt: "2026-10-01T10:00:00Z", checklist: [], status: "done" as const },
        { id: "t-late", title: "Abertura", description: null, dueAt: "2026-10-20T10:00:00Z", checklist: [], status: "open" as const },
        { id: "t-soon", title: "Inventário", description: null, dueAt: "2026-10-13T10:00:00Z", checklist: [], status: "open" as const },
      ]),
    });
    const uc = new PortalEngagementUseCase(a);
    expect((await uc.inbox()).announcements.map((x) => x.id)).toEqual(["por-confirmar", "lido"]);
    expect((await uc.tasks()).map((t) => t.id)).toEqual(["t-soon", "t-late", "t-done"]);
    // 1 comunicado por confirmar + 1 documento + 2 tarefas abertas.
    expect(await uc.pendingCount()).toBe(4);
  });

  it("solicitação: recusa no cliente se faltar uma resposta obrigatória", async () => {
    const submit = vi.fn(async () => ({ id: "r1", formId: "f1", answers: {}, status: "pending" as const, dueAt: null, decisionComment: null, createdAt: "x" }));
    const uc = new PortalEngagementUseCase(api({ submitCustomRequest: submit }));
    expect(missingAnswers(FORM, { size: "M", items: [] })).toEqual(["items"]);
    await expect(uc.submitCustomRequest(FORM, { size: "M" })).rejects.toThrow(/obrigatórias/);
    expect(submit).not.toHaveBeenCalled();
    await uc.submitCustomRequest(FORM, { size: "M", items: ["Casaco"] });
    expect(submit).toHaveBeenCalledWith("f1", { size: "M", items: ["Casaco"] });
  });

  it("horas a partir de segundos", () => {
    expect(hoursLabel(3 * 3600 + 5 * 60)).toBe("3h 05m");
    expect(hoursLabel(-5400)).toBe("-1h 30m");
    expect(hoursLabel(0)).toBe("0h 00m");
  });
});
