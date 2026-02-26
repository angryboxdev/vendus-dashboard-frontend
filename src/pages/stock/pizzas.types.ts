export type PizzaCategory = "classics" | "specials" | "sweeties";
export type PizzaSize = "small" | "large";

export type Pizza = {
  id: string;
  name: string;
  description: string;
  category: PizzaCategory;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PizzaPrice = {
  id: string;
  pizza_id: string;
  size: PizzaSize;
  price: number;
  created_at?: string;
  updated_at?: string;
};

export type PizzaRecipe = {
  id: string;
  pizza_id: string;
  version: number;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PizzaRecipeItem = {
  id: string;
  recipe_id: string;
  stock_item_id: string;
  size: PizzaSize;
  quantity: number;
  waste_factor: number | null;
  is_optional: boolean;
  created_at?: string;
};

export const PIZZA_CATEGORY_LABELS: Record<PizzaCategory, string> = {
  classics: "Clássicas",
  specials: "Especiais",
  sweeties: "Doces",
};

export const PIZZA_SIZE_LABELS: Record<PizzaSize, string> = {
  small: "Pequena",
  large: "Grande",
};
