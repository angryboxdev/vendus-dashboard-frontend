import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { useHrModule } from "../../hr.module.tsx";
import {
  OCCURRENCE_STATUS_LABELS,
  type ApplicationAudience,
  type ApplicationDays,
  type ApplyTemplateResult,
  type ShiftTemplate,
  type TemplateApplicationConfig,
  type TemplateApplicationPreview,
  type TemplateOccurrence,
  type Weekday,
} from "../../domain/entities/shift-template.ts";
import { templateTimeLabel } from "../../domain/services/shift-template.service.ts";
import {
  buildDecisions,
  canReplace,
  countToCreate,
  formatOccurrenceDate,
  initialChoice,
  WEEKDAY_PRESETS,
  WEEKDAY_SHORT_LABELS,
  type OccurrenceChoice,
} from "../../domain/services/template-application.service.ts";
import { usePositions } from "./use-positions.ts";
import { TemplatePicker } from "./TemplatePicker.tsx";
import { useManageShiftAutomations } from "./use-shift-automations.ts";
import { HORIZON_OPTIONS, type AutomationGenerationResult } from "../../domain/entities/shift-automation.ts";
import { firstGenerationWindow, generationSummary } from "../../domain/services/shift-automation.service.ts";

type AudienceKind = "one" | "many" | "all" | "position" | "location";
type WhenKind = "dates" | "weekdays" | "weekend" | "custom";
type Usage = "once" | "automation";
const USAGE_LABELS: Record<Usage, string> = { once: "Aplicar apenas uma vez", automation: "Guardar como automatização" };

const inputCls = "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-[#ED5C32]";
const labelCls = "mb-1 block text-sm font-medium text-stone-700";

const AUDIENCE_LABELS: Record<AudienceKind, string> = {
  one: "Um colaborador",
  many: "Vários colaboradores",
  all: "Todos",
  position: "Por cargo",
  location: "Por local",
};
const WHEN_LABELS: Record<WhenKind, string> = {
  dates: "Datas específicas",
  weekdays: "Segunda a sexta",
  weekend: "Fins de semana",
  custom: "Personalizado",
};

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {(Object.keys(options) as T[]).map((k) => (
        <label key={k} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${value === k ? "border-[#ED5C32] bg-orange-50 text-stone-900" : "border-stone-200 text-stone-600"}`}>
          <input type="radio" name={name} className="mr-1.5" checked={value === k} onChange={() => onChange(k)} />
          {options[k]}
        </label>
      ))}
    </div>
  );
}

function occurrenceTime(o: Pick<TemplateOccurrence, "startTime" | "endTime" | "secondStartTime" | "secondEndTime">): string {
  return templateTimeLabel(o);
}

/**
 * Escalas & Turnos → Modelos & Automatizações → "Aplicar modelo" (RH 2.0,
 * ticket 02): Configuração → Pré-visualização → Confirmar. Na confirmação
 * o backend revalida tudo; o que mudou entretanto é mostrado e não aplicado.
 */
export function ApplyTemplateModal({
  templates,
  initialTemplateId,
  onClose,
  onReviewDrafts,
}: {
  templates: ShiftTemplate[];
  initialTemplateId: string | null;
  onClose: () => void;
  /** Depois de criar, abre a revisão dos rascunhos desse período (os turnos ficam em rascunho até serem publicados). */
  onReviewDrafts?: (range: { from: string; to: string }) => void;
}) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const { locations } = useLocations();
  const { data: positions = [] } = usePositions();
  const activeTemplates = templates.filter((t) => t.active);
  const activeLocations = locations.filter((l) => l.isActive);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templateId, setTemplateId] = useState(initialTemplateId ?? activeTemplates[0]?.id ?? "");
  const [audienceKind, setAudienceKind] = useState<AudienceKind>("one");
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [positionId, setPositionId] = useState("");
  const [audienceLocationId, setAudienceLocationId] = useState("");
  const [when, setWhen] = useState<WhenKind>("weekdays");
  const [dates, setDates] = useState<string[]>([]);
  const [dateDraft, setDateDraft] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customDays, setCustomDays] = useState<Weekday[]>([]);
  const [shiftLocationId, setShiftLocationId] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TemplateApplicationPreview | null>(null);
  const [choices, setChoices] = useState<Record<string, OccurrenceChoice>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [result, setResult] = useState<ApplyTemplateResult | null>(null);
  // RH 2.0 ticket 03 — "Tipo de utilização": aplicar uma vez ou guardar como automatização.
  const [usage, setUsage] = useState<Usage>("once");
  const [automationName, setAutomationName] = useState("");
  const [horizonWeeks, setHorizonWeeks] = useState(4);
  const [automationResult, setAutomationResult] = useState<AutomationGenerationResult | null>(null);
  const { createMutation } = useManageShiftAutomations();
  const isAutomation = usage === "automation";
  const today = new Date().toISOString().slice(0, 10);

  const employeesQuery = useQuery({
    queryKey: ["hr-people-list", "apply-template"],
    queryFn: () => api.listEmployees({ status: "active", page: 1, pageSize: 100 }),
  });
  const employees = [...(employeesQuery.data?.items ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName, "pt"));
  const template = templates.find((t) => t.id === templateId) ?? null;

  function buildConfig(): TemplateApplicationConfig | string {
    if (!template) return "Escolha o modelo.";
    let audience: ApplicationAudience;
    if (audienceKind === "one" || audienceKind === "many") {
      if (employeeIds.length === 0) return "Escolha pelo menos um colaborador.";
      audience = { kind: "employees", employeeIds };
    } else if (audienceKind === "all") audience = { kind: "all" };
    else if (audienceKind === "position") {
      if (!positionId) return "Escolha o cargo.";
      audience = { kind: "position", positionId, locationId: audienceLocationId || null };
    } else {
      if (!audienceLocationId) return "Escolha o local.";
      audience = { kind: "location", locationId: audienceLocationId };
    }
    let days: ApplicationDays;
    if (isAutomation) {
      if (!automationName.trim()) return "Indique o nome da automatização.";
      if (when === "dates") return "Uma automatização usa dias da semana — escolha Seg–Sex, fins de semana ou personalizado.";
      if (!from) return "Indique a data inicial.";
      if (to && to < from) return "A data final tem de ser igual ou posterior à inicial.";
      const weekdays = when === "custom" ? customDays : WEEKDAY_PRESETS[when];
      if (weekdays.length === 0) return "Escolha pelo menos um dia da semana.";
      // Pré-visualiza só a 1.ª geração (a mesma janela que o backend vai gerar).
      const window = firstGenerationWindow(from, to || null, horizonWeeks, today);
      days = { kind: "range", from: window?.from ?? from, to: window?.to ?? from, weekdays };
    } else if (when === "dates") {
      if (dates.length === 0) return "Adicione pelo menos uma data.";
      days = { kind: "dates", dates };
    } else {
      if (!from || !to) return "Indique o período de aplicação.";
      const weekdays = when === "custom" ? customDays : WEEKDAY_PRESETS[when];
      if (weekdays.length === 0) return "Escolha pelo menos um dia da semana.";
      days = { kind: "range", from, to, weekdays };
    }
    return { audience, days, locationId: shiftLocationId || (audienceKind === "location" ? audienceLocationId : null) || null };
  }

  const previewMutation = useMutation({
    mutationFn: (config: TemplateApplicationConfig) => api.previewTemplateApplication(templateId, config),
    onSuccess: (data) => {
      setPreview(data);
      setChoices(Object.fromEntries(data.occurrences.map((o) => [o.key, initialChoice(o)])));
      setSelectedKey(null);
      setStep(2);
    },
  });

  const applyMutation = useMutation({
    mutationFn: (config: TemplateApplicationConfig) => api.applyTemplate(templateId, config, buildDecisions(preview!.occurrences, choices)),
    onSuccess: (data) => {
      setResult(data);
      void qc.invalidateQueries({ queryKey: ["hr-work-shifts"] });
      void qc.invalidateQueries({ queryKey: ["hr-work-shifts-week-actions"] });
      void qc.invalidateQueries({ queryKey: ["hr-schedule-alerts"] });
    },
  });

  function goPreview() {
    const config = buildConfig();
    if (typeof config === "string") {
      setConfigError(config);
      return;
    }
    setConfigError(null);
    // Automatização que começa depois do horizonte: nada a pré-visualizar agora — o cron gera quando chegar a altura.
    if (isAutomation && firstGenerationWindow(from, to || null, horizonWeeks, today) === null) {
      setPreview(null);
      setStep(3);
      return;
    }
    previewMutation.mutate(config);
  }

  function confirm() {
    const config = buildConfig();
    if (typeof config === "string") return;
    if (!isAutomation) {
      applyMutation.mutate(config);
      return;
    }
    createMutation.mutate(
      {
        payload: {
          name: automationName.trim(),
          description: null,
          templateId,
          audience: config.audience,
          locationId: config.locationId,
          weekdays: config.days.kind === "range" ? config.days.weekdays : [],
          startDate: from,
          endDate: to || null,
          horizonWeeks,
        },
        generateNow: true,
      },
      {
        onSuccess: (data) =>
          setAutomationResult(data.generation ?? { automationId: data.automation.id, window: null, created: 0, alreadyExisting: 0, issues: 0 }),
      },
    );
  }

  const occurrences = preview?.occurrences ?? [];
  const visible = statusFilter ? occurrences.filter((o) => o.status === statusFilter) : occurrences;
  const selected = occurrences.find((o) => o.key === selectedKey) ?? null;
  // Na automatização só as válidas são criadas (conflitos nunca são forçados — vão para Alertas e ações).
  const toCreate = isAutomation ? occurrences.filter((o) => o.status === "valid").length : countToCreate(occurrences, choices);
  const mutationError = (previewMutation.error ?? applyMutation.error ?? createMutation.error) as Error | null;
  const finished = result !== null || automationResult !== null;

  /** Período dos turnos acabados de criar (para "Rever e publicar agora"). */
  function appliedRange(): { from: string; to: string } | null {
    if (automationResult) return automationResult.window;
    const config = buildConfig();
    if (typeof config === "string") return null;
    if (config.days.kind === "range") return { from: config.days.from, to: config.days.to };
    const dates = [...config.days.dates].sort();
    return dates.length > 0 ? { from: dates[0]!, to: dates[dates.length - 1]! } : null;
  }

  function draftsCreatedNotice(count: number) {
    const range = appliedRange();
    if (count === 0) return null;
    return (
      <div role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sky-900">
        <p>
          Ficaram <strong>em rascunho</strong> — os colaboradores ainda não os veem.
        </p>
        {onReviewDrafts && range && (
          <button type="button" onClick={() => onReviewDrafts(range)} className="mt-1 font-medium text-[#ED5C32] hover:underline">
            Rever e publicar agora
          </button>
        )}
      </div>
    );
  }
  const whenOptions: Partial<Record<WhenKind, string>> = isAutomation
    ? { weekdays: WHEN_LABELS.weekdays, weekend: WHEN_LABELS.weekend, custom: WHEN_LABELS.custom }
    : WHEN_LABELS;

  const audienceSummary =
    audienceKind === "position"
      ? `Por cargo: ${positions.find((p) => p.id === positionId)?.name ?? "—"}${audienceLocationId ? ` · ${locationName.get(audienceLocationId) ?? ""}` : ""}`
      : audienceKind === "location"
        ? `Por local: ${locationName.get(audienceLocationId) ?? "—"}`
        : audienceKind === "all"
          ? "Todos os colaboradores ativos"
          : `${employeeIds.length} colaborador(es)`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="apply-template-title">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 id="apply-template-title" className="text-base font-semibold text-stone-900">
              Aplicar modelo de turno
            </h2>
            <ol className="mt-2 flex gap-4 text-xs">
              {["Configuração", "Pré-visualização", "Confirmar"].map((label, i) => (
                <li key={label} className={step === i + 1 ? "font-semibold text-[#ED5C32]" : "text-stone-400"} aria-current={step === i + 1 ? "step" : undefined}>
                  {i + 1}. {label}
                </li>
              ))}
            </ol>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar janela" className="rounded-md px-2 py-1 text-stone-400 hover:text-stone-700">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && (
            <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
              <div className="space-y-5">
                <div>
                  <label htmlFor="apply-template" className={labelCls}>
                    Modelo <span className="text-red-500">*</span>
                  </label>
                  <TemplatePicker templates={activeTemplates} value={templateId} onChange={setTemplateId} />
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>Aplicar a quem?</p>
                  <Choice name="Aplicar a quem?" value={audienceKind} options={AUDIENCE_LABELS} onChange={(v) => { setAudienceKind(v); setEmployeeIds([]); }} />
                  {audienceKind === "one" && (
                    <select aria-label="Colaborador" value={employeeIds[0] ?? ""} onChange={(e) => setEmployeeIds(e.target.value ? [e.target.value] : [])} className={inputCls}>
                      <option value="">— Escolher —</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName}
                        </option>
                      ))}
                    </select>
                  )}
                  {audienceKind === "many" && (
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2" aria-label="Colaboradores">
                      {employees.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={employeeIds.includes(e.id)}
                            onChange={(ev) => setEmployeeIds((ids) => (ev.target.checked ? [...ids, e.id] : ids.filter((x) => x !== e.id)))}
                          />
                          {e.fullName}
                        </label>
                      ))}
                    </div>
                  )}
                  {audienceKind === "position" && (
                    <div className="grid grid-cols-2 gap-3">
                      <select aria-label="Cargo" value={positionId} onChange={(e) => setPositionId(e.target.value)} className={inputCls}>
                        <option value="">— Cargo —</option>
                        {positions.filter((p) => p.active).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select aria-label="Local (opcional)" value={audienceLocationId} onChange={(e) => setAudienceLocationId(e.target.value)} className={inputCls}>
                        <option value="">Todos os locais</option>
                        {activeLocations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {audienceKind === "location" && (
                    <select aria-label="Local dos colaboradores" value={audienceLocationId} onChange={(e) => setAudienceLocationId(e.target.value)} className={inputCls}>
                      <option value="">— Local —</option>
                      {activeLocations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>Quando aplicar?</p>
                  <Choice name="Quando aplicar?" value={when} options={whenOptions as Record<WhenKind, string>} onChange={setWhen} />
                  {when === "dates" && !isAutomation ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input type="date" aria-label="Data" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} className={inputCls} />
                        <button
                          type="button"
                          onClick={() => dateDraft && !dates.includes(dateDraft) && setDates((d) => [...d, dateDraft].sort())}
                          className="rounded-lg border border-stone-200 px-3 text-sm text-stone-700"
                        >
                          Adicionar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {dates.map((d) => (
                          <button key={d} type="button" onClick={() => setDates((all) => all.filter((x) => x !== d))} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700" title="Remover">
                            {formatOccurrenceDate(d)} ✕
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <input type="date" aria-label="De" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
                        <input type="date" aria-label={isAutomation ? "Até (opcional)" : "Até"} value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
                      </div>
                      {when === "custom" && (
                        <div className="flex gap-1">
                          {WEEKDAY_SHORT_LABELS.map((label, i) => (
                            <button
                              key={label}
                              type="button"
                              aria-pressed={customDays.includes(i as Weekday)}
                              onClick={() => setCustomDays((d) => (d.includes(i as Weekday) ? d.filter((x) => x !== i) : [...d, i as Weekday]))}
                              className={`rounded-md border px-2 py-1 text-xs ${customDays.includes(i as Weekday) ? "border-[#ED5C32] bg-orange-50" : "border-stone-200"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="apply-shift-location" className={labelCls}>
                    Local do turno
                  </label>
                  <select id="apply-shift-location" value={shiftLocationId} onChange={(e) => setShiftLocationId(e.target.value)} className={inputCls}>
                    <option value="">Local padrão do modelo (ou o local principal de cada colaborador)</option>
                    {activeLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>Tipo de utilização</p>
                  <Choice
                    name="Tipo de utilização"
                    value={usage}
                    options={USAGE_LABELS}
                    onChange={(v) => {
                      setUsage(v);
                      if (v === "automation" && when === "dates") setWhen("weekdays");
                    }}
                  />
                  {isAutomation && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="automation-name-new" className={labelCls}>
                          Nome da automatização <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="automation-name-new"
                          value={automationName}
                          onChange={(e) => setAutomationName(e.target.value)}
                          placeholder="Ex.: Fim de semana — Preparadores"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor="automation-horizon-new" className={labelCls}>
                          Horizonte de geração
                        </label>
                        <select id="automation-horizon-new" value={horizonWeeks} onChange={(e) => setHorizonWeeks(Number(e.target.value))} className={inputCls}>
                          {HORIZON_OPTIONS.map((w) => (
                            <option key={w} value={w}>
                              Próximas {w} semana(s)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <aside className="h-fit space-y-3 rounded-xl bg-stone-50 p-4 text-sm">
                <p className="font-semibold text-stone-800">Resumo da aplicação</p>
                <p>
                  <span className="text-stone-500">Modelo:</span> {template ? `${template.name} · ${templateTimeLabel(template)}` : "—"}
                </p>
                <p>
                  <span className="text-stone-500">Colaboradores:</span> {audienceSummary}
                </p>
                {isAutomation && (
                  <p>
                    <span className="text-stone-500">Tipo:</span> Automatização · horizonte de {horizonWeeks} semana(s)
                  </p>
                )}
                <p className="text-xs text-stone-500">Os turnos são criados em rascunho — revê e publica no Calendário.</p>
              </aside>
            </div>
          )}

          {step === 2 && preview && (
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    ["Colaboradores", preview.summary.employees, "text-stone-800"],
                    ["Turnos válidos", preview.summary.valid, "text-emerald-700"],
                    ["Conflitos de horário", preview.summary.overlap, "text-amber-700"],
                    ["Em férias/ausências", preview.summary.unavailable, "text-red-600"],
                    ["Turnos já existentes", preview.summary.duplicate, "text-stone-600"],
                  ].map(([label, value, cls]) => (
                    <div key={label as string} className="rounded-lg border border-stone-200 px-3 py-2">
                      <p className={`text-lg font-bold ${cls}`}>{value}</p>
                      <p className="text-xs text-stone-500">{label}</p>
                    </div>
                  ))}
                </div>
                {isAutomation && (
                  <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    Primeira geração da automatização. Só os turnos válidos são criados; conflitos e ausências vão para Alertas e ações (nunca são forçados).
                  </p>
                )}
                {preview.summary.holidays > 0 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {preview.summary.holidays} turno(s) calham em feriado — são criados na mesma (assinalados); o tratamento faz-se no Fecho Mensal.
                  </p>
                )}
                <select aria-label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm">
                  <option value="">Estado: Todos</option>
                  {Object.entries(OCCURRENCE_STATUS_LABELS).map(([v, { label }]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="px-3 py-2">
                          <span className="sr-only">Criar</span>
                        </th>
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2">Colaborador</th>
                        <th className="px-3 py-2">Turno (novo)</th>
                        <th className="px-3 py-2">Local</th>
                        <th className="px-3 py-2">Situação</th>
                        <th className="px-3 py-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {visible.map((o) => {
                        const choice = choices[o.key] ?? initialChoice(o);
                        const status = OCCURRENCE_STATUS_LABELS[o.status];
                        return (
                          <tr key={o.key} className={selectedKey === o.key ? "bg-orange-50/40" : ""}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                aria-label={`Criar turno de ${o.employeeName} em ${o.workDate}`}
                                disabled={isAutomation || (o.status !== "valid" && !(o.status === "overlap" && choice === "replace"))}
                                checked={choice === "create" || choice === "replace"}
                                onChange={(e) => setChoices((c) => ({ ...c, [o.key]: e.target.checked ? "create" : "skip" }))}
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              {formatOccurrenceDate(o.workDate)}
                              {o.holidayName && <p className="text-xs text-amber-700">Feriado · {o.holidayName}</p>}
                            </td>
                            <td className="px-3 py-2">{o.employeeName}</td>
                            <td className="whitespace-nowrap px-3 py-2">{occurrenceTime(o)}</td>
                            <td className="px-3 py-2">{o.locationId ? (locationName.get(o.locationId) ?? "—") : "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                              {o.status === "overlap" && choice === "replace" && <p className="mt-0.5 text-xs text-[#ED5C32]">Vai substituir</p>}
                            </td>
                            <td className="px-3 py-2">
                              {!isAutomation && (o.status === "overlap" || o.status === "duplicate") ? (
                                <button type="button" onClick={() => setSelectedKey(o.key)} className="text-sm font-medium text-[#ED5C32] hover:underline">
                                  {o.status === "overlap" ? "Resolver" : "Ver"}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="h-fit rounded-xl border border-stone-200 p-4 text-sm" aria-label="Detalhes do conflito">
                {!selected ? (
                  <p className="text-stone-500">Escolha "Resolver" num conflito para decidir o que fazer.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="font-semibold text-stone-800">Detalhes do conflito</p>
                    <p>
                      {selected.employeeName} · {formatOccurrenceDate(selected.workDate)}
                    </p>
                    {selected.existingShift && (
                      <div className="rounded-lg bg-stone-50 p-2">
                        <p className="text-xs text-stone-500">Turno existente</p>
                        <p>{occurrenceTime(selected.existingShift)}</p>
                      </div>
                    )}
                    <div className="rounded-lg bg-sky-50 p-2">
                      <p className="text-xs text-stone-500">Novo turno</p>
                      <p>{occurrenceTime(selected)}</p>
                    </div>
                    {selected.status === "overlap" && (
                      <fieldset className="space-y-1.5">
                        <legend className="mb-1 text-xs font-medium text-stone-600">O que pretende fazer?</legend>
                        <label className="flex gap-2">
                          <input type="radio" name="resolve" checked={(choices[selected.key] ?? "skip") === "skip"} onChange={() => setChoices((c) => ({ ...c, [selected.key]: "skip" }))} />
                          Manter turno existente (não cria o novo)
                        </label>
                        <label className={`flex gap-2 ${canReplace(selected) ? "" : "text-stone-400"}`}>
                          <input
                            type="radio"
                            name="resolve"
                            disabled={!canReplace(selected)}
                            checked={choices[selected.key] === "replace"}
                            onChange={() => setChoices((c) => ({ ...c, [selected.key]: "replace" }))}
                          />
                          Substituir turno existente
                        </label>
                        {!canReplace(selected) && <p className="text-xs text-stone-500">Não é possível substituir: o turno existente já tem presença registada.</p>}
                      </fieldset>
                    )}
                    {selected.status === "duplicate" && <p className="text-xs text-stone-500">Este turno já existe — nada a fazer.</p>}
                  </div>
                )}
              </aside>
            </div>
          )}

          {step === 3 && isAutomation && (
            <div className="space-y-2 text-sm">
              {!automationResult ? (
                <p className="text-stone-700">
                  {preview
                    ? `A automatização "${automationName.trim()}" é guardada e gera já ${toCreate} turno(s) válido(s) em rascunho. Depois, mantém sempre as próximas ${horizonWeeks} semana(s) geradas.`
                    : `A automatização "${automationName.trim()}" é guardada; os turnos são gerados quando o período entrar no horizonte de ${horizonWeeks} semana(s).`}
                </p>
              ) : (
                <>
                  <p className="font-semibold text-emerald-700">Automatização guardada. {generationSummary(automationResult)}</p>
                  {draftsCreatedNotice(automationResult.created)}
                </>
              )}
            </div>
          )}

          {step === 3 && !isAutomation && (
            <div className="space-y-3">
              {!result ? (
                <p className="text-sm text-stone-700">
                  {toCreate} turno(s) serão criados em rascunho. Antes de gravar, os dados são revalidados — o que tiver mudado desde a pré-visualização não é aplicado.
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-emerald-700">
                    {result.created} turno(s) criado(s){result.replaced > 0 ? `, ${result.replaced} substituído(s)` : ""}.
                  </p>
                  {draftsCreatedNotice(result.created + result.replaced)}
                  {result.changed.length > 0 && (
                    <div className="rounded-lg bg-amber-50 p-3 text-amber-800">
                      <p className="font-medium">Não aplicados — mudaram desde a pré-visualização:</p>
                      <ul className="mt-1 list-disc pl-5">
                        {result.changed.map((c) => (
                          <li key={c.key}>
                            {c.employeeName} · {formatOccurrenceDate(c.workDate)} — {OCCURRENCE_STATUS_LABELS[c.status].label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(configError ?? mutationError?.message) && <p className="mt-3 text-sm text-red-600">{configError ?? mutationError?.message}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-6 py-3">
          <p className="text-xs text-stone-500">{step === 2 && `${toCreate} turno(s) serão criados.`}</p>
          <div className="flex gap-2">
            {step === 2 && (
              <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700">
                Editar configuração
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700">
              {finished ? "Fechar" : "Cancelar"}
            </button>
            {step === 1 && (
              <button
                type="button"
                onClick={goPreview}
                disabled={previewMutation.isPending || !templateId}
                className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {previewMutation.isPending ? "A analisar…" : "Pré-visualizar"}
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={toCreate === 0 && !isAutomation}
                className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Continuar
              </button>
            )}
            {step === 3 && !finished && (
              <button
                type="button"
                onClick={confirm}
                disabled={applyMutation.isPending || createMutation.isPending || (toCreate === 0 && !isAutomation)}
                className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isAutomation ? (createMutation.isPending ? "A guardar…" : "Guardar automatização") : applyMutation.isPending ? "A criar…" : `Criar ${toCreate} turno(s)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
