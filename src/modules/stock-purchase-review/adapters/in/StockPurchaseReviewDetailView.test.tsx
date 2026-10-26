import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { StockPurchaseReviewProvider } from "../../stock-purchase-review.module.tsx";
import type { StockPurchaseReviewApiPort } from "../../domain/ports/out/stock-purchase-review-api.port.ts";
import type { StockPurchaseReviewDTO, StockReviewLineDTO } from "../../domain/entities/stock-purchase-review.ts";
import { StockPurchaseReviewDetailView } from "./StockPurchaseReviewDetailView.tsx";
import { ApiError } from "../../../../lib/api.ts";

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

describe("StockPurchaseReviewDetailView (V5 — conciliação compacta)", () => {
  it("cabeçalho, progresso da conciliação e três indicadores, linha compacta com referência; ao rever: base/IVA e as três ações, sem loja nem divisão", async () => {
    renderView({ getReview: async () => review() });
    expect(await screen.findByRole("region", { name: "Progresso da conciliação" })).toBeTruthy();
    expect(screen.queryByText("Linhas do documento")).toBeNull();
    for (const k of ["Artigos distintos para Stock", "Base sem IVA", "Total da fatura"]) expect(screen.getByText(k)).toBeTruthy();
    // Pendência de categorias aparece só porque existe; não impede a entrada.
    expect(screen.getByText(/Batedeira industrial/)).toBeTruthy();
    expect(screen.getByText("ref. 12345")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rever" }));
    expect(screen.getByText(/base 300,00\s€ · IVA 18,00\s€/)).toBeTruthy();
    for (const label of ["Associar artigo", "Criar artigo", "Não é item de stock"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
    expect(screen.queryByText(/Destino \(loja\)/)).toBeNull();
    expect(screen.queryByText(/Dividir por lojas/)).toBeNull();
    expect(screen.queryByText(/Fator de conversão/)).toBeNull();
  });

  it("sem unidade de medida na fatura: pergunta «Quanto tem 1 saco?» e guarda sem loja nem divisão", async () => {
    const resolveLine = vi.fn(async () => review());
    renderView({ getReview: async () => review(), resolveLine });
    fireEvent.click(await screen.findByRole("button", { name: "Rever" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Farinha T65" })).toBeTruthy());
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "item-farinha" } });
    fireEvent.change(screen.getByLabelText("Conversão"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(resolveLine).toHaveBeenCalled());
    expect(resolveLine).toHaveBeenCalledWith("r1", "l1", expect.objectContaining({ resolution: "existing_item", stockItemId: "item-farinha", conversionFactor: 25, locationId: null }));
    expect((resolveLine.mock.calls[0] as unknown[])[2]).not.toHaveProperty("locationSplits", expect.anything());
  });

  it("T03: «Q. Cheddar Ralado kg» com artigo em g → conversão automática 1 kg = 1000 g, sem campo", async () => {
    const resolveLine = vi.fn(async () => review());
    renderView({
      getReview: async () => review({ lines: [line({ description: "Q. Cheddar Ralado kg", purchaseQuantity: 6, purchaseUnit: "un" })] }),
      listStockItemOptions: async () => [{ id: "item-cheddar", name: "Cheddar Ralado", baseUnit: "g", categoryId: "c", isActive: true }],
      resolveLine,
    });
    fireEvent.click(await screen.findByRole("button", { name: "Rever" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Cheddar Ralado" })).toBeTruthy());
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "item-cheddar" } });
    expect(screen.getByText(/1 kg = 1000 g/)).toBeTruthy();
    expect(screen.queryByLabelText("Conversão")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(resolveLine).toHaveBeenCalledWith("r1", "l1", expect.objectContaining({ stockItemId: "item-cheddar", conversionFactor: 1000 })));
  });

  it("documento em divergência: aviso e confirmação desativada", async () => {
    const mismatch = review({ status: "ready", lines: [line({ resolutionType: "no_stock_effect" })] });
    mismatch.conference = { ...mismatch.conference!, document: { ...mismatch.conference!.document, status: "mismatch", netDifferenceCents: -100 } };
    renderView({ getReview: async () => mismatch });
    expect(await screen.findByText(/As linhas não batem com a fatura \(base/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Confirmar/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("todas as linhas «Não é item de stock» → «Confirmar — não afeta Stock»", async () => {
    renderView({ getReview: async () => review({ status: "ready", lines: [line({ resolutionType: "no_stock_effect" })] }) });
    expect(await screen.findByRole("button", { name: "Confirmar — não afeta Stock" })).toBeTruthy();
  });

  it("T22: várias lojas sem localização principal → aviso para definir uma vez (sem seletor de loja)", async () => {
    const confirmReview = vi.fn(async () => {
      throw new ApiError("Há várias lojas ativas e nenhuma localização principal do Stock", 400, { error: "Há várias lojas ativas e nenhuma localização principal do Stock — defina-a" });
    });
    renderView({ getReview: async () => review({ status: "ready", lines: [line({ resolutionType: "no_stock_effect" })] }), confirmReview });
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar — não afeta Stock" }));
    expect(await screen.findByRole("button", { name: "Definir localização principal" })).toBeTruthy();
    expect(screen.queryByText(/Loja \(obrigatório\)/)).toBeNull();
  });
});

describe("StockPurchaseReviewDetailView — progresso da conciliação", () => {
  const lines = [
    line({ id: "a", resolutionType: "existing_item", stockItemId: "item-farinha", conversionFactor: 25, stockQuantity: 300 }),
    line({ id: "b", resolutionType: "existing_item", stockItemId: "item-farinha", conversionFactor: 25, stockQuantity: 300 }),
    line({ id: "c", description: "Por associar" }),
    line({ id: "d", description: "DEPOSITO 28 X 0.10 EUR", resolutionType: "no_stock_effect" }),
  ];

  it("2/4 resolvidas, 1 por resolver, 1 fora do Stock; a legenda filtra a lista e volta a mostrar tudo", async () => {
    renderView({ getReview: async () => review({ lines }) });
    const card = await screen.findByRole("region", { name: "Progresso da conciliação" });
    expect(card.textContent).toMatch(/2\s*\/\s*4\s*linhas resolvidas/);
    expect(card.textContent).toMatch(/Falta 1 linha/);
    expect(screen.getByRole("img", { name: /2 resolvidas, 1 por resolver e 1 fora do Stock/ })).toBeTruthy();
    const outButton = within(card).getByRole("button", { name: /1\s*Fora do Stock/ });
    fireEvent.click(outButton);
    expect(outButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("DEPOSITO 28 X 0.10 EUR")).toBeTruthy();
    expect(screen.queryByText("Por associar")).toBeNull();
    fireEvent.click(outButton);
    expect(screen.getByText("Por associar")).toBeTruthy();
  });

  it("sem linhas por resolver: «Tudo conciliado»", async () => {
    renderView({ getReview: async () => review({ status: "ready", lines: [lines[0]!, lines[3]!] }) });
    expect(await screen.findByText("Tudo conciliado")).toBeTruthy();
  });
});

describe("StockPurchaseReviewDetailView (F3b — conciliação e fila)", () => {
  const proposal = (over: Partial<NonNullable<StockReviewLineDTO["suggestion"]>> = {}) => ({
    source: "ai" as const, resolution: "existing_item" as const, stockItemId: "item-farinha", conversionFactor: 25, confidence: 0.92, packagingChanged: false, ...over,
  });

  it("ao abrir procura conciliações; «Confirmar» na linha; a proposta mostra artigo, fator e origem e «Aceitar» resolve", async () => {
    const suggestMappings = vi.fn(async () => review({ lines: [line({ suggestion: proposal() })] }));
    const resolveLine = vi.fn(async () => review());
    renderView({ getReview: async () => review(), suggestMappings, resolveLine });
    await waitFor(() => expect(suggestMappings).toHaveBeenCalledWith("r1", { refresh: false }));
    expect(await screen.findByText("Confirmar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rever" }));
    await waitFor(() => expect(screen.getByText(/Farinha T65 · fator 25/)).toBeTruthy());
    expect(screen.getByText(/IA 92%/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await waitFor(() => expect(resolveLine).toHaveBeenCalledWith("r1", "l1", expect.objectContaining({ resolution: "existing_item", stockItemId: "item-farinha", conversionFactor: 25 })));
  });

  it("proposta sem fator não pode ser aceite diretamente (só «Ajustar»)", async () => {
    renderView({ getReview: async () => review({ lines: [line({ suggestion: proposal({ conversionFactor: null, source: "name_match", confidence: 0.8 }) })] }) });
    fireEvent.click(await screen.findByRole("button", { name: "Rever" }));
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

describe("StockPurchaseReviewDetailView (V5 — ordem, filtros e agrupamento só no ecrã)", () => {
  it("Stock → Por rever → Fora do Stock; filtros com contagens; Cheddar de dois lotes numa linha com as duas por baixo", async () => {
    const r = review({
      lines: [
        line({ id: "d", description: "Portes", resolutionType: "no_stock_effect", totalWithVat: 615 }),
        line({ id: "b", description: "Produto novo" }),
        line({ id: "ch1", description: "Q. Cheddar Ralado kg", purchaseUnit: "un", purchaseQuantity: 6, resolutionType: "existing_item", stockItemId: "item-cheddar", conversionFactor: 1000, stockQuantity: 6000, netAmount: 4674, autoResolved: true }),
        line({ id: "ch2", description: "Q. Cheddar Ralado kg", purchaseUnit: "un", purchaseQuantity: 1, resolutionType: "existing_item", stockItemId: "item-cheddar", conversionFactor: 1000, stockQuantity: 1000, netAmount: 779 }),
      ],
    });
    renderView({ getReview: async () => r, listStockItemOptions: async () => [{ id: "item-cheddar", name: "Cheddar Ralado", baseUnit: "g", categoryId: "c", isActive: true }] });
    // Total faturado na lista; «6 + 1» e cada lote só no painel.
    expect(await screen.findByText("7 kg")).toBeTruthy();
    expect(screen.queryByText(/6 + 1/)).toBeNull();
    expect(screen.getByText("2 lotes")).toBeTruthy();
    expect(screen.getByText("7000 g")).toBeTruthy();
    expect(screen.getByText(/54,53\s€/)).toBeTruthy();
    expect(screen.getByText(/2 linhas da fatura/)).toBeTruthy();
    const states = within(screen.getByRole("region", { name: "Linhas da fatura" })).getAllByText(/^(Resolvido|Por rever|Fora do Stock)$/, { selector: "span" }).map((el) => el.textContent);
    expect(states).toEqual(["Resolvido", "Por rever", "Fora do Stock"]);
    fireEvent.click(screen.getByRole("tab", { name: /Fora do Stock/ }));
    expect(screen.getByText("Portes")).toBeTruthy();
    expect(screen.queryByText("7 kg")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Todos/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ver" })[0]!);
    expect(screen.getByText("Associado automaticamente")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Alterar" })).toHaveLength(2);
  });
});

describe("conversão errada com a fatura em kg (Cheddar «…Ralado kg», 1 kg = 1 g)", () => {
  it("mostra o aviso e corrige num clique para 1 kg = 1000 g, mantendo artigo e destino", async () => {
    const cheddar = line({
      description: "Q. Cheddar Ralado kg", purchaseQuantity: 6, purchaseUnit: "un", supplierItemCode: "020051000R",
      resolutionType: "existing_item", stockItemId: "item-cheddar", conversionFactor: 1, stockQuantity: 6, locationId: "loc-1",
    });
    const resolveLine = vi.fn(async () => review({ lines: [{ ...cheddar, conversionFactor: 1000, stockQuantity: 6000 }] }));
    renderView({
      getReview: async () => review({ lines: [cheddar] }),
      listStockItemOptions: async () => [{ id: "item-cheddar", name: "Cheddar Ralado", baseUnit: "g", categoryId: "c", isActive: true }],
      resolveLine,
    });
    fireEvent.click(await screen.findByRole("button", { name: "Ver" }));
    expect(await screen.findByText(/A fatura conta em/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Corrigir: 1 kg = 1000 g" }));
    await waitFor(() =>
      expect(resolveLine).toHaveBeenCalledWith("r1", "l1", expect.objectContaining({ resolution: "existing_item", stockItemId: "item-cheddar", conversionFactor: 1000, locationId: "loc-1" })),
    );
  });
});

describe("V5 — ver a fatura e conferir como aparece na fatura", () => {
  it("botão «Ver fatura» abre o PDF; sem PDF fica indicado", async () => {
    renderView({ getReview: async () => review({ attachmentUrl: "https://exemplo.invalid/fatura.pdf" }) });
    const link = await screen.findByRole("link", { name: "Ver fatura" });
    expect(link.getAttribute("href")).toBe("https://exemplo.invalid/fatura.pdf");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("sem PDF: «Sem PDF da fatura»; coluna «Na fatura» com a embalagem escrita na descrição", async () => {
    renderView({ getReview: async () => review({ attachmentUrl: null, lines: [line({ description: "Tomate Mutti p/ Pizza Classico 5 kg bolsa", purchaseQuantity: 4, purchaseUnit: "un" })] }) });
    expect(await screen.findByText("Sem PDF da fatura")).toBeTruthy();
    expect(screen.getByText("Na fatura")).toBeTruthy();
    expect(screen.getByText("4 bolsas × 5 kg = 20 kg")).toBeTruthy();
  });
});
