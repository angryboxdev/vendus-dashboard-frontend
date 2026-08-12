export type SupplierStatus = "active" | "inactive";

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
