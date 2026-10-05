import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { useHrModule } from "../../hr.module.tsx";
import { HORIZON_OPTIONS, type AutomationGenerationResult, type ShiftAutomation } from "../../domain/entities/shift-automation.ts";
import type { Weekday } from "../../domain/entities/shift-template.ts";
import { audienceLabel, generationSummary, recurrenceLabel, weekdaysLabel } from "../../domain/services/shift-automation.service.ts";
import { WEEKDAY_SHORT_LABELS } from "../../domain/services/template-application.service.ts";
import { MOTION_ROW_HOVER, MotionLayer, MotionPresence, useRetained } from "../../../../components/motion/index.ts";
import { useManageShiftAutomations, useShiftAutomations } from "./use-shift-automations.ts";
import { usePositions } from "./use-positions.ts";
import { useShiftTemplates } from "./use-shift-templates.ts";
import { ApplyTemplateModal } from "./ApplyTemplateModal.tsx";

const inputCls = "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-[#ED5C32]";
const labelCls = "mb-1 block text-sm font-medium text-stone-700";

function formatDate(ymd: string): string {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}

/** Editar: nome, dias, fim, horizonte e local. Modelo/público mantêm-se (para mudar, crie outra e pause esta). */
function EditAutomationModal({ automation, onClose }: { automation: ShiftAutomation; onClose: () => void }) {
  const { locations } = useLocations();
  const { updateMutation } = useManageShiftAutomations();
  const [name, setName] = useState(automation.name);
  const [weekdays, setWeekdays] = useState<Weekday[]>(automation.weekdays);
  const [endDate, setEndDate] = useState(automation.endDate ?? "");
  const [horizonWeeks, setHorizonWeeks] = useState(automation.horizonWeeks);
  const [locationId, setLocationId] = useState(automation.locationId ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    updateMutation.mutate(
      { id: automation.id, payload: { name, weekdays, endDate: endDate || null, horizonWeeks, locationId: locationId || null } },
      { onSuccess: onClose },
    );
  }

  return (
    <MotionLayer kind="overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Editar automatização">
      <MotionLayer as="form" kind="modal" onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-stone-900">Editar automatização</h2>
        <div>
          <label htmlFor="automation-name" className={labelCls}>
            Nome
          </label>
          <input id="automation-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <p className={labelCls}>Dias da semana</p>
          <div className="flex gap-1">
            {WEEKDAY_SHORT_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={weekdays.includes(i as Weekday)}
                onClick={() => setWeekdays((d) => (d.includes(i as Weekday) ? d.filter((x) => x !== i) : [...d, i as Weekday]))}
                className={`rounded-md border px-2 py-1 text-xs ${weekdays.includes(i as Weekday) ? "border-[#ED5C32] bg-orange-50" : "border-stone-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="automation-end" className={labelCls}>
              Data final (opcional)
            </label>
            <input id="automation-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="automation-horizon" className={labelCls}>
              Horizonte de geração
            </label>
            <select id="automation-horizon" value={horizonWeeks} onChange={(e) => setHorizonWeeks(Number(e.target.value))} className={inputCls}>
              {HORIZON_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  Próximas {w} semana(s)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="automation-location" className={labelCls}>
            Local do turno
          </label>
          <select id="automation-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}>
            <option value="">Local padrão do modelo (ou o local principal de cada colaborador)</option>
            {locations
              .filter((l) => l.isActive || l.id === locationId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </div>
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          As alterações só valem para as próximas gerações — os turnos já gerados não mudam. Para mudar o modelo ou o público, crie uma nova
          automatização e pause esta.
        </p>
        {updateMutation.error && <p className="text-sm text-red-600">{(updateMutation.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700">
            Cancelar
          </button>
          <button type="submit" disabled={updateMutation.isPending} className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {updateMutation.isPending ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </MotionLayer>
    </MotionLayer>
  );
}

/** "Gerar próximas X semanas" — nunca para lá do escolhido; conflitos vão para Alertas e ações. */
function GenerateModal({ automation, onClose }: { automation: ShiftAutomation; onClose: () => void }) {
  const { generateMutation } = useManageShiftAutomations();
  const [weeks, setWeeks] = useState(automation.horizonWeeks);
  const [result, setResult] = useState<AutomationGenerationResult | null>(null);

  return (
    <MotionLayer kind="overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Gerar turnos">
      <MotionLayer kind="modal" className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-stone-900">Gerar turnos — {automation.name}</h2>
        {result ? (
          <p className="text-sm text-stone-700">{generationSummary(result)}</p>
        ) : (
          <>
            <label htmlFor="generate-weeks" className={labelCls}>
              Gerar as próximas
            </label>
            <select id="generate-weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={inputCls}>
              {HORIZON_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w} semana(s)
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-500">
              Só são geradas datas ainda não geradas{automation.generatedUntil ? ` (já gerada até ${formatDate(automation.generatedUntil)})` : ""}. Os turnos ficam em rascunho.
            </p>
          </>
        )}
        {generateMutation.error && <p className="text-sm text-red-600">{(generateMutation.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700">
            {result ? "Fechar" : "Cancelar"}
          </button>
          {!result && (
            <button
              type="button"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate({ id: automation.id, weeks }, { onSuccess: setResult })}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {generateMutation.isPending ? "A gerar…" : "Gerar"}
            </button>
          )}
        </div>
      </MotionLayer>
    </MotionLayer>
  );
}

type Dialog = { kind: "edit" | "generate"; automation: ShiftAutomation } | null;

/**
 * Escalas & Turnos → Modelos & Automatizações → **Automatizações de turnos**
 * (RH 2.0, ticket 03). Criar abre o "Aplicar modelo" já em "Guardar como
 * automatização" (mesma configuração e pré-visualização).
 */
export function ShiftAutomationsPanel() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "manager";
  const { api } = useHrModule();
  const { locations } = useLocations();
  const { data: positions = [] } = usePositions();
  const { data: automations = [], isLoading, isError } = useShiftAutomations();
  const { statusMutation } = useManageShiftAutomations();
  const employeesQuery = useQuery({
    queryKey: ["hr-people-list", "automations"],
    queryFn: () => api.listEmployees({ status: "all", page: 1, pageSize: 100 }),
  });
  const { data: templates = [] } = useShiftTemplates();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const shownDialog = useRetained(dialog);

  const names = {
    position: (id: string) => positions.find((p) => p.id === id)?.name ?? "—",
    location: (id: string) => locations.find((l) => l.id === id)?.name ?? "—",
    employee: (id: string) => employeesQuery.data?.items.find((e) => e.id === id)?.fullName ?? "Colaborador",
  };
  const visible = automations.filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <section className="rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Automatizações de turnos</h2>
          <p className="text-xs text-stone-500">Aplicação de modelos a colaboradores, por cargo, local ou todos, com regras de recorrência.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar automatizações…"
            aria-label="Pesquisar automatizações"
            className="w-56 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#ED5C32]"
          />
          {canEdit && templates.some((t) => t.active) && (
            <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90">
              Nova automatização
            </button>
          )}
        </div>
      </div>

      {isLoading && <p className="px-4 py-6 text-sm text-stone-500">A carregar…</p>}
      {isError && <p className="px-4 py-6 text-sm text-red-600">Não foi possível carregar as automatizações.</p>}
      {statusMutation.isError && <p className="px-4 pt-2 text-sm text-red-600">{(statusMutation.error as Error).message}</p>}

      {!isLoading && !isError && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#FDF8F5] text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Modelo</th>
                <th className="px-4 py-2">Aplicar a</th>
                <th className="px-4 py-2">Local</th>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Recorrência</th>
                <th className="px-4 py-2">Estado</th>
                {canEdit && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5C992]/30">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-4 py-6 text-center text-stone-500">
                    {automations.length === 0 ? "Ainda não há automatizações — crie uma em \"Nova automatização\"." : "Nenhuma automatização corresponde à pesquisa."}
                  </td>
                </tr>
              )}
              {visible.map((a) => (
                <tr key={a.id} className={MOTION_ROW_HOVER}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-stone-800">{a.name}</p>
                    <p className="text-xs text-stone-500">
                      {a.generatedUntil ? `Gerada até ${formatDate(a.generatedUntil)}` : "Ainda não gerada"}
                      {a.openIssues > 0 && <span className="text-amber-700"> · {a.openIssues} por resolver</span>}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">{a.templateName}</td>
                  <td className="px-4 py-2.5">{audienceLabel(a.audience, names)}</td>
                  <td className="px-4 py-2.5 text-stone-600">{a.locationId ? names.location(a.locationId) : "Padrão"}</td>
                  <td className="px-4 py-2.5">
                    {a.endDate ? `${formatDate(a.startDate)} – ${formatDate(a.endDate)}` : weekdaysLabel(a.weekdays)}
                    {a.endDate && <p className="text-xs text-stone-500">{weekdaysLabel(a.weekdays)}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{recurrenceLabel(a)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {a.status === "active" ? "Ativa" : "Pausada"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="space-x-3 whitespace-nowrap px-4 py-2.5 text-right">
                      {a.status === "active" && (
                        <button type="button" onClick={() => setDialog({ kind: "generate", automation: a })} className="text-sm font-medium text-stone-800 hover:underline" aria-label={`Gerar ${a.name}`}>
                          Gerar
                        </button>
                      )}
                      <button type="button" onClick={() => setDialog({ kind: "edit", automation: a })} className="text-sm font-medium text-[#ED5C32] hover:underline">
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: a.id, status: a.status === "active" ? "paused" : "active" })}
                        className={`text-sm hover:underline ${a.status === "active" ? "text-red-600" : "text-emerald-700"}`}
                      >
                        {a.status === "active" ? "Pausar" : "Ativar"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MotionPresence show={creating}>
        <ApplyTemplateModal templates={templates} initialTemplateId={null} initialUsage="automation" onClose={() => setCreating(false)} />
      </MotionPresence>

      <MotionPresence show={dialog !== null}>
        {shownDialog?.kind === "edit" && <EditAutomationModal key={shownDialog.automation.id} automation={shownDialog.automation} onClose={() => setDialog(null)} />}
        {shownDialog?.kind === "generate" && <GenerateModal key={shownDialog.automation.id} automation={shownDialog.automation} onClose={() => setDialog(null)} />}
      </MotionPresence>
    </section>
  );
}
