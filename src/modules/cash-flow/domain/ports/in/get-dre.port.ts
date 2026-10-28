import type { DreReport } from "../../entities/dre.ts";

export interface GetDrePort {
  /** `withRestaurantSales: false` → rápido, sem as vendas do Vendus. */
  execute(year: number, month: number, withRestaurantSales?: boolean): Promise<DreReport>;
}
