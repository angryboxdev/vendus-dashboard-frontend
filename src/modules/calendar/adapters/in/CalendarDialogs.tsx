import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "../../../../lib/api.ts";
import {
  CATEGORY_LABELS,
  HOLIDAY_TYPE_LABELS,
  PRIORITY_LABELS,
  VISIBILITY_LABELS,
  type CalendarItem,
  type EventCategory,
  type EventInput,
  type EventPriority,
  type EventVisibility,
  type HolidayInput,
  type HolidayType,
} from "../../domain/entities/calendar-item.ts";
import { useCalendarMutations, useHolidayImportPreview } from "./use-calendar.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30 disabled:bg-stone-50";
const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";
const primaryBtn =
  "rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50";
const secondaryBtn = "rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50";

export interface LocationOption {
  id: string;
  name: string;
  isActive: boolean;
}

function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError && (error.status === 400 || error.status === 409)) return error.message;
  return "Não foi possível guardar. Tente novamente.";
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Fechar janela">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LocationSelect({
  id,
  value,
  onChange,
  locations,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  locations: LocationOption[];
  disabled?: boolean;
}) {
  const options = locations.filter((l) => l.isActive || l.id === value);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls}>
      <option value="">Empresa inteira</option>
      {options.map((l) => (
        <option key={l.id} value={l.id}>
          {l.isActive ? l.name : `${l.name} (inativo)`}
        </option>
      ))}
    </select>
  );
}

/** Criar/editar/cancelar um evento empresarial. Só leitura para quem não gere eventos. */
export function EventDrawer({
  item,
  defaultDate,
  canEdit,
  locations,
  onClose,
}: {
  item: CalendarItem | null;
  defaultDate: string;
  canEdit: boolean;
  locations: LocationOption[];
  onClose: () => void;
}) {
  const { saveEvent, cancelEvent } = useCalendarMutations();
  const [form, setForm] = useState<EventInput>({
    title: item?.title ?? "",
    date: item?.date ?? defaultDate,
    allDay: item?.allDay ?? true,
    startTime: item?.startTime ?? null,
    endTime: item?.endTime ?? null,
    description: item?.description ?? null,
    category: item?.category ?? "meeting",
    locationId: item?.locationId ?? null,
    priority: item?.priority ?? "normal",
    responsible: item?.responsible ?? null,
    visibility: item?.visibility ?? "all",
  });
  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    saveEvent.mutate({ id: item?.id ?? null, input: form }, { onSuccess: onClose });
  }

  return (
    <Drawer title={item ? (canEdit ? "Editar evento" : "Evento") : "Novo evento"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <fieldset disabled={!canEdit} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="event-title" className={labelCls}>
              Título <span className="text-[#ED5C32]">*</span>
            </label>
            <input id="event-title" required value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-date" className={labelCls}>
                Data <span className="text-[#ED5C32]">*</span>
              </label>
              <input id="event-date" type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} className={inputCls} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-stone-700">
              <input type="checkbox" checked={form.allDay} onChange={(e) => set("allDay", e.target.checked)} />
              Dia inteiro
            </label>
            {!form.allDay && (
              <>
                <div>
                  <label htmlFor="event-start" className={labelCls}>
                    Hora de início
                  </label>
                  <input id="event-start" type="time" required value={form.startTime ?? ""} onChange={(e) => set("startTime", e.target.value || null)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="event-end" className={labelCls}>
                    Hora de fim
                  </label>
                  <input id="event-end" type="time" value={form.endTime ?? ""} onChange={(e) => set("endTime", e.target.value || null)} className={inputCls} />
                </div>
              </>
            )}
            <div>
              <label htmlFor="event-category" className={labelCls}>
                Categoria
              </label>
              <select id="event-category" value={form.category} onChange={(e) => set("category", e.target.value as EventCategory)} className={inputCls}>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="event-priority" className={labelCls}>
                Prioridade
              </label>
              <select id="event-priority" value={form.priority} onChange={(e) => set("priority", e.target.value as EventPriority)} className={inputCls}>
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="event-location" className={labelCls}>
                Local
              </label>
              <LocationSelect id="event-location" value={form.locationId ?? ""} onChange={(v) => set("locationId", v || null)} locations={locations} />
            </div>
            <div>
              <label htmlFor="event-visibility" className={labelCls}>
                Visibilidade
              </label>
              <select id="event-visibility" value={form.visibility} onChange={(e) => set("visibility", e.target.value as EventVisibility)} className={inputCls}>
                {Object.entries(VISIBILITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="event-responsible" className={labelCls}>
              Responsável (opcional)
            </label>
            <input id="event-responsible" value={form.responsible ?? ""} onChange={(e) => set("responsible", e.target.value || null)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="event-description" className={labelCls}>
              Descrição (opcional)
            </label>
            <textarea id="event-description" rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value || null)} className={inputCls} />
          </div>
          <p className="text-xs text-stone-500">Um evento é informativo: não altera escalas, férias, assiduidade nem remunerações.</p>
          {errorText(saveEvent.error ?? cancelEvent.error) && <p className="text-sm text-[#A3211A]">{errorText(saveEvent.error ?? cancelEvent.error)}</p>}
        </fieldset>
        {canEdit && (
          <div className="flex justify-between gap-2 border-t border-stone-200 px-5 py-4">
            {item ? (
              <button type="button" onClick={() => cancelEvent.mutate(item.id, { onSuccess: onClose })} className="text-sm text-stone-500 hover:underline">
                Cancelar evento
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={secondaryBtn}>
                Fechar
              </button>
              <button type="submit" disabled={saveEvent.isPending} className={primaryBtn}>
                {saveEvent.isPending ? "A guardar…" : item ? "Guardar" : "Criar evento"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
}

/** Criar/editar/remover um feriado (só admin — os feriados mudam as Escalas). */
export function HolidayDrawer({
  item,
  defaultDate,
  canEdit,
  locations,
  onClose,
}: {
  item: CalendarItem | null;
  defaultDate: string;
  canEdit: boolean;
  locations: LocationOption[];
  onClose: () => void;
}) {
  const { saveHoliday, deleteHoliday } = useCalendarMutations();
  const [form, setForm] = useState<HolidayInput>({
    date: item?.date ?? defaultDate,
    name: item?.title ?? "",
    type: item?.holidayType ?? "custom",
    locationId: item?.locationId ?? null,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Drawer title={item ? (canEdit ? "Editar feriado" : "Feriado") : "Novo feriado"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveHoliday.mutate({ id: item?.id ?? null, input: form }, { onSuccess: onClose });
        }}
        className="flex flex-1 flex-col"
      >
        <fieldset disabled={!canEdit} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="holiday-name" className={labelCls}>
              Nome <span className="text-[#ED5C32]">*</span>
            </label>
            <input id="holiday-name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="holiday-date" className={labelCls}>
                Data <span className="text-[#ED5C32]">*</span>
              </label>
              <input id="holiday-date" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label htmlFor="holiday-type" className={labelCls}>
                Tipo
              </label>
              <select id="holiday-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as HolidayType }))} className={inputCls}>
                {Object.entries(HOLIDAY_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="holiday-location" className={labelCls}>
              Aplica-se a
            </label>
            <LocationSelect id="holiday-location" value={form.locationId ?? ""} onChange={(v) => setForm((f) => ({ ...f, locationId: v || null }))} locations={locations} />
            <p className="mt-1 text-xs text-stone-500">Nesta fase, as Escalas e as Férias só consideram feriados da empresa inteira.</p>
          </div>
          {errorText(saveHoliday.error ?? deleteHoliday.error) && <p className="text-sm text-[#A3211A]">{errorText(saveHoliday.error ?? deleteHoliday.error)}</p>}
        </fieldset>
        {canEdit && (
          <div className="flex justify-between gap-2 border-t border-stone-200 px-5 py-4">
            {item ? (
              confirmDelete ? (
                <button type="button" onClick={() => deleteHoliday.mutate(item.id, { onSuccess: onClose })} className="text-sm font-medium text-[#A3211A]">
                  Confirmar remoção
                </button>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-stone-500 hover:underline">
                  Remover feriado
                </button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={secondaryBtn}>
                Fechar
              </button>
              <button type="submit" disabled={saveHoliday.isPending} className={primaryBtn}>
                {saveHoliday.isPending ? "A guardar…" : item ? "Guardar" : "Criar feriado"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
}

/** Importar feriados nacionais de Portugal por ano — pré-visualização antes de gravar; nunca duplica. */
export function ImportHolidaysModal({ defaultYear, onClose }: { defaultYear: number; onClose: () => void }) {
  const [year, setYear] = useState(defaultYear);
  const [requested, setRequested] = useState<number | null>(null);
  const preview = useHolidayImportPreview(requested);
  const { importHolidays } = useCalendarMutations();
  const newCount = preview.data?.filter((r) => r.status === "new").length ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20" role="dialog" aria-modal="true" aria-label="Importar feriados">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-stone-900">Importar feriados nacionais</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Fechar janela">
            ✕
          </button>
        </div>
        <div className="mb-4 flex items-end gap-2">
          <div>
            <label htmlFor="import-country" className="mb-1 block text-xs font-medium text-stone-600">
              País
            </label>
            <select id="import-country" disabled className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
              <option>Portugal</option>
            </select>
          </div>
          <div>
            <label htmlFor="import-year" className="mb-1 block text-xs font-medium text-stone-600">
              Ano
            </label>
            <input
              id="import-year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="button" onClick={() => setRequested(year)} className={secondaryBtn}>
            Pré-visualizar
          </button>
        </div>

        {preview.isLoading && <p className="text-sm text-stone-500">A calcular…</p>}
        {preview.data && (
          <ul className="mb-4 max-h-72 divide-y divide-stone-100 overflow-y-auto text-sm">
            {preview.data.map((r) => (
              <li key={r.date} className="flex items-center justify-between py-1.5">
                <span>
                  {new Date(`${r.date}T00:00:00Z`).toLocaleDateString("pt-PT", { timeZone: "UTC" })} — {r.name}
                </span>
                <span className={`text-xs font-medium ${r.status === "new" ? "text-emerald-700" : "text-stone-400"}`}>
                  {r.status === "new" ? "Novo" : "Já existe"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {importHolidays.data && (
          <p className="mb-3 text-sm text-emerald-700">
            {importHolidays.data.created} feriado(s) importado(s); {importHolidays.data.skipped} já existia(m).
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Fechar
          </button>
          <button
            type="button"
            disabled={!preview.data || newCount === 0 || importHolidays.isPending}
            onClick={() => requested !== null && importHolidays.mutate(requested, { onSuccess: () => void preview.refetch() })}
            className={primaryBtn}
          >
            {importHolidays.isPending ? "A importar…" : `Importar ${newCount} novo(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
