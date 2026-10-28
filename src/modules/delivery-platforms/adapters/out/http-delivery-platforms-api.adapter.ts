import { apiGet, apiGetBlob, apiPostFormData } from "../../../../lib/api.ts";
import type { DownloadedFile, MarginReport, MarginReportFormat } from "../../domain/entities/margin-report.ts";
import type { PayoutReconciliation } from "../../domain/entities/payout-reconciliation.ts";
import type { ImportPlatformDocumentsResult, PlatformDocumentUpload, PlatformStatementSummary } from "../../domain/entities/platform-statement.ts";
import type { DeliveryPlatformsApiPort } from "../../domain/ports/out/delivery-platforms-api.port.ts";

export class HttpDeliveryPlatformsApiAdapter implements DeliveryPlatformsApiPort {
  importDocuments(files: PlatformDocumentUpload[]): Promise<ImportPlatformDocumentsResult> {
    const form = new FormData();
    for (const file of files) form.append("files", new Blob([file.content]), file.name);
    return apiPostFormData<ImportPlatformDocumentsResult>("/api/delivery-platforms/import", form);
  }

  listStatements(year: number, month: number): Promise<PlatformStatementSummary[]> {
    return apiGet<PlatformStatementSummary[]>(`/api/delivery-platforms/statements?year=${year}&month=${month}`);
  }

  getMarginReport(year: number, month: number): Promise<MarginReport> {
    return apiGet<MarginReport>(`/api/delivery-platforms/report?year=${year}&month=${month}`);
  }

  getPayoutReconciliation(year: number, month: number): Promise<PayoutReconciliation> {
    return apiGet<PayoutReconciliation>(`/api/delivery-platforms/payouts?year=${year}&month=${month}`);
  }

  async exportMarginReport(year: number, month: number, format: MarginReportFormat): Promise<DownloadedFile> {
    const content = await apiGetBlob(`/api/delivery-platforms/report/export?year=${year}&month=${month}&format=${format}`);
    return { fileName: `margem-delivery-${year}-${String(month).padStart(2, "0")}.${format}`, content };
  }
}
