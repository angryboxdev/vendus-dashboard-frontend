export type SupplierStatus = "active" | "inactive";

/** Módulo Stock (Compra por rever) — só preferência complementar; nunca ignora uma classificação financeira explícita da categoria. */
export type DefaultStockPolicy = "inherit" | "usually_creates_review" | "usually_skips_review";

export const DEFAULT_STOCK_POLICY_LABELS: Record<DefaultStockPolicy, string> = {
  inherit: "Seguir preferência da categoria",
  usually_creates_review: "Normalmente gera revisão de stock",
  usually_skips_review: "Normalmente não afeta stock",
};

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

export interface SupplierDetail extends Supplier {
  stats: SupplierStats;
  invoices: SupplierInvoiceRow[];
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
}
