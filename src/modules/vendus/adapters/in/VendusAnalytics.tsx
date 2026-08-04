import { Fragment, useState } from "react";
import type {
  VendusAnalytics,
  VendusChannelStats,
} from "../../domain/entities/vendus-analytics.ts";

import type { VendusDetailedDocument } from "../../domain/entities/vendus-document.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEUR(v: number): string {
  return `€${v.toFixed(2)}`;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export function Pagination({
  total,
  page,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-500">
      <div className="flex items-center gap-2">
        <span className="text-xs">Linhas por página</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm"
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 text-xs text-gray-400">
          {start}–{end} de {total}
        </span>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-gray-300">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`min-w-[28px] rounded-lg px-2 py-1 text-xs ${
                p === page
                  ? "bg-gray-800 font-semibold text-white"
                  : "hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── KPI Cards (financial waterfall + channel metrics + IVA) ─────────────────

export function KpiCards({
  summary,
  byChannel,
  byVatRate,
}: {
  summary: VendusAnalytics["summary"];
  byChannel: VendusChannelStats[];
  byVatRate: VendusAnalytics["byVatRate"];
}) {
  const gross = summary.grossRevenue;
  const vatPct = gross > 0 ? (summary.vatCollected / gross) * 100 : 0;
  const netPct = gross > 0 ? (summary.netRevenue / gross) * 100 : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Financial waterfall */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Fluxo Financeiro
        </p>

        {/* Stacked bar */}
        <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${netPct}%` }}
            title={`Líquido: ${netPct.toFixed(1)}%`}
          />
          <div
            className="h-full bg-red-300 transition-all duration-500"
            style={{ width: `${vatPct}%` }}
            title={`IVA: ${vatPct.toFixed(1)}%`}
          />
        </div>

        {/* Legend */}
        <div className="mb-5 flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
            Líquido s/ IVA ({netPct.toFixed(1)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-300" />
            IVA ({vatPct.toFixed(1)}%)
          </span>
        </div>

        {/* Breakdown rows */}
        <div className="space-y-1 text-sm">
          <div className="flex items-baseline justify-between py-1.5">
            <span className="text-gray-600">Receita Bruta</span>
            <span className="text-lg font-bold text-gray-800">
              {fmtEUR(gross)}
            </span>
          </div>
          <div className="flex items-baseline justify-between py-1 pl-4 text-gray-500">
            <span>− IVA Cobrado</span>
            <span className="font-medium">{fmtEUR(summary.vatCollected)}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-gray-200 pt-2.5">
            <span className="font-semibold text-gray-700">
              = Receita s/ IVA
            </span>
            <span className="text-xl font-bold text-emerald-600">
              {fmtEUR(summary.netRevenue)}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-gray-100 pt-2 text-xs text-gray-400">
            <span>
              {summary.totalDocuments} faturas · {summary.totalCreditNotes} NC
            </span>
            <span>Ticket médio {fmtEUR(summary.averageTicket)}</span>
          </div>
        </div>
      </div>

      {/* Right — channel metrics + IVA breakdown */}
      <div className="grid grid-cols-2 content-stretch gap-4">
        {/* Channel metrics */}
        <ChannelMetricsCard byChannel={byChannel} summary={summary} />

        {/* IVA breakdown */}
        <VatRateCard byVatRate={byVatRate} />
      </div>
    </div>
  );
}

function ChannelMetricsCard({
  byChannel,
  summary,
}: {
  byChannel: VendusChannelStats[];
  summary: VendusAnalytics["summary"];
}) {
  const CHANNELS: {
    channel: "salao" | "eatz";
    label: string;
    color: string;
  }[] = [
    { channel: "salao", label: "Salão", color: "bg-blue-400" },
    { channel: "eatz", label: "Eatz", color: "bg-orange-400" },
  ];

  const padded = CHANNELS.map(({ channel, label, color }) => ({
    label,
    color,
    ...(byChannel.find((c) => c.channel === channel) ?? {
      channel,
      documentCount: 0,
      creditNoteCount: 0,
      grossRevenue: 0,
      vatCollected: 0,
      netRevenue: 0,
      averageTicket: 0,
      takeAwayCount: 0,
    }),
  }));

  const takeAwayCount =
    byChannel.find((c) => c.channel === "salao")?.takeAwayCount ?? 0;

  const maxDocs = Math.max(
    ...padded.map((c) => c.documentCount),
    takeAwayCount,
    1,
  );

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Canais de Venda
        </p>
        <div className="flex justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-800">
              {summary.totalDocuments}
            </p>
            <p className="mt-1 text-xs text-gray-400">Total de Faturas</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-emerald-600">
              {fmtEUR(summary.averageTicket)}
            </p>
            <p className="mt-1 text-right text-xs text-gray-400">
              Ticket Médio
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-4">
        {padded
          .filter((c) => c.channel === "salao")
          .map((c) => (
            <div key={c.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span
                  className={`flex items-center gap-1.5 ${c.documentCount === 0 ? "text-gray-300" : "text-gray-600"}`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${c.documentCount === 0 ? "bg-gray-200" : c.color}`}
                  />
                  {c.label}
                </span>
                <span
                  className={`font-medium ${c.documentCount === 0 ? "text-gray-300" : "text-gray-700"}`}
                >
                  {c.documentCount}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${c.documentCount === 0 ? "" : c.color}`}
                  style={{ width: `${(c.documentCount / maxDocs) * 100}%` }}
                />
              </div>
            </div>
          ))}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span
              className={`flex items-center gap-1.5 ${takeAwayCount === 0 ? "text-gray-300" : "text-gray-600"}`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${takeAwayCount === 0 ? "bg-gray-200" : "bg-sky-300"}`}
              />
              Take Away
            </span>
            <span
              className={`font-medium ${takeAwayCount === 0 ? "text-gray-300" : "text-gray-700"}`}
            >
              {takeAwayCount}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${takeAwayCount === 0 ? "" : "bg-sky-300"}`}
              style={{ width: `${(takeAwayCount / maxDocs) * 100}%` }}
            />
          </div>
        </div>
        {padded
          .filter((c) => c.channel === "eatz")
          .map((c) => (
            <div key={c.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span
                  className={`flex items-center gap-1.5 ${c.documentCount === 0 ? "text-gray-300" : "text-gray-600"}`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${c.documentCount === 0 ? "bg-gray-200" : c.color}`}
                  />
                  {c.label}
                </span>
                <span
                  className={`font-medium ${c.documentCount === 0 ? "text-gray-300" : "text-gray-700"}`}
                >
                  {c.documentCount}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${c.documentCount === 0 ? "" : c.color}`}
                  style={{ width: `${(c.documentCount / maxDocs) * 100}%` }}
                />
              </div>
            </div>
          ))}
      </div>

      {summary.totalCreditNotes > 0 && (
        <p className="text-xs text-gray-400">
          {summary.totalCreditNotes} nota
          {summary.totalCreditNotes !== 1 ? "s" : ""} de crédito
        </p>
      )}
    </div>
  );
}

function VatRateCard({
  byVatRate,
}: {
  byVatRate: VendusAnalytics["byVatRate"];
}) {
  const ALL_RATES: { rate: number; color: string }[] = [
    { rate: 23, color: "bg-violet-400" },
    { rate: 13, color: "bg-violet-500" },
    { rate: 6, color: "bg-violet-300" },
  ];

  const padded = ALL_RATES.map(({ rate, color }) => ({
    color,
    ...(byVatRate.find((r) => r.rate === rate) ?? {
      rate,
      grossRevenue: 0,
      vatAmount: 0,
      netRevenue: 0,
    }),
  }));

  const totalGross = padded.reduce((s, r) => s + r.grossRevenue, 0);
  const maxGross = Math.max(...padded.map((r) => r.grossRevenue), 1);

  const colorOf = (rate: number) =>
    ALL_RATES.find((r) => r.rate === rate)?.color ?? "bg-gray-200";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Breakdown por Taxa de IVA
        </p>
        <div className="mb-2 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          {padded.map((row) => (
            <div
              key={row.rate}
              className={`h-full transition-all duration-500 ${colorOf(row.rate)}`}
              style={{
                width: `${totalGross > 0 ? (row.grossRevenue / totalGross) * 100 : 0}%`,
              }}
              title={`${row.rate}%: ${fmtEUR(row.grossRevenue)}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {padded.map((row) => (
            <span
              key={row.rate}
              className={`flex items-center gap-1 text-xs ${row.grossRevenue === 0 ? "text-gray-300" : "text-gray-500"}`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-sm ${row.grossRevenue === 0 ? "bg-gray-200" : colorOf(row.rate)}`}
              />
              {row.rate}%
            </span>
          ))}
        </div>
      </div>

      <div className="border-b mt-3 border-gray-100" />

      <div className="flex flex-col gap-3 pt-4">
        {padded.map((row) => {
          const empty = row.grossRevenue === 0;
          const sharePct =
            totalGross > 0 ? (row.grossRevenue / totalGross) * 100 : 0;
          const barPct = (row.grossRevenue / maxGross) * 100;
          return (
            <div key={row.rate}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span
                  className={`font-semibold ${empty ? "text-gray-300" : "text-gray-700"}`}
                >
                  {row.rate}%
                </span>
                <span
                  className={`font-semibold ${empty ? "text-gray-300" : "text-emerald-600"}`}
                >
                  {fmtEUR(row.grossRevenue)}
                </span>
              </div>
              <div className="mb-1 h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${empty ? "" : colorOf(row.rate)}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <div
                className={`flex justify-between text-xs ${empty ? "text-gray-200" : "text-gray-400"}`}
              >
                <span>{sharePct.toFixed(1)}% da receita</span>
                <span>
                  IVA {fmtEUR(row.vatAmount)} · Líq. {fmtEUR(row.netRevenue)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Temporal Chart ───────────────────────────────────────────────────────────

export function TemporalChart({
  data,
}: {
  data: VendusAnalytics["temporalDistribution"];
}) {
  const max = Math.max(...data.map((d) => d.grossRevenue), 1);
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Distribuição Temporal — Receita Bruta
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-end gap-1" style={{ height: "120px" }}>
          {data.map((d) => {
            const heightPct = (d.grossRevenue / max) * 100;
            return (
              <div
                key={d.period}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className="flex w-full flex-col justify-end"
                  style={{ height: "96px" }}
                >
                  <div
                    title={`${d.period}: ${fmtEUR(d.grossRevenue)} (${d.documentCount} docs)`}
                    className="w-full rounded-t-sm bg-[#E8533F] opacity-80 transition-opacity hover:opacity-100"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: d.grossRevenue > 0 ? "4px" : "0",
                    }}
                  />
                </div>
                <span className="w-full truncate text-center text-[10px] leading-none text-gray-400">
                  {d.period}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Category Badge ───────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  pizza: "Pizza",
  bebida_alcoolica: "Bebida Alcoólica",
  bebida_nao_alcoolica: "Bebida Não Alcoólica",
  sacos: "Sacos",
  outros: "Outros",
};

const CATEGORY_COLORS: Record<string, string> = {
  pizza: "bg-gray-500 text-gray-100",
  bebida_alcoolica: "bg-gray-500 text-gray-100",
  bebida_nao_alcoolica: "bg-gray-500 text-gray-100",
  sacos: "bg-gray-500 text-gray-100",
  outros: "bg-gray-500 text-gray-100",
};

export function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category] ?? category;
  const cls = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Channel Table ────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  salao: "Salão",
  take_away: "Take Away",
  eatz: "Eatz",
};

const CHANNEL_COLORS: Record<string, string> = {
  salao: "bg-blue-100 text-blue-700",
  take_away: "bg-red-100 text-red-700",
  eatz: "bg-green-100 text-green-700",
};

export function ChannelBadge({ channel }: { channel: string }) {
  const label = CHANNEL_LABELS[channel] ?? channel;
  const cls = CHANNEL_COLORS[channel] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function computeChannelStats(
  docs: VendusDetailedDocument[],
  cancelledInvoiceIds: Set<number>,
) {
  const invoices = docs.filter((d) => d.type !== "NC");
  const ncs = docs.filter((d) => d.type === "NC");

  const invoiceGross = invoices.reduce(
    (s, d) => s + parseFloat(d.amount_gross),
    0,
  );
  const invoiceNet = invoices.reduce((s, d) => s + parseFloat(d.amount_net), 0);
  const ncGross = ncs.reduce((s, d) => s + parseFloat(d.amount_gross), 0);
  const ncNet = ncs.reduce((s, d) => s + parseFloat(d.amount_net), 0);

  const grossRevenue = invoiceGross - ncGross;
  const netRevenue = invoiceNet - ncNet;

  // averageTicket excludes invoices cancelled by an NC in the same period
  const activeInvoices = invoices.filter((d) => !cancelledInvoiceIds.has(d.id));
  const activeGross = activeInvoices.reduce(
    (s, d) => s + parseFloat(d.amount_gross),
    0,
  );

  return {
    documentCount: invoices.length,
    creditNoteCount: ncs.length,
    grossRevenue,
    netRevenue,
    vatCollected: grossRevenue - netRevenue,
    averageTicket:
      activeInvoices.length > 0 ? activeGross / activeInvoices.length : 0,
  };
}

export function ChannelTable({
  documents,
  cancelledInvoiceIds,
  onDocumentDetail,
}: {
  data: VendusChannelStats[];
  documents: VendusDetailedDocument[];
  cancelledInvoiceIds: Set<number>;
  onDocumentDetail: (d: VendusDetailedDocument) => void;
}) {
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(10);

  const toggleChannel = (channel: string) => {
    if (expandedChannel === channel) {
      setExpandedChannel(null);
    } else {
      setExpandedChannel(channel);
      setSubPage(1);
    }
  };

  const channelGroups: Array<{
    channel: string;
    docs: VendusDetailedDocument[];
  }> = [
    { channel: "salao", docs: documents.filter((d) => d.channel === "salao") },
    {
      channel: "take_away",
      docs: documents.filter((d) => d.channel === "take_away"),
    },
    { channel: "eatz", docs: documents.filter((d) => d.channel === "eatz") },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Breakdown por Canal
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Canal</th>
              <th className="px-4 py-3 text-right">Faturas</th>
              <th className="px-4 py-3 text-right">NC</th>
              <th className="px-4 py-3 text-right">Receita Bruta</th>
              <th className="px-4 py-3 text-right">IVA</th>
              <th className="px-4 py-3 text-right">Receita s/ IVA</th>
              <th className="px-4 py-3 text-right">Ticket Médio</th>
            </tr>
          </thead>
          <tbody>
            {channelGroups.map(({ channel, docs }) => {
              const stats = computeChannelStats(docs, cancelledInvoiceIds);
              const isExpanded = expandedChannel === channel;
              const subStart = (subPage - 1) * subPageSize;
              const visibleSubDocs = docs.slice(
                subStart,
                subStart + subPageSize,
              );

              return (
                <Fragment key={channel}>
                  <tr
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                    onClick={() => toggleChannel(channel)}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                        <ChannelBadge channel={channel} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {stats.documentCount}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {stats.creditNoteCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {fmtEUR(stats.grossRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {fmtEUR(stats.vatCollected)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtEUR(stats.netRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {fmtEUR(stats.averageTicket)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-gray-100">
                      <td colSpan={7} className="bg-gray-50 p-0">
                        {docs.length === 0 ? (
                          <div className="flex items-center justify-center py-6 text-sm text-gray-400">
                            Sem documentos para{" "}
                            {CHANNEL_LABELS[channel] ?? channel}.
                          </div>
                        ) : (
                          <>
                            <table className="w-full text-left text-sm">
                              <thead className="border-b border-gray-200 bg-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <tr>
                                  <th className="px-6 py-2">Número</th>
                                  <th className="px-4 py-2">Tipo</th>
                                  <th className="px-4 py-2">Data</th>
                                  <th className="px-4 py-2">Cliente</th>
                                  <th className="px-4 py-2 text-right">
                                    Total
                                  </th>
                                  <th className="px-4 py-2">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visibleSubDocs.map((doc) => (
                                  <DocumentSubRow
                                    key={doc.id}
                                    doc={doc}
                                    onDetail={onDocumentDetail}
                                  />
                                ))}
                              </tbody>
                            </table>
                            <div className="border-t border-gray-200">
                              <Pagination
                                total={docs.length}
                                page={subPage}
                                pageSize={subPageSize}
                                onPageChange={setSubPage}
                                onPageSizeChange={(s) => {
                                  setSubPageSize(s);
                                  setSubPage(1);
                                }}
                              />
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Category Table ───────────────────────────────────────────────────────────

export function CategoryTable({
  data,
  topProducts,
}: {
  data: VendusAnalytics["byCategory"];
  topProducts: VendusAnalytics["topProducts"];
}) {
  const [expandedItems, setExpandedItems] = useState<string | null>(null);

  const toggleItems = (cat: string) =>
    setExpandedItems((prev) => (prev === cat ? null : cat));

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Breakdown por Categoria
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-right">Itens Vendidos</th>
              <th className="px-4 py-3 text-right">Receita Bruta</th>
              <th className="px-4 py-3 text-right">IVA</th>
              <th className="px-4 py-3 text-right">Receita s/ IVA</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isItemsOpen = expandedItems === row.category;
              const categoryProducts = topProducts.filter(
                (p) => p.category === row.category,
              );

              return (
                <Fragment key={row.category}>
                  <tr
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                    onClick={() => toggleItems(row.category)}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">
                          {isItemsOpen ? "▲" : "▼"}
                        </span>
                        <CategoryBadge category={row.category} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.quantitySold}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {fmtEUR(row.grossRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {fmtEUR(row.vatCollected)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {fmtEUR(row.netRevenue)}
                    </td>
                  </tr>
                  {isItemsOpen && (
                    <tr className="border-t border-gray-100">
                      <td colSpan={5} className="bg-gray-50 p-0">
                        {categoryProducts.length === 0 ? (
                          <div className="flex items-center justify-center py-6 text-sm text-gray-400">
                            Sem produtos para {row.category} neste período.
                          </div>
                        ) : (
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-gray-200 bg-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              <tr>
                                <th className="px-6 py-2">Produto</th>
                                <th className="px-4 py-2 text-right">IVA</th>
                                <th className="px-4 py-2 text-right">
                                  Qtd Vendida
                                </th>
                                <th className="px-4 py-2 text-right">
                                  Receita Bruta
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryProducts.map((p) => (
                                <tr
                                  key={p.reference}
                                  className="border-b border-gray-100 hover:bg-white"
                                >
                                  <td className="px-6 py-2.5 font-medium text-gray-800">
                                    {p.title}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-gray-500">
                                    {p.vatRate}%
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-medium text-gray-700">
                                    {p.quantitySold}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                                    {fmtEUR(p.grossRevenue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Top Products Table ───────────────────────────────────────────────────────

export function TopProductsTable({
  data,
}: {
  data: VendusAnalytics["topProducts"];
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const start = (page - 1) * pageSize;
  const pageData = data.slice(start, start + pageSize);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Produtos ({data.length})
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">#</th>
            <th className="px-4 py-3 text-left">Produto</th>
            <th className="px-4 py-3 text-left">Categoria</th>
            <th className="px-4 py-3 text-right">IVA</th>
            <th className="px-4 py-3 text-right">Qtd Vendida</th>
            <th className="px-4 py-3 text-right">Receita Bruta</th>
          </tr>
        </thead>
        <tbody>
          {pageData.map((p, i) => (
            <tr
              key={p.reference}
              className="border-t border-gray-100 hover:bg-gray-50"
            >
              <td className="px-4 py-3 text-gray-400">{start + i + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-800">{p.title}</td>
              <td className="px-4 py-3">
                <CategoryBadge category={p.category} />
              </td>
              <td className="px-4 py-3 text-right text-gray-500">
                {p.vatRate}%
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {p.quantitySold}
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-800">
                {fmtEUR(p.grossRevenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-gray-100">
        <Pagination
          total={data.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}

// ─── Document sub-row (used inside channel expand) ────────────────────────────

function DocumentSubRow({
  doc,
  onDetail,
}: {
  doc: VendusDetailedDocument;
  onDetail: (d: VendusDetailedDocument) => void;
}) {
  const isNC = doc.type === "NC";
  return (
    <tr className="border-b border-gray-100 hover:bg-white">
      <td className="px-6 py-2.5 font-mono text-sm text-gray-600">
        {doc.number}
      </td>
      <td className="px-4 py-2.5">
        <DocTypeBadge type={doc.type} />
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-600">
        {doc.date.slice(0, 10)}
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-700">
        {doc.client.name || "—"}
      </td>
      <td
        className={`px-4 py-2.5 text-right text-sm font-semibold ${isNC ? "text-red-500" : "text-gray-800"}`}
      >
        {isNC ? "−" : ""}€{Math.abs(parseFloat(doc.amount_gross)).toFixed(2)}
      </td>
      <td className="px-4 py-2.5">
        <button
          onClick={() => onDetail(doc)}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#E8533F] hover:bg-red-50"
        >
          Ver detalhe
        </button>
      </td>
    </tr>
  );
}

// ─── DocTypeBadge ─────────────────────────────────────────────────────────────

export function DocTypeBadge({ type }: { type: string }) {
  if (type === "NC") {
    return (
      <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        NC
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      {type}
    </span>
  );
}
