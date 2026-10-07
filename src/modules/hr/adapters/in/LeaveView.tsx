import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { ABSENCE_STATUS_STYLE, ABSENCE_TYPE_LABEL, ABSENCE_TYPE_STYLE, type AbsenceRecord, type AbsenceType } from "../../domain/entities/absences.ts";
import {
  calendarDays,
  calendarName,
  filterRecords,
  fmtDate,
  inTab,
  monthLabel,
  monthRange,
  recordsCsv,
  recordsOnDay,
  shiftMonth,
  tabCounts,
  type BoardFilters,
  type RecordsTab,
} from "../../domain/services/absences-board.service.ts";
import { RegisterAbsenceDrawer } from "./RegisterAbsenceDrawer.tsx";

type Tab = "calendar" | "records";

const todayYmd = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const RECORD_TABS: Array<{ key: RecordsTab; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "approved", label: "Aprovados" },
  { key: "closed", label: "Rejeitados/Cancelados" },
];

const period = (r: AbsenceRecord) => (r.startDate === r.endDate ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}`);

function AttentionBanner({ attention }: { attention: { pendingRequests: number; pendingDocuments: number; shiftConflicts: number } }) {
  const total = attention.pendingRequests + attention.pendingDocuments + attention.shiftConflicts;
  if (total === 0) return null;
  const parts = [
    attention.pendingRequests > 0 && `${attention.pendingRequests} ${attention.pendingRequests === 1 ? "pedido aguarda" : "pedidos aguardam"} aprovação`,
    attention.pendingDocuments > 0 && `${attention.pendingDocuments} ${attention.pendingDocuments === 1 ? "comprovativo pendente" : "comprovativos pendentes"}`,
    attention.shiftConflicts > 0 && `${attention.shiftConflicts} ${attention.shiftConflicts === 1 ? "conflito" : "conflitos"} em turnos`,
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-orange-50/70 px-4 py-3" role="status">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ED5C32] text-sm font-bold text-white">!</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#C2410C]">Requer atenção</p>
        <p className="text-sm text-stone-700">{parts.join(" · ")}</p>
      </div>
      {(attention.pendingRequests > 0 || attention.pendingDocuments > 0) && (
        <Link to="/hr/pedidos" className="text-sm font-medium text-[#ED5C32] hover:underline">
          Abrir Caixa de pedidos →
        </Link>
      )}
    </div>
  );
}

/** Detalhe de um registo: cancelar ausência (com motivo) ou decidir um pedido do Portal. */
function RecordDrawer({ record, onClose, onChanged }: { record: AbsenceRecord; onClose: () => void; onChanged: () => void }) {
  const { api } = useHrModule();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const cancel = useMutation({ mutationFn: () => api.cancelAbsence(record.id, reason), onSuccess: onChanged });
  const decide = useMutation({ mutationFn: (decision: "approve" | "reject") => api.decidePortalRequest(record.id, decision, note || null), onSuccess: onChanged });
  const st = ABSENCE_STATUS_STYLE[record.status];
  const error = cancel.error ?? decide.error;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="Detalhe da ausência">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-stone-900">{record.source === "request" ? "Pedido do Portal" : "Ausência"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4 text-sm">
          <p className="font-semibold text-stone-900">{record.employeeName}</p>
          <p className="text-stone-500">{[record.positionName, record.locationName].filter(Boolean).join(" · ")}</p>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ABSENCE_TYPE_STYLE[record.type].chip}`}>{ABSENCE_TYPE_LABEL[record.type]}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
          </div>
          <p>
            {period(record)} · {record.duration}
            {record.startTime && ` (${record.startTime}–${record.endTime})`}
          </p>
          {record.notes && <p className="text-stone-600">{record.notes}</p>}
          {record.affectedShifts > 0 && (
            <p className="rounded-lg bg-orange-50 px-3 py-2 text-[#C2410C]">
              {record.affectedShifts} {record.affectedShifts === 1 ? "turno afetado" : "turnos afetados"} — continuam na escala.{" "}
              <Link to="/hr/schedules" className="font-medium underline">
                Ajustar nas Escalas
              </Link>
            </p>
          )}
          {record.decisionNote && <p className="text-stone-500">Motivo: {record.decisionNote}</p>}
          {record.origin === "portal" && record.source === "absence" && <p className="text-xs text-stone-400">Criada a partir de um pedido do Portal.</p>}

          {record.source === "absence" && record.status === "approved" && (
            <div className="space-y-2 border-t border-stone-100 pt-3">
              <label htmlFor="cancel-reason" className="block text-xs font-medium text-stone-700">
                Cancelar ausência — motivo (fica no histórico)
              </label>
              <textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-md border border-stone-300 p-2" />
              <button type="button" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate()} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50">
                Cancelar ausência
              </button>
            </div>
          )}
          {record.source === "request" && record.status === "pending" && (
            <div className="space-y-2 border-t border-stone-100 pt-3">
              <label htmlFor="decision-note" className="block text-xs font-medium text-stone-700">
                Nota (obrigatória para rejeitar)
              </label>
              <textarea id="decision-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-md border border-stone-300 p-2" />
              <div className="flex gap-2">
                <button type="button" disabled={decide.isPending} onClick={() => decide.mutate("approve")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                  Aprovar
                </button>
                <button type="button" disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate("reject")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50">
                  Rejeitar
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error instanceof Error ? error.message : "Não foi possível guardar."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Férias & Ausências 2.0 (mockup 2026-10-07): Calendário | Registos, faixa
 * "Requer atenção", Registar ausência com impacto. Os pedidos do Portal
 * pendentes aparecem como "Pendente" e decidem-se aqui ou na Caixa de pedidos.
 */
export function LeaveView() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("calendar");
  const [month, setMonth] = useState(() => todayYmd().slice(0, 7));
  const [filters, setFilters] = useState<BoardFilters>({ search: "", type: "", locationId: "" });
  const [recordsTab, setRecordsTab] = useState<RecordsTab>("all");
  const [registering, setRegistering] = useState(false);
  const [selected, setSelected] = useState<AbsenceRecord | null>(null);

  const range = monthRange(month);
  const { data: board, isLoading, isError } = useQuery({ queryKey: ["hr-absence-board", range.from, range.to], queryFn: () => api.getAbsenceBoard(range.from, range.to) });
  const { data: employeesResult } = useQuery({ queryKey: ["hr-employees-active"], queryFn: () => api.listEmployees({ status: "active", page: 1, pageSize: 200 }) });
  const employees = employeesResult?.items ?? [];

  const records = useMemo(() => filterRecords(board?.records ?? [], filters), [board, filters]);
  const counts = tabCounts(records);
  const locations = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of board?.records ?? []) if (r.locationId && r.locationName) m.set(r.locationId, r.locationName);
    return [...m.entries()];
  }, [board]);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["hr-absence-board"] });
    void qc.invalidateQueries({ queryKey: ["hr-requests-count"] });
  };
  const exportCsv = () => {
    const blob = new Blob(["﻿" + recordsCsv(records.filter((r) => inTab(r, recordsTab)))], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ausencias-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const today = todayYmd();
  const select = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Férias &amp; Ausências</h1>
          <p className="text-sm text-stone-500">Visão global da disponibilidade da equipa.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/hr/ferias/saldos" className="text-sm text-stone-500 hover:underline">
            Saldos de férias
          </Link>
          <button type="button" onClick={() => setRegistering(true)} className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm">
            + Registar ausência
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {(
          [
            { key: "calendar", label: "Calendário" },
            { key: "records", label: "Registos" },
          ] as Array<{ key: Tab; label: string }>
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.key ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {board && <AttentionBanner attention={board.attention} />}

      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Pesquisar colaborador"
          placeholder="Pesquisar colaborador…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="min-w-[200px] flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <select aria-label="Tipo" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as AbsenceType | "" })} className={select}>
          <option value="">Todos os tipos</option>
          {(Object.keys(ABSENCE_TYPE_LABEL) as AbsenceType[]).map((t) => (
            <option key={t} value={t}>
              {ABSENCE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select aria-label="Local" value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })} className={select}>
          <option value="">Todos os locais</option>
          {locations.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))} className={select}>
            ‹
          </button>
          <span className="min-w-[150px] text-center text-sm font-medium text-stone-800">{monthLabel(month)}</span>
          <button type="button" aria-label="Mês seguinte" onClick={() => setMonth(shiftMonth(month, 1))} className={select}>
            ›
          </button>
          <button type="button" onClick={() => setMonth(today.slice(0, 7))} className={select}>
            Hoje
          </button>
        </div>
        {tab === "records" && (
          <button type="button" onClick={exportCsv} className={select}>
            ⬇ Exportar
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-stone-400">A carregar…</p>
      ) : isError || !board ? (
        <p className="text-sm text-red-700">Não foi possível carregar as ausências.</p>
      ) : tab === "calendar" ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50 text-center text-xs font-semibold text-stone-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays(month).map((ymd) => {
              const inMonth = ymd.startsWith(month);
              const day = recordsOnDay(records, ymd);
              return (
                <div key={ymd} className={`min-h-[96px] border-b border-r border-stone-100 p-1.5 ${inMonth ? "" : "bg-stone-50/60 text-stone-300"}`}>
                  <span className={`text-xs ${ymd === today ? "rounded-full bg-[#ED5C32] px-1.5 text-white" : "text-stone-500"}`}>{Number(ymd.slice(8, 10))}</span>
                  <div className="mt-1 space-y-0.5">
                    {day.slice(0, 3).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelected(r)}
                        title={`${r.employeeName} — ${ABSENCE_TYPE_LABEL[r.type]} (${ABSENCE_STATUS_STYLE[r.status].label})`}
                        className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] ${ABSENCE_TYPE_STYLE[r.type].chip} ${r.status === "pending" ? "border border-dashed border-current" : ""}`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ABSENCE_TYPE_STYLE[r.type].dot}`} />
                        <span className="truncate">
                          {calendarName(r.employeeName)} — {ABSENCE_TYPE_LABEL[r.type]}
                        </span>
                      </button>
                    ))}
                    {day.length > 3 && <p className="text-[10px] font-medium text-[#ED5C32]">+{day.length - 3} mais</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white">
          <div className="flex flex-wrap gap-1 border-b border-stone-100 px-3">
            {RECORD_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setRecordsTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${recordsTab === t.key ? "border-[#ED5C32] font-medium text-[#ED5C32]" : "border-transparent text-stone-500"}`}
              >
                {t.label} <span className="ml-1 rounded-full bg-stone-100 px-1.5 text-xs text-stone-600">{counts[t.key]}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
                  <th className="px-4 py-2.5">Colaborador</th>
                  <th className="px-4 py-2.5">Período</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Duração</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Impacto</th>
                  <th className="px-4 py-2.5">Ação</th>
                </tr>
              </thead>
              <tbody>
                {records.filter((r) => inTab(r, recordsTab)).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                      Sem registos para este filtro.
                    </td>
                  </tr>
                ) : (
                  records
                    .filter((r) => inTab(r, recordsTab))
                    .map((r) => {
                      const review = r.status === "pending";
                      return (
                        <tr key={`${r.source}-${r.id}`} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-stone-800">{r.employeeName}</p>
                            <p className="text-xs text-stone-400">{r.positionName ?? ""}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">{period(r)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ABSENCE_TYPE_STYLE[r.type].chip}`}>{ABSENCE_TYPE_LABEL[r.type]}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">{r.duration}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ABSENCE_STATUS_STYLE[r.status].cls}`}>{ABSENCE_STATUS_STYLE[r.status].label}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            {r.affectedShifts > 0 ? (
                              <span className="text-[#C2410C]">
                                ⚠ {r.affectedShifts} {r.affectedShifts === 1 ? "turno afetado" : "turnos afetados"}
                              </span>
                            ) : (
                              <span className="text-emerald-700">✓ Sem impacto</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <button type="button" onClick={() => setSelected(r)} className="font-medium text-[#ED5C32] hover:underline">
                              {review ? "Rever →" : "Ver →"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {registering && (
        <RegisterAbsenceDrawer
          employees={employees}
          onClose={() => setRegistering(false)}
          onSaved={() => {
            setRegistering(false);
            refresh();
          }}
        />
      )}
      {selected && (
        <RecordDrawer
          record={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
