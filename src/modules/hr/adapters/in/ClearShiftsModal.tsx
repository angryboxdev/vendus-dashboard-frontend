import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import type { ClearShiftsScope, ClearWorkShiftsPreview, ClearWorkShiftsResult } from "../../domain/entities/schedule.ts";
import { useShiftAutomations } from "./use-shift-automations.ts";
import { useShiftTemplates } from "./use-shift-templates.ts";

interface ClearShiftsModalProps {
  /** null = sem colaborador selecionado (semana para TODOS, ou período para todos/vários). */
  employeeId: string | null;
  employeeName: string;
  /** Colaboradores ativos — para escolher a quem se aplica o âmbito "Período". */
  employees: Array<{ id: string; fullName: string }>;
  defaultWeekStartDate: string;
  locationId?: string;
  onClose: () => void;
  onCleared: (result: ClearWorkShiftsResult) => void;
}

type ScopeKind = "day" | "week" | "range";

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * "Limpar turnos" — âmbito explícito, nunca um "limpar tudo" implícito,
 * sempre com confirmação. O âmbito "Período" (apagar em massa — p.ex. 12
 * semanas criadas por engano) exige pré-visualização antes de apagar.
 */
export function ClearShiftsModal({ employeeId, employeeName, employees, defaultWeekStartDate, locationId, onClose, onCleared }: ClearShiftsModalProps) {
  const { api } = useHrModule();
  const { data: automations = [] } = useShiftAutomations();
  const { data: templates = [] } = useShiftTemplates();
  const [scopeKind, setScopeKind] = useState<ScopeKind>(employeeId ? "day" : "week");
  const [date, setDate] = useState(defaultWeekStartDate);
  const [weekStartDate, setWeekStartDate] = useState(defaultWeekStartDate);
  const [from, setFrom] = useState(defaultWeekStartDate);
  const [to, setTo] = useState(addDaysYmd(defaultWeekStartDate, 6));
  const [allEmployees, setAllEmployees] = useState(!employeeId);
  const [selectedIds, setSelectedIds] = useState<string[]>(employeeId ? [employeeId] : []);
  const [onlyDrafts, setOnlyDrafts] = useState(false);
  const [automationId, setAutomationId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<{ key: string; data: ClearWorkShiftsPreview } | null>(null);

  function buildScope(): ClearShiftsScope {
    if (scopeKind === "range") {
      return {
        kind: "range",
        from,
        to,
        ...(!allEmployees && { employeeIds: selectedIds }),
        ...(locationId && { locationId }),
        ...(onlyDrafts && { onlyDrafts: true }),
        ...(automationId && { automationId }),
        ...(templateId && { templateId }),
      };
    }
    if (!employeeId) return { kind: "week_all", weekStartDate, ...(locationId && { locationId }) };
    return scopeKind === "day" ? { kind: "day", employeeId, workDate: date } : { kind: "week", employeeId, weekStartDate };
  }

  const scope = buildScope();
  const scopeKey = JSON.stringify(scope);
  // Qualquer alteração ao âmbito invalida a pré-visualização (o que se confirma é sempre o que se viu).
  const currentPreview = preview?.key === scopeKey ? preview.data : null;
  const rangeInvalid = scopeKind === "range" && (!from || !to || from > to || (!allEmployees && selectedIds.length === 0));

  const previewMutation = useMutation({
    mutationFn: (s: ClearShiftsScope) => api.previewClearWorkShifts(s),
    onSuccess: (data, s) => {
      setConfirming(false);
      setPreview({ key: JSON.stringify(s), data });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.clearWorkShifts(scope),
    onSuccess: (result) => onCleared(result),
  });

  function changeScope(kind: ScopeKind) {
    setScopeKind(kind);
    setConfirming(false);
  }

  function toggleEmployee(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const nameOf = (id: string) => employees.find((e) => e.id === id)?.fullName ?? "Colaborador";
  const needsPreview = scopeKind === "range" && !currentPreview;
  const nothingToDelete = scopeKind === "range" && currentPreview?.deletableCount === 0;
  const error = previewMutation.error ?? clearMutation.error;

  const tabs: Array<[ScopeKind, string]> = employeeId
    ? [["day", "Um dia"], ["week", "Uma semana"], ["range", "Período"]]
    : [["week", "Uma semana"], ["range", "Período"]];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Limpar turnos">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Limpar turnos</h2>
            <p className="text-sm text-stone-500">
              {scopeKind === "range" ? "Apagar em massa por período" : employeeId ? employeeName : "Todos os colaboradores desta semana"}
            </p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-sm">
            {tabs.map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => changeScope(kind)}
                className={`flex-1 rounded px-2 py-1.5 ${scopeKind === kind ? "bg-white shadow-sm" : "text-stone-500"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {scopeKind === "day" && (
            <div>
              <label htmlFor="clear-day" className="mb-1.5 block text-sm font-medium text-stone-700">Dia</label>
              <input id="clear-day" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
            </div>
          )}

          {scopeKind === "week" && (
            <div>
              <label htmlFor="clear-week" className="mb-1.5 block text-sm font-medium text-stone-700">Semana a partir de</label>
              <input
                id="clear-week"
                type="date"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </div>
          )}

          {scopeKind === "range" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="clear-from" className="mb-1.5 block text-sm font-medium text-stone-700">De</label>
                  <input id="clear-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label htmlFor="clear-to" className="mb-1.5 block text-sm font-medium text-stone-700">Até</label>
                  <input id="clear-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <p className="-mt-2 text-xs text-stone-400">Máximo de 1 ano.</p>

              <div>
                <p className="mb-1.5 text-sm font-medium text-stone-700">Colaboradores</p>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={allEmployees} onChange={(e) => setAllEmployees(e.target.checked)} />
                  Todos os colaboradores
                </label>
                {!allEmployees && (
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
                    {employees.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 text-sm text-stone-700">
                        <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggleEmployee(e.id)} />
                        {e.fullName}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">Filtros (opcionais)</p>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={onlyDrafts} onChange={(e) => setOnlyDrafts(e.target.checked)} />
                  Só rascunhos (os turnos publicados ficam)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="clear-automation" className="mb-1 block text-xs text-stone-500">Criados pela automatização</label>
                    <select id="clear-automation" value={automationId} onChange={(e) => setAutomationId(e.target.value)} className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm">
                      <option value="">Qualquer</option>
                      {automations.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="clear-template" className="mb-1 block text-xs text-stone-500">Criados a partir do modelo</label>
                    <select id="clear-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm">
                      <option value="">Qualquer</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {locationId && <p className="text-xs text-stone-500">Só turnos do local filtrado na escala.</p>}
              </div>

              {currentPreview && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm" aria-label="Pré-visualização da limpeza">
                  {currentPreview.deletableCount === 0 ? (
                    <p className="text-stone-600">Não há turnos para apagar com estes critérios.</p>
                  ) : (
                    <p className="font-medium text-stone-800">
                      Vão ser apagados {currentPreview.deletableCount} turno(s) de{" "}
                      {currentPreview.byEmployee.filter((r) => r.deletableCount > 0).length} colaborador(es).
                    </p>
                  )}
                  {currentPreview.protectedCount > 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      {currentPreview.protectedCount} turno(s) com presença registada ficam preservados.
                    </p>
                  )}
                  {currentPreview.byEmployee.length > 0 && (
                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                      {currentPreview.byEmployee.map((row) => (
                        <li key={row.employeeId} className="flex justify-between gap-3 text-xs text-stone-600">
                          <span>{nameOf(row.employeeId)}</span>
                          <span className="text-right">
                            {row.deletableCount} a apagar
                            {row.protectedCount > 0 && ` · ${row.protectedCount} preservado(s)`}
                            <span className="text-stone-400"> · {formatYmd(row.firstDate)}–{formatYmd(row.lastDate)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {scopeKind !== "range" && (
            <p className="text-xs text-stone-500">
              Apaga os turnos planeados de {employeeId ? employeeName : "todos os colaboradores"} no âmbito escolhido. Turnos com presença já
              registada nunca são apagados — ficam preservados e reportados à parte.
            </p>
          )}

          {confirming && !needsPreview && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Tens a certeza que queres limpar a escala?</p>
              <p className="mt-0.5 text-red-700">Os turnos serão apagados permanentemente. Queres continuar?</p>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error instanceof Error ? error.message : "Erro ao limpar turnos"}</p>}
        </div>

        <div className="flex gap-2 border-t border-stone-100 px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
            Cancelar
          </button>
          {needsPreview ? (
            <button
              onClick={() => previewMutation.mutate(scope)}
              disabled={rangeInvalid || previewMutation.isPending}
              className="flex-1 rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900 disabled:opacity-50"
            >
              {previewMutation.isPending ? "A calcular…" : "Pré-visualizar"}
            </button>
          ) : confirming ? (
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {clearMutation.isPending ? "A limpar…" : "Sim, limpar permanentemente"}
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={nothingToDelete}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {scopeKind === "range" && currentPreview ? `Apagar ${currentPreview.deletableCount} turno(s)` : "Limpar turnos"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
