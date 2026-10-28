import type { DownloadedFile } from "../../domain/entities/margin-report.ts";
import type { FileDownloaderPort } from "../../domain/ports/out/file-downloader.port.ts";

export class BrowserFileDownloaderAdapter implements FileDownloaderPort {
  save({ fileName, content }: DownloadedFile): void {
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
