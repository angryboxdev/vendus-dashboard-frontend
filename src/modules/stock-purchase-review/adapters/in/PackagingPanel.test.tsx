import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockPurchaseReviewProvider } from "../../stock-purchase-review.module.tsx";
import type { StockPurchaseReviewApiPort } from "../../domain/ports/out/stock-purchase-review-api.port.ts";
import type { PurchasePresentationDTO, StockPurchaseReviewDTO, StockReviewLineDTO } from "../../domain/entities/stock-purchase-review.ts";
import { PackagingPanel, guessPresentation } from "./PackagingPanel.tsx";

const line = (over: Partial<StockReviewLineDTO> = {}): StockReviewLineDTO => ({
  id: "l1", invoiceLineId: "il1", description: "Q. Mozzarella ralado 100% Eurial kg", purchaseQuantity: 20, purchaseUnit: "kg", unitCostWithoutVat: 620, totalWithVat: 11830,
  vatAmount: 670, netAmount: 11160, discountAmount: 1240, supplierItemCode: "44641004", costCenterCategoryId: null, locationSplits: null, suggestion: null,
  resolutionType: "unresolved", stockItemId: null, conversionFactor: null, stockQuantity: null, locationId: null,
  unitCostPerBaseUnitWithVat: null, unitCostPerBaseUnitWithoutVat: null, flaggedSuspiciousConversion: false, flagReason: null, resolvedBy: null, resolvedAt: null,
  ...over,
});
const review = { id: "r1", decisionSupplierId: "sup-dream", status: "in_review", version: 2 } as unknown as StockPurchaseReviewDTO;
const items = [{ id: "mozz", name: "Mozzarella ralada", baseUnit: "g", categoryId: "c", isActive: true }];
const presentation: PurchasePresentationDTO = {
  id: "p1", supplierId: "sup-dream", supplierReference: "44641004", description: "Q. Mozzarella ralado 100% Eurial kg", stockItemId: "mozz",
  packageUnit: "saco", contentQuantity: 2.5, contentUnit: "kg", invoicedBy: "content", minOrderPackages: 1, orderIncrementPackages: 1,
  source: "user", confidence: 1, createdBy: "x", createdAt: "2026-10-25T10:00:00Z", supersededAt: null,
};

function renderPanel(l: StockReviewLineDTO, api: Partial<StockPurchaseReviewApiPort> = {}, onSaved = vi.fn(), stockItemId: string | null = "mozz") {
  render(
    <StockPurchaseReviewProvider module={{ api: api as StockPurchaseReviewApiPort }}>
      <PackagingPanel review={review} line={l} stockItemId={stockItemId} stockItems={items} readOnly={false} onSaved={onSaved} />
    </StockPurchaseReviewProvider>,
  );
  return onSaved;
}

describe("PackagingPanel", () => {
  it("embalagem confirmada: fatura, 1 saco = 2,5 kg → 8 sacos, Stock +20 000 g e custos legíveis", () => {
    renderPanel(line({ packaging: { presentation, preview: null, baseUnit: "g" } }));
    expect(screen.getByText(/20 kg × 6,20\s€\/kg − 12,40\s€ desconto =/)).toBeTruthy();
    expect(screen.getByText("1 saco = 2,5 kg → 8 sacos")).toBeTruthy();
    expect(screen.getByText(/\+20 000 g/)).toBeTruthy();
    expect(screen.getByText(/5,58\s€\/kg · 13,95\s€\/saco/)).toBeTruthy();
  });

  it("por configurar: o editor propõe a partir da descrição, mostra as equivalências antes de gravar e grava a versão", async () => {
    const savePresentation = vi.fn(async () => presentation);
    const onSaved = renderPanel(line({ packaging: { presentation: null, preview: null, baseUnit: null } }), { savePresentation });
    expect(screen.getByText("Embalagem por configurar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.change(screen.getByLabelText("Conteúdo de cada embalagem"), { target: { value: "2,5" } });
    expect(screen.getByText("1 saco = 2,5 kg → 8 sacos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar embalagem" }));
    await waitFor(() => expect(savePresentation).toHaveBeenCalled());
    expect(savePresentation).toHaveBeenCalledWith(expect.objectContaining({ supplierId: "sup-dream", supplierReference: "44641004", stockItemId: "mozz", packageUnit: "saco", contentQuantity: 2.5, contentUnit: "kg", invoicedBy: "content" }));
    expect(onSaved).toHaveBeenCalledWith(1000);
  });

  it("sem artigo escolhido não grava; proposta inicial do tomate em sacos de 5 kg", async () => {
    const savePresentation = vi.fn();
    renderPanel(line({ packaging: { presentation: null, preview: null, baseUnit: null } }), { savePresentation }, vi.fn(), null);
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar embalagem" }));
    expect(await screen.findByText("Escolha primeiro o artigo de stock.")).toBeTruthy();
    expect(savePresentation).not.toHaveBeenCalled();
    expect(guessPresentation(line({ description: "Tomate Mutti p/ Pizza Classico 5 kg bolsa", purchaseUnit: "un" }))).toMatchObject({ packageUnit: "saco", contentQuantity: 5, contentUnit: "kg", invoicedBy: "package" });
  });
});
