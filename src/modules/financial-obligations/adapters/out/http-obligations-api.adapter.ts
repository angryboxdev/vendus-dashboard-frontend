import { apiGet, apiPost, apiPatch } from "../../../../lib/api.ts";
import type { ObligationsApiPort } from "../../domain/ports/out/obligations-api.port.ts";
import type {
  FinancialObligationDTO,
  CreateManualObligationPayload,
  MarkObligationAsPaidPayload,
  ListObligationsParams,
} from "../../domain/entities/financial-obligation.ts";

const BASE = "/api/financial-obligations";

export class HttpObligationsApiAdapter implements ObligationsApiPort {
  async listObligations(params?: ListObligationsParams): Promise<FinancialObligationDTO[]> {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.supplierId) q.set("supplierId", params.supplierId);
    if (params?.status) q.set("status", params.status);
    if (params?.source) q.set("source", params.source);
    const qs = q.toString();
    return apiGet(`${BASE}${qs ? `?${qs}` : ""}`);
  }

  async createManualObligation(payload: CreateManualObligationPayload): Promise<FinancialObligationDTO> {
    return apiPost(BASE, payload);
  }

  async markAsPaid(id: string, payload: MarkObligationAsPaidPayload): Promise<FinancialObligationDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/pay`, payload);
  }
}
