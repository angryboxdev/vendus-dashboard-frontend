import type { StockBaseUnit, StockItemCreateBody } from "../stock.types";
import type { ReviewableInvoiceLine } from "./invoiceImport.types";

/** Mapeia unidade da fatura (ex. PC, KG) para `base_unit` do catálogo. */
export function mapInvoiceUnitToBaseUnit(unitRaw: string): StockBaseUnit {
  const u = (unitRaw || "").trim().toUpperCase().replace(/\./g, "");
  const map: Record<string, StockBaseUnit> = {
    PC: "un",
    UN: "un",
    PÇ: "un",
    PCS: "un",
    UNIT: "un",
    UNIDADE: "un",
    UND: "un",
    KG: "kg",
    G: "g",
    GR: "g",
    L: "l",
    LT: "l",
    LTR: "l",
    ML: "ml",
    CL: "cl",
  };
  return map[u] ?? "un";
}

/** Pré-preenche o formulário de novo item a partir de uma linha da importação. */
export function mapInvoiceLineToNewStockItemForm(
  line: ReviewableInvoiceLine,
  defaultCategoryId: string,
): StockItemCreateBody {
  const vat = line.vat_rate_pct ?? 0;
  const unitNet = line.unit_price;
  const withVat =
    unitNet > 0 && vat != null
      ? Math.round(unitNet * (1 + vat / 100) * 100) / 100
      : unitNet > 0
        ? unitNet
        : null;
  const withoutVat =
    unitNet > 0 ? Math.round(unitNet * 100) / 100 : null;

  return {
    name: (line.description || "").trim().slice(0, 500) || "Item",
    sku: null,
    category_id: defaultCategoryId,
    type: "ingredient",
    base_unit: mapInvoiceUnitToBaseUnit(line.unit),
    min_stock: 0,
    is_sellable: false,
    sale_price: null,
    is_active: true,
    purchase_reference_unit_cost_without_vat: withoutVat,
    purchase_reference_unit_cost_with_vat: withVat,
  };
}
