import type { CostCenter, CreateCostCenterPayload, UpdateCostCenterPayload, CostCenterCategory } from "../../entities/cost-center.ts";
import type { Supplier, CreateSupplierPayload, UpdateSupplierPayload } from "../../entities/supplier.ts";

export interface ListCostCentersParams {
  category?: CostCenterCategory;
  status?: "active" | "inactive";
}

export interface ListSuppliersParams {
  status?: "active" | "inactive";
  search?: string;
}

export interface FinancialBaseApiPort {
  // Cost Centers
  listCostCenters(params?: ListCostCentersParams): Promise<CostCenter[]>;
  getCostCenter(id: string): Promise<CostCenter>;
  createCostCenter(payload: CreateCostCenterPayload): Promise<CostCenter>;
  updateCostCenter(id: string, payload: UpdateCostCenterPayload): Promise<CostCenter>;
  setCostCenterStatus(id: string, status: "active" | "inactive"): Promise<CostCenter>;
  listCategories(): Promise<CostCenterCategory[]>;

  // Suppliers
  listSuppliers(params?: ListSuppliersParams): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier>;
  createSupplier(payload: CreateSupplierPayload): Promise<Supplier>;
  updateSupplier(id: string, payload: UpdateSupplierPayload): Promise<Supplier>;
  setSupplierStatus(id: string, status: "active" | "inactive"): Promise<Supplier>;
}
