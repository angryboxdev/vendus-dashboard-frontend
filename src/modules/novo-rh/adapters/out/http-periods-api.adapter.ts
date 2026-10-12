import { apiGet, apiGetBlob, apiWrite } from "../../../../lib/api.ts";
import type { Closure, ExportJob, PayPeriod, PendingItem, Reopening } from "../../domain/entities/periods.ts";
import type { PeriodsApiPort } from "../../domain/ports/out/periods-api.port.ts";

const P = "/api/novo-rh/periods";

export class HttpPeriodsApiAdapter implements PeriodsApiPort {
  list() {
    return apiGet<PayPeriod[]>(P);
  }
  async create(input: Pick<PayPeriod, "scopeType" | "scopeId" | "startDate" | "endDate">) {
    return (await apiWrite<PayPeriod>(P, { body: input })).data;
  }
  precheck(id: string) {
    return apiGet<{ employees: number; pending: PendingItem[] }>(`${P}/${id}/precheck`);
  }
  async close(id: string, exceptionReason: string | null) {
    return (await apiWrite<Closure>(`${P}/${id}/close`, { body: { exceptionReason } })).data;
  }
  closures(id: string) {
    return apiGet<Closure[]>(`${P}/${id}/closures`);
  }
  async requestReopen(id: string, reason: string) {
    return (await apiWrite<Reopening>(`${P}/${id}/reopen`, { body: { reason } })).data;
  }
  reopenings() {
    return apiGet<Reopening[]>(`${P}/reopenings`);
  }
  async approveReopen(id: string) {
    return (await apiWrite<Reopening>(`${P}/reopenings/${id}/approve`, {})).data;
  }
  async rejectReopen(id: string, reason: string | null) {
    return (await apiWrite<Reopening>(`${P}/reopenings/${id}/reject`, { body: { reason } })).data;
  }
  async requestExport(id: string, kind: ExportJob["kind"], includeSensitive: boolean) {
    return (await apiWrite<ExportJob>(`${P}/${id}/exports`, { body: { kind, includeSensitive } })).data;
  }
  exports() {
    return apiGet<ExportJob[]>(`${P}/exports`);
  }
  async download(job: ExportJob) {
    const { token } = await apiGet<{ token: string }>(`${P}/exports/${job.id}/link`);
    const blob = await apiGetBlob(`${P}/exports/${job.id}/download?token=${encodeURIComponent(token)}`);
    return { blob, fileName: job.fileName ?? "exportacao.csv" };
  }
}
