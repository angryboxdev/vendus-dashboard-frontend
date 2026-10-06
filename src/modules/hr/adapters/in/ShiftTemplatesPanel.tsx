import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../../../lib/api.ts";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import {
  SHIFT_TEMPLATE_COLORS,
  SHIFT_TEMPLATE_GROUP_LABELS,
  SHIFT_TEMPLATE_GROUP_ORDER,
  SHIFT_TEMPLATE_KIND_LABELS,
  type ShiftTemplate,
  type ShiftTemplateGroup,
  type ShiftTemplateKind,
  type ShiftTemplatePayload,
} from "../../domain/entities/shift-template.ts";
import {
  emptyShiftTemplateForm,
  filterTemplates,
  formatMinutes,
  formFromTemplate,
  formWorkMinutes,
  groupTemplates,
  templateDurationLabel,
  templateTimeLabel,
  toShiftTemplatePayload,
  type ShiftTemplateForm,
} from "../../domain/services/shift-template.service.ts";
import { useManageShiftTemplates, useShiftTemplates } from "./use-shift-templates.ts";
import { ApplyTemplateModal } from "./ApplyTemplateModal.tsx";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";
const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";

function saveErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError && error.status === 409) return "Já existe um modelo com este nome.";
  if (error instanceof ApiError && error.status === 400) return error.message;
  return "Não foi possível guardar. Tente novamente.";
}

/** Barra 06:00–24:00 com os períodos do modelo (pré-visualização do mockup). */
function TimelinePreview({ form }: { form: ShiftTemplateForm }) {
  const toPct = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const minutes = (h ?? 0) * 60 + (m ?? 0);
    return Math.min(100, Math.max(0, ((minutes - 360) / (18 * 60)) * 100));
  };
  const periods: [string, string][] = [[form.startTime, form.endTime]];
  if (form.kind === "split") periods.push([form.secondStartTime, form.secondEndTime]);
  return (
    <div className="relative mt-2 h-8 rounded-md bg-stone-100" aria-hidden="true">
      {periods.map(([s, e], i) => {
        const left = toPct(s);
        const end = e <= s ? 100 : toPct(e);
        return (
          <div
            key={i}
            className="absolute inset-y-1 flex items-center justify-center rounded text-[11px] font-medium text-white"
            style={{ left: `${left}%`, width: `${Math.max(2, end - left)}%`, background: form.color || "#3B82F6" }}
          >
            {s}–{e}
          </div>
        );
      })}
    </div>
  );
}

function ShiftTemplateModal({
  title,
  initial,
  saving,
  error,
  onSave,
  onClose,
}: {
  title: string;
  initial: ShiftTemplateForm;
  saving: boolean;
  error: unknown;
  onSave: (payload: ShiftTemplatePayload) => void;
  onClose: () => void;
}) {
  const { locations } = useLocations();
  const [form, setForm] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const set = (patch: Partial<ShiftTemplateForm>) => setForm((f) => ({ ...f, ...patch }));
  const work = formWorkMinutes(form);
  const activeLocations = locations.filter((l) => l.isActive || l.id === form.locationId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = toShiftTemplatePayload(form);
    if ("error" in result) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    onSave(result.payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="shift-template-title">
      <form onSubmit={handleSubmit} className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 id="shift-template-title" className="text-base font-semibold text-stone-900">
              {title}
            </h2>
            <p className="text-xs text-stone-500">Horário utilizado nas escalas e automatizações.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar janela" className="rounded-md px-2 py-1 text-stone-400 hover:text-stone-700">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label htmlFor="template-name" className={labelCls}>
              Nome do modelo <span className="text-red-500">*</span>
            </label>
            <input id="template-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Manhã 1" className={inputCls} />
          </div>
          <div>
            <label htmlFor="template-group" className={labelCls}>
              Grupo
            </label>
            <select id="template-group" value={form.group} onChange={(e) => set({ group: e.target.value as ShiftTemplateGroup })} className={inputCls}>
              {SHIFT_TEMPLATE_GROUP_ORDER.map((g) => (
                <option key={g} value={g}>
                  {SHIFT_TEMPLATE_GROUP_LABELS[g]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">Só organiza a biblioteca — não altera horários nem a geração de turnos.</p>
          </div>
          <div>
            <label htmlFor="template-description" className={labelCls}>
              Descrição (opcional)
            </label>
            <input id="template-description" value={form.description} onChange={(e) => set({ description: e.target.value })} className={inputCls} />
          </div>

          <fieldset>
            <legend className={labelCls}>Tipo de turno</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["direct", "split"] as const).map((kind) => (
                <label
                  key={kind}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${form.kind === kind ? "border-[#ED5C32] bg-orange-50" : "border-stone-200"}`}
                >
                  <input type="radio" name="kind" className="mr-2" checked={form.kind === kind} onChange={() => set({ kind })} />
                  <span className="font-medium text-stone-800">{SHIFT_TEMPLATE_KIND_LABELS[kind]}</span>
                  <span className="block pl-5 text-xs text-stone-500">{kind === "direct" ? "Um único período de trabalho" : "Dois períodos de trabalho"}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="template-start" className={labelCls}>
                Hora de início <span className="text-red-500">*</span>
              </label>
              <input id="template-start" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="template-end" className={labelCls}>
                Hora de fim <span className="text-red-500">*</span>
              </label>
              <input id="template-end" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} className={inputCls} />
            </div>
            {form.kind === "split" && (
              <>
                <div>
                  <label htmlFor="template-second-start" className={labelCls}>
                    Início do 2.º período
                  </label>
                  <input
                    id="template-second-start"
                    type="time"
                    value={form.secondStartTime}
                    onChange={(e) => set({ secondStartTime: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="template-second-end" className={labelCls}>
                    Fim do 2.º período
                  </label>
                  <input
                    id="template-second-end"
                    type="time"
                    value={form.secondEndTime}
                    onChange={(e) => set({ secondEndTime: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="template-break" className={labelCls}>
                Pausa (minutos)
              </label>
              <input
                id="template-break"
                type="number"
                min={0}
                step={5}
                value={form.breakMinutes}
                onChange={(e) => set({ breakMinutes: Math.max(0, Number(e.target.value) || 0) })}
                className={inputCls}
              />
            </div>
            <div className="rounded-lg bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Duração de trabalho</p>
              <p className="text-sm font-semibold text-stone-800">{work === null ? "—" : formatMinutes(work)}</p>
            </div>
          </div>
          {form.kind === "direct" && form.endTime <= form.startTime && (
            <p className="text-xs text-stone-500">Termina no dia seguinte (turno noturno).</p>
          )}

          <div>
            <label htmlFor="template-location" className={labelCls}>
              Local padrão (opcional)
            </label>
            <select id="template-location" value={form.locationId} onChange={(e) => set({ locationId: e.target.value })} className={inputCls}>
              <option value="">Sem local padrão</option>
              {activeLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">Se definido, é o local sugerido nas aplicações deste modelo.</p>
          </div>

          <div>
            <span className={labelCls}>Cor</span>
            <div className="flex gap-2">
              {SHIFT_TEMPLATE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  aria-pressed={form.color === c}
                  onClick={() => set({ color: c })}
                  className={`h-6 w-6 rounded-full ${form.color === c ? "ring-2 ring-stone-800 ring-offset-2" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 p-3">
            <p className="text-xs font-medium text-stone-600">Pré-visualização</p>
            <TimelinePreview form={form} />
          </div>

          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Alterações futuras neste modelo não modificam os turnos já criados — cada turno guarda uma cópia do horário e do local.
          </p>

          {(formError ?? saveErrorMessage(error)) && <p className="text-sm text-red-600">{formError ?? saveErrorMessage(error)}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "A guardar…" : "Guardar modelo"}
          </button>
        </div>
      </form>
    </div>
  );
}

type ModalState = { open: false } | { open: true; title: string; editingId: string | null; initial: ShiftTemplateForm };

const KIND_FILTERS: Array<[ShiftTemplateKind | null, string]> = [
  [null, "Todos"],
  ["direct", "Direto"],
  ["split", "Repartido"],
];

/** "⋮" com as ações secundárias da linha (Editar, Duplicar, Inativar/Ativar). */
function RowMenu({ template, onEdit, onDuplicate, onToggle }: { template: ShiftTemplate; onEdit: () => void; onDuplicate: () => void; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = (label: string, action: () => void, tone = "text-stone-700") => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        action();
      }}
      className={`block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 ${tone}`}
    >
      {label}
    </button>
  );
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={`Mais ações de ${template.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      >
        ⋮
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          {item("Editar", onEdit)}
          {item("Duplicar", onDuplicate)}
          {item(template.active ? "Inativar" : "Ativar", onToggle, template.active ? "text-red-600" : "text-emerald-700")}
        </div>
      )}
    </div>
  );
}

/**
 * Escalas & Turnos → Modelos & Automatizações → **Modelos de turno**
 * (RH 2.0 ticket 01; Modelos de Turno 2.0): biblioteca compacta com
 * pesquisa, filtros por Grupo/Tipo/Estado (no cliente — uma só carga) e,
 * em "Todos", secções por Grupo recolhíveis (estado só local). Ação
 * principal "Aplicar" (pré-seleciona o modelo); o resto no "⋮". Nunca
 * apagar — só inativar.
 */
export function ShiftTemplatesPanel({ onReviewDrafts }: { onReviewDrafts?: (range: { from: string; to: string }) => void } = {}) {
  const { user } = useAuth();
  // Editar exige Escalas & Turnos: Gerir (Utilizadores & Perfis 2.0); sem acesso carregado, regra antiga por papel.
  const canEdit = user?.access ? user.access.isAdmin || user.access.permissions["hr.schedules"] === "MANAGE" : user?.role === "admin" || user?.role === "manager";
  const { locations } = useLocations();
  const { data: templates = [], isLoading, isError } = useShiftTemplates();
  const { saveMutation, setActiveMutation } = useManageShiftTemplates();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<ShiftTemplateGroup | null>(null);
  const [kind, setKind] = useState<ShiftTemplateKind | null>(null);
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [collapsed, setCollapsed] = useState<Set<ShiftTemplateGroup>>(new Set());
  const [modal, setModal] = useState<ModalState>({ open: false });
  /** Modelo pré-selecionado no "Aplicar modelo"; `undefined` = fechado. */
  const [applying, setApplying] = useState<string | null | undefined>(undefined);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  const visible = filterTemplates(templates, { group, kind, status, search });
  const sections = group === null ? groupTemplates(visible) : [{ group, label: SHIFT_TEMPLATE_GROUP_LABELS[group], templates: groupTemplates(visible)[0]?.templates ?? [] }];
  const columns = 7;

  function open(title: string, editingId: string | null, initial: ShiftTemplateForm) {
    saveMutation.reset();
    setModal({ open: true, title, editingId, initial });
  }

  function toggleSection(g: ShiftTemplateGroup) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`;

  return (
    <section className="rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Modelos de turno</h2>
          <p className="text-xs text-stone-500">Horários reutilizáveis, aplicados manualmente ou por automatizações.</p>
        </div>
        <div className="flex gap-2">
          {canEdit && templates.some((t) => t.active) && (
            <button
              type="button"
              onClick={() => setApplying(null)}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Aplicar modelo
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => open("Novo modelo de turno", null, emptyShiftTemplateForm(group ?? "OTHER"))}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >
              Novo modelo
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 border-b border-stone-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar modelos…"
            aria-label="Pesquisar modelos"
            className="w-64 rounded-lg border border-stone-200 px-3 py-1.5 text-sm outline-none focus:border-[#ED5C32]"
          />
          <select aria-label="Tipo" value={kind ?? ""} onChange={(e) => setKind((e.target.value || null) as ShiftTemplateKind | null)} className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm">
            {KIND_FILTERS.map(([v, l]) => (
              <option key={l} value={v ?? ""}>
                Tipo: {l}
              </option>
            ))}
          </select>
          <select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive" | "all")} className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm">
            <option value="active">Estado: Ativos</option>
            <option value="inactive">Estado: Inativos</option>
            <option value="all">Estado: Todos</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grupo">
          <button type="button" aria-pressed={group === null} onClick={() => setGroup(null)} className={chip(group === null)}>
            Todos
          </button>
          {SHIFT_TEMPLATE_GROUP_ORDER.map((g) => (
            <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} className={chip(group === g)}>
              {SHIFT_TEMPLATE_GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="px-4 py-6 text-sm text-stone-500">A carregar…</p>}
      {isError && <p className="px-4 py-6 text-sm text-red-600">Não foi possível carregar os modelos.</p>}
      {setActiveMutation.isError && <p className="px-4 pt-2 text-sm text-red-600">Não foi possível alterar o estado do modelo.</p>}

      {!isLoading && !isError && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#FDF8F5] text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Modelo</th>
                <th className="px-4 py-2">Horário</th>
                <th className="px-4 py-2">Duração</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Local</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            {visible.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={columns} className="px-4 py-6 text-center text-stone-500">
                    {templates.length === 0 ? "Ainda não há modelos de turno." : "Nenhum modelo corresponde aos filtros."}
                  </td>
                </tr>
              </tbody>
            )}
            {sections.map((section) => {
              const isCollapsed = group === null && collapsed.has(section.group);
              return (
                <tbody key={section.group} className="divide-y divide-[#F5C992]/30">
                  {group === null && (
                    <tr className="bg-stone-50/60">
                      <td colSpan={columns} className="px-4 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggleSection(section.group)}
                          aria-expanded={!isCollapsed}
                          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-600"
                        >
                          <span aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span>
                          {section.label} · {section.templates.length}
                        </button>
                      </td>
                    </tr>
                  )}
                  {!isCollapsed &&
                    section.templates.map((t: ShiftTemplate) => (
                      <tr key={t.id} className={t.active ? "" : "text-stone-400"}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color ?? "#94A3B8" }} />
                            <div>
                              <p className="font-medium text-stone-800">{t.name}</p>
                              {t.description && <p className="text-xs text-stone-500">{t.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">{templateTimeLabel(t)}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-stone-600">{templateDurationLabel(t)}</td>
                        <td className="px-4 py-2 text-stone-600">{SHIFT_TEMPLATE_KIND_LABELS[t.kind]}</td>
                        <td className="px-4 py-2 text-stone-600">{t.locationId ? (locationName.get(t.locationId) ?? "—") : "—"}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-medium ${t.active ? "text-emerald-700" : "text-stone-500"}`}>{t.active ? "Ativo" : "Inativo"}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          {canEdit && (
                            <div className="flex items-center justify-end gap-1">
                              {t.active && (
                                <button
                                  type="button"
                                  onClick={() => setApplying(t.id)}
                                  aria-label={`Aplicar ${t.name}`}
                                  className="rounded-md border border-[#ED5C32]/40 px-3 py-1 text-xs font-medium text-[#ED5C32] hover:bg-[#FEF3EC]"
                                >
                                  Aplicar
                                </button>
                              )}
                              <RowMenu
                                template={t}
                                onEdit={() => open("Editar modelo de turno", t.id, formFromTemplate(t))}
                                onDuplicate={() => open("Duplicar modelo de turno", null, formFromTemplate(t, true))}
                                onToggle={() => setActiveMutation.mutate({ id: t.id, active: !t.active })}
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      {applying !== undefined && (
        <ApplyTemplateModal
          templates={templates}
          initialTemplateId={applying}
          onClose={() => setApplying(undefined)}
          {...(onReviewDrafts && {
            onReviewDrafts: (range: { from: string; to: string }) => {
              setApplying(undefined);
              onReviewDrafts(range);
            },
          })}
        />
      )}

      {modal.open && (
        <ShiftTemplateModal
          title={modal.title}
          initial={modal.initial}
          saving={saveMutation.isPending}
          error={saveMutation.error}
          onClose={() => setModal({ open: false })}
          onSave={(payload) => saveMutation.mutate({ id: modal.editingId, payload }, { onSuccess: () => setModal({ open: false }) })}
        />
      )}
    </section>
  );
}
