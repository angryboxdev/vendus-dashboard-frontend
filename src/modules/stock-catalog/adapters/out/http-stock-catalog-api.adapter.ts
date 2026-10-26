import { apiGet } from "../../../../lib/api.ts";
import type {
  ArticlePurchaseDTO,
  CostOverviewResponseDTO,
  PurchasePresentationDTO,
  StockCategoryDTO,
  StockItemDTO,
  StockMovementDTO,
} from "../../domain/entities/stock-catalog.ts";
import type { StockCatalogApiPort } from "../../domain/ports/out/stock-catalog-api.port.ts";

export class HttpStockCatalogApiAdapter implements StockCatalogApiPort {
  listItems(): Promise<StockItemDTO[]> {
    return apiGet<StockItemDTO[]>("/api/stock/items");
  }

  listCategories(): Promise<StockCategoryDTO[]> {
    return apiGet<StockCategoryDTO[]>("/api/stock/categories");
  }

  getCostOverview(): Promise<CostOverviewResponseDTO> {
    return apiGet<CostOverviewResponseDTO>("/api/recipe-costing/ingredients/overview?weeks=12");
  }

  async listPresentations(): Promise<PurchasePresentationDTO[]> {
    // A Reposição funciona sem embalagens (fica «Por confirmar»): sem permissão de Compras por rever, lista vazia.
    try {
      return await apiGet<PurchasePresentationDTO[]>("/api/stock-purchase-reviews/presentations");
    } catch {
      return [];
    }
  }

  listMovements(stockItemId: string, limit = 50): Promise<StockMovementDTO[]> {
    return apiGet<StockMovementDTO[]>(`/api/stock/items/${stockItemId}/movements?limit=${limit}`);
  }


  async listPurchases(stockItemId: string): Promise<ArticlePurchaseDTO[]> {
    const history = await apiGet<{ weeks: { observations: ArticlePurchaseDTO[] }[] }>(`/api/recipe-costing/ingredients/${stockItemId}/price-history?weeks=104`);
    return history.weeks.flatMap((w) => w.observations).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  }
}
