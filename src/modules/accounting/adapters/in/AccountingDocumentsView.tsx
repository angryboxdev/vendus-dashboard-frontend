import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccountingModule } from "../../accounting.module.tsx";
import { AccountingDocumentDrawer } from "./AccountingDocumentDrawer.tsx";
import {
  DOCUMENT_TYPE_LABELS,
  FUNDING_SOURCE_LABELS,
  STATUS_LABELS,
  STATUS_TEXT_COLOR,
  type AccountingDocumentRowDTO,
  type AccountingDocumentSource,
  type AccountingDocumentStatus,
  type AccountingDocumentType,
  type AccountingFundingSource,
} from "../../domain/entities/accounting-document.ts";

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function documentTypeLabel(value: string): string {
  return DOCUMENT_TYPE_LABELS[value as AccountingDocumentType] ?? value;
}

function fundingSourceLabel(value: string | null): string {
  if (!value) return "—";
  return FUNDING_SOURCE_LABELS[value as AccountingFundingSource] ?? value;
}

function statusLabel(value: string): string {
  return STATUS_LABELS[value as AccountingDocumentStatus] ?? value;
}

function statusColor(value: string): string {
  return STATUS_TEXT_COLOR[value as AccountingDocumentStatus] ?? "text-stone-500";
}

type SourceFilter = "all" | AccountingDocumentSource;

/**
 * "Documentos" — vista agregada, nunca um CRUD paralelo de faturas: linhas
 * `source: "invoice"` vêm do módulo Faturas e são só de leitura aqui; só
 * `source: "accounting_document"` abre o drawer de edição. "+ Novo
 * documento" só cria esse segundo tipo.
 */
export function AccountingDocumentsView() {
  const { api } = useAccountingModule();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: documents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["accounting-documents"],
    queryFn: () => api.listAccountingDocuments(),
  });

  const counts = useMemo(() => {
    const result: Record<SourceFilter, number> = { all: documents.length, invoice: 0, accounting_document: 0 };
    for (const d of documents) result[d.source] += 1;
    return result;
  }, [documents]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (sourceFilter !== "all" && d.source !== sourceFilter) return false;
      if (search.trim() && !d.entityName.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [documents, sourceFilter, search]);

  function handleRowAction(row: AccountingDocumentRowDTO) {
    if (row.source === "accounting_document") setEditingDocumentId(row.id);
    else window.open("/financial/invoices", "_blank");
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Documentos</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Faturas e documentos de acompanhamento (sócio, funcionário, plataforma, regularizações), numa só lista.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + Novo documento
        </button>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
            {(
              [
                { key: "all" as const, label: `Todos (${counts.all})` },
                { key: "invoice" as const, label: `Faturas (${counts.invoice})` },
                { key: "accounting_document" as const, label: `Documentos de acompanhamento (${counts.accounting_document})` },
              ]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSourceFilter(key)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  sourceFilter === key ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar entidade..."
            className="w-64 rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">Entidade</th>
                <th className="px-4 py-2.5">Documento</th>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Origem</th>
                <th className="px-4 py-2.5 text-right">Valor</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-stone-400">A carregar…</td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-stone-400">Indisponível — não foi possível carregar os documentos.</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-stone-400">Sem documentos para este filtro.</td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={`${row.source}-${row.id}`} className="hover:bg-stone-50/60">
                    <td className="px-4 py-2.5 font-medium text-stone-800">{row.entityName}</td>
                    <td className="px-4 py-2.5 text-stone-600">{row.documentNumber ?? "—"}</td>
                    <td className="px-4 py-2.5 text-stone-600">{formatDate(row.date)}</td>
                    <td className="px-4 py-2.5 text-stone-600">{documentTypeLabel(row.documentType)}</td>
                    <td className="px-4 py-2.5 text-stone-500">
                      {row.source === "invoice" ? "Fatura" : fundingSourceLabel(row.fundingSource)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-stone-800">{fromCents(row.totalWithVat)}</td>
                    <td className={`px-4 py-2.5 text-xs font-medium ${statusColor(row.status)}`}>{statusLabel(row.status)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRowAction(row)}
                        className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showCreate || editingDocumentId) && (
        <AccountingDocumentDrawer
          documentId={editingDocumentId}
          onClose={() => {
            setShowCreate(false);
            setEditingDocumentId(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditingDocumentId(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}
