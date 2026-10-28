import { useMutation, useQuery } from "@tanstack/react-query";
import type { MarginReportFormat } from "../../domain/entities/margin-report.ts";
import { useDeliveryPlatformsModule } from "../../delivery-platforms.module.tsx";
import { STATEMENTS_KEY } from "./use-delivery-platforms.ts";

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Margem por plataforma do mês (refaz-se depois de cada importação) e exportação Excel/PDF. */
export function useMarginReport(year: number, month: number) {
  const { getMarginReport, exportMarginReport } = useDeliveryPlatformsModule();
  const report = useQuery({
    queryKey: [STATEMENTS_KEY, "report", year, month],
    queryFn: () => getMarginReport.execute(year, month),
    retry: false,
  });
  const download = useMutation({ mutationFn: (format: MarginReportFormat) => exportMarginReport.execute(year, month, format) });
  return {
    report: report.data ?? null,
    loading: report.isLoading,
    error: report.error ? message(report.error, "Erro ao calcular a margem") : null,
    exporting: download.isPending ? download.variables : null,
    exportError: download.error ? message(download.error, "Erro ao exportar") : null,
    exportAs: (format: MarginReportFormat) => download.mutate(format),
  };
}
