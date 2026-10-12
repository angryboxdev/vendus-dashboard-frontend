import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Distribution } from "../../../domain/entities/distributions.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { DocumentsView } from "./DocumentsView.tsx";

function renderWith(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <DocumentsView />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const mod = () =>
  fakeNovoRhModule({
    settings: { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Teste" }]), listLocations: vi.fn(async () => [{ id: "l1", label: "Porto" }]) } as unknown as NovoRhModule["settings"],
  });

const SENT: Distribution = {
  id: "d1",
  title: "Normas de segurança",
  fileName: "normas.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  audience: { type: "all" },
  requiresConfirmation: true,
  status: "sent",
  createdBy: "rh@demo.invalid",
  createdAt: "2026-10-12T09:00:00.000Z",
  stats: { recipients: 3, read: 2, confirmed: 1 },
};

describe("Documentos — envio a colaboradores (FE-065)", () => {
  it("assistente em 3 passos: ficheiro, destinatários com contagem, resumo e envio", async () => {
    const m = mod();
    m.distributions.previewAudience = vi.fn(async () => ({ recipients: 1, withoutAccount: 0 }));
    m.distributions.send = vi.fn(async () => ({ ...SENT, id: "d9", stats: { recipients: 1, read: 0, confirmed: 0 }, withoutAccount: 0 }));
    renderWith(m);
    const user = userEvent.setup();
    const box = screen.getByRole("region", { name: "Enviar documento a colaboradores" });
    const file = new File(["%PDF"], "regulamento.pdf", { type: "application/pdf" });
    await user.upload(within(box).getByLabelText("Ficheiro"), file);
    // O título vem do nome do ficheiro e pode ser mudado.
    expect(within(box).getByLabelText("Título")).toHaveValue("regulamento");
    await user.click(within(box).getByRole("button", { name: "Seguinte" }));
    await user.selectOptions(within(box).getByLabelText("Para"), "locations");
    await user.selectOptions(await within(box).findByRole("listbox", { name: "Centros" }), "l1");
    expect(await within(box).findByText("Chega a 1 pessoa(s).")).toBeInTheDocument();
    expect(m.distributions.previewAudience).toHaveBeenLastCalledWith({ type: "locations", ids: ["l1"] });
    await user.click(within(box).getByRole("button", { name: "Seguinte" }));
    expect(within(box).getByText("regulamento.pdf (1 KB)")).toBeInTheDocument();
    await user.click(within(box).getByRole("button", { name: "Enviar" }));
    expect(m.distributions.send).toHaveBeenCalledWith({ title: "regulamento", audience: { type: "locations", ids: ["l1"] }, requiresConfirmation: true, file });
    expect(await within(box).findByText("Enviado a 1 pessoa(s).")).toBeInTheDocument();
  });

  it("ficheiro de tipo não permitido não deixa avançar", async () => {
    const m = mod();
    renderWith(m);
    const user = userEvent.setup({ applyAccept: false });
    const box = screen.getByRole("region", { name: "Enviar documento a colaboradores" });
    await user.upload(within(box).getByLabelText("Ficheiro"), new File(["PK"], "a.zip", { type: "application/zip" }));
    expect(within(box).getByText("Só PDF, JPEG ou PNG.")).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Seguinte" })).toBeDisabled();
  });

  it("detalhe: progresso, filtro 'Em falta', lembrete e prova de leitura", async () => {
    const m = mod();
    m.distributions.list = vi.fn(async () => [SENT]);
    m.distributions.report = vi.fn(async () => ({
      distribution: SENT,
      totals: SENT.stats,
      rows: [
        { employeeId: "e1", name: "Ana Teste", deliveredAt: "2026-10-12T09:00:00.000Z", readAt: "2026-10-12T10:00:00.000Z", confirmedAt: "2026-10-12T10:05:00.000Z", status: "confirmed" as const, hasAccount: true },
        { employeeId: "e2", name: "Rui Teste", deliveredAt: "2026-10-12T09:00:00.000Z", readAt: null, confirmedAt: null, status: "delivered" as const, hasAccount: false },
      ],
    }));
    m.distributions.remind = vi.fn(async () => ({ pending: 2, notified: 1, withoutAccount: 1 }));
    m.distributions.proofCsv = vi.fn(async () => new Blob(["x"]));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    renderWith(m);
    const user = userEvent.setup();
    expect(await screen.findByText(/1\/3 confirmaram/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Normas de segurança/ }));
    const detail = await screen.findByRole("region", { name: "Normas de segurança" });
    expect(await within(detail).findByText("Ana Teste")).toBeInTheDocument();
    await user.click(within(detail).getByRole("tab", { name: "Em falta" }));
    expect(within(detail).queryByText("Ana Teste")).not.toBeInTheDocument();
    expect(within(detail).getByText("Rui Teste")).toBeInTheDocument();
    await user.click(within(detail).getByRole("button", { name: "Lembrar quem falta" }));
    expect(await within(detail).findByText("Lembrete enviado a 1 de 2 pessoa(s) em falta.")).toBeInTheDocument();
    await user.click(within(detail).getByRole("button", { name: "Exportar prova" }));
    expect(m.distributions.proofCsv).toHaveBeenCalledWith("d1");
  });
});
