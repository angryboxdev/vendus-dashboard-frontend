import { apiGet, apiPostFormData } from "../../../../lib/api.ts";
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
}
