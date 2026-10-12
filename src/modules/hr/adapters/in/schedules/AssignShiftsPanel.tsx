import { useState } from "react";
import {
  IconButton,
  IconClose,
  IconPlus,
  IconSearch,
  IconSort,
  ShiftTypeChip,
} from "../../../../../components/ui/index.ts";
import type { ShiftTemplate } from "../../../domain/entities/shift-template.ts";
import {
  abbreviation,
  hoursLabel,
  templateVisualType,
  timeRange,
} from "../../../domain/services/schedule-board.service.ts";

const times = (t: ShiftTemplate) =>
  t.secondStartTime && t.secondEndTime
    ? `${timeRange(t.startTime, t.endTime)}, ${timeRange(t.secondStartTime, t.secondEndTime)}`
    : timeRange(t.startTime, t.endTime);

/**
 * "Atribuir turnos" (lateral direita): escolher um modelo abre a aplicação a
 * um ou mais colaboradores (fluxo "Aplicar modelo" existente); "Criar novo
 * turno" abre um turno personalizado; "Configurações" leva à gestão de
 * modelos. Em ecrãs pequenos ocupa o ecrã inteiro.
 */
export function AssignShiftsPanel({
  templates,
  loading,
  onPick,
  onCreateCustom,
  onOpenSettings,
  onClose,
}: {
  templates: ShiftTemplate[];
  loading: boolean;
  onPick: (templateId: string) => void;
  onCreateCustom: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sortByTime, setSortByTime] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const norm = (v: string) =>
    v
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const shown = templates
    .filter((t) => t.active && (!q || norm(t.name).includes(norm(q))))
    .sort((a, b) =>
      sortByTime
        ? a.startTime.localeCompare(b.startTime)
        : a.name.localeCompare(b.name, "pt"),
    );

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-navy-950/25 motion-safe:animate-motion-fade xl:hidden"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        aria-label="Atribuir turnos"
        className="fixed inset-0 z-50 flex flex-col bg-surface-card motion-safe:animate-motion-slide-in-right sm:inset-y-0 sm:left-auto sm:w-[420px] sm:shadow-pop xl:sticky xl:top-4 xl:z-10 xl:-ml-2 xl:max-h-[calc(100vh-2rem)] xl:min-h-[640px] xl:w-[308px] xl:shrink-0 xl:rounded-2.5xl xl:border xl:border-line xl:shadow-pop"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
          <h2 className="text-xl font-semibold text-navy-900">
            Atribuir turnos
          </h2>
          <IconButton label="Fechar" size="sm" onClick={onClose}>
            <IconClose size={18} />
          </IconButton>
        </div>
        <p className="px-6 text-sm leading-6 text-ink-secondary">
          Selecione um turno para atribuí-lo a um ou mais funcionários. Os
          turnos criados aqui serão associados a esta escala.{" "}
          <button
            type="button"
            onClick={onOpenSettings}
            className="font-medium text-brand-600 hover:text-brand-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            Configurações
          </button>
        </p>
        <div className="flex items-center gap-2 px-6 pb-3 pt-5">
          <div className="relative flex-1">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="search"
              aria-label="Pesquisar modelo"
              placeholder="Pesquisar modelo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-full rounded-full border border-transparent bg-surface-soft pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand-500 focus:bg-surface-card focus:ring-2 focus:ring-brand-500/15"
            />
          </div>
          <IconButton
            label={
              sortByTime ? "Ordenar por nome" : "Ordenar por hora de início"
            }
            size="sm"
            onClick={() => setSortByTime((v) => !v)}
          >
            <IconSort size={16} />
          </IconButton>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 pb-5">
          {loading &&
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-2xl bg-surface-soft motion-reduce:animate-none"
              />
            ))}
          {!loading && shown.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-secondary">
              {q
                ? "Nenhum modelo com esse nome."
                : "Ainda não há modelos de turno."}
            </p>
          )}
          <ul className="space-y-2.5">
            {shown.map((t, i) => {
              const tone = templateVisualType(t);
              const active = selected === t.id;
              return (
                <li
                  key={t.id}
                  className="motion-safe:animate-motion-fade-up"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelected(t.id);
                      onPick(t.id);
                    }}
                    className={`flex w-full items-center gap-4 rounded-2xl border bg-surface-card px-4 py-3.5 text-left transition duration-150 hover:border-navy-900/20 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                      active
                        ? "border-brand-600 ring-1 ring-brand-600"
                        : "border-line"
                    }`}
                  >
                    <ShiftTypeChip tone={tone}>
                      {abbreviation(t.name)}
                    </ShiftTypeChip>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-900">
                        {t.name}
                      </span>
                      <span
                        className={`mt-0.5 block text-ink-secondary tabular-nums ${t.secondStartTime ? "text-xs" : "text-sm"}`}
                      >
                        {times(t)}
                      </span>
                    </span>
                    <span className="shrink-0 self-end text-xs text-ink-secondary tabular-nums">
                      {hoursLabel(t.workMinutes)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-3 pt-5">
            <span className="text-sm text-ink-secondary">
              Turnos personalizados
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={onCreateCustom}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-card px-4 py-4 text-left text-sm text-navy-900 transition duration-150 hover:border-navy-900/20 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <IconPlus size={18} className="text-brand-600" />
            Criar novo turno
          </button>
        </div>
      </aside>
    </>
  );
}
