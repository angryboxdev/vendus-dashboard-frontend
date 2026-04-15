import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { fetchAuditLogs, fetchEmployees } from "./hrApi";
import { hrQueryKeys } from "./hrQueryKeys";
import { SkeletonBlock } from "./components/SkeletonBlock";
import type { AuditAction, AuditEntityType, HrAuditLog } from "./hr.types";

// ---------- constants ----------

const PAGE_SIZE = 40;

const ENTITY_FILTER_LABELS: { value: AuditEntityType | ""; label: string }[] = [
  { value: "", label: "Tudo" },
  { value: "employee", label: "Funcionários" },
  { value: "shift", label: "Turnos" },
  { value: "attendance", label: "Presença" },
  { value: "payment", label: "Pagamentos" },
];

const ACTION_STYLES: Record<
  AuditAction,
  { label: string; cls: string }
> = {
  created:                { label: "criado",       cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  updated:                { label: "editado",      cls: "bg-blue-100 text-blue-800 ring-blue-200" },
  deleted:                { label: "apagado",      cls: "bg-red-100 text-red-800 ring-red-200" },
  status_changed:         { label: "estado",       cls: "bg-orange-100 text-orange-800 ring-orange-200" },
  attendance_registered:  { label: "conferência",  cls: "bg-indigo-100 text-indigo-800 ring-indigo-200" },
  attendance_updated:     { label: "conf. editada",cls: "bg-indigo-100 text-indigo-800 ring-indigo-200" },
  schedule_updated:       { label: "escala",       cls: "bg-violet-100 text-violet-800 ring-violet-200" },
  pin_set:                { label: "PIN",          cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  kiosk_checkin:          { label: "entrada kiosk",cls: "bg-teal-100 text-teal-800 ring-teal-200" },
  kiosk_checkout:         { label: "saída kiosk",  cls: "bg-teal-100 text-teal-800 ring-teal-200" },
};

// ---------- helpers ----------

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
}

function fmtDateHeading(dateYmd: string): string {
  return new Date(dateYmd + "T12:00:00Z").toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByDate(logs: HrAuditLog[]): [string, HrAuditLog[]][] {
  const map = new Map<string, HrAuditLog[]>();
  for (const log of logs) {
    const date = new Date(log.createdAt)
      .toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" }); // YYYY-MM-DD
    const list = map.get(date) ?? [];
    list.push(log);
    map.set(date, list);
  }
  return [...map.entries()];
}

// ---------- sub-components ----------

function ActionBadge({ action }: { action: AuditAction }) {
  const s = ACTION_STYLES[action] ?? { label: action, cls: "bg-slate-100 text-slate-700 ring-slate-200" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${s.cls}`}>
      {s.label}
    </span>
  );
}

function PayloadViewer({ label, data }: { label: string; data: unknown }) {
  if (data == null) return null;
  return (
    <div className="mt-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <pre className="mt-0.5 max-h-40 overflow-auto rounded bg-slate-100 p-2 text-[11px] text-slate-700">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function LogEntry({ log }: { log: HrAuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = log.payloadBefore != null || log.payloadAfter != null;

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-10 flex-shrink-0 text-right text-xs tabular-nums text-slate-400">
          {fmtTime(log.createdAt)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ActionBadge action={log.action} />
            <span className="text-sm text-slate-800">{log.description}</span>
          </div>
          {log.actor && (
            <p className="mt-0.5 text-xs text-slate-400">por {log.actor}</p>
          )}
          {expanded && (
            <div className="mt-2 space-y-1">
              <PayloadViewer label="Antes" data={log.payloadBefore} />
              <PayloadViewer label="Depois" data={log.payloadAfter} />
            </div>
          )}
        </div>
        {hasPayload && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-shrink-0 text-xs text-indigo-600 hover:underline"
          >
            {expanded ? "Ocultar" : "Detalhes"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- main component ----------

export function HrAuditLogPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [entityType, setEntityType] = useState<AuditEntityType | "">("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: employees } = useQuery({
    queryKey: hrQueryKeys.employees({ limit: 500, offset: 0 }),
    queryFn: () => fetchEmployees({ limit: 500, offset: 0 }),
  });

  const params = useMemo(
    () => ({
      ...(employeeId ? { employeeId } : {}),
      ...(entityType ? { entityType: entityType as AuditEntityType } : {}),
      limit,
      offset: 0,
    }),
    [employeeId, entityType, limit],
  );

  const { data, isPending, isFetching } = useQuery({
    queryKey: hrQueryKeys.auditLogs(params),
    queryFn: () => fetchAuditLogs(params),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const grouped = useMemo(() => groupByDate(logs), [logs]);

  function resetLimit() {
    setLimit(PAGE_SIZE);
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Histórico de Alterações
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Registo de todas as alterações ao módulo de Recursos Humanos.
        </p>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Employee */}
        <select
          value={employeeId}
          onChange={(e) => { setEmployeeId(e.target.value); resetLimit(); }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos os funcionários</option>
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.fullName}</option>
          ))}
        </select>

        {/* Entity type tabs */}
        <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm">
          {ENTITY_FILTER_LABELS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setEntityType(value); resetLimit(); }}
              className={`px-3 py-1.5 font-medium transition-colors ${
                entityType === value
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Count */}
        {!isPending && (
          <span className="ml-auto text-xs text-slate-400">
            {logs.length} de {total} entrada{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        {isPending ? (
          <div className="p-4">
            <SkeletonBlock className="h-64 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Sem entradas para os filtros selecionados.
          </p>
        ) : (
          grouped.map(([date, dateLogs]) => (
            <div key={date}>
              <div className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <p className="text-xs font-semibold capitalize text-slate-600">
                  {fmtDateHeading(date)}
                </p>
              </div>
              {dateLogs.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
            </div>
          ))
        )}

        {/* Load more */}
        {!isPending && logs.length < total && (
          <div className="border-t border-slate-100 p-4 text-center">
            <button
              type="button"
              disabled={isFetching}
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isFetching ? "A carregar…" : `Mostrar mais (${total - logs.length} restantes)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
