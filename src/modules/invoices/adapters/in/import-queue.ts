import { useSyncExternalStore } from "react";
import type { InvoiceImportResultDTO } from "../../domain/entities/invoice.ts";
import type { InvoicesApiPort } from "../../domain/ports/out/invoices-api.port.ts";
import { isPaymentDocument } from "../../domain/entities/payment-document.ts";

/**
 * Importação em lote / em segundo plano (E4). Fila só do browser (sobrevive a fechar o modal e a
 * mudar de página dentro da app; não a recarregar). Cada ficheiro é importado com
 * `keepDraftLines`, por isso o rascunho fica com as linhas lidas e pode ser revisto mais tarde
 * pela lista de faturas mesmo que a fila se perca.
 */

export const MAX_BATCH_FILES = 10;
const CONCURRENCY = 2;

export type ImportQueueStatus = "queued" | "reading" | "done" | "payment_document" | "error";

export interface ImportQueueItem {
  id: string;
  fileName: string;
  status: ImportQueueStatus;
  result?: InvoiceImportResultDTO;
  error?: string;
  reviewed?: boolean;
}

let items: ImportQueueItem[] = [];
const files = new Map<string, File>();
const listeners = new Set<() => void>();
let running = 0;
let api: Pick<InvoicesApiPort, "importInvoice"> | null = null;

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
}

function update(id: string, patch: Partial<ImportQueueItem>) {
  items = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
  emit();
}

async function pump() {
  while (api && running < CONCURRENCY) {
    const next = items.find((i) => i.status === "queued");
    if (!next) return;
    running++;
    update(next.id, { status: "reading" });
    const file = files.get(next.id)!;
    const current = api;
    void current
      .importInvoice(file, undefined, { keepDraftLines: true })
      .then((result) => {
        if (isPaymentDocument(result)) update(next.id, { status: "payment_document" });
        else update(next.id, { status: "done", result });
      })
      .catch((e: unknown) => update(next.id, { status: "error", error: e instanceof Error ? e.message : "Erro ao ler a fatura." }))
      .finally(() => {
        files.delete(next.id);
        running--;
        void pump();
      });
  }
}

export const importQueue = {
  /** Acrescenta ficheiros à fila (no máximo `MAX_BATCH_FILES` por vez) e começa a ler. */
  enqueue(newFiles: File[], importer: Pick<InvoicesApiPort, "importInvoice">): number {
    api = importer;
    const accepted = newFiles.slice(0, MAX_BATCH_FILES);
    for (const f of accepted) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      files.set(id, f);
      items = [...items, { id, fileName: f.name, status: "queued" }];
    }
    emit();
    void pump();
    return accepted.length;
  },
  markReviewed(id: string) {
    update(id, { reviewed: true });
  },
  /** Tira da lista o que já terminou (lido e revisto, erro ou documento de cobrança). */
  clearFinished() {
    items = items.filter((i) => i.status === "queued" || i.status === "reading" || (i.status === "done" && !i.reviewed));
    emit();
  },
  /** Só para testes. */
  reset() {
    items = [];
    files.clear();
    running = 0;
    api = null;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: () => items,
};

export function useImportQueue(): ImportQueueItem[] {
  return useSyncExternalStore(importQueue.subscribe, importQueue.snapshot, importQueue.snapshot);
}
