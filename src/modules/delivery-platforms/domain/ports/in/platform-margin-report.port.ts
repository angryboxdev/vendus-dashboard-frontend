import type { MarginReport, MarginReportFormat } from "../../entities/margin-report.ts";

/** Margem por plataforma de um mês. */
export interface GetPlatformMarginReportPort {
  execute(year: number, month: number): Promise<MarginReport>;
}

/** Descarrega o relatório do mês em Excel ou PDF. */
export interface ExportPlatformMarginReportPort {
  execute(year: number, month: number, format: MarginReportFormat): Promise<void>;
}
