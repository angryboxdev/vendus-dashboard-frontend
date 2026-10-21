import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EmployeeDocument } from "../../domain/entities/employee-document.ts";
import type { EmployeeDocumentSummary } from "../../domain/entities/employee-document-summary.ts";
import type { EmployeeDocumentsPort } from "../../domain/ports/in/employee-documents.ports.ts";
import { EmployeeDocumentsProvider } from "../../documents.module.tsx";
import { EmployeeDocumentsPanel } from "./EmployeeDocumentsPanel.tsx";

// Dados fictícios (RGPD).
const DOC: EmployeeDocument = {
  id: "d1", employeeId: "e1", category: "cartao_cidadao", mandatory: true, fileName: "cc-ficticio.pdf", mimeType: "application/pdf", fileSizeBytes: 10,
  origin: "rh", expiresAt: null, period: null, version: 1, previousVersionId: null, displayStatus: "ok", uploadedBy: "rh@demo.invalid", uploadedAt: "2026-10-01T10:00:00Z",
};
const SUMMARY: EmployeeDocumentSummary = {
  employeeId: "e1", positionId: null, mandatoryTotal: 3, mandatoryCompleted: 1, missingRequirements: ["Contrato de trabalho"], missingOptional: [], expiringSoonCount: 0,
  alerts: [{ type: "document_missing", message: "Documento em falta: Contrato de trabalho" }],
};

function renderPanel() {
  const api = {
    listEmployeeDocuments: vi.fn(async () => [DOC, { ...DOC, id: "d2", category: "contrato_trabalho", fileName: "contrato-ficticio.pdf" }]),
    getDocumentSummary: vi.fn(async () => SUMMARY),
    listDocumentCategories: vi.fn(async () => []),
  } as unknown as EmployeeDocumentsPort;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EmployeeDocumentsProvider module={api}>
        <EmployeeDocumentsPanel employeeId="e1" />
      </EmployeeDocumentsProvider>
    </QueryClientProvider>,
  );
  return api;
}

describe("EmployeeDocumentsPanel (ficha do Novo RH)", () => {
  it("mostra os documentos e o resumo do módulo documents, sem histórico antigo", async () => {
    const api = renderPanel();
    expect(await screen.findByText("cc-ficticio.pdf")).toBeInTheDocument();
    expect(await screen.findByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("Documento em falta: Contrato de trabalho")).toBeInTheDocument();
    expect(screen.queryByText("Histórico documental")).toBeNull();
    expect(api.getDocumentSummary).toHaveBeenCalledWith("e1");
  });

  it("pastas: contam os documentos e filtram a lista sem mudar de página", async () => {
    renderPanel();
    const user = userEvent.setup();
    expect(await screen.findByText("contrato-ficticio.pdf")).toBeInTheDocument();
    const personal = screen.getByRole("button", { name: /Documentos pessoais/ });
    expect(personal).toHaveTextContent("1 documento");
    expect(screen.getByRole("button", { name: /Recibos e faturas/ })).toHaveTextContent("Sem elementos");
    await user.click(personal);
    expect(personal).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("cc-ficticio.pdf")).toBeInTheDocument();
    expect(screen.queryByText("contrato-ficticio.pdf")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ver todos os documentos" }));
    expect(screen.getByText("contrato-ficticio.pdf")).toBeInTheDocument();
  });
});
