import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { StockPurchaseReviewProvider } from "../../stock-purchase-review.module.tsx";
import type { StockPurchaseReviewApiPort } from "../../domain/ports/out/stock-purchase-review-api.port.ts";
import type { StockPurchaseReviewDTO, StockReviewLineDTO } from "../../domain/entities/stock-purchase-review.ts";
import { StockPurchaseReviewDetailView } from "./StockPurchaseReviewDetailView.tsx";

const locationsState = {
  activeLocations: [{ id: "loc-1", name: "Loja A" }, { id: "loc-2", name: "Loja B" }],
  hasMultipleLocations: true,
};
vi.mock("../../../locations/adapters/in/use-locations.ts", () => ({ useLocations: () => locationsState }));

const line = (over: Partial<StockReviewLineDTO>): StockReviewLineDTO => ({
  id: "l1", invoiceLineId: "il1", description: "Farinha T65 25kg", purchaseQuantity: 12, purchaseUnit: "saco", unitCostWithoutVat: 2500, totalWithVat: 31800,
  vatAmount: 1800, netAmount: 30000, discountAmount: 0, supplierItemCode: "12345", costCenterCategoryId: "cat-ingred", locationSplits: null, suggestion: null,
  resolutionType: "unresolved", stockItemId: null, conversionFactor: null, stockQuantity: null, locationId: null,
  unitCostPerBaseUnitWithVat: null, unitCostPerBaseUnitWithoutVat: null, flaggedSuspiciousConversion: false, flagReason: null, resolvedBy: null, resolvedAt: null,
  ...over,
});

const review = (over: Partial<StockPurchaseReviewDTO> = {}): StockPurchaseReviewDTO => ({
  id: "r1", invoiceId: "inv-1", status: "partial", version: 3, decisionSource: "category", decisionCategoryId: null, decisionSupplierId: "sup-1",
  decisionPolicyUsed: "CREATE_REVIEW", decisionActor: null, decisionOverrideReason: null, decisionAt: "2026-10-20T10:00:00Z",
  supplierName: "Makro", invoiceNumber: "FT 1", invoiceDate: "2026-10-20", locationId: null, appliedAt: null, cancelledAt: null, cancellationReason: null,
  invoiceNetCents: 65000, invoiceVatCents: 9850, invoiceTotalCents: 74850, categoryDivergences: null,
  conference: {
    document: { status: "ok", linesNetCents: 65000, linesVatCents: 9850, invoiceNetCents: 65000, invoiceVatCents: 9850, invoiceTotalCents: 74850, netDifferenceCents: 0, vatDifferenceCents: 0 },
    stock: { inventoriableLines: 1, nonStockLines: 1, unresolvedLines: 1, inventoriableNetCents: 10000, nonStockNetCents: 25000 },
    categories: { divergences: [{ lineId: "l2", description: "Batedeira industrial", costCenterCategoryId: "cat-equip", kind: "stock_line_in_non_stock_category" }] },
  },
  lines: [line({})],
  createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T10:00:00Z",
  ...over,
});

function renderView(api: Partial<StockPurchaseReviewApiPort>) {
  const full = {
    listStockItemOptions: async () => [{ id: "item-farinha", name: "Farinha T65", baseUnit: "kg", categoryId: "c", isActive: true }],
    listStockCategoryOptions: async () => [],
    // Por omissão a conciliação não encontra nada (marca as linhas como procuradas).
    suggestMappings: async () => {
      const r = await api.getReview!("r1");
      return { ...r, lines: r.lines.map((l) => ({ ...l, suggestion: l.suggestion ?? { source: "none", resolution: null, stockItemId: null, conversionFactor: null, confidence: null, packagingChanged: false } })) };
    },
    ...api,
  } as unknown as StockPurchaseReviewApiPort;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <StockPurchaseReviewProvider module={{ api: full }}>
        <MemoryRouter initialEntries={["/stock/compras-por-rever/r1"]}>
          <Routes>
            <Route path="/stock/compras-por-rever/:id" element={<StockPurchaseReviewDetailView />} />
          </Routes>
        </MemoryRouter>
      </StockPurchaseReviewProvider>
    </QueryClientProvider>,
  );
  return full;
}

describe("StockPurchaseReviewDetailView (F3a)", () => {
  it("mostra as três conferências, a referência/base/IVA da linha e as três ações", async () => {
    renderView({ getReview: async () => review() });
    expect(await screen.findByText("1. Documento")).toBeTruthy();
    expect(screen.getByText("Todas as linhas batem com a fatura.")).toBeTruthy();
    expect(screen.getByText(/Batedeira industrial/)).toBeTruthy();
    expect(screen.getByText(/pendência para o Financeiro/)).toBeTruthy();
    expect(screen.getByText("ref. 12345")).toBeTruthy();
    expect(screen.getByText(/base 300,00\s€ · IVA 18,00\s€/)).toBeTruthy();
    for (const label of ["Associar artigo", "Criar artigo", "Não é item de stock"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
  });

  it("divisão por lojas: recusa soma errada e envia quantidades explícitas", async () => {
    const resolveLine = vi.fn(async () => review());
    renderView({ getReview: async () => review(), resolveLine });
    await screen.findByText("1. Documento");
    await waitFor(() => expect(screen.getByRole("option", { name: "Farinha T65" })).toBeTruthy());
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "item-farinha" } });
    fireEvent.change(screen.getByDisplayValue("1"), { target: { value: "25" } });
    fireEvent.click(screen.getByLabelText(/Dividir por lojas/));
    const selects = screen.getAllByRole("combobox").slice(1);
    fireEvent.change(selects[0]!, { target: { value: "loc-1" } });
    fireEvent.change(selects[1]!, { target: { value: "loc-2" } });
    const qty = screen.getAllByRole("textbox").filter((el) => (el as HTMLInputElement).inputMode === "decimal");
    fireEvent.change(qty[0]!, { target: { value: "12" } });
    fireEvent.change(qty[1]!, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText(/A divisão soma 24 saco; tem de somar 12 saco/)).toBeTruthy();
    expect(resolveLine).not.toHaveBeenCalled();
    fireEvent.change(qty[1]!, { target: { value: "5" } });
    fireEvent.change(qty[0]!, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(resolveLine).toHaveBeenCalled());
    expect(resolveLine).toHaveBeenCalledWith("r1", "l1", expect.objectContaining({
      resolution: "existing_item", stockItemId: "item-farinha", conversionFactor: 25, locationId: null,
      locationSplits: [{ locationId: "loc-1", purchaseQuantity: 7 }, { locationId: "loc-2", purchaseQuantity: 5 }],
    }));
  });

  it("documento em divergência bloqueia a confirmação", async () => {
    const mismatch = review({ status: "ready", lines: [line({ resolutionType: "no_stock_effect" })] });
    mismatch.conference = { ...mismatch.conference!, document: { ...mismatch.conference!.document, status: "mismatch", netDifferenceCents: -100 } };
    renderView({ getReview: async () => mismatch });
    expect(await screen.findByText(/as linhas não batem com a fatura/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirmar/ })).toBeNull();
  });

  it("todas as linhas «Não é item de stock» → «Confirmar — não afeta Stock»", async () => {
    renderView({ getReview: async () => review({ status: "ready", lines: [line({ resolutionType: "no_stock_effect" })] }) });
    expect(await screen.findByRole("button", { name: "Confirmar — não afeta Stock" })).toBeTruthy();
  });
});

describe("StockPurchaseReviewDetailView (F3b — conciliação e fila)", () => {
  const proposal = (over: Partial<NonNullable<StockReviewLineDTO["suggestion"]>> = {}) => ({
    source: "ai" as const, resolution: "existing_item" as const, stockItemId: "item-farinha", conversionFactor: 25, confidence: 0.92, packagingChanged: false, ...over,
  });

  it("ao abrir procura conciliações; a proposta mostra artigo, fator e origem e «Aceitar» resolve a linha", async () => {
    const suggestMappings = vi.fn(async () => review({ lines: [line({ suggestion: proposal() })] }));
    const resolveLine = vi.fn(async () => review());
    renderView({ getReview: async () => review(), suggestMappings, resolveLine });
    expect(await screen.findByText(/Conciliação proposta/)).toBeTruthy();
    expect(suggestMappings).toHaveBeenCalledWith("r1", { refresh: false });
    await waitFor(() => expect(screen.getByText(/Farinha T65 · fator 25/)).toBeTruthy());
    expect(screen.getByText(/IA 92%/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await waitFor(() => expect(resolveLine).toHaveBeenCalledWith("r1", "l1", expect.objectContaining({ resolution: "existing_item", stockItemId: "item-farinha", conversionFactor: 25 })));
  });

  it("proposta sem fator não pode ser aceite diretamente (só «Ajustar»)", async () => {
    renderView({ getReview: async () => review({ lines: [line({ suggestion: proposal({ conversionFactor: null, source: "name_match", confidence: 0.8 }) })] }) });
    expect(await screen.findByText(/fator por preencher/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aceitar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ajustar" }));
    expect((screen.getAllByRole("combobox")[0] as HTMLSelectElement).value).toBe("item-farinha");
  });

  it("«Aceitar as N propostas» resolve em sequência com a versão atualizada", async () => {
    const two = review({ lines: [line({ suggestion: proposal() }), line({ id: "l2", invoiceLineId: "il2", description: "Entrega", suggestion: proposal({ resolution: "no_stock_effect", stockItemId: null, conversionFactor: null }) })] });
    const resolveLine = vi.fn(async (_r: string, _l: string, p: { expectedVersion: number }) => ({ ...two, version: p.expectedVersion + 1 }));
    renderView({ getReview: async () => two, resolveLine });
    fireEvent.click(await screen.findByRole("button", { name: "Aceitar as 2 propostas" }));
    await waitFor(() => expect(resolveLine).toHaveBeenCalledTimes(2));
    expect(resolveLine.mock.calls.map((c) => [c[1], c[2].expectedVersion])).toEqual([["l1", 3], ["l2", 4]]);
  });

  it("revisão retirada pode ser reposta", async () => {
    const restoreReview = vi.fn(async () => review({ status: "in_review" }));
    renderView({ getReview: async () => review({ status: "cancelled", cancellationReason: "engano" }), restoreReview });
    fireEvent.click(await screen.findByRole("button", { name: "Repor em Compras por rever" }));
    await waitFor(() => expect(restoreReview).toHaveBeenCalledWith("r1", { expectedVersion: 3 }));
    expect(screen.getByText("Motivo da retirada: engano")).toBeTruthy();
  });
});
