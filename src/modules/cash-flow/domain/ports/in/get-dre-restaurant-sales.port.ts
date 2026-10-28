import type { DreRestaurantSales } from "../../entities/dre.ts";

export interface GetDreRestaurantSalesPort {
  execute(year: number, month: number): Promise<DreRestaurantSales>;
}
