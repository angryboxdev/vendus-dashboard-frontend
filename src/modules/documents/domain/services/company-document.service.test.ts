import { describe, expect, it } from "vitest";
import type { CompanyDocument } from "../entities/company-document.ts";
import { sortCompanyDocuments, validateCompanyDocumentUpload, visibilityOptionsFor } from "./company-document.service.ts";

function file(type: string, size = 100): File {
  return new File([new Uint8Array(size)], "f", { type });
}

describe("company-document.service", () => {
  it("valida formato, tamanho e ordem das datas", () => {
    expect(validateCompanyDocumentUpload({ file: file("application/pdf"), issuedAt: "2026-01-01", expiresAt: "2026-12-31" })).toBeNull();
    expect(validateCompanyDocumentUpload({ file: file("text/plain"), issuedAt: null, expiresAt: null })).toMatch(/Formato/);
    expect(validateCompanyDocumentUpload({ file: file("application/pdf"), issuedAt: "2026-06-01", expiresAt: "2026-01-01" })).toMatch(/validade/);
  });

  it("só administradores podem escolher 'Só administração'", () => {
    expect(visibilityOptionsFor("admin")).toEqual(["management", "admin"]);
    expect(visibilityOptionsFor("manager")).toEqual(["management"]);
  });

  it("ordena o que exige atenção primeiro", () => {
    const base = { fileName: "", mimeType: null, fileSizeBytes: null, issuedAt: null, expiresAt: null, visibility: "management", version: 1, isCurrent: true, uploadedBy: "", uploadedAt: "" } as const;
    const docs: CompanyDocument[] = [
      { ...base, id: "1", category: "a", categoryLabel: "Apólice", displayStatus: "ok" },
      { ...base, id: "2", category: "b", categoryLabel: "Certidão", displayStatus: "expired" },
      { ...base, id: "3", category: "c", categoryLabel: "Licença", displayStatus: "expiring" },
    ];
    expect(sortCompanyDocuments(docs).map((d) => d.id)).toEqual(["2", "3", "1"]);
  });
});
