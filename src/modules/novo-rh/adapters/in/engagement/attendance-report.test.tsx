import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { AttendanceReportView } from "./AttendanceReportView.tsx";

// Dados fictícios (RGPD).
const day = (employeeId: string, workDate: string, over = {}) => ({ employeeId, workDate, worked: 8 * 3600, planned: 8 * 3600, late: false, lateMinutes: 0, missing: false, forgotten: false, excused: false, ...over });

describe("Mais → Relatórios → Assiduidade", () => {
  it("gera o período em blocos, mostra os totais por colaborador e exporta para Excel", async () => {
    const today = todayIn();
    const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => [{ id: "l1", label: "Loja Porto" }]), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    m.reports.attendanceDays = vi.fn(async (q) => ({
      people: [{ id: "e1", name: "Ana Teste", locationId: "l1", hireDate: "2020-01-01" }],
      days: q.from.startsWith(today.slice(0, 7)) ? [day("e1", q.from, { late: true, lateMinutes: 10 }), day("e1", q.from, { worked: 0, missing: true })] : [],
    }));
    m.reports.exportXlsx = vi.fn(async () => ({ blob: new Blob(["x"]), fileName: "relatorio.xlsx" }));
    const url = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: url, revokeObjectURL: vi.fn() });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
          <AttendanceReportView />
        </NovoRhProvider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Para" }), "location");
    await user.selectOptions(await screen.findByRole("combobox", { name: "Centro" }), "l1");
    await user.click(screen.getByRole("button", { name: "Gerar relatório" }));
    const table = await screen.findByRole("region", { name: "Resultados por colaborador" });
    const row = within(table).getByRole("row", { name: /Ana Teste/ });
    expect(row).toHaveTextContent("1 · 10 min");
    expect(m.reports.attendanceDays).toHaveBeenCalledWith(expect.objectContaining({ from: `${today.slice(0, 7)}-01`, to: today, locationIds: ["l1"] }));
    expect(screen.getByText(/Loja Porto · 1 colaborador/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Excel" }));
    expect(m.reports.exportXlsx).toHaveBeenCalledWith(expect.objectContaining({ title: "Relatório de assiduidade", rows: [expect.arrayContaining(["Ana Teste", "Total"])] }));
  });
});
