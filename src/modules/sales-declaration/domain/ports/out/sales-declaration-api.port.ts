import type { SalesDeclarationFile, SaftUpload } from "../../entities/sales-declaration.ts";

export interface SalesDeclarationApiPort {
  /** Gera o Excel a partir dos SAF-T (o cálculo é do backend). */
  exportFromSaft(files: SaftUpload[]): Promise<SalesDeclarationFile>;
}
