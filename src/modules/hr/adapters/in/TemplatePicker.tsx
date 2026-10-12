import { useEffect, useRef, useState } from "react";
import {
  SHIFT_TEMPLATE_GROUP_LABELS,
  SHIFT_TEMPLATE_KIND_LABELS,
  type ShiftTemplate,
  type ShiftTemplateGroup,
  type ShiftTemplateKind,
} from "../../domain/entities/shift-template.ts";
import { filterTemplates, formatMinutes, templateTimeLabel } from "../../domain/services/shift-template.service.ts";

/** Grupos no seletor (task §10): Todos | Abertura | Intermédio | Fecho | Full time. */
const PICKER_GROUPS: ShiftTemplateGroup[] = ["OPENING", "INTERMEDIATE", "CLOSING", "FULL_TIME"];

/**
 * Seletor pesquisável do Modelo no "Aplicar modelo" (Modelos de Turno 2.0
 * §10) — substitui o dropdown longo. Só modelos ativos; pesquisa por nome,
 * horário ou Grupo; filtros por Grupo e Tipo; lista com altura máxima e
 * scroll interno (a pesquisa fica sempre visível); fecha ao selecionar.
 * Filtra no cliente a mesma coleção já carregada (sem pedidos novos).
 */
export function TemplatePicker({ templates, value, onChange }: { templates: ShiftTemplate[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<ShiftTemplateGroup | null>(null);
  const [kind, setKind] = useState<ShiftTemplateKind | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const selected = templates.find((t) => t.id === value) ?? null;
  const results = filterTemplates(templates, { group, kind, status: "active", search });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const chip = (active: boolean) => `rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id="apply-template"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-left text-sm text-stone-800 outline-none focus:border-[#ED5C32]"
      >
        <span>{selected ? `${selected.name} — ${templateTimeLabel(selected)}` : "Escolher modelo…"}</span>
        <span aria-hidden="true" className="text-stone-400">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-stone-200 bg-white shadow-xl">
          <div className="space-y-2 border-b border-stone-100 p-3">
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar modelo ou horário…"
              aria-label="Pesquisar modelo ou horário"
              className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm outline-none focus:border-[#ED5C32]"
            />
            <div className="flex flex-wrap gap-1" role="group" aria-label="Grupo do modelo">
              <button type="button" aria-pressed={group === null} onClick={() => setGroup(null)} className={chip(group === null)}>
                Todos
              </button>
              {PICKER_GROUPS.map((g) => (
                <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} className={chip(group === g)}>
                  {SHIFT_TEMPLATE_GROUP_LABELS[g]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Tipo do modelo">
              {([null, "direct", "split"] as const).map((k) => (
                <button key={k ?? "all"} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                  {k === null ? "Todos" : SHIFT_TEMPLATE_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <ul role="listbox" aria-label="Modelos" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && <li className="px-3 py-3 text-sm text-stone-500">Nenhum modelo ativo corresponde.</li>}
            {results.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={t.id === value}
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left hover:bg-stone-50 ${t.id === value ? "bg-[#FEF3EC]" : ""}`}
                >
                  <span className="block text-sm font-medium text-stone-800">{t.name}</span>
                  <span className="block text-xs text-stone-500">
                    {templateTimeLabel(t)} · {formatMinutes(t.workMinutes)} · {SHIFT_TEMPLATE_KIND_LABELS[t.kind]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
