import { useState } from "react";
import {
  LOCATION_COUNTRY_OPTIONS,
  LOCATION_FIELD_LABELS,
  LOCATION_TIMEZONE_OPTIONS,
  LocationValidationError,
  type LocationDTO,
  type LocationField,
  type LocationFormValues,
} from "../../domain/entities/location.ts";
import { EMPTY_LOCATION_FORM, locationHistoryLabel, toLocationFormValues } from "../../domain/services/location-form.service.ts";
import { useLocationHistory } from "./use-manage-locations.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";
const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";

interface LocationDrawerProps {
  /** `null` = criar um Local novo. */
  editing: LocationDTO | null;
  saving: boolean;
  error: unknown;
  onSubmit: (values: LocationFormValues) => void;
  onClose: () => void;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function History({ locationId }: { locationId: string }) {
  const { data, isLoading } = useLocationHistory(locationId);
  return (
    <div className="border-t border-stone-100 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-stone-800">Histórico de alterações</h3>
      {isLoading && <p className="text-sm text-stone-500">A carregar…</p>}
      {data && data.length === 0 && <p className="text-sm text-stone-500">Sem alterações registadas.</p>}
      <ul className="divide-y divide-stone-100">
        {data?.map((entry) => (
          <li key={entry.id} className="py-2 text-sm">
            <p className="text-stone-800">{locationHistoryLabel(entry)}</p>
            <p className="text-xs text-stone-500">
              {fmtDateTime(entry.createdAt)} · {entry.actor}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Criar/editar um Local — os erros do backend aparecem junto de cada campo. */
export function LocationDrawer({ editing, saving, error, onSubmit, onClose }: LocationDrawerProps) {
  const [values, setValues] = useState<LocationFormValues>(() => (editing ? toLocationFormValues(editing) : EMPTY_LOCATION_FORM));
  const fieldErrors = error instanceof LocationValidationError ? error.fieldErrors : [];
  const genericError = Boolean(error) && !(error instanceof LocationValidationError);

  function errorOf(field: LocationField) {
    return fieldErrors.find((e) => e.field === field)?.message;
  }

  function input(field: LocationField, opts: { required?: boolean; placeholder?: string } = {}) {
    const id = `location-${field}`;
    const err = errorOf(field);
    return (
      <div>
        <label htmlFor={id} className={labelCls}>
          {LOCATION_FIELD_LABELS[field]}
          {opts.required && <span className="text-[#ED5C32]"> *</span>}
        </label>
        <input
          id={id}
          value={values[field]}
          placeholder={opts.placeholder}
          onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
          className={`${inputCls} ${err ? "border-[#A3211A]" : ""}`}
          aria-invalid={err ? true : undefined}
        />
        {err && <p className="mt-1 text-xs text-[#A3211A]">{err}</p>}
      </div>
    );
  }

  function select(field: "country" | "timezone", options: { value: string; label: string }[]) {
    const id = `location-${field}`;
    const current = values[field];
    const withCurrent = options.some((o) => o.value === current) ? options : [{ value: current, label: current }, ...options];
    return (
      <div>
        <label htmlFor={id} className={labelCls}>
          {LOCATION_FIELD_LABELS[field]}
        </label>
        <select id={id} value={current} onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))} className={inputCls}>
          {withCurrent.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errorOf(field) && <p className="mt-1 text-xs text-[#A3211A]">{errorOf(field)}</p>}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" role="dialog" aria-modal="true" aria-label={editing ? "Editar local" : "Novo local"}>
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="text-base font-semibold text-stone-900">{editing ? `Editar ${editing.name}` : "Novo local"}</h2>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Fechar">
            ✕
          </button>
        </div>
        <form
          className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values);
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">{input("name", { required: true, placeholder: "Ex.: Armazém" })}</div>
            {input("code", { placeholder: "Opcional" })}
            {input("phone")}
            <div className="col-span-2">{input("address")}</div>
            {input("postalCode", { placeholder: values.country === "PT" ? "0000-000" : undefined })}
            {input("city")}
            {input("municipality")}
            {select("country", LOCATION_COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.label })))}
            <div className="col-span-2">{select("timezone", LOCATION_TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz })))}</div>
          </div>

          {genericError && <p className="text-sm text-[#A3211A]">Não foi possível guardar. Tente novamente.</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "A guardar…" : editing ? "Guardar alterações" : "Criar local"}
            </button>
          </div>

          {editing && <History locationId={editing.id} />}
        </form>
      </div>
    </div>
  );
}
