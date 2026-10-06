import { describe, expect, it } from "vitest";
import type { SalesDeclarationFile, SaftUpload } from "../../domain/entities/sales-declaration.ts";
import { InvalidSalesDeclarationRequestError } from "../../domain/errors.ts";
import type { FileDownloaderPort } from "../../domain/ports/out/file-downloader.port.ts";
import type { SalesDeclarationApiPort } from "../../domain/ports/out/sales-declaration-api.port.ts";
import { ExportSalesDeclarationUseCase } from "./export-sales-declaration.use-case.ts";

class FakeApi implements SalesDeclarationApiPort {
  received: SaftUpload[][] = [];
  async exportFromSaft(files: SaftUpload[]): Promise<SalesDeclarationFile> {
    this.received.push(files);
    return { fileName: "SalesReport_2026-09-10_2026-09-30.xlsx", content: new Uint8Array([1, 2, 3]).buffer };
  }
}

class FakeDownloader implements FileDownloaderPort {
  saved: SalesDeclarationFile[] = [];
  save(file: SalesDeclarationFile): void {
    this.saved.push(file);
  }
}

const upload = (name: string): SaftUpload => ({ name, content: new ArrayBuffer(1) });

describe("ExportSalesDeclarationUseCase", () => {
  it("envia os SAF-T à API e entrega o ficheiro devolvido ao downloader", async () => {
    const api = new FakeApi();
    const downloader = new FakeDownloader();
    const files = [upload("vendus.xml"), upload("bo.xml")];

    await new ExportSalesDeclarationUseCase(api, downloader).execute(files);

    expect(api.received).toEqual([files]);
    expect(downloader.saved).toHaveLength(1);
    expect(downloader.saved[0]!.fileName).toBe("SalesReport_2026-09-10_2026-09-30.xlsx");
    expect(new Uint8Array(downloader.saved[0]!.content)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("não chama a API nem descarrega quando os ficheiros são inválidos", async () => {
    const api = new FakeApi();
    const downloader = new FakeDownloader();
    const useCase = new ExportSalesDeclarationUseCase(api, downloader);

    await expect(useCase.execute([])).rejects.toThrow(InvalidSalesDeclarationRequestError);
    await expect(useCase.execute([upload("extrato.pdf")])).rejects.toThrow(InvalidSalesDeclarationRequestError);

    expect(api.received).toHaveLength(0);
    expect(downloader.saved).toHaveLength(0);
  });
});
