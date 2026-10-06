import { createContext, useContext, type ReactNode } from "react";
import { BrowserFileDownloaderAdapter } from "./adapters/out/browser-file-downloader.adapter.ts";
import { HttpSalesDeclarationApiAdapter } from "./adapters/out/http-sales-declaration-api.adapter.ts";
import { ExportSalesDeclarationUseCase } from "./application/use-cases/export-sales-declaration.use-case.ts";
import type { ExportSalesDeclarationPort } from "./domain/ports/in/export-sales-declaration.port.ts";

export interface SalesDeclarationModule {
  exportSalesDeclaration: ExportSalesDeclarationPort;
}

/** Composition root: único sítio que conhece os adapters concretos. */
function buildModule(): SalesDeclarationModule {
  return {
    exportSalesDeclaration: new ExportSalesDeclarationUseCase(
      new HttpSalesDeclarationApiAdapter(),
      new BrowserFileDownloaderAdapter(),
    ),
  };
}

const SalesDeclarationContext = createContext<SalesDeclarationModule | null>(null);

export function SalesDeclarationProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: SalesDeclarationModule;
}) {
  const value = mod ?? buildModule();
  return <SalesDeclarationContext.Provider value={value}>{children}</SalesDeclarationContext.Provider>;
}

export function useSalesDeclarationModule(): SalesDeclarationModule {
  const ctx = useContext(SalesDeclarationContext);
  if (!ctx) throw new Error("useSalesDeclarationModule must be used inside SalesDeclarationProvider");
  return ctx;
}
