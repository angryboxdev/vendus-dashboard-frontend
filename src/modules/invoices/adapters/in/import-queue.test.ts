import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvoiceImportResultDTO } from "../../domain/entities/invoice.ts";
import { importQueue, MAX_BATCH_FILES } from "./import-queue.ts";

const file = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });
const result = (n: string) => ({ invoice: { id: n, supplierName: "Makro", invoiceNumber: n, status: "draft_ai" }, extractedLines: [], validationIssues: [], aiConfidence: 1, supplierMatch: null }) as unknown as InvoiceImportResultDTO;
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => importQueue.reset());

describe("importação em lote (E4)", () => {
  it("lê no máximo 2 de cada vez, com keepDraftLines, e termina todas", async () => {
    let active = 0;
    let peak = 0;
    const resolvers: (() => void)[] = [];
    const importInvoice = vi.fn((f: File, _type?: unknown, _opts?: unknown) => {
      active++;
      peak = Math.max(peak, active);
      return new Promise<InvoiceImportResultDTO>((res) => resolvers.push(() => (active--, res(result(f.name)))));
    });
    importQueue.enqueue([file("a.pdf"), file("b.pdf"), file("c.pdf")], { importInvoice } as never);
    await flush();
    expect(importInvoice).toHaveBeenCalledTimes(2);
    expect(importInvoice.mock.calls[0]![2]).toEqual({ keepDraftLines: true });
    while (resolvers.length) {
      resolvers.shift()!();
      await flush();
      await flush();
    }
    expect(peak).toBe(2);
    expect(importQueue.snapshot().map((i) => i.status)).toEqual(["done", "done", "done"]);
  });

  it("documento de cobrança e erro ficam assinalados; limpar tira o que terminou e não precisa de revisão", async () => {
    const importInvoice = vi
      .fn()
      .mockResolvedValueOnce({ kind: "payment_document", payment: {}, matches: [], supplierSuggestion: null, metrics: {} })
      .mockRejectedValueOnce(new Error("PDF ilegível"))
      .mockResolvedValueOnce(result("FT 3"));
    importQueue.enqueue([file("at.pdf"), file("mau.pdf"), file("ok.pdf")], { importInvoice } as never);
    for (let i = 0; i < 6; i++) await flush();
    expect(importQueue.snapshot().map((i) => [i.status, i.error ?? null])).toEqual([["payment_document", null], ["error", "PDF ilegível"], ["done", null]]);
    importQueue.clearFinished();
    expect(importQueue.snapshot().map((i) => i.fileName)).toEqual(["ok.pdf"]);
    importQueue.markReviewed(importQueue.snapshot()[0]!.id);
    importQueue.clearFinished();
    expect(importQueue.snapshot()).toEqual([]);
  });

  it(`aceita no máximo ${MAX_BATCH_FILES} ficheiros por vez`, () => {
    const importInvoice = vi.fn(() => new Promise<InvoiceImportResultDTO>(() => {}));
    const n = importQueue.enqueue(Array.from({ length: 12 }, (_, i) => file(`${i}.pdf`)), { importInvoice } as never);
    expect(n).toBe(MAX_BATCH_FILES);
    expect(importQueue.snapshot()).toHaveLength(MAX_BATCH_FILES);
  });
});
