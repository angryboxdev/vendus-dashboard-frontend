import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PayslipMappingEntry, PayslipPreviewRow } from "../../domain/entities/payslip-import.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { ImportPayslipsModal } from "./ImportPayslipsModal.tsx";

// Dados fictícios (RGPD).
const EMPLOYEES = [
  { id: "e1", fullName: "Carlos Andrés" },
  { id: "e2", fullName: "Gabriel Gomes" },
  { id: "e3", fullName: "Marta Lopes" },
];

const PREVIEW: PayslipPreviewRow[] = [
  { fileName: "carlos.pdf", period: "2026-09", status: "duplicate", employeeId: "e1", employeeName: "Carlos Andrés", matchReason: "file_name", reviewReason: null, candidates: [], existingDocumentId: "d1", hasText: false },
  { fileName: "gabriel.pdf", period: "2026-09", status: "identified", employeeId: "e2", employeeName: "Gabriel Gomes", matchReason: "nif", reviewReason: null, candidates: [], existingDocumentId: null, hasText: true },
  { fileName: "doc123.pdf", period: "2026-09", status: "review", employeeId: null, employeeName: null, matchReason: null, reviewReason: "no_match", candidates: [], existingDocumentId: null, hasText: false },
];

function renderModal() {
  const calls: { category: string; period: string; mapping: PayslipMappingEntry[]; files: string[] }[] = [];
  const api = {
    listEmployees: async () => ({ items: EMPLOYEES, total: EMPLOYEES.length, page: 1, pageSize: 100 }),
    previewPayslipImport: vi.fn(async () => PREVIEW),
    importPayslips: async (category: string, period: string, files: File[], mapping: PayslipMappingEntry[]) => {
      calls.push({ category, period, mapping, files: files.map((f) => f.name) });
      return mapping.map((m) => ({ fileName: m.fileName, employeeId: m.employeeId, outcome: m.action === "replace" ? ("replaced" as const) : ("created" as const), documentId: "x", message: null }));
    },
  } as unknown as HrApiPort;
  const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HrProvider module={mod}>
        <ImportPayslipsModal onClose={() => {}} />
      </HrProvider>
    </QueryClientProvider>,
  );
  return { api, calls };
}

const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });

describe("ImportPayslipsModal", () => {
  it("pré-visualiza, exige escolha no Rever e no duplicado, e grava só o confirmado", async () => {
    const { calls } = renderModal();
    const user = userEvent.setup();
    const dialog = screen.getByRole("dialog", { name: "Importar recibos" });

    await user.selectOptions(within(dialog).getByLabelText("Tipo"), "recibo_verde");
    fireEvent.change(within(dialog).getByLabelText("Período"), { target: { value: "2026-09" } });
    await user.upload(within(dialog).getByLabelText("Recibos (PDF)"), [pdf("carlos.pdf"), pdf("gabriel.pdf"), pdf("doc123.pdf")]);
    await user.click(within(dialog).getByRole("button", { name: "Pré-visualizar" }));

    // Duplicado: mensagem da task e nada gravado por omissão; Rever sem associação.
    expect(await within(dialog).findByText("Já existe um recibo deste colaborador para este período.")).toBeInTheDocument();
    expect(within(dialog).getByText(/Colaborador não identificado — PDF sem texto/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirmar e gravar 1" })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "Substituir versão" }));
    await user.selectOptions(await within(dialog).findByLabelText("Colaborador de doc123.pdf"), "e3");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar e gravar 3" }));

    expect(await within(dialog).findByText("Versão substituída")).toBeInTheDocument();
    expect(calls).toEqual([
      {
        category: "recibo_verde",
        period: "2026-09",
        files: ["carlos.pdf", "gabriel.pdf", "doc123.pdf"],
        mapping: [
          { fileName: "carlos.pdf", employeeId: "e1", action: "replace" },
          { fileName: "gabriel.pdf", employeeId: "e2", action: "create" },
          { fileName: "doc123.pdf", employeeId: "e3", action: "create" },
        ],
      },
    ]);
  });

  it("não deixa enviar o mesmo colaborador duas vezes", async () => {
    renderModal();
    const user = userEvent.setup();
    const dialog = screen.getByRole("dialog", { name: "Importar recibos" });
    await user.upload(within(dialog).getByLabelText("Recibos (PDF)"), [pdf("carlos.pdf"), pdf("gabriel.pdf"), pdf("doc123.pdf")]);
    await user.click(within(dialog).getByRole("button", { name: "Pré-visualizar" }));

    await user.selectOptions(await within(dialog).findByLabelText("Colaborador de doc123.pdf"), "e2");
    expect(within(dialog).getByText("Gabriel Gomes tem mais de um recibo neste período — escolha só um.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirmar e gravar 2" })).toBeDisabled();
  });
});
