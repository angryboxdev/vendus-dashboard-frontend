import type { DownloadedFile } from "../../entities/margin-report.ts";

/** Entrega um ficheiro ao utilizador (no browser: descarregar). */
export interface FileDownloaderPort {
  save(file: DownloadedFile): void;
}
