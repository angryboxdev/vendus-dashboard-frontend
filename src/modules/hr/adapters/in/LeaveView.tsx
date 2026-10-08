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
import { LeaveBalancesTab } from "./LeaveBalancesTab.tsx";
import {
  AlertBanner,
  Button,
  Drawer,
  FIELD,
  IconAlert,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconPlus,
  PageShell,
  StatusBadge,
  SURFACE,
  TABLE,
  Tabs,
  TD,
  TH,
  THEAD,
  TR,
  buttonClass,
  type StatusTone,
} from "../../../../components/ui/index.ts";

type Tab = "calendar" | "records" | "balances";

const todayYmd = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const RECORD_TABS: Array<{ key: RecordsTab; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "approved", label: "Aprovados" },
  { key: "closed", label: "Rejeitados/Cancelados" },
];

const STATUS_TONE: Record<AbsenceRecord["status"], StatusTone> = { pending: "warning", approved: "success", rejected: "danger", cancelled: "neutral" };
const TypeChip = ({ type }: { type: AbsenceType }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${ABSENCE_TYPE_STYLE[type].chip}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${ABSENCE_TYPE_STYLE[type].dot}`} />
    {ABSENCE_TYPE_LABEL[type]}
  </span>
);

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
    <AlertBanner
      tone="warning"
      title="Requer atenção"
      action={
        (attention.pendingRequests > 0 || attention.pendingDocuments > 0) && (
          <Link to="/hr/pedidos" className={buttonClass("tertiary")}>
            Abrir Caixa de pedidos →
          </Link>
        )
      }
    >
      {parts.join(" · ")}
    </AlertBanner>
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
    <Drawer open title={record.source === "request" ? "Pedido do Portal" : "Ausência"} description={record.employeeName} onClose={onClose}>
        <div className="space-y-3 text-sm">
          <p className="text-stone-500">{[record.positionName, record.locationName].filter(Boolean).join(" · ")}</p>
          <div className="flex flex-wrap gap-2">
            <TypeChip type={record.type} />
            <StatusBadge tone={STATUS_TONE[record.status]}>{st.label}</StatusBadge>
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
              <Button variant="danger" size="sm" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>
                Cancelar ausência
              </Button>
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
    </Drawer>
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
  const select = FIELD;

  return (
    <PageShell
      title="Férias & Ausências"
      description="Visão global da disponibilidade da equipa."
      actions={
        <Button variant="primary" icon={<IconPlus />} onClick={() => setRegistering(true)}>
          Registar ausência
        </Button>
      }
      tabs={
        <Tabs<Tab>
          label="Férias & Ausências"
          value={tab}
          onChange={setTab}
          items={[
            { key: "calendar", label: "Calendário" },
            { key: "records", label: "Registos" },
            { key: "balances", label: "Saldos" },
          ]}
        />
      }
    >

      {board && <AttentionBanner attention={board.attention} />}

      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Pesquisar colaborador"
          placeholder="Pesquisar colaborador…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className={`min-w-[200px] flex-1 ${FIELD}`}
        />
        {tab !== "balances" && (
          <>
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
          <Button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))} icon={<IconChevronLeft />} />
          <span className="min-w-[150px] text-center text-sm font-medium text-stone-800">{monthLabel(month)}</span>
          <Button aria-label="Mês seguinte" onClick={() => setMonth(shiftMonth(month, 1))} icon={<IconChevronRight />} />
          <Button onClick={() => setMonth(today.slice(0, 7))}>Hoje</Button>
        </div>
        {tab === "records" && (
          <Button onClick={exportCsv} icon={<IconDownload />}>
            Exportar
          </Button>
        )}
          </>
        )}
      </div>

      {tab === "balances" ? (
        <LeaveBalancesTab search={filters.search} />
      ) : isLoading ? (
        <p className="text-sm text-stone-400">A carregar…</p>
      ) : isError || !board ? (
        <p className="text-sm text-red-700">Não foi possível carregar as ausências.</p>
      ) : tab === "calendar" ? (
        <div className={`overflow-hidden ${SURFACE}`}>
          <div className="grid grid-cols-7 border-b border-[#F5C992]/40 bg-stone-50/60 text-center text-xs font-semibold text-stone-500">
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
              const holiday = board.holidays.find((h) => h.date === ymd);
              return (
                <div key={ymd} className={`min-h-[96px] border-b border-r border-stone-100 p-1.5 ${inMonth ? "" : "bg-stone-50/60 text-stone-300"} ${holiday && inMonth ? "bg-amber-50/70" : ""}`}>
                  <span className={`text-xs ${ymd === today ? "rounded-full bg-[#ED5C32] px-1.5 text-white" : "text-stone-500"}`}>{Number(ymd.slice(8, 10))}</span>
                  {holiday && <p className="truncate text-[10px] font-medium text-amber-700">{holiday.name}</p>}
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
        <div className={SURFACE}>
          <div className="border-b border-[#F5C992]/40 px-3">
            <Tabs<RecordsTab> label="Estado" value={recordsTab} onChange={setRecordsTab} items={RECORD_TABS.map((t) => ({ ...t, count: counts[t.key] }))} />
          </div>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Colaborador</th>
                  <th className={TH}>Período</th>
                  <th className={TH}>Tipo</th>
                  <th className={TH}>Duração</th>
                  <th className={TH}>Estado</th>
                  <th className={TH}>Impacto</th>
                  <th className={TH}>
                    <span className="sr-only">Ação</span>
                  </th>
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
                        <tr key={`${r.source}-${r.id}`} className={TR}>
                          <td className={TD}>
                            <p className="font-medium text-stone-800">{r.employeeName}</p>
                            <p className="text-xs text-stone-400">{r.positionName ?? ""}</p>
                          </td>
                          <td className={`whitespace-nowrap ${TD}`}>{period(r)}</td>
                          <td className={TD}>
                            <TypeChip type={r.type} />
                          </td>
                          <td className={`whitespace-nowrap ${TD}`}>{r.duration}</td>
                          <td className={TD}>
                            <StatusBadge tone={STATUS_TONE[r.status]}>{ABSENCE_STATUS_STYLE[r.status].label}</StatusBadge>
                          </td>
                          <td className={`whitespace-nowrap ${TD}`}>
                            {r.affectedShifts > 0 ? (
                              <span className="inline-flex items-center gap-1.5 text-amber-800">
                                <IconAlert className="text-amber-600" />
                                {r.affectedShifts} {r.affectedShifts === 1 ? "turno afetado" : "turnos afetados"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-stone-500">
                                <IconCheck className="text-emerald-600" />
                                Sem impacto
                              </span>
                            )}
                          </td>
                          <td className={TD}>
                            <Button variant="tertiary" onClick={() => setSelected(r)}>
                              {review ? "Rever →" : "Ver →"}
                            </Button>
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
    </PageShell>
  );
}
