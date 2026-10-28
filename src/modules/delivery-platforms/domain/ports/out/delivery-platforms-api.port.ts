import type { ImportPlatformDocumentsResult, PlatformDocumentUpload, PlatformStatementSummary } from "../../entities/platform-statement.ts";

export interface DeliveryPlatformsApiPort {
  importDocuments(files: PlatformDocumentUpload[]): Promise<ImportPlatformDocumentsResult>;
  listStatements(year: number, month: number): Promise<PlatformStatementSummary[]>;
}
