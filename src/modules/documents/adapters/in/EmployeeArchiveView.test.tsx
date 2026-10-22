import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { EmployeeDocumentsPort } from "../../domain/ports/in/employee-documents.ports.ts";
import { EmployeeDocumentsProvider } from "../../documents.module.tsx";
import { EmployeeArchiveView } from "./EmployeeArchiveView.tsx";

// Dados fictícios (RGPD).
const ROWS = [
  { employeeId: "e1", employeeName: "Ana Teste", category: "cartao_cidadao", requiresPeriod: false, count: 1, lastUploadedAt: "2026-03-01T10:00:00Z" },
  { employeeId: "e1", employeeName: "Ana Teste", category: "nif", requiresPeriod: false, count: 1, lastUploadedAt: "2026-04-02T10:00:00Z" },
  { employeeId: "e2", employeeName: "Rui Teste", category: "recibo_vencimento", requiresPeriod: true, count: 3, lastUploadedAt: "2026-09-30T10:00:00Z" },
];

describe("EmployeeArchiveView (Mais → Documentos → Colaboradores)", () => {
  it("pastas com colaboradores; abrir mostra quantidade, último arquivamento e leva à ficha", async () => {
    const api = { getDocumentArchive: vi.fn(async () => ROWS) } as unknown as EmployeeDocumentsPort;
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <EmployeeDocumentsProvider module={api}>
            <EmployeeArchiveView personHref={(id) => `/ficha/${id}`} />
          </EmployeeDocumentsProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    const personal = await screen.findByRole("button", { name: /Documentos pessoais/ });
    expect(personal).toHaveTextContent("1 colaborador · 2 documentos");
    expect(screen.getByRole("button", { name: /Recibos e faturas/ })).toHaveTextContent("1 colaborador · 3 documentos");
    expect(screen.getByRole("button", { name: /Saúde e formação/ })).toHaveTextContent("Sem elementos");
    await user.click(personal);
    const link = screen.getByRole("link", { name: "Ana Teste" });
    expect(link).toHaveAttribute("href", "/ficha/e1");
    const row = link.closest("tr")!;
    expect(row).toHaveTextContent("2");
    expect(row).toHaveTextContent("02/04/2026");
    expect(screen.queryByText("Rui Teste")).toBeNull();
    await user.click(screen.getByRole("button", { name: "‹ Pastas" }));
    expect(screen.getByRole("button", { name: /Outros/ })).toBeInTheDocument();
  });
});
