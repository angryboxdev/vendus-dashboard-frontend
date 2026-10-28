import type { MarginReport, MarginReportFormat } from "../../domain/entities/margin-report.ts";
import type { ExportPlatformMarginReportPort, GetPlatformMarginReportPort } from "../../domain/ports/in/platform-margin-report.port.ts";
import type { DeliveryPlatformsApiPort } from "../../domain/ports/out/delivery-platforms-api.port.ts";
import type { FileDownloaderPort } from "../../domain/ports/out/file-downloader.port.ts";

export class GetPlatformMarginReportUseCase implements GetPlatformMarginReportPort {
  private readonly api: DeliveryPlatformsApiPort;

  constructor(api: DeliveryPlatformsApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<MarginReport> {
    return this.api.getMarginReport(year, month);
  }
}

export class ExportPlatformMarginReportUseCase implements ExportPlatformMarginReportPort {
  private readonly api: DeliveryPlatformsApiPort;
  private readonly downloader: FileDownloaderPort;

  constructor(api: DeliveryPlatformsApiPort, downloader: FileDownloaderPort) {
    this.api = api;
    this.downloader = downloader;
  }

  async execute(year: number, month: number, format: MarginReportFormat): Promise<void> {
    this.downloader.save(await this.api.exportMarginReport(year, month, format));
  }
}
