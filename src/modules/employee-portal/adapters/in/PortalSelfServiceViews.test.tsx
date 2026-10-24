import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DocumentChecklist, MyDocument, MyShift, SubmittableCategory } from "../../domain/entities/portal.ts";
import type { PortalSelfServicePort } from "../../domain/ports/in/portal.ports.ts";
import { EmployeePortalProvider, type EmployeePortalModule } from "../../employee-portal.module.tsx";
import { PortalDocumentsView } from "./PortalDocumentsView.tsx";
import { PortalLeaveView } from "./PortalLeaveView.tsx";
import { PortalScheduleView } from "./PortalScheduleView.tsx";
import { addDays, mondayOf } from "../../domain/services/portal-text.service.ts";
import { todayLisbon } from "./portal-today.ts";

// Dados fictícios (RGPD).
function renderWith(ui: ReactNode, selfService: Partial<PortalSelfServicePort>) {
  const mod: EmployeePortalModule = {
    getHome: { execute: vi.fn() },
    registerPunch: { execute: vi.fn() },
    selfService: selfService as PortalSelfServicePort,
    engagement: {} as EmployeePortalModule["engagement"],
    newIdempotencyKey: () => "k",
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EmployeePortalProvider module={mod}>{ui}</EmployeePortalProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const today = todayLisbon();
const SHIFT: MyShift = {
  id: "s1",
  workDate: today,
  startTime: "09:00",
  endTime: "17:00",
  endsNextDay: false,
  secondStartTime: null,
  secondEndTime: null,
  locationId: "loc-1",
  locationName: "Loja Teste",
};

describe("PortalScheduleView", () => {
  it("mostra os turnos da semana e os colegas ao abrir", async () => {
    const listCoworkers = vi.fn(async () => [{ shortName: "Gabriel Teste", positionName: "Cozinheiro", hours: "16:00–23:00" }]);
    renderWith(<PortalScheduleView />, { listShifts: vi.fn(async () => [SHIFT]), listCoworkers });
    expect(await screen.findByText("Hoje · 09:00–17:00")).toBeInTheDocument();
    expect(listCoworkers).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Quem trabalha comigo" }));
    expect(await screen.findByText("Gabriel Teste")).toBeInTheDocument();
    expect(listCoworkers).toHaveBeenCalledWith("s1");
  });

  it("semana sem turnos", async () => {
    renderWith(<PortalScheduleView />, { listShifts: vi.fn(async () => []) });
    expect(await screen.findByText("Sem turnos publicados nesta semana.")).toBeInTheDocument();
  });

  it("folga, modelo e área, e os dias sem escala da semana", async () => {
    const dayOff: MyShift = { ...SHIFT, id: "f1", kind: "day_off", startTime: "", endTime: "", segments: [] };
    const withTemplate: MyShift = { ...SHIFT, areaName: "Bar", template: { name: "Manhã", abbreviation: "M", color: "#2a78d6" } };
    const other = today === addDays(mondayOf(today), 6) ? addDays(today, -1) : addDays(today, 1);
    renderWith(<PortalScheduleView />, { listShifts: vi.fn(async () => [withTemplate, { ...dayOff, workDate: other }]) });
    expect(await screen.findByText("Hoje · 09:00–17:00")).toBeInTheDocument();
    expect(screen.getByText("Manhã")).toBeInTheDocument();
    expect(screen.getByText("Loja Teste · Bar")).toBeInTheDocument();
    expect(screen.getByText(/· Folga$/)).toBeInTheDocument();
    expect(screen.getAllByText(/Sem turno publicado$/)).toHaveLength(5);
  });

  it("erro: mostra «Tentar novamente» e volta a pedir", async () => {
    const listShifts = vi.fn<() => Promise<MyShift[]>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue([SHIFT]);
    renderWith(<PortalScheduleView />, { listShifts });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Hoje · 09:00–17:00")).toBeInTheDocument();
    expect(listShifts).toHaveBeenCalledTimes(2);
  });
});

describe("PortalDocumentsView", () => {
  const docs: MyDocument[] = [
    { id: "r1", categoryLabel: "Recibo de vencimento", category: "recibo_vencimento", fileName: "r.pdf", mimeType: "application/pdf", status: "valid", canReplace: false, lastRejection: null, period: "2026-09", isPayslip: true, issuedAt: null, expiresAt: null, uploadedAt: "" },
    { id: "d1", categoryLabel: "Atestado de saúde", category: "atestado_saude", fileName: "a.pdf", mimeType: "application/pdf", status: "valid", canReplace: true, lastRejection: null, period: null, isPayslip: false, issuedAt: null, expiresAt: "2020-01-31", uploadedAt: "" },
  ];
  const cat = (o: Partial<SubmittableCategory>): SubmittableCategory => ({ slug: "nif", label: "NIF", mandatory: false, requiresPeriod: false, accepts: ["application/pdf", "image/jpeg", "image/png"], status: "missing", canSubmit: true, lastRejection: null, ...o });
  const checklist: DocumentChecklist = {
    categories: [
      cat({ slug: "cartao_cidadao", label: "Cartão de Cidadão", mandatory: true }),
      cat({ slug: "passaporte", label: "Passaporte", mandatory: true }),
      cat({ slug: "nif" }),
      cat({ slug: "atestado_saude", label: "Atestado de saúde", status: "expired" }),
      cat({ slug: "recibo_verde", label: "Recibo verde", requiresPeriod: true, status: null }),
    ],
    missingMandatory: [{ id: "identificacao", label: "Documento de identificação", categories: ["cartao_cidadao", "titulo_residencia", "passaporte"], status: "missing" }],
  };

  it("as 5 pastas do RH com contagem; em falta e vencido no topo; abre a janela no toque (iOS)", async () => {
    const win = { location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    const documentUrl = vi.fn(async () => "https://signed/r1");
    renderWith(<PortalDocumentsView />, { listDocuments: vi.fn(async () => docs), documentChecklist: vi.fn(async () => checklist), documentUrl });
    const user = userEvent.setup();

    expect(await screen.findByText("Vencido a 31/01/2020")).toBeInTheDocument();
    expect(await screen.findByText("Documento de identificação")).toBeInTheDocument();
    expect(screen.getByText("Obrigatório · em falta")).toBeInTheDocument();
    const folders = screen.getByRole("list", { name: "Pastas" });
    expect(within(folders).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "1Documentos pessoais0 documentos",
      "Contrato e trabalho0 documentos",
      "Recibos e faturas1 documento",
      "1Saúde e formação1 documento",
      "Outros0 documentos",
    ]);
    expect(screen.queryByText("Enviados pela empresa")).toBeNull(); // fica em Mais → Comunicados
    await user.click(within(folders).getByRole("button", { name: /Recibos e faturas/ }));
    expect(screen.getByText("SET 2026 · Recibo de vencimento")).toBeInTheDocument();
    expect(screen.getByText("PDF · SET 2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(open).toHaveBeenCalledWith("", "_blank");
    await vi.waitFor(() => expect(win.location.href).toBe("https://signed/r1"));
    expect(documentUrl).toHaveBeenCalledWith("r1");
    open.mockRestore();
  });

  it("enviar o obrigatório em falta: destino explícito, só as opções do requisito, e fica em validação", async () => {
    const submitDocument = vi.fn(async () => docs[1]!);
    renderWith(<PortalDocumentsView />, { listDocuments: vi.fn(async () => []), documentChecklist: vi.fn(async () => checklist), submitDocument });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Enviar Documento de identificação" }));
    const form = screen.getByRole("form", { name: "Enviar documento" });
    expect(within(form).getByRole("combobox", { name: "Documento" }).querySelectorAll("option")).toHaveLength(2); // Cartão de Cidadão, Passaporte
    expect(form).toHaveTextContent("Destino: Documentos pessoais › Cartão de Cidadão");
    const file = new File(["x"], "cc.jpg", { type: "image/jpeg" });
    await user.upload(within(form).getByLabelText("Ficheiro"), file);
    await user.click(within(form).getByRole("button", { name: "Enviar para validação" }));
    expect(submitDocument).toHaveBeenCalledWith({ category: "cartao_cidadao", file, period: null, expiresAt: null });
    expect(await screen.findByRole("status")).toHaveTextContent("Fica «Em validação» até o RH ou o seu gerente aprovar.");
  });

  it("pasta Recibos e faturas: recibo verde pede o mês; ficheiro inválido não sai do telemóvel", async () => {
    const submitDocument = vi.fn(async () => docs[0]!);
    renderWith(<PortalDocumentsView />, { listDocuments: vi.fn(async () => []), documentChecklist: vi.fn(async () => checklist), submitDocument });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Recibos e faturas/ }));
    await user.click(screen.getByRole("button", { name: "Enviar documento" }));
    const form = screen.getByRole("form", { name: "Enviar documento" });
    expect(form).toHaveTextContent("Destino: Recibos e faturas › Recibo verde");
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "grande.pdf", { type: "application/pdf" });
    await user.upload(within(form).getByLabelText("Ficheiro"), big);
    expect(within(form).getByRole("button", { name: "Enviar para validação" })).toBeDisabled(); // falta o mês
    fireEvent.change(within(form).getByLabelText("Mês a que se refere"), { target: { value: "2026-09" } });
    await user.click(within(form).getByRole("button", { name: "Enviar para validação" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("O ficheiro tem mais de 10 MB.");
    expect(submitDocument).not.toHaveBeenCalled();
  });

  it("foto: pré-visualização no próprio Portal; voltar às pastas", async () => {
    const photo: MyDocument = { ...docs[1]!, id: "p1", canReplace: false, expiresAt: null, fileName: "cc.jpg", mimeType: "image/jpeg", category: "cartao_cidadao", categoryLabel: "Cartão de Cidadão" };
    const open = vi.spyOn(window, "open");
    renderWith(<PortalDocumentsView />, { listDocuments: vi.fn(async () => [photo]), documentChecklist: vi.fn(async () => ({ categories: [], missingMandatory: [] })), documentUrl: vi.fn(async () => "https://signed/p1") });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Documentos pessoais/ }));
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(await screen.findByRole("img", { name: "Cartão de Cidadão" })).toHaveAttribute("src", "https://signed/p1");
    expect(open).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    await user.click(screen.getByRole("button", { name: "Pastas" }));
    expect(screen.getByRole("list", { name: "Pastas" })).toBeInTheDocument();
    open.mockRestore();
  });

  it("erro com «Tentar novamente»; sem a lista do que falta, as pastas continuam", async () => {
    const listDocuments = vi.fn<() => Promise<MyDocument[]>>().mockRejectedValueOnce(new Error("x")).mockResolvedValue([]);
    renderWith(<PortalDocumentsView />, { listDocuments, documentChecklist: vi.fn(async () => Promise.reject(new Error("x"))) });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("list", { name: "Pastas" })).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível ver o que está em falta/)).toBeInTheDocument();
  });

  it("falha a obter o URL → fecha a janela e avisa", async () => {
    const win = { location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    renderWith(<PortalDocumentsView />, { listDocuments: vi.fn(async () => docs), documentChecklist: vi.fn(async () => checklist), documentUrl: vi.fn(async () => Promise.reject(new Error("x"))) });
    await userEvent.setup().click((await screen.findAllByRole("button", { name: "Abrir" }))[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir o documento");
    expect(win.close).toHaveBeenCalled();
    open.mockRestore();
  });
});

describe("PortalLeaveView", () => {
  it("lista as ausências do ano, sem saldo", async () => {
    const year = Number(today.slice(0, 4));
    const getLeave = vi.fn(async () => ({ year, entries: [{ id: "l1", type: "vacation" as const, startDate: `${year}-08-03`, endDate: `${year}-08-05`, workingDays: 3 }] }));
    renderWith(<PortalLeaveView />, { getLeave });
    expect(await screen.findByText("Férias")).toBeInTheDocument();
    expect(screen.getByText("3 dias úteis")).toBeInTheDocument();
    expect(screen.queryByText(/saldo/i)).not.toBeInTheDocument();
    expect(getLeave).toHaveBeenCalledWith(year);
  });
});
