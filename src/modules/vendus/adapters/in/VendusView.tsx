import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KpiCards,
  ChannelTable,
  CategoryTable,
  ProductsByChannelTable,
  TemporalChart,
  Pagination,
  DocTypeBadge,
  ChannelBadge,
} from "./VendusAnalytics.tsx";
import {
  SelfConsumptionKpiCards,
  SelfConsumptionRecordsTable,
} from "./VendusSelfConsumption.tsx";
import type { VendusDetailedDocument } from "../../domain/entities/vendus-document.ts";
import { useVendusSummary } from "./use-vendus-summary.ts";
import { useVendusSelfConsumption } from "./use-vendus-selfconsumption.ts";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// ─── Date range selector ─────────────────────────────────────────────────────

type Preset = "today" | "yesterday" | "last7" | "last30" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last7: "Últimos 7 dias",
  last30: "Último mês",
  custom: "Personalizado",
};

function presetRange(
  preset: Preset,
  customStart: Date,
  customEnd: Date,
): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "last7":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "last30":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "custom":
      return { start: customStart, end: customEnd };
  }
}

function DateRangeSelector({
  preset,
  customStart,
  customEnd,
  onChange,
}: {
  preset: Preset;
  customStart: Date;
  customEnd: Date;
  onChange: (preset: Preset, customStart: Date, customEnd: Date) => void;
}) {
  const [draftStart, setDraftStart] = useState(customStart);
  const [draftEnd, setDraftEnd] = useState(customEnd);

  const presets: Preset[] = ["today", "yesterday", "last7", "last30", "custom"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p}
          onClick={() => {
            if (p === "custom") {
              onChange("custom", customStart, customEnd);
            } else {
              onChange(p, customStart, customEnd);
            }
          }}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            preset === p
              ? "bg-[#E8533F] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={toDateStr(draftStart)}
            max={toDateStr(draftEnd)}
            onChange={(e) => setDraftStart(startOfDay(new Date(e.target.value)))}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
          <span className="text-sm text-gray-400">até</span>
          <input
            type="date"
            value={toDateStr(draftEnd)}
            min={toDateStr(draftStart)}
            onChange={(e) => setDraftEnd(endOfDay(new Date(e.target.value)))}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => onChange("custom", draftStart, draftEnd)}
            className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Buscar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Document filter tabs ─────────────────────────────────────────────────────

type DocFilter = "all" | "invoice" | "NC";

const DOC_FILTER_LABELS: Record<DocFilter, string> = {
  all: "Todos",
  invoice: "Faturas (FS/FT)",
  NC: "Notas de Crédito",
};

function DocFilterTabs({
  active,
  onChange,
}: {
  active: DocFilter;
  onChange: (f: DocFilter) => void;
}) {
  const filters: DocFilter[] = ["invoice", "NC", "all"];
  return (
    <div className="flex gap-1">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active === f
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {DOC_FILTER_LABELS[f]}
        </button>
      ))}
    </div>
  );
}

function FilterSummary({
  documents,
  docFilter,
}: {
  documents: VendusDetailedDocument[];
  docFilter: DocFilter;
}) {
  const invoices = documents.filter((d) => d.type !== "NC");
  const creditNotes = documents.filter((d) => d.type === "NC");
  const invoiceTotal = invoices.reduce((s, d) => s + parseFloat(d.amount_gross), 0);
  const creditTotal = creditNotes.reduce(
    (s, d) => s + Math.abs(parseFloat(d.amount_gross)),
    0,
  );
  const net = invoiceTotal - creditTotal;

  if (docFilter === "invoice") {
    return (
      <span className="text-sm font-medium text-gray-600">
        {invoices.length} fatura{invoices.length !== 1 ? "s" : ""}{" "}
        <span className="text-emerald-600">· €{invoiceTotal.toFixed(2)}</span>
      </span>
    );
  }

  if (docFilter === "NC") {
    return (
      <span className="text-sm font-medium text-gray-600">
        {creditNotes.length} nota{creditNotes.length !== 1 ? "s" : ""} de crédito{" "}
        <span className="text-red-500">· €{creditTotal.toFixed(2)}</span>
      </span>
    );
  }

  return (
    <span className="text-sm text-gray-500">
      Faturas{" "}
      <span className="font-medium text-emerald-600">€{invoiceTotal.toFixed(2)}</span>
      {" − "}
      NC{" "}
      <span className="font-medium text-red-500">€{creditTotal.toFixed(2)}</span>
      {" = Líquido "}
      <span className={`font-semibold ${net >= 0 ? "text-gray-800" : "text-red-500"}`}>
        €{net.toFixed(2)}
      </span>
    </span>
  );
}

// ─── Document detail drawer ───────────────────────────────────────────────────

function DocumentDrawer({
  doc,
  onClose,
}: {
  doc: VendusDetailedDocument;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isNC = doc.type === "NC";
  const gross = parseFloat(doc.amount_gross);
  const net = parseFloat(doc.amount_net);

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Detalhe do Documento
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold text-gray-800">
              {doc.number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Summary */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Informação
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
              {[
                ["Tipo", <DocTypeBadge key="type" type={doc.type} />],
                ["Canal", <ChannelBadge key="ch" channel={doc.channel} />],
                ["Data / Hora", formatDateTime(doc.system_time)],
                ...(doc.client.name ? [["Cliente", doc.client.name]] : []),
                ...(doc.client.fiscal_id ? [["NIF", doc.client.fiscal_id]] : []),
                ["Bruto", `€${Math.abs(gross).toFixed(2)}`],
                ["s/ IVA", `€${Math.abs(net).toFixed(2)}`],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-medium text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Items */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Itens
            </h3>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Produto</th>
                    <th className="px-4 py-2 text-right">Qtd</th>
                    <th className="px-4 py-2 text-right">P. Unit.</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item) => {
                    const unit = parseFloat(item.amounts.gross_unit ?? "0");
                    const total = parseFloat(item.amounts.gross_total ?? "0");
                    return (
                      <tr key={item.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-800">{item.title}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{item.qty}</td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          €{unit.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-800">
                          €{total.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-400"
                    >
                      Total
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-bold ${isNC ? "text-red-500" : "text-gray-800"}`}
                    >
                      {isNC ? "−" : ""}€{Math.abs(gross).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Payments */}
          {doc.payments.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Pagamentos
              </h3>
              <div className="space-y-2">
                {doc.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5 text-sm"
                  >
                    <span className="text-gray-700">{p.title}</span>
                    <span className="font-medium text-gray-800">
                      €{parseFloat(p.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Taxes */}
          {doc.taxes.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                IVA
              </h3>
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-400">
                    <tr>
                      <th className="px-4 py-2 text-left">Taxa</th>
                      <th className="px-4 py-2 text-right">Base</th>
                      <th className="px-4 py-2 text-right">IVA</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.taxes.map((t, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-700">{t.rate}%</td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          €{parseFloat(t.base).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          €{parseFloat(t.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-800">
                          €{parseFloat(t.total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Tab navigation ───────────────────────────────────────────────────────────

type Tab = "resumo" | "analise" | "documentos";

const TAB_LABELS: Record<Tab, string> = {
  resumo: "Resumo",
  analise: "Análise",
  documentos: "Documentos",
};

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const tabs: Tab[] = ["resumo", "analise", "documentos"];
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            active === t
              ? "border-b-2 border-[#E8533F] text-[#E8533F]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {TAB_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

// ─── Linked document chip ─────────────────────────────────────────────────────

function LinkedDocChip({
  number,
  type,
  onOpen,
}: {
  number: string;
  type: string;
  onOpen?: () => void;
}) {
  const isNC = type === "NC";
  const colorClass = onOpen
    ? isNC
      ? "bg-red-50 text-red-500 hover:bg-red-100"
      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
    : "bg-gray-100 text-gray-400";
  const title = onOpen
    ? isNC
      ? "Anulado por esta NC — clique para ver"
      : "NC referente a esta fatura — clique para ver"
    : "Documento fora do período selecionado";

  if (onOpen) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className={`ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${colorClass}`}
        title={title}
      >
        ↩ {number}
      </button>
    );
  }
  return (
    <span
      className={`ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${colorClass}`}
      title={title}
    >
      ↩ {number}
    </span>
  );
}

export function VendusView() {
  const now = new Date();
  const [preset, setPreset] = useState<Preset>("today");
  const [customStart, setCustomStart] = useState<Date>(startOfDay(now));
  const [customEnd, setCustomEnd] = useState<Date>(endOfDay(now));
  const [activeTab, setActiveTab] = useState<Tab>("resumo");
  const [docFilter, setDocFilter] = useState<DocFilter>("invoice");
  const [detailDoc, setDetailDoc] = useState<VendusDetailedDocument | null>(null);
  const [docsPage, setDocsPage] = useState(1);
  const [docsPageSize, setDocsPageSize] = useState(10);

  const { start: startDate, end: endDate } = presetRange(preset, customStart, customEnd);

  const since = toDateStr(startDate);
  const until = toDateStr(endDate);

  const {
    documents,
    analytics,
    loading,
    error,
    refresh,
  } = useVendusSummary(since, until);

  const {
    data: selfConsumption,
    loading: selfConsumptionLoading,
    error: selfConsumptionError,
  } = useVendusSelfConsumption(since, until);

  // ── Log: inspecionar related_docs ao carregar ──────────────────────────────
  useEffect(() => {
    if (documents.length === 0) return;
    const withRelated = documents.filter(
      (d) => d.related_docs && d.related_docs.length > 0,
    );
    console.log(
      "[Vendus] related_docs snapshot — total docs:",
      documents.length,
      "| docs com related_docs:",
      withRelated.length,
    );
    withRelated.forEach((d) =>
      console.log(`  ${d.type} ${d.number} (id=${d.id}) →`, d.related_docs),
    );
  }, [documents]);

  // ── Mapas de documentos relacionados ─────────────────────────────────────
  const { docsById, ncForInvoice, cancelledInvoiceIds } = useMemo(() => {
    const docsById = new Map<number, VendusDetailedDocument>(
      documents.map((d) => [d.id, d]),
    );
    // invoice ID → NC que o referencia (construído a partir dos related_docs das NCs)
    const ncForInvoice = new Map<number, VendusDetailedDocument>();
    for (const doc of documents) {
      if (doc.type !== "NC") continue;
      if (!doc.related_docs || doc.related_docs.length === 0) continue;
      for (const rel of doc.related_docs) {
        if (!["FS", "FT"].includes(rel.type)) continue;
        if (!ncForInvoice.has(rel.id)) ncForInvoice.set(rel.id, doc);
      }
    }
    const cancelledInvoiceIds = new Set(ncForInvoice.keys());
    return { docsById, ncForInvoice, cancelledInvoiceIds };
  }, [documents]);

  const handlePresetChange = useCallback(
    (p: Preset, cs: Date, ce: Date) => {
      setPreset(p);
      setCustomStart(cs);
      setCustomEnd(ce);
    },
    [],
  );

  const sortedDocs = [...documents].sort(
    (a, b) => new Date(b.system_time).getTime() - new Date(a.system_time).getTime(),
  );

  const filteredDocs =
    docFilter === "NC"
      ? sortedDocs.filter((d) => d.type === "NC")
      : docFilter === "invoice"
        ? sortedDocs.filter((d) => d.type !== "NC" && !ncForInvoice.has(d.id))
        : sortedDocs;

  const docsStart = (docsPage - 1) * docsPageSize;
  const visibleDocs = filteredDocs.slice(docsStart, docsStart + docsPageSize);

  const tabSpinner = (
    <div className="flex items-center justify-center py-16 text-gray-400">
      A carregar…
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vendus</h1>
          <p className="mt-1 text-sm text-gray-500">
            Faturação do restaurante — Salão e Eatz
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-lg bg-[#E8533F] px-4 py-2 text-sm font-medium text-white hover:bg-[#d44432] disabled:opacity-50"
        >
          {loading ? "A carregar…" : "Atualizar"}
        </button>
      </div>

      {/* Date range */}
      <div className="mb-4">
        <DateRangeSelector
          preset={preset}
          customStart={customStart}
          customEnd={customEnd}
          onChange={handlePresetChange}
        />
      </div>

      {/* Tab bar */}
      <div className="mb-6">
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Resumo ─────────────────────────────────────────────────────────── */}
      {activeTab === "resumo" && (
        loading ? tabSpinner : analytics ? (
          <div className="space-y-6">
            <KpiCards
              summary={analytics.summary}
              byChannel={analytics.byChannel}
              byVatRate={analytics.byVatRate}
            />
            <TemporalChart data={analytics.temporalDistribution} />
          </div>
        ) : null
      )}

      {/* ── Análise ────────────────────────────────────────────────────────── */}
      {activeTab === "analise" && (
        loading ? tabSpinner : analytics ? (
          <div className="space-y-6">
            <ChannelTable
              data={analytics.byChannel}
              documents={documents}
              cancelledInvoiceIds={cancelledInvoiceIds}
              onDocumentDetail={setDetailDoc}
            />
            <CategoryTable
              data={analytics.byCategory}
              topProducts={analytics.topProducts}
            />
            <ProductsByChannelTable data={analytics.productsByChannel} />

            {/* ── Autoconsumo ─────────────────────────────────────────────── */}
            <div className="border-t border-gray-200 pt-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Autoconsumo
              </p>
              {selfConsumptionError && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {selfConsumptionError}
                </div>
              )}
              {selfConsumptionLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  A carregar autoconsumo…
                </div>
              ) : selfConsumption ? (
                <div className="space-y-4">
                  <SelfConsumptionKpiCards analytics={selfConsumption.analytics} />
                  <SelfConsumptionRecordsTable records={selfConsumption.records} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null
      )}

      {/* ── Documentos ─────────────────────────────────────────────────────── */}
      {activeTab === "documentos" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <DocFilterTabs
              active={docFilter}
              onChange={(f) => {
                setDocFilter(f);
                setDocsPage(1);
              }}
            />
            <FilterSummary documents={filteredDocs} docFilter={docFilter} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              A carregar documentos…
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              Sem documentos no período selecionado.
            </div>
          ) : (
            <>
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Canal</th>
                    <th className="px-4 py-3">Número</th>
                    {docFilter === "all" && <th className="px-4 py-3">Tipo</th>}
                    <th className="px-4 py-3">Data / Hora</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Total Bruto</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDocs.map((doc) => {
                    const isNC = doc.type === "NC";
                    return (
                      <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <ChannelBadge channel={doc.channel} />
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-600">
                          {doc.number}
                          {/* NC → mostra a(s) fatura(s) referenciada(s) em related_docs */}
                          {doc.type === "NC" &&
                            doc.related_docs
                              ?.filter((r) => ["FS", "FT"].includes(r.type))
                              .map((r) => {
                                const linked = docsById.get(r.id);
                                return (
                                  <LinkedDocChip
                                    key={r.id}
                                    number={r.number}
                                    type={r.type}
                                    onOpen={
                                      linked
                                        ? () => setDetailDoc(linked)
                                        : undefined
                                    }
                                  />
                                );
                              })}
                          {/* FS/FT → mostra NC que a referencia, se carregada */}
                          {doc.type !== "NC" && ncForInvoice.has(doc.id) && (
                            <LinkedDocChip
                              number={ncForInvoice.get(doc.id)!.number}
                              type="NC"
                              onOpen={() =>
                                setDetailDoc(ncForInvoice.get(doc.id)!)
                              }
                            />
                          )}
                        </td>
                        {docFilter === "all" && (
                          <td className="px-4 py-3">
                            <DocTypeBadge type={doc.type} />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDateTime(doc.system_time)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {doc.client.name || "—"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-semibold ${isNC ? "text-red-500" : "text-gray-800"}`}
                        >
                          {isNC ? "−" : ""}€{Math.abs(parseFloat(doc.amount_gross)).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setDetailDoc(doc)}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#E8533F] hover:bg-red-50"
                          >
                            Ver detalhe
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-gray-100">
                <Pagination
                  total={filteredDocs.length}
                  page={docsPage}
                  pageSize={docsPageSize}
                  onPageChange={setDocsPage}
                  onPageSizeChange={(s) => {
                    setDocsPageSize(s);
                    setDocsPage(1);
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {detailDoc && (
        <DocumentDrawer doc={detailDoc} onClose={() => setDetailDoc(null)} />
      )}
    </div>
  );
}
