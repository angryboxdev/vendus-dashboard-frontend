import { Fragment, useState } from "react";
import type { AirMenuOrder } from "../../domain/entities/air-menu-order.ts";
import type { AirMenuAnalyticsData } from "../../domain/entities/air-menu-analytics.ts";
import { OrderRow } from "./air-menu-shared.tsx";

export type { AirMenuAnalyticsData };

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
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
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
          onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm"
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 text-xs text-gray-400">{start}–{end} de {total}</span>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-gray-300">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`min-w-[28px] rounded-lg px-2 py-1 text-xs ${
                p === page ? "bg-gray-800 font-semibold text-white" : "hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

export function KpiCards({
  summary,
  totalCommission,
  totalCancelled,
  byVatRate,
  byPlatform,
}: {
  summary: AirMenuAnalyticsData["summary"];
  totalCommission: number;
  totalCancelled: number;
  byVatRate: AirMenuAnalyticsData["byVatRate"];
  byPlatform: AirMenuAnalyticsData["byPlatform"];
}) {
  const gross = summary.grossRevenue;
  const liquidFinal = summary.netRevenue - totalCommission;
  const vatPct = gross > 0 ? (summary.vatCollected / gross) * 100 : 0;
  const commissionPct = gross > 0 ? (totalCommission / gross) * 100 : 0;
  const liquidPct = gross > 0 ? (liquidFinal / gross) * 100 : 0;

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
            style={{ width: `${liquidPct}%` }}
            title={`Líquido Final: ${liquidPct.toFixed(1)}%`}
          />
          <div
            className="h-full bg-orange-300 transition-all duration-500"
            style={{ width: `${commissionPct}%` }}
            title={`Comissão: ${commissionPct.toFixed(1)}%`}
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
            Líquido Final ({liquidPct.toFixed(1)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-300" />
            Comissão ({commissionPct.toFixed(1)}%)
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
            <span className="text-base font-bold text-gray-800">
              {fmtEUR(summary.netRevenue)}
            </span>
          </div>
          <div className="flex items-baseline justify-between py-1 pl-4 text-gray-500">
            <span>− Comissão Estimada</span>
            <span className="font-medium">{fmtEUR(totalCommission)}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-gray-200 pt-2.5">
            <span className="font-semibold text-gray-700">= Líquido Final</span>
            <span className="text-xl font-bold text-emerald-600">
              {fmtEUR(liquidFinal)}
            </span>
          </div>
        </div>
      </div>

      {/* Right — 2 cards side by side, stretched to match left height */}
      <div className="grid grid-cols-2 content-stretch gap-4">
        {/* Métricas de Pedidos */}
        {(() => {
          const ALL_PLATFORMS: { name: string; color: string }[] = [
            { name: "Glovo", color: "bg-yellow-400" },
            { name: "Uber Eats", color: "bg-green-400" },
            { name: "Bolt Food", color: "bg-emerald-400" },
          ];
          const paddedPlatforms = ALL_PLATFORMS.map(({ name, color }) => ({
            color,
            ...(byPlatform.find((p) => p.platform === name) ?? {
              platform: name,
              orderCount: 0,
              cancellationCount: 0,
              grossRevenue: 0,
              vatCollected: 0,
              netRevenue: 0,
              averageTicket: 0,
            }),
          }));
          const maxOrders = Math.max(
            ...paddedPlatforms.map((p) => p.orderCount),
            1,
          );
          return (
            <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              {/* Hero numbers */}
              <div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Métricas de Pedidos
                </p>
                <div className="flex justify-between">
                  <div>
                    <p className="text-3xl font-bold text-gray-800">
                      {summary.totalOrders}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Total de Pedidos
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-emerald-600">
                      {fmtEUR(summary.averageTicket)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400 text-right">
                      Ticket Médio
                    </p>
                  </div>
                </div>
              </div>

              {/* Platform distribution */}
              <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-4">
                {paddedPlatforms.map((p) => (
                  <div key={p.platform}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span
                        className={`flex items-center gap-1.5 ${p.orderCount === 0 ? "text-gray-300" : "text-gray-600"}`}
                      >
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${p.orderCount === 0 ? "bg-gray-200" : p.color}`}
                        />
                        {p.platform}
                      </span>
                      <span
                        className={`font-medium ${p.orderCount === 0 ? "text-gray-300" : "text-gray-700"}`}
                      >
                        {p.orderCount}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${p.orderCount === 0 ? "" : p.color}`}
                        style={{
                          width: `${(p.orderCount / maxOrders) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Cancelamentos footnote */}
              <p className="text-xs text-gray-400">
                {totalCancelled} cancelado{totalCancelled !== 1 ? "s" : ""} ·
                taxa {summary.cancellationRate.toFixed(1)}%
              </p>
            </div>
          );
        })()}

        {/* Breakdown por Taxa de IVA */}
        {(() => {
          const ALL_RATES: { rate: number; color: string }[] = [
            { rate: 23, color: "bg-violet-500" },
            { rate: 13, color: "bg-violet-300" },
            { rate: 0, color: "bg-violet-200" },
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
              {/* Top: stacked bar + legend */}
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

              <div className="border-b mt-3 border-gray-100"></div>

              {/* Bottom: rows with inline bars */}
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
                          IVA {fmtEUR(row.vatAmount)} · Líq.{" "}
                          {fmtEUR(row.netRevenue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── By Platform ──────────────────────────────────────────────────────────────

export function PlatformTable({
  data,
  commissions,
  onCommissionChange,
  orders,
  onOrderDetail,
}: {
  data: AirMenuAnalyticsData["byPlatform"];
  commissions: Record<string, number>;
  onCommissionChange: (platform: string, value: number) => void;
  orders: AirMenuOrder[];
  onOrderDetail: (o: AirMenuOrder) => void;
}) {
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(10);

  const togglePlatform = (platform: string) => {
    if (expandedPlatform === platform) {
      setExpandedPlatform(null);
    } else {
      setExpandedPlatform(platform);
      setSubPage(1);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Breakdown por Plataforma
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Plataforma</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-right">Cancelamentos</th>
              <th className="px-4 py-3 text-right">Receita Bruta</th>
              <th className="px-4 py-3 text-right">IVA</th>
              <th className="px-4 py-3 text-right">Receita s/ IVA</th>
              <th className="px-4 py-3 text-right">Comissão %</th>
              <th className="px-4 py-3 text-right">Valor Comissão</th>
              <th className="px-4 py-3 text-right">Líquido Final</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const commission = commissions[row.platform] ?? 30;
              const commissionAmount = row.grossRevenue * (commission / 100);
              const liquidFinal = row.netRevenue - commissionAmount;
              const isExpanded = expandedPlatform === row.platform;
              const platformOrders = orders.filter(
                (o) => o.platform === row.platform,
              );
              const subStart = (subPage - 1) * subPageSize;
              const visibleSubOrders = platformOrders.slice(
                subStart,
                subStart + subPageSize,
              );
              return (
                <Fragment key={row.platform}>
                  <tr
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                    onClick={() => togglePlatform(row.platform)}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-medium text-gray-800">
                        <span className="text-[10px] text-gray-400">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                        {row.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.orderCount}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.cancellationCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {fmtEUR(row.grossRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {fmtEUR(row.vatCollected)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtEUR(row.netRevenue)}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={commission}
                        onChange={(e) =>
                          onCommissionChange(
                            row.platform,
                            Number(e.target.value),
                          )
                        }
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {fmtEUR(commissionAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {fmtEUR(liquidFinal)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-gray-100">
                      <td colSpan={9} className="bg-gray-50 p-0">
                        {platformOrders.length === 0 ? (
                          <div className="flex items-center justify-center py-6 text-sm text-gray-400">
                            Sem pedidos faturados para {row.platform} neste período.
                          </div>
                        ) : (
                          <>
                            <table className="w-full text-left text-sm">
                              <thead className="border-b border-gray-200 bg-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <tr>
                                  <th className="px-6 py-2">ID Plataforma</th>
                                  <th className="px-4 py-2">Documento</th>
                                  <th className="px-4 py-2">Data Documento</th>
                                  <th className="px-4 py-2">Cliente</th>
                                  <th className="px-4 py-2">Itens</th>
                                  <th className="px-4 py-2">Total</th>
                                  <th className="px-4 py-2">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visibleSubOrders.map((order) => (
                                  <OrderRow
                                    key={`${order.orderId}-${order.divisionName}`}
                                    order={order}
                                    onDetail={onOrderDetail}
                                    showPlatformCol={false}
                                    showDocumentCol={true}
                                  />
                                ))}
                              </tbody>
                            </table>
                            <div className="border-t border-gray-200">
                              <Pagination
                                total={platformOrders.length}
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

// ─── By Category ──────────────────────────────────────────────────────────────

export function CategoryTable({
  data,
  topItems,
}: {
  data: AirMenuAnalyticsData["byCategory"];
  topItems: AirMenuAnalyticsData["topItems"];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<string | null>(null);
  const [commission, setCommission] = useState(30);

  const toggle = (cat: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const toggleItems = (cat: string) =>
    setExpandedItems((prev) => (prev === cat ? null : cat));

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Breakdown por Categoria
        </p>
        <label className="flex items-center gap-2 text-xs text-gray-500">
          Comissão global
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
            className="w-14 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm"
          />
          <span>%</span>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-right">Itens</th>
              <th className="px-4 py-3 text-right">Receita Bruta</th>
              <th className="px-4 py-3 text-right">IVA</th>
              <th className="px-4 py-3 text-right">Receita s/ IVA</th>
              <th className="px-4 py-3 text-right">Líquido Final</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isOpen = expanded.has(row.category);
              const isItemsOpen = expandedItems === row.category;
              const hasSubs = row.subcategories.length > 0;
              const commissionAmount = row.grossRevenue * (commission / 100);
              const liquidFinal = row.netRevenue - commissionAmount;

              // Collect all category names that belong to this top-level row
              const categoryNames = new Set([
                row.category,
                ...row.subcategories.map((s) => s.category),
              ]);
              const categoryItems = topItems.filter((item) =>
                categoryNames.has(item.category),
              );

              return (
                <Fragment key={row.category}>
                  <tr
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                    onClick={() => toggleItems(row.category)}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-medium text-gray-800">
                        <span className="text-[10px] text-gray-400">
                          {isItemsOpen ? "▲" : "▼"}
                        </span>
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.itemsSold}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {fmtEUR(row.grossRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {fmtEUR(row.vatCollected)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtEUR(row.netRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {fmtEUR(liquidFinal)}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hasSubs && (
                        <button
                          onClick={() => toggle(row.category)}
                          className="rounded px-2 py-0.5 text-xs font-medium text-[#E8533F] hover:bg-red-50"
                        >
                          {isOpen ? "▲ Fechar" : "▼ Ver sub"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen &&
                    row.subcategories.map((sub) => {
                      const subCommissionAmount =
                        sub.grossRevenue * (commission / 100);
                      const subLiquidFinal =
                        sub.netRevenue - subCommissionAmount;
                      return (
                        <tr
                          key={`${row.category}-${sub.category}`}
                          className="border-t border-gray-50 bg-gray-50"
                        >
                          <td className="py-2 pl-10 pr-4 text-gray-500">
                            ↳ {sub.category}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {sub.itemsSold}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {fmtEUR(sub.grossRevenue)}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400">
                            {fmtEUR(sub.vatCollected)}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {fmtEUR(sub.netRevenue)}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-emerald-600">
                            {fmtEUR(subLiquidFinal)}
                          </td>
                          <td />
                        </tr>
                      );
                    })}
                  {isItemsOpen && (
                    <tr className="border-t border-gray-100">
                      <td colSpan={7} className="bg-gray-50 p-0">
                        {categoryItems.length === 0 ? (
                          <div className="flex items-center justify-center py-6 text-sm text-gray-400">
                            Sem itens para {row.category} neste período.
                          </div>
                        ) : (
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-gray-200 bg-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              <tr>
                                <th className="px-6 py-2">Produto</th>
                                <th className="px-4 py-2">Categoria</th>
                                <th className="px-4 py-2 text-right">IVA</th>
                                <th className="px-4 py-2 text-right">Qtd Vendida</th>
                                <th className="px-4 py-2 text-right">Receita Bruta</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryItems.map((item) => (
                                <tr
                                  key={item.plu}
                                  className="border-b border-gray-100 hover:bg-white"
                                >
                                  <td className="px-6 py-2.5 font-medium text-gray-800">
                                    {item.title}
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-500">
                                    {item.category}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-gray-500">
                                    {item.vatRate}%
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-medium text-gray-700">
                                    {item.quantitySold}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                                    {fmtEUR(item.grossRevenue)}
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

// ─── Top Items ────────────────────────────────────────────────────────────────

export function TopItemsTable({ data }: { data: AirMenuAnalyticsData["topItems"] }) {
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
            <th className="px-4 py-3 text-right">Qtd Vendida</th>
            <th className="px-4 py-3 text-right">Receita Bruta</th>
          </tr>
        </thead>
        <tbody>
          {pageData.map((item, i) => (
            <tr key={item.plu} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-400">{start + i + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-800">{item.title}</td>
              <td className="px-4 py-3 text-gray-600">{item.category}</td>
              <td className="px-4 py-3 text-right text-gray-600">{item.quantitySold}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-800">
                {fmtEUR(item.grossRevenue)}
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
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}

// ─── Temporal Distribution ────────────────────────────────────────────────────

export function TemporalChart({
  data,
}: {
  data: AirMenuAnalyticsData["temporalDistribution"];
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
                    title={`${d.period}: ${fmtEUR(d.grossRevenue)} (${d.orderCount} pedidos)`}
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

