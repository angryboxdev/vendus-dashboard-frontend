/**
 * Custo real da comida e da embalagem do delivery — contrato de `GET /api/delivery-platforms/food-cost`
 * e `PUT /api/delivery-platforms/product-mappings` (backend `delivery-platforms`, F5). Cêntimos, sem IVA.
 */
export type ProductTargetType = "dish" | "item" | "upgrade_large" | "ignore";
export type PackagingKey = "@box_small" | "@box_large" | "@bag" | "@napkin";

export interface ResolvedTarget {
  targetType: ProductTargetType;
  pizzaId: string | null;
  size: string | null;
  stockItemId: string | null;
  label: string;
  /** `manual` = gravado; `auto` = sugerido pelo nome. */
  source: "manual" | "auto";
}

export interface FoodCostLine {
  productKey: string;
  code: string;
  description: string;
  quantity: number;
  netCents: number;
  target: ResolvedTarget | null;
  unitCostCents: number | null;
  costCents: number | null;
  complete: boolean;
}

export interface PackagingLine {
  key: PackagingKey;
  label: string;
  item: { stockItemId: string; name: string; source: "manual" | "auto" } | null;
  quantity: number;
  unitCostCents: number | null;
  costCents: number | null;
}

export interface FoodCost {
  period: { year: number; month: number; from: string; to: string };
  hasProducts: boolean;
  ordersCount: number;
  revenueNetCents: number;
  costedRevenueNetCents: number;
  productsCostCents: number;
  extrapolatedCostCents: number;
  packagingCostCents: number;
  totalCostCents: number;
  foodCostPct: number | null;
  complete: boolean;
  lines: FoodCostLine[];
  packaging: PackagingLine[];
  targets: { dishes: { pizzaId: string; name: string }[]; items: { stockItemId: string; name: string }[] };
  warnings: string[];
}

/** Uma correção; `targetType: null` volta à sugestão automática. */
export interface ProductMappingChange {
  productKey: string;
  productCode: string | null;
  productDescription: string;
  targetType: ProductTargetType | null;
  pizzaId?: string | null;
  size?: string | null;
  stockItemId?: string | null;
}
