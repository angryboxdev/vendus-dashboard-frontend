import type { DownloadedFile, MarginReport, MarginReportFormat } from "../../entities/margin-report.ts";
import type { PayoutReconciliation } from "../../entities/payout-reconciliation.ts";
import type { ImportPlatformDocumentsResult, PlatformDocumentUpload, PlatformStatementSummary } from "../../entities/platform-statement.ts";

export interface DeliveryPlatformsApiPort {
  importDocuments(files: PlatformDocumentUpload[]): Promise<ImportPlatformDocumentsResult>;
  listStatements(year: number, month: number): Promise<PlatformStatementSummary[]>;
  getMarginReport(year: number, month: number): Promise<MarginReport>;
  exportMarginReport(year: number, month: number, format: MarginReportFormat): Promise<DownloadedFile>;
  getPayoutReconciliation(year: number, month: number): Promise<PayoutReconciliation>;
}
