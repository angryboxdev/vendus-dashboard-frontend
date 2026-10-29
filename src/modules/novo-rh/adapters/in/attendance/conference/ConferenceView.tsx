import { useMemo, useState, type ReactNode } from "react";
import { Button, DateNavigator, EmptyState, EmployeeCell, FIELD, SURFACE, SearchInput, SegmentedControl, Skeleton, StatusBadge, Toolbar } from "../../../../../../components/ui/index.ts";
import type { ConferenceResult, ReviewDay, ReviewWeek } from "../../../../domain/entities/attendance-review.ts";
import { dayState, formatMinutes, incomplete, isPending, lateMinutes, pendingPriority, rangesLabel, weekTotals } from "../../../../domain/services/attendance-review.service.ts";
import { ReviewDrawer, type ReviewCommand } from "./ReviewDrawer.tsx";
import { STATE, ddmm, dayLabel, keyOf } from "./review-ui.ts";
import { WeekGrid } from "./WeekGrid.tsx";

type View = "week" | "day" | "pending";
type Filter = "all" | "pending" | "ok" | "absence";

const PUNCH_SHORT = { in: "E", out: "S", break_start: "P", break_end: "R" } as const;

/** Estado operacional (onde está a pessoa) — distinto da situação de conferência. */
function operational(d: ReviewDay): string {
  if (d.phase === "future") return "—";
  if (d.phase === "in_progress") {
    const last = d.punches.at(-1);
    if (!last) return "Fora";
    return last.kind === "in" || last.kind === "break_end" ? "A trabalhar" : last.kind === "break_start" ? "Em pausa" : "Saiu";
  }
  return d.punches.length ? "Saiu" : d.planned ? "Fora" : "—";
}

/** Uma linha curta que diz porquê o dia está pendente. */
function why(d: ReviewDay): string {
  const s = dayState(d);
  if (s === "absent") return `Sem picagens · planeado ${rangesLabel(d.planned)}`;
  if (s === "no_schedule") return `Trabalhou ${formatMinutes(d.workedMinutes)} sem escala publicada`;
  if (incomplete(d)) return `Marcação incompleta · ${d.punches.map((p) => `${PUNCH_SHORT[p.kind]} ${p.at}`).join(" ")}`;
  if (s === "late") return `Entrada ${d.punches[0]!.at} (planeado ${d.planned![0]!.start}) · +${lateMinutes(d)} min`;
  if (d.workedMinutes > d.plannedMinutes) return `Trabalhou ${formatMinutes(d.workedMinutes)} de ${formatMinutes(d.plannedMinutes)} planeadas`;
  return `Registou ${formatMinutes(d.workedMinutes)} de ${formatMinutes(d.plannedMinutes)} planeadas`;
}

/**
 * Conferência V2 (pré-visualização): Semana · Dia · Pendências, com um só
 * painel de revisão. Os dados vêm de fora (no preview, fictícios; na
 * integração, do motor atual) e `onApply` recebe um comando por confirmação.
 */
export function ConferenceView({
  week,
  dates,
  today,
  weekLabel,
  onPrevWeek,
  onNextWeek,
  onApply,
  absenceTypes,
  onVoid,
  extra,
  pendingCorrections,
  loading = false,
}: {
  week: ReviewWeek;
  dates: string[];
  today: string;
  weekLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  /** Grava a decisão; devolve o resultado do servidor (null = pré-visualização). */
  onApply: (cmd: ReviewCommand) => Promise<ConferenceResult | null>;
  absenceTypes?: { id: string; name: string }[];
  onVoid?: (reviewId: string, reason: string) => Promise<void>;
  /** Na barra, à direita (ex.: acesso às vistas técnicas). */
  extra?: ReactNode;
  /** Pedidos de correção dos colaboradores por decidir (aparecem nas Pendências). */
  pendingCorrections?: { count: number; onOpen: () => void };
  loading?: boolean;
}) {
  const [view, setView] = useState<View>("week");
  const [filter, setFilter] = useState<Filter>("all");
  const [centre, setCentre] = useState("");
  const [q, setQ] = useState("");
  const [day, setDay] = useState(dates.includes(today) ? today : dates[0]!);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<string[] | null>(null);

  const byKey = useMemo(() => new Map(week.days.map((d) => [keyOf(d.employeeId, d.date), d])), [week.days]);
  const centres = [...new Set(week.people.map((p) => p.location))].sort();
  const people = week.people.filter((p) => {
    if (centre && p.location !== centre) return false;
    if (q && !p.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    const own = week.days.filter((d) => d.employeeId === p.id);
    if (filter === "pending") return own.some(isPending);
    if (filter === "ok") return own.every((d) => !isPending(d));
    if (filter === "absence") return own.some((d) => ["absent", "justified"].includes(dayState(d)));
    return true;
  });
  const visibleDays = week.days.filter((d) => people.some((p) => p.id === d.employeeId));
  const totals = weekTotals(visibleDays);

  const toggle = (k: string) => setSelected((cur) => (cur.has(k) ? new Set([...cur].filter((x) => x !== k)) : new Set([...cur, k])));
  const toggleMany = (keys: string[], on: boolean) =>
    setSelected((cur) => (on ? new Set([...cur, ...keys]) : new Set([...cur].filter((k) => !keys.includes(k)))));
  // A seleção só conta o que está visível com os filtros atuais (nunca age sobre o que está escondido).
  const visibleSelected = [...selected].filter((k) => people.some((p) => k.startsWith(`${p.id}|`)));

  const dayIdx = dates.indexOf(day);
  const pending = visibleDays.filter(isPending).sort((a, b) => pendingPriority(a) - pendingPriority(b) || a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <Toolbar label="Conferência">
        <SegmentedControl
          label="Vista"
          size="sm"
          value={view}
          onChange={setView}
          items={[
            { key: "week", label: "Semana" },
            { key: "day", label: "Dia" },
            { key: "pending", label: `Pendências${totals.pending ? ` (${totals.pending})` : ""}` },
          ]}
        />
        {view === "day" ? (
          <DateNavigator
            label={`${dayLabel(day)} · ${ddmm(day)}`}
            onPrev={() => (dayIdx > 0 ? setDay(dates[dayIdx - 1]!) : onPrevWeek())}
            onNext={() => (dayIdx < dates.length - 1 ? setDay(dates[dayIdx + 1]!) : onNextWeek())}
            prevLabel="Dia anterior"
            nextLabel="Dia seguinte"
          />
        ) : (
          <DateNavigator label={weekLabel} onPrev={onPrevWeek} onNext={onNextWeek} prevLabel="Semana anterior" nextLabel="Semana seguinte" />
        )}
        <select aria-label="Centro" className={`${FIELD} w-44`} value={centre} onChange={(e) => setCentre(e.target.value)}>
          <option value="">Todos os centros</option>
          {centres.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <SearchInput label="Pesquisar colaborador" placeholder="Pesquisar" value={q} onChange={(e) => setQ(e.target.value)} className="w-44" />
        {view === "week" && (
          <SegmentedControl
            label="Estado"
            size="sm"
            value={filter}
            onChange={setFilter}
            items={[
              { key: "all", label: "Todos" },
              { key: "pending", label: "Pendentes" },
              { key: "ok", label: "Conformes" },
              { key: "absence", label: "Ausências" },
            ]}
          />
        )}
        <div className="ml-auto flex items-center gap-3">
          {visibleSelected.length > 0 && (
            <span className="text-xs text-ink-secondary">
              {visibleSelected.length} {visibleSelected.length === 1 ? "dia selecionado" : "dias selecionados"} (visíveis)
              <button type="button" className="ml-2 text-brand-600 hover:underline" onClick={() => setSelected(new Set())}>
                Limpar
              </button>
            </span>
          )}
          <Button variant="primary" size="sm" disabled={!visibleSelected.length} onClick={() => setDrawer(visibleSelected)}>
            Rever seleção
          </Button>
          {extra}
        </div>
      </Toolbar>

      <p className="text-sm text-ink-secondary">
        Planeado <strong className="font-medium text-navy-900 tabular-nums">{formatMinutes(totals.planned)}</strong> · validado{" "}
        <strong className="font-medium text-navy-900 tabular-nums">{formatMinutes(totals.validated)}</strong>
        {totals.provisional > 0 && <> · provisório {formatMinutes(totals.provisional)}</>} ·{" "}
        {totals.pending ? <span className="text-amber-800">{totals.pending} dias por rever</span> : "nada por rever"}
      </p>

      {view === "pending" && pendingCorrections && pendingCorrections.count > 0 && (
        <div className={`${SURFACE} flex items-center justify-between gap-3 px-4 py-3 text-sm`}>
          <span className="text-navy-900">
            {pendingCorrections.count} {pendingCorrections.count === 1 ? "pedido de correção" : "pedidos de correção"} dos colaboradores por decidir
          </span>
          <Button size="sm" variant="secondary" onClick={pendingCorrections.onOpen}>
            Abrir pedidos
          </Button>
        </div>
      )}
      {loading ? (
        <div className={`${SURFACE} space-y-2 p-4`} aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className={SURFACE}>
          <EmptyState title="Ninguém com estes filtros" />
        </div>
      ) : view === "week" ? (
        <WeekGrid people={people} dates={dates} days={byKey} selected={selected} onToggle={toggle} onToggleMany={toggleMany} onOpen={(k) => setDrawer([k])} />
      ) : view === "day" ? (
        <div className={`${SURFACE} overflow-x-auto`}>
          <table className="w-full min-w-[900px] text-sm" aria-label={`Equipa em ${ddmm(day)}`}>
            <thead className="border-b border-line-subtle text-xs text-ink-secondary">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="px-3 py-3 text-left font-medium">Colaborador</th>
                <th className="px-3 py-3 text-left font-medium">Planeado</th>
                <th className="px-3 py-3 text-left font-medium">Marcações do dia</th>
                <th className="px-3 py-3 text-left font-medium">Estado</th>
                <th className="px-3 py-3 text-right font-medium">Trabalhado / previsto</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const k = keyOf(p.id, day);
                const d = byKey.get(k);
                if (!d) return null;
                const s = dayState(d);
                return (
                  <tr key={p.id} className="cursor-pointer border-b border-line-subtle last:border-0 hover:bg-surface-soft/60" onClick={() => setDrawer([k])}>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="accent-brand-600" aria-label={`Selecionar ${p.name}`} checked={selected.has(k)} onChange={() => toggle(k)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <EmployeeCell name={p.name} photoUrl={p.photoUrl ?? null} subtitle={p.location} size="sm" />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-ink">{d.absence ?? (d.dayOff ? "Folga" : rangesLabel(d.planned))}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-secondary">
                      {d.punches.length ? d.punches.map((x) => `${PUNCH_SHORT[x.kind]} ${x.at}${x.nextDay ? "⁺¹" : ""}`).join("  ") : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge tone={STATE[s].tone}>{STATE[s].label}</StatusBadge>
                        <span className="text-[11px] text-ink-muted">{operational(d)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatMinutes(d.review?.validatedMinutes ?? d.workedMinutes)} / {formatMinutes(d.plannedMinutes)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="secondary" onClick={(e) => (e.stopPropagation(), setDrawer([k]))}>
                        Rever
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : pending.length === 0 ? (
        <div className={SURFACE}>
          <EmptyState title="Sem pendências nesta semana" description="Tudo conforme ou já revisto." />
        </div>
      ) : (
        <ul className={`${SURFACE} divide-y divide-line-subtle`} aria-label="Pendências">
          {pending.map((d) => {
            const k = keyOf(d.employeeId, d.date);
            const p = week.people.find((x) => x.id === d.employeeId)!;
            const s = dayState(d);
            return (
              <li key={k} className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" className="accent-brand-600" aria-label={`Selecionar ${p.name} ${dayLabel(d.date)}`} checked={selected.has(k)} onChange={() => toggle(k)} />
                <div className="w-56 shrink-0">
                  <EmployeeCell name={p.name} photoUrl={p.photoUrl ?? null} subtitle={`${dayLabel(d.date)} · ${p.location}`} size="sm" />
                </div>
                <StatusBadge tone={STATE[s].tone}>{STATE[s].label}</StatusBadge>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">{why(d)}</span>
                <Button size="sm" variant="secondary" onClick={() => setDrawer([k])}>
                  Rever
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <ReviewDrawer
        open={!!drawer}
        week={week}
        keys={drawer ?? []}
        onClose={() => setDrawer(null)}
        onConfirm={async (cmd) => {
          const r = await onApply(cmd);
          setSelected(new Set());
          return r;
        }}
        absenceTypes={absenceTypes}
        onVoid={onVoid}
      />
    </div>
  );
}
