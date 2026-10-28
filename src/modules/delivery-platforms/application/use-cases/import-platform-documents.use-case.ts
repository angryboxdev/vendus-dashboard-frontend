import { InvalidPlatformUploadError } from "../../domain/errors.ts";
import type { ImportPlatformDocumentsResult, PlatformDocumentUpload } from "../../domain/entities/platform-statement.ts";
import type { ImportPlatformDocumentsPort } from "../../domain/ports/in/import-platform-documents.port.ts";
import type { DeliveryPlatformsApiPort } from "../../domain/ports/out/delivery-platforms-api.port.ts";
import { validatePlatformFiles } from "../../domain/services/platform-statements-view.ts";

export class ImportPlatformDocumentsUseCase implements ImportPlatformDocumentsPort {
  private readonly api: DeliveryPlatformsApiPort;

  constructor(api: DeliveryPlatformsApiPort) {
    this.api = api;
  }

  execute(files: PlatformDocumentUpload[]): Promise<ImportPlatformDocumentsResult> {
    const problem = validatePlatformFiles(files.map((f) => f.name));
    if (problem) return Promise.reject(new InvalidPlatformUploadError(problem));
    return this.api.importDocuments(files);
  }
}
