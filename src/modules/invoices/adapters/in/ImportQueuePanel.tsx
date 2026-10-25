import { useState } from "react";
import type { InvoiceImportResultDTO } from "../../domain/entities/invoice.ts";
import { importQueue, useImportQueue, type ImportQueueItem } from "./import-queue.ts";

const STATUS_LABEL: Record<ImportQueueItem["status"], string> = {
  queued: "Na fila",
  reading: "A ler…",
  done: "Pronta a rever",
  payment_document: "Documento de cobrança — importe-o sozinho",
  error: "Erro",
};

interface Props {
  onReview(result: InvoiceImportResultDTO): void;
}

/** Painel flutuante da importação em lote (E4): progresso e «Rever» de cada fatura lida. */
export function ImportQueuePanel({ onReview }: Props) {
  const items = useImportQueue();
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;
  const working = items.filter((i) => i.status === "queued" || i.status === "reading").length;
  const ready = items.filter((i) => i.status === "done" && !i.reviewed).length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 rounded-xl border border-stone-200 bg-white shadow-xl" role="region" aria-label="Importação em lote">
      <button type="button" onClick={() => setCollapsed((c) => !c)} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
        <span className="text-sm font-semibold text-stone-800">
          {working > 0 ? `A importar ${working} fatura(s)…` : "Importação concluída"}
        </span>
        <span className="text-xs text-stone-500">{ready > 0 ? `${ready} por rever` : ""} {collapsed ? "▴" : "▾"}</span>
      </button>
      {!collapsed && (
        <>
          <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto border-t border-stone-100">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-stone-800" title={i.fileName}>
                    {i.result ? `${i.result.invoice.supplierName} · ${i.result.invoice.invoiceNumber || "sem número"}` : i.fileName}
                  </p>
                  <p className={`text-[11px] ${i.status === "error" ? "text-red-600" : i.status === "done" ? "text-emerald-700" : "text-stone-500"}`}>
                    {i.status === "error" ? i.error : i.reviewed ? "Revista" : STATUS_LABEL[i.status]}
                    {i.status === "done" && i.result?.reading?.source === "deterministic" ? " · lida sem IA" : ""}
                    {i.status === "done" && i.result?.reused ? " · já existia" : ""}
                  </p>
                </div>
                {i.status === "done" && i.result && (
                  <button
                    type="button"
                    onClick={() => {
                      importQueue.markReviewed(i.id);
                      onReview(i.result!);
                    }}
                    className="shrink-0 rounded-md border border-stone-200 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Rever
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-stone-100 px-4 py-2 text-[11px] text-stone-500">
            <span>Os rascunhos ficam também na lista de faturas.</span>
            {working === 0 && (
              <button type="button" onClick={() => importQueue.clearFinished()} className="font-medium text-stone-600 hover:text-stone-800">
                Limpar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
