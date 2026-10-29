import { EmployeeCell, SURFACE } from "../../../../../../components/ui/index.ts";
import type { ReviewDay, ReviewPerson, ReviewState } from "../../../../domain/entities/attendance-review.ts";
import { dayState, formatMinutes, weekTotals } from "../../../../domain/services/attendance-review.service.ts";
import { STATE, dayLabel, keyOf } from "./review-ui.ts";

const CHIP: Record<ReviewState, string> = {
  ok: "bg-emerald-50 text-emerald-800",
  reviewed: "bg-emerald-50 text-emerald-800",
  review: "bg-amber-50 text-amber-900",
  late: "bg-amber-50 text-amber-900",
  absent: "bg-red-50 text-red-800",
  justified: "bg-surface-soft text-ink-secondary",
  in_progress: "bg-surface-soft text-navy-900",
  day_off: "text-ink-muted",
  no_schedule: "text-ink-muted",
  future: "text-ink-muted",
};

/** O que a célula mostra: só o estado e as horas essenciais (o detalhe abre no painel). */
function cellHours(d: ReviewDay, s: ReviewState) {
  if (s === "future") return d.planned ? formatMinutes(d.plannedMinutes) : "";
  if (s === "day_off" || s === "justified") return "";
  if (s === "absent") return `0h00 / ${formatMinutes(d.plannedMinutes)}`;
  if (d.review) return formatMinutes(d.review.validatedMinutes);
  return formatMinutes(d.workedMinutes);
}

/**
 * Semana: colaborador × dia. Selecionar dias ou linhas e «Rever seleção»
 * (na barra) abre o painel; clicar num dia abre o mesmo painel nesse dia.
 * Sem ações de cumprimento aqui.
 */
export function WeekGrid({
  people,
  dates,
  days,
  selected,
  onToggle,
  onToggleMany,
  onOpen,
}: {
  people: ReviewPerson[];
  dates: string[];
  days: Map<string, ReviewDay>;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onToggleMany: (keys: string[], on: boolean) => void;
  onOpen: (key: string) => void;
}) {
  const allKeys = people.flatMap((p) => dates.map((d) => keyOf(p.id, d))).filter((k) => days.has(k));
  const allOn = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  return (
    <div className={`${SURFACE} overflow-x-auto`}>
      <table className="w-full min-w-[1040px] text-sm" aria-label="Conferência da semana">
        <thead className="border-b border-line-subtle text-xs text-ink-secondary">
          <tr>
            <th className="w-10 px-3 py-3 text-left">
              <input
                type="checkbox"
                className="accent-brand-600"
                aria-label="Selecionar todos os visíveis"
                checked={allOn}
                onChange={() => onToggleMany(allKeys, !allOn)}
              />
            </th>
            <th className="px-3 py-3 text-left font-medium">Colaborador</th>
            {dates.map((d) => (
              <th key={d} className="px-1.5 py-3 text-center font-medium">
                {dayLabel(d)}
              </th>
            ))}
            <th className="px-3 py-3 text-right font-medium">Planeado</th>
            <th className="px-3 py-3 text-right font-medium">Validado</th>
            <th className="px-3 py-3 text-right font-medium">Por rever</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const own = dates.map((d) => days.get(keyOf(p.id, d))).filter((d): d is ReviewDay => !!d);
            const keys = own.map((d) => keyOf(d.employeeId, d.date));
            const rowOn = keys.length > 0 && keys.every((k) => selected.has(k));
            const t = weekTotals(own);
            return (
              <tr key={p.id} className="border-b border-line-subtle last:border-0">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    aria-label={`Selecionar a semana de ${p.name}`}
                    checked={rowOn}
                    onChange={() => onToggleMany(keys, !rowOn)}
                  />
                </td>
                <td className="px-3 py-2">
                  <EmployeeCell name={p.name} photoUrl={p.photoUrl ?? null} subtitle={p.location} size="sm" />
                </td>
                {dates.map((date) => {
                  const k = keyOf(p.id, date);
                  const d = days.get(k);
                  if (!d) return <td key={date} />;
                  const s = dayState(d);
                  const on = selected.has(k);
                  return (
                    <td key={date} className="px-1 py-1.5">
                      <div className={`group relative rounded-lg ${on ? "ring-2 ring-brand-500/60" : ""}`}>
                        <input
                          type="checkbox"
                          className={`absolute left-1 top-1 z-[1] h-3.5 w-3.5 accent-brand-600 ${on ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
                          aria-label={`Selecionar ${dayLabel(date)} de ${p.name}`}
                          checked={on}
                          onChange={() => onToggle(k)}
                        />
                        <button
                          type="button"
                          onClick={() => onOpen(k)}
                          aria-label={`${p.name}, ${dayLabel(date)}: ${STATE[s].label}`}
                          className={`flex h-12 w-full flex-col items-center justify-center rounded-lg px-1 text-[11px] leading-tight transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${CHIP[s]}`}
                        >
                          <span className="font-medium">{STATE[s].label}</span>
                          <span className="tabular-nums opacity-80">
                            {cellHours(d, s)}
                            {d.closed && " · fechado"}
                          </span>
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">{formatMinutes(t.planned)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-900">
                  {formatMinutes(t.validated)}
                  {t.provisional > 0 && <span className="block text-[11px] text-ink-muted">+{formatMinutes(t.provisional)} provisório</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{t.pending ? <span className="font-medium text-amber-800">{t.pending}</span> : <span className="text-ink-muted">0</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
