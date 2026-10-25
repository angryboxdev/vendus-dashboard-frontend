export type SupplierStatus = "active" | "inactive";

/** Módulo Stock (Compra por rever) — só preferência complementar; nunca ignora uma classificação financeira explícita da categoria. */
export type DefaultStockPolicy = "inherit" | "usually_creates_review" | "usually_skips_review" | "decide_per_document";

/** Política «Enviar para Stock» da ficha (F2 v1.2 §2.1). */
export const DEFAULT_STOCK_POLICY_LABELS: Record<DefaultStockPolicy, string> = {
  inherit: "Seguir a subcategoria",
  usually_creates_review: "Enviar por defeito",
  usually_skips_review: "Não enviar",
  decide_per_document: "Decidir no documento",
};

/** Modo de classificação financeira (F2 §2.2). */
export type FinancialMode = "single" | "by_item" | "by_values";
// Ordem de apresentação: «Por artigo» primeiro (modo por omissão com linhas lidas), depois «Única».
export const FINANCIAL_MODE_LABELS: Record<FinancialMode, string> = {
  by_item: "Por artigo",
  single: "Única",
  by_values: "Por valores",
};

/** Exceção por loja da ficha do fornecedor (prevalece sobre a regra geral para essa loja). */
export interface SupplierLocationRule {
  id: string;
  supplierId: string;
  locationId: string;
  stockPolicy: DefaultStockPolicy | null;
  costCenterGroupId: string | null;
  costCenterCategoryId: string | null;
  updatedAt: string;
}

export interface UpsertSupplierLocationRulePayload {
  stockPolicy?: DefaultStockPolicy | null;
  costCenterGroupId?: string | null;
  costCenterCategoryId?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  iban: string | null;
  defaultCostCenterGroupId: string | null;
  defaultCostCenterCategoryId: string | null;
  paymentTermsDays: number | null;
  notes: string | null;
  status: SupplierStatus;
  defaultStockPolicy: DefaultStockPolicy;
  defaultFinancialType?: string | null;
  /** Modo financeiro preferido (fornecedor misto pode preferir «Por valores»). */
  defaultFinancialMode?: FinancialMode | null;
  /** Destino habitual — uma loja concreta, nunca «todas». */
  defaultLocationId?: string | null;
  /** Logótipo (proposto a partir de uma fatura e confirmado pela pessoa). */
  logoUrl?: string | null;
  /** Encomenda mínima configurada (euros); `null` = sem mínimo. */
  minOrderValue?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierStats {
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  lastInvoiceDate: string | null;
  lastPaymentDate: string | null;
}

export interface SupplierWithStats extends Supplier {
  stats: SupplierStats;
}

export interface SupplierInvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  totalWithoutVat: number;
  vatAmount: number;
  totalWithVat: number;
  documentType: string;
  status: string;
  paidAt: string | null;
  attachmentUrl: string | null;
}

/** «Artigos principais» do fornecedor (onde mais se gastou). */
export interface SupplierTopItem {
  key: string;
  name: string;
  code: string | null;
  stockItemId: string | null;
  lastPurchaseDate: string;
  /** Preço unitário sem IVA da compra mais recente. */
  lastUnitPrice: number;
  totalSpent: number;
  purchaseCount: number;
}

export interface SupplierDetail extends Supplier {
  stats: SupplierStats;
  invoices: SupplierInvoiceRow[];
  /** Opcional: um backend anterior a esta versão não o envia. */
  topItems?: SupplierTopItem[];
}

export interface SuppliersKpis {
  totalActive: number;
  totalInactive: number;
  totalWithPending: number;
  totalBilledAll: number;
}

export interface CreateSupplierPayload {
  name: string;
  nif?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  iban?: string | null;
  defaultCostCenterGroupId?: string | null;
  defaultCostCenterCategoryId?: string | null;
  paymentTermsDays?: number | null;
  notes?: string | null;
  defaultStockPolicy?: DefaultStockPolicy;
  defaultFinancialType?: string | null;
  defaultFinancialMode?: FinancialMode | null;
  defaultLocationId?: string | null;
  logoUrl?: string | null;
  minOrderValue?: number | null;
}

export interface UpdateSupplierPayload {
  name?: string;
  nif?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  iban?: string | null;
  defaultCostCenterGroupId?: string | null;
  defaultCostCenterCategoryId?: string | null;
  paymentTermsDays?: number | null;
  notes?: string | null;
  defaultStockPolicy?: DefaultStockPolicy;
  defaultFinancialType?: string | null;
  defaultFinancialMode?: FinancialMode | null;
  defaultLocationId?: string | null;
  logoUrl?: string | null;
  minOrderValue?: number | null;
}
