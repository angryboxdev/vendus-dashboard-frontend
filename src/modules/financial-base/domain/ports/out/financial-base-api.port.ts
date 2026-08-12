import type {
  CostCenterGroup,
  CostCenterCategory,
  CreateCostCenterGroupPayload,
  UpdateCostCenterGroupPayload,
  CreateCostCenterCategoryPayload,
  UpdateCostCenterCategoryPayload,
  SeedResult,
  ChannelDTO,
} from "../../entities/cost-center.ts";
import type {
  Supplier,
  SupplierWithStats,
  SupplierDetail,
  CreateSupplierPayload,
  UpdateSupplierPayload,
} from "../../entities/supplier.ts";

export interface ListCostCenterGroupsParams {
  isActive?: boolean;
}

export interface ListCostCenterCategoriesParams {
  groupId?: string;
  isActive?: boolean;
}

export interface ListSuppliersParams {
  status?: "active" | "inactive";
  search?: string;
}

export interface FinancialBaseApiPort {
  // Cost Center Groups
  listCostCenterGroups(params?: ListCostCenterGroupsParams): Promise<CostCenterGroup[]>;
  getCostCenterGroup(id: string): Promise<CostCenterGroup>;
  createCostCenterGroup(payload: CreateCostCenterGroupPayload): Promise<CostCenterGroup>;
  updateCostCenterGroup(id: string, payload: UpdateCostCenterGroupPayload): Promise<CostCenterGroup>;
  setCostCenterGroupStatus(id: string, isActive: boolean): Promise<CostCenterGroup>;

  // Cost Center Categories
  listCostCenterCategories(params?: ListCostCenterCategoriesParams): Promise<CostCenterCategory[]>;
  getCostCenterCategory(id: string): Promise<CostCenterCategory>;
  createCostCenterCategory(payload: CreateCostCenterCategoryPayload): Promise<CostCenterCategory>;
  updateCostCenterCategory(id: string, payload: UpdateCostCenterCategoryPayload): Promise<CostCenterCategory>;
  setCostCenterCategoryStatus(id: string, isActive: boolean): Promise<CostCenterCategory>;
  seedDefaultCostCenters(): Promise<SeedResult>;

  // Suppliers
  listSuppliers(params?: ListSuppliersParams): Promise<Supplier[]>;
  listSuppliersWithStats(params?: ListSuppliersParams): Promise<SupplierWithStats[]>;
  getSupplier(id: string): Promise<Supplier>;
  getSupplierDetail(id: string): Promise<SupplierDetail>;
  createSupplier(payload: CreateSupplierPayload): Promise<Supplier>;
  updateSupplier(id: string, payload: UpdateSupplierPayload): Promise<Supplier>;
  setSupplierStatus(id: string, status: "active" | "inactive"): Promise<Supplier>;
  downloadSupplierStatement(id: string, params?: { startDate?: string; endDate?: string }): Promise<void>;

  // Channels
  listChannels(): Promise<ChannelDTO[]>;
}
