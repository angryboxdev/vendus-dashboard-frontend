import { useMemo, useState } from "react";
import type {
  GroupedSettlementCombinationDTO,
  GroupedSettlementDocDTO,
  GroupedSettlementDocumentType,
} from "../../domain/entities/bank-statement.ts";

// ── Helpers (duplicated on purpose from ClassifyDrawer.tsx to avoid a
// circular import between the two files — both are tiny pure formatters) ──────

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const parts = s.slice(0, 10).split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ── Small shared bits ─────────────────────────────────────────────────────────

function ExactMatchBadge() {
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700">
      Correspondência exata
    </span>
  );
}

export function DocumentTypeTag({ documentType }: { documentType: GroupedSettlementDocumentType }) {
  return documentType === "credit_note" ? (
    <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-600">NC</span>
  ) : (
    <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600">Fatura</span>
  );
}

function CombinationDocsTable({ docs, netTotalCents }: { docs: GroupedSettlementDocDTO[]; netTotalCents: number }) {
  return (
    <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-stone-50 text-stone-500">
          <tr>
            <th className="text-left font-medium px-3 py-1.5">Tipo</th>
            <th className="text-left font-medium px-3 py-1.5">Documento</th>
            <th className="text-left font-medium px-3 py-1.5">Data</th>
            <th className="text-right font-medium px-3 py-1.5">Saldo utilizado</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.entityId} className="border-t border-stone-100">
              <td className="px-3 py-1.5"><DocumentTypeTag documentType={d.documentType} /></td>
              <td className="px-3 py-1.5 text-stone-700 truncate max-w-[12rem]">{d.entityLabel}</td>
              <td className="px-3 py-1.5 text-stone-500">{formatDate(d.invoiceDate)}</td>
              <td className={`px-3 py-1.5 text-right font-medium ${d.openBalanceCents < 0 ? "text-red-600" : "text-stone-800"}`}>
                {fromCents(d.openBalanceCents)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-stone-200 bg-stone-50">
            <td colSpan={3} className="px-3 py-1.5 font-semibold text-stone-600">Total líquido</td>
            <td className="px-3 py-1.5 text-right font-semibold text-stone-800">{fromCents(netTotalCents)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Supplier + N documentos + Faturas/NC breakdown + Total líquido box + badge, shared by the single-card and multi-option layouts. */
function CombinationSummary({ combination }: { combination: GroupedSettlementCombinationDTO }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-800">{combination.documentCount} documentos</p>
        <ExactMatchBadge />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-white border border-stone-100 px-2.5 py-2">
          <p className="text-stone-400">Faturas ({combination.invoiceCount})</p>
          <p className="font-semibold text-stone-800">{fromCents(combination.invoiceTotalCents)}</p>
        </div>
        <div className="rounded-md bg-white border border-stone-100 px-2.5 py-2">
          <p className="text-stone-400">Notas de crédito ({combination.creditNoteCount})</p>
          <p className="font-semibold text-red-600">{fromCents(combination.creditNoteTotalCents)}</p>
        </div>
      </div>
      <div className="rounded-md bg-[#FDF8F5] border border-[#F5C992]/60 px-2.5 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-stone-500">Total líquido</span>
        <span className="text-sm font-bold text-stone-800">{fromCents(combination.netTotalCents)}</span>
      </div>
    </div>
  );
}

// ── A) / B) Grouped settlement suggestion(s) ───────────────────────────────────

export function GroupedSettlementSuggestions({
  primary,
  alternates,
  supplierName,
  disabled,
  onUse,
}: {
  primary: GroupedSettlementCombinationDTO;
  alternates: GroupedSettlementCombinationDTO[];
  supplierName: string | null;
  disabled?: boolean;
  onUse: (docs: GroupedSettlementDocDTO[]) => void;
}) {
  const options = useMemo(() => [primary, ...alternates], [primary, alternates]);
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpanded(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  if (options.length === 1) {
    const combo = primary;
    const isExpanded = expanded.has(0);
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">Liquidação agrupada encontrada</p>
        <p className="text-sm text-stone-600 mb-2">{supplierName ?? "Fornecedor"}</p>
        <CombinationSummary combination={combo} />
        <div className="mt-3 rounded-md border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-sky-700">
          {combo.creditNoteCount > 0
            ? "Esta sugestão utiliza várias faturas e notas de crédito do mesmo fornecedor que totalizam o valor do movimento."
            : "Esta sugestão utiliza várias faturas do mesmo fornecedor que totalizam o valor do movimento."}
        </div>
        {isExpanded && <CombinationDocsTable docs={combo.docs} netTotalCents={combo.netTotalCents} />}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => toggleExpanded(0)}
            className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-white">
            {isExpanded ? "Ocultar documentos" : "Ver documentos"}
          </button>
          <button type="button" disabled={disabled} onClick={() => onUse(combo.docs)}
            className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40">
            Usar sugestão
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
        Encontrámos {options.length} liquidações possíveis
      </p>
      <div className="space-y-2">
        {options.map((combo, i) => {
          const isExpanded = expanded.has(i);
          return (
            <label key={i}
              className={`block rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                selected === i ? "border-[#ED5C32] bg-[#FDF8F5]" : "border-stone-200 bg-white hover:border-stone-300"
              }`}>
              <div className="flex items-start gap-2">
                <input type="radio" name="grouped-combo" checked={selected === i} onChange={() => setSelected(i)} className="mt-1" />
                <div className="flex-1">
                  <CombinationSummary combination={combo} />
                  {isExpanded && <CombinationDocsTable docs={combo.docs} netTotalCents={combo.netTotalCents} />}
                  <button type="button" onClick={(e) => { e.preventDefault(); toggleExpanded(i); }}
                    className="mt-2 text-xs font-medium text-[#ED5C32] hover:underline">
                    {isExpanded ? "Ocultar documentos" : "Ver documentos"}
                  </button>
                </div>
              </div>
            </label>
          );
        })}
      </div>
      <button type="button" disabled={disabled} onClick={() => onUse(options[selected]!.docs)}
        className="mt-3 w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40">
        Usar liquidação selecionada
      </button>
    </div>
  );
}

// ── C) Manual multi-select search ──────────────────────────────────────────────

type FilterPill = "all" | "invoice" | "credit_note";
type SortKey = "date_asc" | "date_desc" | "amount_desc" | "amount_asc";

export function ManualMultiSelectSearch({
  eligibleDocuments,
  movementAmountCents,
  excludeEntityIds,
  disabled,
  onAssociate,
}: {
  eligibleDocuments: GroupedSettlementDocDTO[];
  movementAmountCents: number;
  /** Documents already staged elsewhere (e.g. from the old candidates list) — hidden from this pool. */
  excludeEntityIds: Set<string>;
  disabled?: boolean;
  onAssociate: (docs: GroupedSettlementDocDTO[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterPill>("all");
  const [sort, setSort] = useState<SortKey>("date_asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const pool = useMemo(
    () => eligibleDocuments.filter((d) => !excludeEntityIds.has(d.entityId)),
    [eligibleDocuments, excludeEntityIds],
  );

  const counts = useMemo(
    () => ({
      all: pool.length,
      invoice: pool.filter((d) => d.documentType === "invoice").length,
      credit_note: pool.filter((d) => d.documentType === "credit_note").length,
    }),
    [pool],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byFilter = pool.filter((d) => filter === "all" || d.documentType === filter);
    const bySearch = q.length === 0 ? byFilter : byFilter.filter((d) => d.entityLabel.toLowerCase().includes(q));
    const sorted = [...bySearch].sort((a, b) => {
      switch (sort) {
        case "date_desc": return b.invoiceDate.localeCompare(a.invoiceDate);
        case "amount_desc": return b.openBalanceCents - a.openBalanceCents;
        case "amount_asc": return a.openBalanceCents - b.openBalanceCents;
        case "date_asc":
        default: return a.invoiceDate.localeCompare(b.invoiceDate);
      }
    });
    return sorted;
  }, [pool, filter, search, sort]);

  const selectedDocs = useMemo(
    () => pool.filter((d) => selectedIds.has(d.entityId)),
    [pool, selectedIds],
  );

  const invoiceSelected = selectedDocs.filter((d) => d.documentType === "invoice");
  const creditNoteSelected = selectedDocs.filter((d) => d.documentType === "credit_note");
  const invoiceSelectedTotal = invoiceSelected.reduce((s, d) => s + d.openBalanceCents, 0);
  const creditNoteSelectedTotal = creditNoteSelected.reduce((s, d) => s + d.openBalanceCents, 0);
  const selectedTotal = invoiceSelectedTotal + creditNoteSelectedTotal;
  const difference = movementAmountCents - selectedTotal;
  const isExactMatch = selectedDocs.length > 0 && difference === 0;

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAssociate() {
    if (selectedDocs.length === 0) return;
    onAssociate(selectedDocs);
    setSelectedIds(new Set());
  }

  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Procurar documentos</p>
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Nome do fornecedor ou nº de documento…"
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]" />

      <div className="flex gap-1.5 mt-2">
        {(
          [["all", `Todos (${counts.all})`], ["invoice", `Faturas (${counts.invoice})`], ["credit_note", `Notas de crédito (${counts.credit_note})`]] as [FilterPill, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === key ? "bg-[#ED5C32] text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}>
            {label}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
          className="ml-auto rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600">
          <option value="date_asc">Data (mais antiga)</option>
          <option value="date_desc">Data (mais recente)</option>
          <option value="amount_desc">Valor (maior)</option>
          <option value="amount_asc">Valor (menor)</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-stone-400 mt-3 text-center py-4 bg-stone-50 rounded-md">
          {pool.length === 0
            ? "Nenhum documento encontrado. Documentos totalmente liquidados não são apresentados para nova conciliação."
            : "Nenhum documento encontrado para os filtros aplicados."}
        </p>
      ) : (
        <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-stone-50 text-stone-500 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 w-6"></th>
                <th className="text-left font-medium px-2 py-1.5">Tipo</th>
                <th className="text-left font-medium px-2 py-1.5">Nº do documento</th>
                <th className="text-left font-medium px-2 py-1.5">Data</th>
                <th className="text-left font-medium px-2 py-1.5">Vencimento</th>
                <th className="text-right font-medium px-2 py-1.5">Saldo disponível</th>
                <th className="text-right font-medium px-2 py-1.5">Total original</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.entityId}
                  className={`border-t border-stone-100 cursor-pointer ${selectedIds.has(d.entityId) ? "bg-[#FDF8F5]" : "hover:bg-stone-50"}`}
                  onClick={() => toggle(d.entityId)}>
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(d.entityId)} onChange={() => toggle(d.entityId)} />
                  </td>
                  <td className="px-2 py-1.5"><DocumentTypeTag documentType={d.documentType} /></td>
                  <td className="px-2 py-1.5 text-stone-700 truncate max-w-[10rem]">{d.entityLabel}</td>
                  <td className="px-2 py-1.5 text-stone-500">{formatDate(d.invoiceDate)}</td>
                  <td className="px-2 py-1.5 text-stone-500">
                    {formatDate(d.dueDate)}
                    {d.isOverdue && <span className="ml-1 text-[10px] font-semibold text-red-500">vencida</span>}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-medium ${d.openBalanceCents < 0 ? "text-red-600" : "text-stone-800"}`}>
                    {fromCents(d.openBalanceCents)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-stone-300">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 0 && (
        <p className="text-[11px] text-stone-400 mt-1">
          "Total original" não está disponível nesta vista — apenas o saldo em aberto é devolvido pelo backend nesta fase.
        </p>
      )}

      {/* Seleção atual */}
      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Seleção atual ({selectedDocs.length})</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-stone-500">Faturas ({invoiceSelected.length})</span>
            <span className="font-medium text-stone-800">{fromCents(invoiceSelectedTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Notas de crédito ({creditNoteSelected.length})</span>
            <span className="font-medium text-red-600">{fromCents(creditNoteSelectedTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-1 mt-1">
            <span className="text-stone-500">Total selecionado</span>
            <span className="font-semibold text-stone-800">{fromCents(selectedTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Valor do movimento</span>
            <span className="font-semibold text-stone-800">{fromCents(movementAmountCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Diferença</span>
            <span className={`font-semibold ${difference === 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fromCents(Math.abs(difference))}{difference !== 0 && difference < 0 ? " (excesso)" : ""}
            </span>
          </div>
        </div>
        {isExactMatch && (
          <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            Valores correspondentes
          </div>
        )}
        <button type="button" disabled={disabled || selectedDocs.length === 0} onClick={handleAssociate}
          className="mt-3 w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
          Associar {selectedDocs.length} documento{selectedDocs.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

// ── Stale-document conflict (409) ─────────────────────────────────────────────

export function StaleDocumentsModal({
  onCancel,
  onRefresh,
  refreshing,
}: {
  onCancel: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="px-6 pt-5 pb-4">
          <h3 className="text-base font-bold text-stone-900">Não foi possível concluir a liquidação</h3>
          <p className="mt-2 text-sm text-stone-600">
            Um ou mais documentos foram alterados ou já foram liquidados. Atualize a conciliação para continuar.
          </p>
        </div>
        <div className="px-6 pt-3 pb-5 flex gap-3">
          <button type="button" onClick={onCancel} disabled={refreshing}
            className="flex-1 rounded-md border border-stone-300 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onRefresh} disabled={refreshing}
            className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] py-2 text-sm font-medium text-white disabled:opacity-50">
            {refreshing ? "A atualizar…" : "Atualizar documentos"}
          </button>
        </div>
      </div>
    </div>
  );
}
