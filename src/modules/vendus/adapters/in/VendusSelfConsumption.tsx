import { Fragment, useState } from "react";
import type {
  VendusSelfConsumptionAnalytics,
  VendusSelfConsumptionRecord,
} from "../../domain/entities/vendus-selfconsumption.ts";

import { CategoryBadge } from "./VendusAnalytics.tsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEUR(v: number): string {
  return `€${v.toFixed(2)}`;
}

function fmtDatetime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

const CATEGORY_META: { key: string; label: string; color: string }[] = [
  { key: "pizza", label: "Pizza", color: "bg-blue-400" },
  { key: "bebida_alcoolica", label: "Bebida Alc.", color: "bg-violet-400" },
  { key: "bebida_nao_alcoolica", label: "Bebida s/ Álc.", color: "bg-sky-300" },
  { key: "sacos", label: "Sacos", color: "bg-emerald-400" },
  { key: "outros", label: "Outros", color: "bg-gray-300" },
];

export function SelfConsumptionKpiCards({
  analytics,
}: {
  analytics: VendusSelfConsumptionAnalytics;
}) {
  const catTotal = analytics.byCategory.reduce((s, c) => s + c.qty, 0);
  const topEmployee = analytics.byEmployee[0];
  const maxEmpSpending = topEmployee?.totalSpending ?? 1;
  const distinctEmployees = analytics.byEmployee.length;
  const topOriginPct =
    analytics.totalSpending > 0 && topEmployee
      ? (topEmployee.totalSpending / analytics.totalSpending) * 100
      : 0;

  const EMP_COLORS = [
    "bg-emerald-400",
    "bg-blue-400",
    "bg-violet-400",
    "bg-sky-300",
  ];

  const enrichedCats = CATEGORY_META.flatMap(({ key, label, color }) => {
    const found = analytics.byCategory.find((c) => c.category === key);
    return found && found.qty > 0 ? [{ label, color, qty: found.qty }] : [];
  });

  const maxCatQty = Math.max(...enrichedCats.map((c) => c.qty), 1);

  return (
    <div className="flex gap-4">
      {/* Card 1+2 merged: Total Gasto + breakdown por categoria */}
      <div className="w-1/4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Total Gasto
        </p>

        {/* Headline metrics */}
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-xl font-bold text-emerald-600">
              {fmtEUR(analytics.totalSpending)}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {analytics.recordCount} registo
              {analytics.recordCount !== 1 ? "s" : ""}
            </p>
          </div>
          {analytics.totalItemsConsumed > 0 && (
            <div className="text-right">
              <p className="text-lg font-bold text-gray-800">
                {analytics.totalItemsConsumed}
              </p>
              <p className="mt-1 text-xs text-gray-400">itens consumidos</p>
            </div>
          )}
        </div>

        {/* Stacked bar */}
        <div className="mb-2 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          {enrichedCats.map(({ label, color, qty }) => (
            <div
              key={label}
              className={`h-full transition-all duration-500 ${color}`}
              style={{
                width: catTotal > 0 ? `${(qty / catTotal) * 100}%` : "0%",
              }}
              title={label}
            />
          ))}
        </div>

        {/* Category breakdown */}
        <div className=" border-gray-100 pt-4 space-y-2.5">
          {enrichedCats.map(({ label, color, qty }) => {
            const pct = catTotal > 0 ? (qty / catTotal) * 100 : 0;
            const barPct = (qty / maxCatQty) * 100;
            return (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${color}`}
                    />
                    {label}
                  </span>
                  <span className="font-semibold text-gray-700">{qty}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  {pct.toFixed(0)}% dos itens
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card 3: Equipa */}
      <div className="w-1/4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Origem do Consumo
        </p>
        {topEmployee ? (
          <>
            {/* Headline metrics */}
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <p className="text-xl font-bold text-gray-800">
                  {distinctEmployees}
                </p>
                <p className="mt-1 text-xs text-gray-400">origens</p>
              </div>
              {topOriginPct > 0 && (
                <div className="text-right">
                  <p className="text-xl font-bold text-emerald-600">
                    {topOriginPct.toFixed(0)}%
                  </p>
                  <p className="mt-1 text-xs text-gray-400">concentração</p>
                </div>
              )}
            </div>

            {/* Stacked bar: each employee's share of total spending */}
            <div className="mb-2 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              {analytics.byEmployee.slice(0, 4).map((e, i) => {
                const sharePct =
                  analytics.totalSpending > 0
                    ? (e.totalSpending / analytics.totalSpending) * 100
                    : 0;
                return (
                  <div
                    key={e.employeeName}
                    className={`h-full transition-all duration-500 ${EMP_COLORS[i] ?? "bg-gray-300"}`}
                    style={{ width: `${sharePct}%` }}
                    title={`${e.employeeName}: ${sharePct.toFixed(0)}%`}
                  />
                );
              })}
            </div>

            {/* Employee list */}
            <div className=" border-gray-100 pt-4 space-y-2.5">
              {analytics.byEmployee.slice(0, 4).map((e, i) => {
                const barPct =
                  maxEmpSpending > 0
                    ? (e.totalSpending / maxEmpSpending) * 100
                    : 0;
                const sharePct =
                  analytics.totalSpending > 0
                    ? (e.totalSpending / analytics.totalSpending) * 100
                    : 0;
                const color = EMP_COLORS[i] ?? "bg-gray-300";
                return (
                  <div key={e.employeeName}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span
                        className={`flex items-center gap-1.5 truncate text-gray-600`}
                      >
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
                        />
                        {e.employeeName}
                      </span>
                      <span className="ml-2 shrink-0 font-semibold text-gray-700">
                        {sharePct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {fmtEUR(e.totalSpending)} · {e.recordCount} ocorrência
                      {e.recordCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-400">—</p>
        )}
      </div>

      {/* Card: Produtos Consumidos */}
      {analytics.topProducts.length > 0 &&
        (() => {
          const catColor = (cat: string) =>
            CATEGORY_META.find((m) => m.key === cat)?.color ?? "bg-gray-300";
          const topQty = analytics.topProducts[0]?.qty ?? 0;
          return (
            <div className="flex-1 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Produtos Consumidos
              </p>

              <div className="mb-4 flex items-baseline justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {analytics.topProducts.length}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    produto{analytics.topProducts.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{topQty}</p>
                  <p className="mt-1 text-xs text-gray-400">qtd máxima</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                {analytics.topProducts.map((p) => {
                  const color = catColor(p.category);
                  return (
                    <div
                      key={p.reference}
                      className="flex items-center justify-between gap-2 min-w-0"
                    >
                      <span className="flex items-center gap-1.5 truncate text-xs text-gray-600">
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
                        />
                        <span className="truncate">
                          {p.title || p.reference}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-gray-700">
                        {p.qty}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// ─── By Employee ──────────────────────────────────────────────────────────────

export function SelfConsumptionByEmployee({
  analytics,
}: {
  analytics: VendusSelfConsumptionAnalytics;
}) {
  const { byEmployee, totalSpending } = analytics;
  if (byEmployee.length === 0) return null;

  const max = Math.max(...byEmployee.map((e) => e.totalSpending), 1);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Por Funcionário
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Funcionário</th>
            <th className="px-4 py-3 text-right">Ocorrências</th>
            <th className="px-4 py-3 text-right">Total Gasto</th>
            <th className="px-4 py-3 text-right">% do Total</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {byEmployee.map((e) => {
            const pct =
              totalSpending > 0 ? (e.totalSpending / totalSpending) * 100 : 0;
            const barPct = (e.totalSpending / max) * 100;
            return (
              <tr
                key={e.employeeName}
                className="border-t border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-gray-800">
                  {e.employeeName}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {e.recordCount}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {fmtEUR(e.totalSpending)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {pct.toFixed(1)}%
                </td>
                <td className="px-4 py-3 w-32">
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#E8533F] transition-all duration-500"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Top Products + By Category ───────────────────────────────────────────────

export function SelfConsumptionProductsAndCategories({
  analytics,
}: {
  analytics: VendusSelfConsumptionAnalytics;
}) {
  const { topProducts, byCategory } = analytics;
  if (topProducts.length === 0 && byCategory.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Top products */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Produtos Mais Consumidos
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Produto</th>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-right">Qtd</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p, i) => (
              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">
                  {p.title || p.reference}
                </td>
                <td className="px-4 py-2.5">
                  <CategoryBadge category={p.category} />
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-700">
                  {p.qty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* By category */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Por Categoria
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-right">Qtd Consumida</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {byCategory.map((c) => {
              const maxQty = Math.max(...byCategory.map((x) => x.qty), 1);
              return (
                <tr
                  key={c.category}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-2.5">
                    <CategoryBadge category={c.category} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-700">
                    {c.qty}
                  </td>
                  <td className="px-4 py-2.5 w-28">
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gray-400 transition-all duration-500"
                        style={{ width: `${(c.qty / maxQty) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Records Table ────────────────────────────────────────────────────────────

export function SelfConsumptionRecordsTable({
  records,
}: {
  records: VendusSelfConsumptionRecord[];
}) {
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());

  const toggle = (id: string | number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400 shadow-sm">
        Sem registos de autoconsumo no período.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Registos ({records.length})
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Data / Hora</th>
            <th className="px-4 py-3 text-left">Funcionário</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Itens</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const isOpen = expanded.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                  onClick={() => toggle(r.id)}
                >
                  <td className="px-4 py-3 text-gray-600">
                    <span className="mr-2 text-[10px] text-gray-400">
                      {isOpen ? "▲" : "▼"}
                    </span>
                    {fmtDatetime(r.datetime)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {r.employeeName}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {r.totalSpending > 0 ? fmtEUR(r.totalSpending) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {r.products.length > 0
                      ? r.products.reduce((s, p) => s + p.qty, 0)
                      : "—"}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-t border-gray-100">
                    <td colSpan={4} className="bg-gray-50 p-0">
                      {r.products.length === 0 ? (
                        <div className="flex items-center justify-center py-4 text-sm text-gray-400">
                          Sem detalhe de produtos disponível.
                        </div>
                      ) : (
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-gray-200 bg-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-6 py-2">Produto</th>
                              <th className="px-4 py-2">Categoria</th>
                              <th className="px-4 py-2 text-right">Qtd</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.products.map((p, i) => (
                              <tr
                                key={i}
                                className="border-b border-gray-100 hover:bg-white"
                              >
                                <td className="px-6 py-2 font-medium text-gray-800">
                                  {p.title || p.reference}
                                </td>
                                <td className="px-4 py-2">
                                  <CategoryBadge category={p.category} />
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-700">
                                  {p.qty}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {r.observations && (
                        <p className="border-t border-gray-200 px-6 py-2 text-xs text-gray-400">
                          Obs: {r.observations}
                        </p>
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
  );
}
