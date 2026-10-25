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
  SupplierPlanningSummary,
  CreateSupplierPayload,
  UpdateSupplierPayload,
  SupplierLocationRule,
  UpsertSupplierLocationRulePayload,
} from "../../entities/supplier.ts";
import type {
  SupplierDeliveryScheduleDTO,
  UpsertSupplierDeliverySchedulePayload,
} from "../../entities/supplier-delivery-schedule.ts";

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
  getSupplierPlanningSummary(id: string): Promise<SupplierPlanningSummary>;
  createSupplier(payload: CreateSupplierPayload): Promise<Supplier>;
  updateSupplier(id: string, payload: UpdateSupplierPayload): Promise<Supplier>;
  /** Um lote de fornecedores sem logótipo: tira-o das faturas (PDF) e grava; repetir com `next` até `null`. */
  fillSupplierLogos(after?: string): Promise<{ processed: number; filled: number; next: string | null }>;
  setSupplierStatus(id: string, status: "active" | "inactive"): Promise<Supplier>;
  downloadSupplierStatement(
    id: string,
    params?: { startDate?: string; endDate?: string; openingBalance?: string; informedFinalBalance?: string },
  ): Promise<void>;

  // Channels
  listChannels(): Promise<ChannelDTO[]>;

  // Delivery schedule (módulo Stock — Planeamento, D10)
  listSupplierDeliverySchedules(supplierId: string): Promise<SupplierDeliveryScheduleDTO[]>;
  // Exceções por loja (F2 v1.2 §2.1)
  listSupplierLocationRules(supplierId: string): Promise<SupplierLocationRule[]>;
  upsertSupplierLocationRule(supplierId: string, locationId: string, payload: UpsertSupplierLocationRulePayload): Promise<SupplierLocationRule>;
  deleteSupplierLocationRule(supplierId: string, locationId: string): Promise<void>;
  upsertSupplierDeliverySchedule(supplierId: string, payload: UpsertSupplierDeliverySchedulePayload): Promise<SupplierDeliveryScheduleDTO>;
}
