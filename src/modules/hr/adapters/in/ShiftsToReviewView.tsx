import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { SeverityBadge } from "./components/SeverityBadge.tsx";
import { ShiftReviewModal } from "./ShiftReviewModal.tsx";
import type { ReviewPriority, ShiftToReview } from "../../domain/entities/overview.ts";

const PAGE_SIZE = 10;
const PRIORITY_TABS: { key: ReviewPriority | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "CRITICA", label: "Críticos" },
  { key: "ALTA", label: "Altos" },
  { key: "MEDIA", label: "Médios" },
  { key: "BAIXA", label: "Baixos" },
];

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ShiftsToReviewView() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const { locations } = useLocations();

  const [priority, setPriority] = useState<ReviewPriority | "all">("all");
  const [locationId, setLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<ShiftToReview | null>(null);

  const params = {
    ...(priority !== "all" && { priority }),
    ...(locationId && { locationId }),
    ...(search && { search }),
    page,
    pageSize: PAGE_SIZE,
  };

  const { data: result, isLoading } = useQuery({
    queryKey: ["hr-shifts-to-review", params],
    queryFn: () => api.listShiftsToReview(params),
  });

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = result?.countsByPriority ?? { CRITICA: 0, ALTA: 0, MEDIA: 0, BAIXA: 0 };
  const totalCount = counts.CRITICA + counts.ALTA + counts.MEDIA + counts.BAIXA;

  function handleReviewed() {
    setReviewing(null);
    void qc.invalidateQueries({ queryKey: ["hr-shifts-to-review"] });
    void qc.invalidateQueries({ queryKey: ["hr-overview"] });
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <nav className="mb-2 text-sm text-stone-400">
          <Link to="/hr/overview" className="hover:text-stone-700">
            Recursos Humanos
          </Link>
        </nav>
        <h1 className="text-xl font-bold text-stone-900">Turnos por conferir</h1>
        <p className="mt-0.5 text-sm text-stone-500">Turnos que precisam de conferência ou validação.</p>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          {PRIORITY_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setPriority(key);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                priority === key ? "border-[#ED5C32] bg-[#FDF8F5] text-[#ED5C32]" : "border-stone-200 text-stone-500 hover:border-stone-300"
              }`}
            >
              {label}
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                {key === "all" ? totalCount : counts[key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar funcionário..."
            className="w-64 rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
          />
          {locations.length > 1 && (
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
            >
              <option value="">Todos os locais</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {isLoading ? (
            <p className="py-16 text-center text-sm text-stone-400">A carregar…</p>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-stone-400">Sem turnos por conferir.</p>
          ) : (
            <>
              <table className="min-w-full text-sm">
                <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Prioridade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Funcionário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Planeado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Registado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Exceção</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5C992]/30">
                  {items.map((item) => (
                    <tr key={item.shiftId}>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={item.priority} />
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-700">{item.employeeName}</td>
                      <td className="px-4 py-3 text-stone-500">{formatDate(item.workDate)}</td>
                      <td className="px-4 py-3 text-stone-500">
                        {item.plannedStartTime} – {item.plannedEndTime}
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {item.actualStartTime ?? "—"}
                        {item.actualEndTime ? ` – ${item.actualEndTime}` : ""}
                      </td>
                      <td className="px-4 py-3 text-red-600">{item.exceptionLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setReviewing(item)}
                          className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                        >
                          Conferir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-[#F5C992]/30 px-4 py-3 text-sm text-stone-500">
                <span>
                  Mostrando {(page - 1) * PAGE_SIZE + 1} a {Math.min(page * PAGE_SIZE, total)} de {total} resultados
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ←
                  </button>
                  <span className="px-2 tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {reviewing && (
        <ShiftReviewModal shift={reviewing} onClose={() => setReviewing(null)} onConfirmed={handleReviewed} />
      )}
    </div>
  );
}
