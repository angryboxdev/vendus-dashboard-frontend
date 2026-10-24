import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { EmployeeDocumentsPort } from "../../domain/ports/in/employee-documents.ports.ts";
import { EmployeeDocumentsProvider } from "../../documents.module.tsx";
import { PendingDocumentsSection } from "./DocumentReview.tsx";

// Dados fictícios (RGPD).
const PENDING = [{ id: "d1", employeeId: "e1", employeeName: "Ana Teste", categoryLabel: "Cartão de Cidadão", fileName: "cc.jpg", expiresAt: null, submittedAt: "2026-10-20T10:00:00Z" }];

function setup(api: Partial<EmployeeDocumentsPort>) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <EmployeeDocumentsProvider module={api as EmployeeDocumentsPort}>
          <PendingDocumentsSection personHref={(id) => `/ficha/${id}`} />
        </EmployeeDocumentsProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe("Novo RH — envios do Portal por validar", () => {
  it("lista com o colaborador (leva à ficha) e valida", async () => {
    const reviewEmployeeDocument = vi.fn(async () => ({}) as never);
    const user = setup({ listPendingDocuments: vi.fn(async () => PENDING), reviewEmployeeDocument });
    const section = await screen.findByRole("region", { name: "Por validar" });
    expect(within(section).getByRole("link", { name: "Ana Teste" })).toHaveAttribute("href", "/ficha/e1");
    expect(section).toHaveTextContent("20/10/2026");
    await user.click(within(section).getByRole("button", { name: "Validar Cartão de Cidadão de Ana Teste" }));
    expect(reviewEmployeeDocument).toHaveBeenCalledWith("e1", "d1", "approve", undefined);
  });

  it("rejeitar pede o motivo (o colaborador vê-o no Portal)", async () => {
    const reviewEmployeeDocument = vi.fn(async () => ({}) as never);
    const user = setup({ listPendingDocuments: vi.fn(async () => PENDING), reviewEmployeeDocument });
    await user.click(await screen.findByRole("button", { name: "Rejeitar Cartão de Cidadão de Ana Teste" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Rejeitar" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Motivo"), "Foto ilegível");
    await user.click(confirm);
    expect(reviewEmployeeDocument).toHaveBeenCalledWith("e1", "d1", "reject", "Foto ilegível");
  });

  it("sem envios por validar: não mostra nada", async () => {
    const listPendingDocuments = vi.fn(async () => []);
    setup({ listPendingDocuments });
    await vi.waitFor(() => expect(listPendingDocuments).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "Por validar" })).toBeNull();
  });
});
