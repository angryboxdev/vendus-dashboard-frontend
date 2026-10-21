import { describe, expect, it } from "vitest";
import { documentFolderOf } from "./document-folders.service.ts";

describe("Pastas dos documentos da ficha", () => {
  it("cada categoria conhecida vai para a sua pasta; periódicas são recibos; o resto é «Outros»", () => {
    expect(documentFolderOf("cartao_cidadao")).toBe("personal");
    expect(documentFolderOf("comprovativo_iban")).toBe("personal");
    expect(documentFolderOf("contrato_trabalho")).toBe("work");
    expect(documentFolderOf("recibo_verde")).toBe("payslips");
    expect(documentFolderOf("categoria_da_empresa", true)).toBe("payslips");
    expect(documentFolderOf("atestado_saude")).toBe("health");
    expect(documentFolderOf("categoria_da_empresa")).toBe("other");
    expect(documentFolderOf("outro")).toBe("other");
  });
});
