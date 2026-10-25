import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../lib/api.ts";
import { StockPurchaseReviewProvider } from "../../stock-purchase-review.module.tsx";
import type { StockPurchaseReviewApiPort } from "../../domain/ports/out/stock-purchase-review-api.port.ts";
import { StockImportInvoiceModal } from "./StockImportInvoiceModal.tsx";

const pdf = () => new File(["%PDF"], "fatura.pdf", { type: "application/pdf" });

function renderModal(importInvoiceForStock: StockPurchaseReviewApiPort["importInvoiceForStock"]) {
  const onClose = vi.fn();
  render(
    <StockPurchaseReviewProvider module={{ api: { importInvoiceForStock } as unknown as StockPurchaseReviewApiPort }}>
      <MemoryRouter initialEntries={["/stock/compras-por-rever"]}>
        <Routes>
          <Route path="/stock/compras-por-rever" element={<StockImportInvoiceModal onClose={onClose} />} />
          <Route path="/stock/compras-por-rever/:id" element={<p>revisão aberta</p>} />
        </Routes>
      </MemoryRouter>
    </StockPurchaseReviewProvider>,
  );
  const upload = () => fireEvent.change(screen.getByLabelText("Ficheiro da fatura"), { target: { files: [pdf()] } });
  return { onClose, upload };
}

describe("StockImportInvoiceModal (F3c)", () => {
  it("fatura nova → abre a Compra por rever criada", async () => {
    const imp = vi.fn(async () => ({ kind: "created" as const, invoiceId: "inv-1", reviewId: "rev-1", validationIssues: [] }));
    const { onClose, upload } = renderModal(imp);
    upload();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(imp).toHaveBeenCalledWith(expect.any(File), { routeExisting: false });
  });

  it("já deu entrada no Stock → aviso de bloqueio, sem opção de importar outra vez", async () => {
    const imp = vi.fn(async () => {
      throw new ApiError("A fatura Makro FT 1 já deu entrada no Stock — não pode entrar outra vez.", 409, { code: "already_in_stock", reviewId: "rev-old" });
    });
    const { upload } = renderModal(imp);
    upload();
    expect(await screen.findByText("Esta fatura já deu entrada no Stock")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir a revisão" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Enviar para Compras por rever|Tentar de novo/ })).toBeNull();
  });

  it("já lançada no Financeiro sem Stock → «Enviar para Compras por rever» repete com routeExisting", async () => {
    const imp = vi
      .fn<StockPurchaseReviewApiPort["importInvoiceForStock"]>()
      .mockRejectedValueOnce(new ApiError("A fatura Makro FT 1 já está lançada no Financeiro mas não foi enviada para o Stock.", 409, { code: "exists_not_routed", invoiceId: "inv-1" }))
      .mockResolvedValueOnce({ kind: "routed", invoiceId: "inv-1", reviewId: "rev-2", validationIssues: [] });
    const { onClose, upload } = renderModal(imp);
    upload();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar para Compras por rever" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(imp).toHaveBeenLastCalledWith(expect.any(File), { routeExisting: true });
  });

  it("falha de leitura → «Tentar de novo» no máximo duas vezes", async () => {
    const imp = vi.fn(async () => {
      throw new ApiError("Não foi possível ler as linhas da fatura.", 422, { code: "extraction_failed" });
    });
    const { upload } = renderModal(imp);
    upload();
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(imp).toHaveBeenCalledTimes(2));
    await screen.findByText("Não foi possível ler a fatura");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
  });
});
