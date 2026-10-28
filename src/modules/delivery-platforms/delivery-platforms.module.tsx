import { createContext, useContext, type ReactNode } from "react";
import { HttpDeliveryPlatformsApiAdapter } from "./adapters/out/http-delivery-platforms-api.adapter.ts";
import { ImportPlatformDocumentsUseCase } from "./application/use-cases/import-platform-documents.use-case.ts";
import { ListPlatformStatementsUseCase } from "./application/use-cases/list-platform-statements.use-case.ts";
import { ExportPlatformMarginReportUseCase, GetPlatformMarginReportUseCase } from "./application/use-cases/platform-margin-report.use-case.ts";
import { BrowserFileDownloaderAdapter } from "./adapters/out/browser-file-downloader.adapter.ts";
import { GetPayoutReconciliationUseCase } from "./application/use-cases/payout-reconciliation.use-case.ts";
import type { GetPayoutReconciliationPort } from "./domain/ports/in/payout-reconciliation.port.ts";
import { GetFoodCostUseCase, SaveProductMappingsUseCase } from "./application/use-cases/food-cost.use-case.ts";
import type { GetFoodCostPort, SaveProductMappingsPort } from "./domain/ports/in/food-cost.port.ts";
import type { ExportPlatformMarginReportPort, GetPlatformMarginReportPort } from "./domain/ports/in/platform-margin-report.port.ts";
import type { ImportPlatformDocumentsPort } from "./domain/ports/in/import-platform-documents.port.ts";
import type { ListPlatformStatementsPort } from "./domain/ports/in/list-platform-statements.port.ts";

export interface DeliveryPlatformsModule {
  importDocuments: ImportPlatformDocumentsPort;
  listStatements: ListPlatformStatementsPort;
  getMarginReport: GetPlatformMarginReportPort;
  exportMarginReport: ExportPlatformMarginReportPort;
  getPayoutReconciliation: GetPayoutReconciliationPort;
  getFoodCost: GetFoodCostPort;
  saveProductMappings: SaveProductMappingsPort;
}

/** Composition root: liga o adapter HTTP aos casos de uso. */
function buildModule(): DeliveryPlatformsModule {
  const api = new HttpDeliveryPlatformsApiAdapter();
  return {
    importDocuments: new ImportPlatformDocumentsUseCase(api),
    listStatements: new ListPlatformStatementsUseCase(api),
    getMarginReport: new GetPlatformMarginReportUseCase(api),
    exportMarginReport: new ExportPlatformMarginReportUseCase(api, new BrowserFileDownloaderAdapter()),
    getPayoutReconciliation: new GetPayoutReconciliationUseCase(api),
    getFoodCost: new GetFoodCostUseCase(api),
    saveProductMappings: new SaveProductMappingsUseCase(api),
  };
}

const DeliveryPlatformsContext = createContext<DeliveryPlatformsModule | null>(null);

export function DeliveryPlatformsProvider({ children, module: mod }: { children: ReactNode; module?: DeliveryPlatformsModule }) {
  const value = mod ?? buildModule();
  return <DeliveryPlatformsContext.Provider value={value}>{children}</DeliveryPlatformsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDeliveryPlatformsModule(): DeliveryPlatformsModule {
  const ctx = useContext(DeliveryPlatformsContext);
  if (!ctx) throw new Error("useDeliveryPlatformsModule must be used inside DeliveryPlatformsProvider");
  return ctx;
}
