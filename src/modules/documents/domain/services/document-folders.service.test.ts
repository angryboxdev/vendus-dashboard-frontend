import { describe, expect, it } from "vitest";
import { archiveByFolder, documentFolderOf } from "./document-folders.service.ts";

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

  it("arquivo por pasta: soma as categorias da mesma pasta por pessoa e guarda o último arquivamento", () => {
    const by = archiveByFolder([
      { employeeId: "e2", employeeName: "Rui", category: "nif", requiresPeriod: false, count: 1, lastUploadedAt: "2026-05-01T10:00:00Z" },
      { employeeId: "e1", employeeName: "Ana", category: "cartao_cidadao", requiresPeriod: false, count: 1, lastUploadedAt: "2026-01-01T10:00:00Z" },
      { employeeId: "e1", employeeName: "Ana", category: "nif", requiresPeriod: false, count: 2, lastUploadedAt: "2026-03-01T10:00:00Z" },
      { employeeId: "e1", employeeName: "Ana", category: "recibo_vencimento", requiresPeriod: true, count: 9, lastUploadedAt: "2026-09-30T10:00:00Z" },
    ]);
    expect(by.personal).toEqual([
      { employeeId: "e1", employeeName: "Ana", count: 3, lastUploadedAt: "2026-03-01T10:00:00Z" },
      { employeeId: "e2", employeeName: "Rui", count: 1, lastUploadedAt: "2026-05-01T10:00:00Z" },
    ]);
    expect(by.payslips).toEqual([{ employeeId: "e1", employeeName: "Ana", count: 9, lastUploadedAt: "2026-09-30T10:00:00Z" }]);
    expect(by.other).toEqual([]);
  });
});
