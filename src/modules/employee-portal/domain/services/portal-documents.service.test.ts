import { describe, expect, it } from "vitest";
import type { DocumentChecklist, MyDocument, SubmittableCategory } from "../entities/portal.ts";
import { fileKind, portalFolders, uploadProblem } from "./portal-documents.service.ts";

// Dados fictícios (RGPD).
const doc = (o: Partial<MyDocument>): MyDocument => ({
  id: "x",
  categoryLabel: "NIF",
  category: "nif",
  fileName: "f.pdf",
  mimeType: "application/pdf",
  status: "valid",
  canReplace: false,
  lastRejection: null,
  period: null,
  isPayslip: false,
  issuedAt: null,
  expiresAt: null,
  uploadedAt: "2026-10-01T10:00:00Z",
  ...o,
});
const cat = (o: Partial<SubmittableCategory>): SubmittableCategory => ({
  slug: "nif",
  label: "NIF",
  mandatory: false,
  requiresPeriod: false,
  accepts: ["application/pdf", "image/jpeg", "image/png"],
  status: "missing",
  canSubmit: true,
  lastRejection: null,
  ...o,
});

describe("Portal — pastas de documentos (as mesmas da ficha do RH)", () => {
  it("5 pastas fixas; cada documento numa só; em falta e o que pede ação por pasta", () => {
    const checklist: DocumentChecklist = {
      categories: [
        cat({ slug: "cartao_cidadao", label: "Cartão de Cidadão", mandatory: true }),
        cat({ slug: "nif", status: "ok", canSubmit: false }),
        cat({ slug: "contrato_trabalho", label: "Contrato de trabalho", mandatory: true, status: "ok", canSubmit: false }),
        cat({ slug: "recibo_verde", label: "Recibo verde", requiresPeriod: true, status: null }),
      ],
      missingMandatory: [{ id: "identificacao", label: "Documento de identificação", categories: ["cartao_cidadao", "titulo_residencia", "passaporte"], status: "missing" }],
    };
    const folders = portalFolders(
      [
        doc({ id: "n1" }),
        doc({ id: "r1", isPayslip: true, category: "recibo_vencimento", categoryLabel: "Recibo de vencimento", period: "2026-09" }),
        doc({ id: "a1", category: "atestado_saude", categoryLabel: "Atestado de saúde", canReplace: true }),
        doc({ id: "c1", category: "contrato_trabalho", categoryLabel: "Contrato de trabalho" }),
      ],
      checklist,
    );
    expect(folders.map((f) => [f.label, f.docs.length, f.attention])).toEqual([
      ["Documentos pessoais", 1, 1],
      ["Contrato e trabalho", 1, 0],
      ["Recibos e faturas", 1, 0],
      ["Saúde e formação", 1, 1],
      ["Outros", 0, 0],
    ]);
    expect(folders[0]!.missing.map((c) => c.slug)).toEqual(["cartao_cidadao"]);
    expect(folders[2]!.submittable.map((c) => c.slug)).toEqual(["recibo_verde"]);
    expect(folders.flatMap((f) => f.docs).length).toBe(4);
  });

  it("sem lista de verificação (falhou): as pastas mostram só os documentos", () => {
    const folders = portalFolders([doc({})], null);
    expect(folders[0]).toMatchObject({ docs: [expect.objectContaining({ id: "x" })], submittable: [], missing: [] });
  });

  it("tipo do ficheiro e validação antes de enviar (10 MB, formatos da categoria)", () => {
    expect(fileKind({ mimeType: "application/pdf", fileName: "a" })).toBe("PDF");
    expect(fileKind({ mimeType: null, fileName: "foto.JPG" })).toBe("Imagem");
    expect(uploadProblem({ size: 11 * 1024 * 1024, type: "application/pdf" }, ["application/pdf"])).toMatch(/10 MB/);
    expect(uploadProblem({ size: 10, type: "image/png" }, ["application/pdf"])).toBe("Escolha um PDF.");
    expect(uploadProblem({ size: 10, type: "image/png" }, ["application/pdf", "image/png", "image/jpeg"])).toBeNull();
  });
});
