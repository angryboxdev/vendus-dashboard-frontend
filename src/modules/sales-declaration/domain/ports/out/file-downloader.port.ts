import type { SalesDeclarationFile } from "../../entities/sales-declaration.ts";

export interface FileDownloaderPort {
  save(file: SalesDeclarationFile): void;
}
