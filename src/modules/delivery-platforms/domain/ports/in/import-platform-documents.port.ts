import type { ImportPlatformDocumentsResult, PlatformDocumentUpload } from "../../entities/platform-statement.ts";

/** Envia os extratos escolhidos; cada ficheiro volta importado ou rejeitado com o motivo. */
export interface ImportPlatformDocumentsPort {
  execute(files: PlatformDocumentUpload[]): Promise<ImportPlatformDocumentsResult>;
}
