import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkShift } from "../../domain/entities/schedule.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { buildReviewDays, draftSummary, initiallyCollapsed, reviewDayHeader, reviewShiftHours, selectionState } from "../../domain/services/publish-review.service.ts";
import { PublishReviewModal } from "./PublishReviewModal.tsx";

// Dados fictícios (RGPD).
function shift(id: string, employeeName: string, workDate: string, extra: Partial<WorkShift> = {}): WorkShift {
  return {
    id,
    employeeId: `e-${employeeName}`,
    employeeName,
    workDate,
    startTime: "10:00",
    endTime: "18:00",
    endsNextDay: false,
    secondStartTime: null,
    secondEndTime: null,
    locationId: "loc-mbs",
    breakMinutes: 0,
    notes: null,
    status: "draft",
    source: "manual",
    rotationId: null,
    seriesId: null,
    templateId: null,
    automationId: null,
    attendanceStatus: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

// Segunda 05/10: 3 no MBS. Quarta 07/10: sobreposição do Gabriel. Quinta 08/10: um turno noutro local + repartido.
const SHIFTS = [
  shift("s1", "Carlos Andrés Teste", "2026-10-05"),
  shift("s2", "Kleiton Ketane Teste", "2026-10-05", { startTime: "11:00", endTime: "19:00" }),
  shift("s3", "Lucas Almeida Teste", "2026-10-05", { startTime: "19:00", endTime: "23:00" }),
  shift("s4", "Gabriel Gomes Teste", "2026-10-07", { endTime: "23:00" }),
  shift("s5", "Carlos Andrés Teste", "2026-10-07"),
  shift("s6", "Lucas Almeida Teste", "2026-10-08", { startTime: "12:00", endTime: "15:00", secondStartTime: "18:00", secondEndTime: "23:59" }),
  shift("s7", "Kleiton Ketane Teste", "2026-10-08", { locationId: "loc-arm" }),
  shift("pub", "Ana Teste", "2026-10-09", { status: "published" }),
];

function renderModal(shifts = SHIFTS, overlapShiftIds: string[] = ["s4"]) {
  let resolvePublish: (() => void) | null = null;
  const api = {
    listWorkShifts: vi.fn(async () => shifts),
    getScheduleAlerts: vi.fn(async () => ({
      coverageGaps: [],
      overlaps: overlapShiftIds.length ? [{ employeeId: "e-Gabriel Gomes Teste", employeeName: "Gabriel", workDate: "2026-10-07", shiftIds: overlapShiftIds }] : [],
      automationIssues: [],
      pendingPublishCount: 0,
      pendingPublishRange: null,
    })),
    listLeaveOverview: vi.fn(async () => []),
    listPublicHolidays: vi.fn(async () => []),
    publishWorkShifts: vi.fn(() => new Promise<WorkShift[]>((r) => (resolvePublish = () => r([])))),
  } as unknown as HrApiPort;
  const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
  const onPublished = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HrProvider module={mod}>
        <PublishReviewModal
          range={{ from: "2026-10-05", to: "2026-10-11" }}
          locationName={(id) => (id === "loc-mbs" ? "Mercado Bom Sucesso" : "Armazém")}
          onClose={() => {}}
          onPublished={onPublished}
        />
      </HrProvider>
    </QueryClientProvider>,
  );
  return { api, onPublished, finishPublish: () => resolvePublish?.() };
}

describe("Rever e publicar — regras", () => {
  it("cabeçalho do dia, horário repartido e noturno, só rascunhos, local comum vs diferente", () => {
    expect(reviewDayHeader("2026-10-05")).toBe("SEGUNDA · 05 OUT");
    expect(reviewShiftHours(SHIFTS[5]!)).toBe("12:00–15:00 · 18:00–23:59");
    expect(reviewShiftHours({ ...SHIFTS[0]!, startTime: "20:00", endTime: "00:00", endsNextDay: true })).toBe("20:00–00:00 (+1)");
    const days = buildReviewDays(SHIFTS, { overlapShiftIds: new Set(["s4"]), leaves: [], holidays: [] });
    expect(days.map((d) => d.workDate)).toEqual(["2026-10-05", "2026-10-07", "2026-10-08"]);
    expect(days[0]!.commonLocationId).toBe("loc-mbs");
    expect(days[2]!.commonLocationId).toBeNull();
    expect(days[1]!.alertCount).toBe(1);
    expect(days[0]!.shifts.map((s) => s.shortName)).toEqual(["Carlos Andrés", "Kleiton Ketane", "Lucas Almeida"]);
  });

  it("estado da seleção, recolher com muitos dias, e resumo para o aviso a seguir a criar", () => {
    expect(selectionState(["a", "b"], new Set())).toBe("all");
    expect(selectionState(["a", "b"], new Set(["a"]))).toBe("some");
    expect(selectionState(["a", "b"], new Set(["a", "b"]))).toBe("none");
    const many = Array.from({ length: 31 }, (_, i) => shift(`m${i}`, "Ana Teste", `2026-11-${String(i + 1).padStart(2, "0")}`)).filter((s) => s.workDate <= "2026-11-30");
    const days = buildReviewDays(many, { overlapShiftIds: new Set(["m3"]), leaves: [], holidays: [] });
    const collapsed = initiallyCollapsed(days);
    expect(collapsed.size).toBe(days.length - 1);
    expect(collapsed.has("2026-11-04")).toBe(false);
    expect(draftSummary([{ status: "draft", workDate: "2026-10-09" }, { status: "published", workDate: "2026-10-01" }, { status: "draft", workDate: "2026-10-05" }])).toEqual({
      count: 2,
      range: { from: "2026-10-05", to: "2026-10-09" },
    });
  });
});

describe("Rever e publicar — janela", () => {
  it("resumo; desmarcar um dia; seleção parcial fica indeterminada; selecionar todos; publica só os selecionados", async () => {
    const { api, onPublished, finishPublish } = renderModal();
    const user = userEvent.setup();

    const monday = await screen.findByRole("region", { name: "SEGUNDA · 05 OUT" });
    await vi.waitFor(() => expect(screen.getByTestId("review-summary")).toHaveTextContent("7 turnos · 3 dias · 4 colaboradores · 1 alerta"));
    expect(within(monday).getByText("Mercado Bom Sucesso")).toBeInTheDocument(); // local comum só no cabeçalho
    expect(within(monday).getByText("✓ PRONTO")).toBeInTheDocument();

    await user.click(within(monday).getByLabelText("Selecionar SEGUNDA · 05 OUT"));
    for (const name of ["Carlos Andrés", "Kleiton Ketane", "Lucas Almeida"]) {
      expect(within(monday).getByLabelText(`${name} SEGUNDA · 05 OUT`)).not.toBeChecked();
    }
    expect(screen.getByText("4 de 7 turnos selecionados")).toBeInTheDocument();
    expect(screen.getByText("3 não serão publicados (ficam em rascunho)")).toBeInTheDocument();

    await user.click(within(monday).getByLabelText("Carlos Andrés SEGUNDA · 05 OUT"));
    expect((within(monday).getByLabelText("Selecionar SEGUNDA · 05 OUT") as HTMLInputElement).indeterminate).toBe(true);

    await user.click(screen.getByLabelText("Selecionar todos"));
    expect(screen.getByText("7 de 7 turnos selecionados")).toBeInTheDocument();

    await user.click(within(monday).getByLabelText("Lucas Almeida SEGUNDA · 05 OUT"));
    const publish = screen.getByRole("button", { name: "Publicar 6 turnos" });
    await user.click(publish);
    await user.click(screen.getByRole("button", { name: "A publicar…" })); // duplo clique: ignorado
    finishPublish();

    expect(api.publishWorkShifts).toHaveBeenCalledTimes(1);
    expect(api.publishWorkShifts).toHaveBeenCalledWith(["s1", "s2", "s5", "s4", "s7", "s6"]);
    await vi.waitFor(() => expect(onPublished).toHaveBeenCalledWith(6));
  });

  it("dia com alerta destacado; local diferente só na linha; repartido identificado; filtro Com alertas", async () => {
    renderModal();
    const user = userEvent.setup();

    const wednesday = await screen.findByRole("region", { name: "QUARTA · 07 OUT" });
    expect(within(wednesday).getByText("⚠ 1 ALERTA")).toBeInTheDocument();
    expect(within(wednesday).getByText("⚠ Sobreposição")).toBeInTheDocument();

    const thursday = screen.getByRole("region", { name: "QUINTA · 08 OUT" });
    expect(within(thursday).getByText("Armazém")).toBeInTheDocument();
    expect(within(thursday).getByText("12:00–15:00 · 18:00–23:59")).toBeInTheDocument();
    expect(within(thursday).getByText("Repartido")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Com alertas" }));
    expect(screen.queryByRole("region", { name: "SEGUNDA · 05 OUT" })).not.toBeInTheDocument();
    const filtered = screen.getByRole("region", { name: "QUARTA · 07 OUT" });
    expect(within(filtered).getByText("Gabriel Gomes")).toBeInTheDocument();
    expect(within(filtered).queryByText("Carlos Andrés")).not.toBeInTheDocument();
  });

  it("recolher e expandir um dia", async () => {
    renderModal();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Recolher SEGUNDA · 05 OUT" }));
    expect(screen.queryByLabelText("Carlos Andrés SEGUNDA · 05 OUT")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expandir SEGUNDA · 05 OUT" }));
    expect(screen.getByLabelText("Carlos Andrés SEGUNDA · 05 OUT")).toBeInTheDocument();
  });
});
