/**
 * Fichas técnicas (V7): pratos, receitas e preparações tal como os endpoints existentes os devolvem
 * (`/api/pizzas`, `/api/preparations`). Os nomes internos continuam «pizza» na API; a interface diz
 * «prato» para servir qualquer restaurante, bar ou café.
 */

/** Variante de um prato. XS só nas doces: exatamente metade da Pequena. */
export type Variant = "xs" | "small" | "large";
export const VARIANTS: Variant[] = ["xs", "small", "large"];
export const VARIANT_LABELS: Record<string, string> = { xs: "XS", small: "Pequena", large: "Grande" };

export type DishCategory = "classics" | "specials" | "sweeties";
export const DISH_CATEGORY_LABELS: Record<string, string> = { classics: "Clássicas", specials: "Especiais", sweeties: "Doces" };

export interface DishDTO {
  id: string;
  name: string;
  description: string;
  category: DishCategory;
  is_active: boolean;
}

export interface DishPriceDTO {
  id: string;
  pizza_id: string;
  size: Variant;
  price: number;
}

export interface RecipeDTO {
  id: string;
  pizza_id: string;
  version: number;
  is_active: boolean;
  notes: string | null;
}

export interface RecipeItemDTO {
  id: string;
  recipe_id: string;
  stock_item_id: string | null;
  preparation_id: string | null;
  size: Variant;
  quantity: number;
  waste_factor: number | null;
}

export interface PreparationDTO {
  id: string;
  name: string;
  description: string | null;
  yield_qty: number;
  yield_unit: string;
  use_as_unit: boolean;
  is_active: boolean;
}

export interface PreparationItemDTO {
  id: string;
  preparation_id: string;
  stock_item_id: string;
  quantity: number;
}

export interface StockItemOptionDTO {
  id: string;
  name: string;
  base_unit: string;
  is_active: boolean;
}

/** Componente da ficha: artigo do stock ou preparação (mutuamente exclusivos). */
export type ComponentRef = { stock_item_id: string } | { preparation_id: string };
