import { apiPostFormDataFile } from "../../../../lib/api.ts";
import type { SalesDeclarationFile, SaftUpload } from "../../domain/entities/sales-declaration.ts";
import type { SalesDeclarationApiPort } from "../../domain/ports/out/sales-declaration-api.port.ts";

const FALLBACK_FILE_NAME = "SalesReport_SAFT.xlsx";

export class HttpSalesDeclarationApiAdapter implements SalesDeclarationApiPort {
  async exportFromSaft(files: SaftUpload[]): Promise<SalesDeclarationFile> {
    const form = new FormData();
    for (const file of files) form.append("files", new Blob([file.content]), file.name);

    const { blob, fileName } = await apiPostFormDataFile("/api/sales-declaration/export", form);
    return { fileName: fileName ?? FALLBACK_FILE_NAME, content: await blob.arrayBuffer() };
  }
}
