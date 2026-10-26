import type {
  ArticlePurchaseDTO,
  CostOverviewResponseDTO,
  PurchasePresentationDTO,
  StockCategoryDTO,
  StockItemDTO,
  StockMovementDTO,
} from "../../entities/stock-catalog.ts";

export interface StockCatalogApiPort {
  listItems(): Promise<StockItemDTO[]>;
  listCategories(): Promise<StockCategoryDTO[]>;
  /** Custos de compra confirmados por artigo (último, referência, série semanal). */
  getCostOverview(): Promise<CostOverviewResponseDTO>;
  /** Embalagens de compra confirmadas de todos os fornecedores; [] sem permissão. */
  listPresentations(): Promise<PurchasePresentationDTO[]>;
  listMovements(stockItemId: string, limit?: number): Promise<StockMovementDTO[]>;
  /** Compras confirmadas do artigo (mais recentes primeiro). */
  listPurchases(stockItemId: string): Promise<ArticlePurchaseDTO[]>;
}
