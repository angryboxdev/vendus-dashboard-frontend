import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import type { OccurrenceDTO, RecurrenceDTO } from "../../domain/entities/recurrence.ts";
import { buildCategoryBreakdown } from "../../domain/services/category-breakdown.ts";
import { OccurrenceStateBadge } from "./OccurrenceStateBadge.tsx";

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string): string {
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

interface Props {
  occurrences: OccurrenceDTO[];
  recurrenceById: Map<string, RecurrenceDTO>;
}

const ALL = "__all";

/** Ocorrências do mês (as de uma categoria ou todas), com as colunas da antiga tabela «Ocorrências do mês». */
function OccurrenceList({
  occurrences,
  recurrenceById,
}: {
  occurrences: OccurrenceDTO[];
  recurrenceById: Map<string, RecurrenceDTO>;
}) {
  const navigate = useNavigate();
  return (
    <div className="mx-3 mb-2 overflow-x-auto rounded-lg border border-stone-100 bg-stone-50/60">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            {["Estado", "Recorrência", "Fornecedor", "Vencimento", "Previsto", "Faturado", "Pago", "Diferença", ""].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {occurrences.map((o) => {
            const rec = recurrenceById.get(o.recurrenceId);
            return (
              <tr key={o.id}>
                <td className="px-3 py-2">
                  <OccurrenceStateBadge state={o.displayState} />
                </td>
                <td className="px-3 py-2 font-medium text-stone-700 max-w-[200px]">
                  <span className="block truncate">{rec?.name ?? "—"}</span>
                </td>
                <td className="px-3 py-2 text-stone-500 max-w-[160px]">
                  <span className="block truncate">{rec?.supplierName ?? "—"}</span>
                </td>
                <td className="px-3 py-2 text-stone-500 whitespace-nowrap">{formatDate(o.dueDate)}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fromCents(o.estimatedAmountCents)}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {o.realAmountCents != null ? fromCents(o.realAmountCents) : <span className="text-stone-300">—</span>}
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {o.paidAmountCents > 0 ? fromCents(o.paidAmountCents) : <span className="text-stone-300">—</span>}
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {o.status === "cancelled" || o.paidAmountCents === 0 ? (
                    <span className="text-stone-300">—</span>
                  ) : (
                    <span className={o.differenceCents >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {o.differenceCents > 0 ? "+" : ""}
                      {fromCents(o.differenceCents)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => navigate(`/financial/recurrences/${o.recurrenceId}`)}
                    className="rounded px-2 py-1 font-medium text-[#ED5C32] hover:bg-orange-50"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Valor do mês separado por categoria (grupo do centro de custo da recorrência):
 * barra laranja em degradê relativa à maior, % do total e «Detalhes» que abre a lista.
 */
export function CategoryBreakdownCard({ occurrences, recurrenceById }: Props) {
  const { api: baseApi } = useFinancialBaseModule();
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Todos os grupos (também inativos): uma recorrência antiga pode apontar para um grupo desativado.
  const { data: groups = [] } = useQuery({
    queryKey: ["cost-center-groups-all"],
    queryFn: () => baseApi.listCostCenterGroups(),
  });
  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const active = useMemo(() => occurrences.filter((o) => o.status !== "cancelled"), [occurrences]);

  const breakdown = useMemo(
    () =>
      buildCategoryBreakdown(
        active.map((o) => {
          const rec = recurrenceById.get(o.recurrenceId);
          const categoryId = rec?.costCenterId ?? null;
          return {
            categoryId,
            categoryName: categoryId ? (groupName.get(categoryId) ?? null) : null,
            recurrenceId: o.recurrenceId,
            supplierName: rec?.supplierName ?? "",
            amountCents: o.effectiveAmountCents,
          };
        }),
      ),
    [active, recurrenceById, groupName],
  );

  if (breakdown.rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#F5C992]/40 bg-white">
        <div className="px-6 pt-4">
          <h2 className="text-sm font-semibold text-stone-800">Categorias</h2>
        </div>
        <div className="py-12 text-center text-sm text-stone-400">Sem ocorrências para este mês.</div>
      </div>
    );
  }

  const showAll = openKey === ALL;
  const allSorted = [...occurrences].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white">
      <div className="flex items-start justify-between gap-4 px-6 pt-4 pb-2">
        <div>
          <h2 className="text-sm font-semibold text-stone-800">Categorias</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            {plural(breakdown.recurrenceCount, "recorrência", "recorrências")},{" "}
            {plural(breakdown.supplierCount, "fornecedor/colaborador", "fornecedores/colaboradores")} · total{" "}
            {fromCents(breakdown.totalCents)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenKey(showAll ? null : ALL)}
          aria-expanded={showAll}
          className="shrink-0 text-xs font-medium text-[#ED5C32] hover:underline"
        >
          {showAll ? "Ocultar lista" : "Mostrar todas"}
        </button>
      </div>
      {showAll && <OccurrenceList occurrences={allSorted} recurrenceById={recurrenceById} />}
      <div className="px-3 pb-3">
        {breakdown.rows.map((row) => {
          const key = row.categoryId ?? "none";
          const isOpen = openKey === key;
          // Barras mais pequenas ficam mais claras, como no resumo de categorias das faturas.
          const opacity = 0.35 + 0.65 * (row.barPercent / 100);
          const rowOccurrences = active
            .filter((o) => (recurrenceById.get(o.recurrenceId)?.costCenterId ?? "none") === key)
            .sort((a, b) => b.effectiveAmountCents - a.effectiveAmountCents);
          return (
            <Fragment key={key}>
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[minmax(0,1.4fr)_auto_minmax(80px,2fr)_3rem_minmax(0,1fr)_auto] items-center gap-4 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#FDF8F5]"
              >
                <span className="truncate text-stone-800">{row.label}</span>
                <span className="text-right font-medium tabular-nums text-stone-800">{fromCents(row.amountCents)}</span>
                <span className="block h-1.5 w-full">
                  <span
                    className="block h-1.5 rounded-full bg-gradient-to-r from-[#ED5C32] to-[#EF8935]"
                    style={{ width: `${Math.max(row.barPercent, 2)}%`, opacity }}
                  />
                </span>
                <span className="text-right text-xs tabular-nums text-stone-500">{row.percent}%</span>
                <span className="truncate text-xs text-stone-500">
                  {plural(row.recurrenceCount, "recorrência", "recorrências")}
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-[#ED5C32]">
                  Detalhes
                  <svg
                    className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </span>
              </button>
              {isOpen && <OccurrenceList occurrences={rowOccurrences} recurrenceById={recurrenceById} />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
