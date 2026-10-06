import type { SalesDeclarationFile } from "../../domain/entities/sales-declaration.ts";
import type { FileDownloaderPort } from "../../domain/ports/out/file-downloader.port.ts";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class BrowserFileDownloaderAdapter implements FileDownloaderPort {
  save({ fileName, content }: SalesDeclarationFile): void {
    const url = URL.createObjectURL(new Blob([content], { type: XLSX_MIME }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
