import { apiGet, apiPost, apiPatch } from "../../../../lib/api.ts";
import type { FinancialBaseApiPort, ListCostCentersParams, ListSuppliersParams } from "../../domain/ports/out/financial-base-api.port.ts";
import type { CostCenter, CostCenterCategory, CreateCostCenterPayload, UpdateCostCenterPayload } from "../../domain/entities/cost-center.ts";
import type { Supplier, CreateSupplierPayload, UpdateSupplierPayload } from "../../domain/entities/supplier.ts";

const BASE = "/api/financial-base";

export class HttpFinancialBaseApiAdapter implements FinancialBaseApiPort {
  async listCostCenters(params?: ListCostCentersParams): Promise<CostCenter[]> {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return apiGet(`${BASE}/cost-centers${qs ? `?${qs}` : ""}`);
  }

  async getCostCenter(id: string): Promise<CostCenter> {
    return apiGet(`${BASE}/cost-centers/${encodeURIComponent(id)}`);
  }

  async createCostCenter(payload: CreateCostCenterPayload): Promise<CostCenter> {
    return apiPost(`${BASE}/cost-centers`, payload);
  }

  async updateCostCenter(id: string, payload: UpdateCostCenterPayload): Promise<CostCenter> {
    return apiPatch(`${BASE}/cost-centers/${encodeURIComponent(id)}`, payload);
  }

  async setCostCenterStatus(id: string, status: "active" | "inactive"): Promise<CostCenter> {
    return apiPatch(`${BASE}/cost-centers/${encodeURIComponent(id)}/status`, { status });
  }

  async listCategories(): Promise<CostCenterCategory[]> {
    return apiGet(`${BASE}/cost-centers/categories`);
  }

  async listSuppliers(params?: ListSuppliersParams): Promise<Supplier[]> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return apiGet(`${BASE}/suppliers${qs ? `?${qs}` : ""}`);
  }

  async getSupplier(id: string): Promise<Supplier> {
    return apiGet(`${BASE}/suppliers/${encodeURIComponent(id)}`);
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
}
