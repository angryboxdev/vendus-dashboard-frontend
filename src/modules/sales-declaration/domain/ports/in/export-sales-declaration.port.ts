import type { SaftUpload } from "../../entities/sales-declaration.ts";

export interface ExportSalesDeclarationPort {
  /**
   * Envia os SAF-T, recebe o Excel (líquido por dia) e entrega-o ao utilizador.
   * Lança `InvalidSalesDeclarationRequestError` se os ficheiros escolhidos não servirem.
   */
  execute(files: SaftUpload[]): Promise<void>;
}
