export type CostCenterStatus = "active" | "inactive";

export type CostCenterCategory =
  | "administration"
  | "operations"
  | "marketing"
  | "logistics"
  | "hr"
  | "technology"
  | "finance"
  | "real_estate"
  | "app_delivery"
  | "other";

export const CATEGORY_LABELS: Record<CostCenterCategory, string> = {
  administration: "Administração",
  operations: "Operações",
  marketing: "Marketing",
  logistics: "Logística",
  hr: "Recursos Humanos",
  technology: "Tecnologia",
  finance: "Finanças",
  real_estate: "Rendas/Imóveis",
  app_delivery: "App Delivery",
  other: "Outro",
};

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  category: CostCenterCategory;
  subcategory: string | null;
  description: string | null;
  responsibleName: string | null;
  status: CostCenterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCostCenterPayload {
  code: string;
  name: string;
  category: CostCenterCategory;
  subcategory?: string | null;
  description?: string | null;
  responsibleName?: string | null;
}

export interface UpdateCostCenterPayload {
  name?: string;
  category?: CostCenterCategory;
  subcategory?: string | null;
  description?: string | null;
  responsibleName?: string | null;
}
