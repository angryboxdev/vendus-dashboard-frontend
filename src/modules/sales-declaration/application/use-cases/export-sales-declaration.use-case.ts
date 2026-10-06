import type { SaftUpload } from "../../domain/entities/sales-declaration.ts";
import { InvalidSalesDeclarationRequestError } from "../../domain/errors.ts";
import type { ExportSalesDeclarationPort } from "../../domain/ports/in/export-sales-declaration.port.ts";
import type { FileDownloaderPort } from "../../domain/ports/out/file-downloader.port.ts";
import type { SalesDeclarationApiPort } from "../../domain/ports/out/sales-declaration-api.port.ts";
import { validateSaftFiles } from "../../domain/services/saft-upload.service.ts";

export class ExportSalesDeclarationUseCase implements ExportSalesDeclarationPort {
  private readonly api: SalesDeclarationApiPort;
  private readonly downloader: FileDownloaderPort;

  constructor(api: SalesDeclarationApiPort, downloader: FileDownloaderPort) {
    this.api = api;
    this.downloader = downloader;
  }

  async execute(files: SaftUpload[]): Promise<void> {
    const error = validateSaftFiles(files.map((f) => f.name));
    if (error) throw new InvalidSalesDeclarationRequestError(error);

    this.downloader.save(await this.api.exportFromSaft(files));
  }
}
