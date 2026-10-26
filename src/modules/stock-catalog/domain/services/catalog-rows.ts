import type {
  CatalogView,
  IngredientCostOverviewDTO,
  PurchasePresentationDTO,
  StockCategoryDTO,
  StockItemDTO,
  StockSituation,
} from "../entities/stock-catalog.ts";
import { deficit, presentationFor, replenishment, situation, type ReplenishmentSuggestion } from "./stock-rules.ts";

/** Uma linha da tabela única (as três vistas mostram colunas diferentes desta mesma linha). */
export interface CatalogRow {
  item: StockItemDTO;
  categoryName: string;
  situation: StockSituation;
  missing: number | null;
  suggestion: ReplenishmentSuggestion;
  cost: IngredientCostOverviewDTO | null;
  /** Custo manual do catálogo, em cêntimos por unidade base (métrica separada do custo de compra). */
  manualCents: number | null;
}

export function buildRows(items: StockItemDTO[], categories: StockCategoryDTO[], overview: IngredientCostOverviewDTO[], presentations: PurchasePresentationDTO[]): CatalogRow[] {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const cost = new Map(overview.map((o) => [o.stockItemId, o]));
  return items.map((item) => {
    const c = cost.get(item.id) ?? null;
    const missing = deficit(item);
    const manual = item.purchase_reference_unit_cost_without_vat;
    return {
      item,
      categoryName: cat.get(item.category_id) ?? "—",
      situation: situation(item),
      missing,
      suggestion: replenishment(missing, item.base_unit, presentationFor(item.id, c?.lastPurchase?.supplierId ?? null, presentations)),
      cost: c,
      manualCents: manual != null && manual > 0 ? manual * 100 : null,
    };
  });
}

export interface CatalogFilters {
  search: string;
  categoryId: string;
  type: string;
  /** "active" | "inactive" | "" (todos). */
  status: string;
  situation: "" | StockSituation | "attention";
}

export type SortKey = "name" | "stock" | "missing" | "cost" | "change" | "lastDate";

const RANK: Record<StockSituation, number> = { out: 0, below: 1, near: 2, no_data: 3, ok: 4, inactive: 5 };

export function filterRows(rows: CatalogRow[], f: CatalogFilters, view: CatalogView): CatalogRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !(r.item.name.toLowerCase().includes(q) || (r.item.sku ?? "").toLowerCase().includes(q))) return false;
    if (f.categoryId && r.item.category_id !== f.categoryId) return false;
    if (f.type && r.item.type !== f.type) return false;
    if (f.status === "active" && !r.item.is_active) return false;
    if (f.status === "inactive" && r.item.is_active) return false;
    if (f.situation === "attention" && !(r.situation === "out" || r.situation === "below" || r.situation === "near")) return false;
    if (f.situation && f.situation !== "attention" && r.situation !== f.situation) return false;
    // Reposição: só o que tem algo em falta (salvo se o filtro de situação pedir outra coisa).
    if (view === "replenishment" && !f.situation && !(r.missing && r.missing > 0)) return false;
    return true;
  });
}

export function sortRows(rows: CatalogRow[], key: SortKey, dir: "asc" | "desc", view: CatalogView): CatalogRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const val = (r: CatalogRow): number | string | null => {
    switch (key) {
      case "name": return r.item.name.toLowerCase();
      case "stock": return r.item.current_quantity ?? null;
      case "missing": return r.missing;
      case "cost": return r.cost?.lastPurchase?.centsPerUnit ?? null;
      case "change": return r.cost?.changeRatio ?? null;
      case "lastDate": return r.cost?.lastPurchase?.invoiceDate ?? null;
    }
  };
  return [...rows].sort((a, b) => {
    if (key === "name" && view !== "costs") {
      // Por omissão o que precisa de atenção aparece primeiro, depois por nome.
      const s = RANK[a.situation] - RANK[b.situation];
      if (dir === "asc" && s !== 0) return s;
    }
    const va = val(a), vb = val(b);
    if (va === null && vb === null) return a.item.name.localeCompare(b.item.name, "pt");
    if (va === null) return 1; // sem valor no fim, nos dois sentidos
    if (vb === null) return -1;
    if (typeof va === "string" && typeof vb === "string") return sign * va.localeCompare(vb, "pt");
    return sign * ((va as number) - (vb as number)) || a.item.name.localeCompare(b.item.name, "pt");
  });
}

export function paginate<T>(rows: T[], page: number, size: number): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((p - 1) * size, p * size), page: p, pages };
}
