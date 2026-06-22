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
