// ── Groups ────────────────────────────────────────────────────────────────────

export interface CostCenterGroup {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCostCenterGroupPayload {
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateCostCenterGroupPayload {
  name?: string;
  description?: string | null;
  sortOrder?: number;
}

// ── Categories ────────────────────────────────────────────────────────────────

export type FinancialType =
  | "cmv"
  | "variable_cost"
  | "fixed_opex"
  | "personnel"
  | "administrative"
  | "marketing"
  | "financial"
  | "capex"
  | "fiscal"
  | "off_dre"
  | "internal_transfer"
  | "transitory";

export const FINANCIAL_TYPE_LABELS: Record<FinancialType, string> = {
  cmv:               "CMV",
  variable_cost:     "Custo variável",
  fixed_opex:        "OPEX fixo",
  personnel:         "Pessoal",
  administrative:    "Administrativo",
  marketing:         "Marketing",
  financial:         "Financeiro",
  capex:             "CAPEX",
  fiscal:            "Fiscal",
  off_dre:           "Fora da DRE",
  internal_transfer: "Transf. interna",
  transitory:        "Transitório",
};

export const FINANCIAL_TYPE_COLORS: Record<FinancialType, string> = {
  cmv:               "bg-orange-50 text-orange-700",
  variable_cost:     "bg-amber-50 text-amber-700",
  fixed_opex:        "bg-stone-100 text-stone-700",
  personnel:         "bg-pink-50 text-pink-700",
  administrative:    "bg-blue-50 text-blue-700",
  marketing:         "bg-purple-50 text-purple-700",
  financial:         "bg-cyan-50 text-cyan-700",
  capex:             "bg-yellow-50 text-yellow-700",
  fiscal:            "bg-indigo-50 text-indigo-700",
  off_dre:           "bg-stone-100 text-stone-500",
  internal_transfer: "bg-stone-50 text-stone-500",
  transitory:        "bg-stone-50 text-stone-400",
};

export interface CostCenterCategory {
  id: string;
  groupId: string;
  code: string;
  name: string;
  financialType: FinancialType;
  affectsDre: boolean;
  affectsCashflow: boolean;
  affectsProfitability: boolean;
  requiresChannel: boolean;
  requiresAllocation: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCostCenterCategoryPayload {
  groupId: string;
  code: string;
  name: string;
  financialType: FinancialType;
  affectsDre: boolean;
  affectsCashflow: boolean;
  affectsProfitability: boolean;
  requiresChannel?: boolean;
  requiresAllocation?: boolean;
  description?: string | null;
}

export interface UpdateCostCenterCategoryPayload {
  name?: string;
  financialType?: FinancialType;
  affectsDre?: boolean;
  affectsCashflow?: boolean;
  affectsProfitability?: boolean;
  requiresChannel?: boolean;
  requiresAllocation?: boolean;
  description?: string | null;
}

export interface SeedResult {
  groupsCreated: number;
  categoriesCreated: number;
  groupsSkipped: number;
  categoriesSkipped: number;
}
