import { apiGet, apiGetBlob, apiPost, apiPatch } from "../../../../lib/api.ts";
import type {
  FinancialBaseApiPort,
  ListCostCenterGroupsParams,
  ListCostCenterCategoriesParams,
  ListSuppliersParams,
} from "../../domain/ports/out/financial-base-api.port.ts";
import type {
  CostCenterGroup,
  CostCenterCategory,
  CreateCostCenterGroupPayload,
  UpdateCostCenterGroupPayload,
  CreateCostCenterCategoryPayload,
  UpdateCostCenterCategoryPayload,
  SeedResult,
  ChannelDTO,
} from "../../domain/entities/cost-center.ts";
import type {
  Supplier,
  SupplierWithStats,
  SupplierDetail,
  CreateSupplierPayload,
  UpdateSupplierPayload,
} from "../../domain/entities/supplier.ts";

const BASE = "/api/financial-base";

export class HttpFinancialBaseApiAdapter implements FinancialBaseApiPort {
  // ── Cost Center Groups ──────────────────────────────────────────────────────

  async listCostCenterGroups(params?: ListCostCenterGroupsParams): Promise<CostCenterGroup[]> {
    const q = new URLSearchParams();
    if (params?.isActive !== undefined) q.set("isActive", String(params.isActive));
    const qs = q.toString();
    return apiGet(`${BASE}/cost-center-groups${qs ? `?${qs}` : ""}`);
  }

  async getCostCenterGroup(id: string): Promise<CostCenterGroup> {
    return apiGet(`${BASE}/cost-center-groups/${encodeURIComponent(id)}`);
  }

  async createCostCenterGroup(payload: CreateCostCenterGroupPayload): Promise<CostCenterGroup> {
    return apiPost(`${BASE}/cost-center-groups`, payload);
  }

  async updateCostCenterGroup(id: string, payload: UpdateCostCenterGroupPayload): Promise<CostCenterGroup> {
    return apiPatch(`${BASE}/cost-center-groups/${encodeURIComponent(id)}`, payload);
  }

  async setCostCenterGroupStatus(id: string, isActive: boolean): Promise<CostCenterGroup> {
    return apiPatch(`${BASE}/cost-center-groups/${encodeURIComponent(id)}/status`, { isActive });
  }

  // ── Cost Center Categories ──────────────────────────────────────────────────

  async listCostCenterCategories(params?: ListCostCenterCategoriesParams): Promise<CostCenterCategory[]> {
    const q = new URLSearchParams();
    if (params?.groupId) q.set("groupId", params.groupId);
    if (params?.isActive !== undefined) q.set("isActive", String(params.isActive));
    const qs = q.toString();
    return apiGet(`${BASE}/cost-center-categories${qs ? `?${qs}` : ""}`);
  }

  async getCostCenterCategory(id: string): Promise<CostCenterCategory> {
    return apiGet(`${BASE}/cost-center-categories/${encodeURIComponent(id)}`);
  }

  async createCostCenterCategory(payload: CreateCostCenterCategoryPayload): Promise<CostCenterCategory> {
    return apiPost(`${BASE}/cost-center-categories`, payload);
  }

  async updateCostCenterCategory(id: string, payload: UpdateCostCenterCategoryPayload): Promise<CostCenterCategory> {
    return apiPatch(`${BASE}/cost-center-categories/${encodeURIComponent(id)}`, payload);
  }

  async setCostCenterCategoryStatus(id: string, isActive: boolean): Promise<CostCenterCategory> {
    return apiPatch(`${BASE}/cost-center-categories/${encodeURIComponent(id)}/status`, { isActive });
  }

  async seedDefaultCostCenters(): Promise<SeedResult> {
    return apiPost(`${BASE}/cost-centers/seed`, {});
  }

  // ── Suppliers ───────────────────────────────────────────────────────────────

  async listSuppliers(params?: ListSuppliersParams): Promise<Supplier[]> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return apiGet(`${BASE}/suppliers${qs ? `?${qs}` : ""}`);
  }

  async listSuppliersWithStats(params?: ListSuppliersParams): Promise<SupplierWithStats[]> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    q.set("includeStats", "true");
    return apiGet(`${BASE}/suppliers?${q.toString()}`);
  }

  async getSupplier(id: string): Promise<Supplier> {
    return apiGet(`${BASE}/suppliers/${encodeURIComponent(id)}`);
  }

  async getSupplierDetail(id: string): Promise<SupplierDetail> {
    return apiGet(`${BASE}/suppliers/${encodeURIComponent(id)}/detail`);
  }

  async createSupplier(payload: CreateSupplierPayload): Promise<Supplier> {
    return apiPost(`${BASE}/suppliers`, payload);
  }

  async updateSupplier(id: string, payload: UpdateSupplierPayload): Promise<Supplier> {
    return apiPatch(`${BASE}/suppliers/${encodeURIComponent(id)}`, payload);
  }

  async setSupplierStatus(id: string, status: "active" | "inactive"): Promise<Supplier> {
    return apiPatch(`${BASE}/suppliers/${encodeURIComponent(id)}/status`, { status });
  }

  async downloadSupplierStatement(id: string, params?: { startDate?: string; endDate?: string }): Promise<void> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set("startDate", params.startDate);
    if (params?.endDate) q.set("endDate", params.endDate);
    const qs = q.toString();
    const blob = await apiGetBlob(`${BASE}/suppliers/${encodeURIComponent(id)}/statement-pdf${qs ? `?${qs}` : ""}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-fornecedor.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Channels ─────────────────────────────────────────────────────────────────

  async listChannels(): Promise<ChannelDTO[]> {
    return apiGet(`${BASE}/channels`);
  }
}
