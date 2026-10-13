import { Fragment, useState, type ReactNode } from "react";
import {
  AvatarStack,
  EmployeeCell,
  IconButton,
  IconCalendar,
  IconPlus,
  IconSort,
  IconUser,
  IconUsers,
  ShiftCard,
  ShiftGroup,
  ShiftToneBar,
  Skeleton,
} from "../../../../../components/ui/index.ts";
import {
  motionListItem,
  useFirstBatch,
} from "../../../../../components/motion/index.ts";
import type {
  RosterShift,
  ShiftTemplate,
} from "../../../domain/entities/rosters.ts";
import {
  dayCounts,
  dayHeader,
  hoursLabel,
  hoursLong,
  segmentLabel,
  segmentsMinutes,
  shiftDisplay,
  shiftRows,
  shiftSegments,
  type RosterRow,
} from "../../../domain/services/roster-board.service.ts";

export type BoardMode = "employees" | "shifts" | "positions";

const FIRST_COL = "sticky left-0 z-10 bg-surface-card";

export interface RosterBoardProps {
  mode: BoardMode;
  days: string[];
  today: string;
  rows: RosterRow[];
  shifts: RosterShift[];
  templates: ShiftTemplate[];
  loading: boolean;
  sort: "asc" | "desc";
  onToggleSort: () => void;
  positionName: (id: string | null) => string | null;
  /** Nome e foto de qualquer colaborador (vista por turnos). */
  person: (id: string) => { name: string; photoUrl: string | null };
  /** Pessoas da escala escondidas pela pesquisa. */
  hidden: number;
  /** Há um modelo escolhido em "Atribuir turnos" (clicar num dia vazio atribui-o). */
  painting: boolean;
  onOpen: (s: RosterShift) => void;
  onPaint: (employeeId: string, ymd: string) => void;
  summary: ReactNode;
}

function Cell({
  s,
  p,
  label,
  index,
  subtitle,
}: {
  s: RosterShift;
  p: RosterBoardProps;
  label: string;
  index: number;
  subtitle?: string;
}) {
  if (s.kind === "day_off")
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => p.onOpen(s)}
        title={s.dirty ? "Por publicar" : undefined}
        className={`block w-full rounded-lg px-2 py-2 text-left text-[12px] font-semibold text-ink-secondary transition duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 motion-safe:animate-motion-pop-in ${
          s.dirty
            ? "border border-dashed border-line bg-surface-card"
            : "bg-surface-soft"
        }`}
      >
        {subtitle ?? "Folga"}
        {s.dirty && <span className="sr-only"> (por publicar)</span>}
      </button>
    );
  const segs = shiftSegments(s, p.templates);
  const { title, tone } = shiftDisplay(s, p.templates);
  return (
    <ShiftCard
      tone={tone}
      title={subtitle ?? title}
      times={segs.map(segmentLabel)}
      hours={hoursLabel(segmentsMinutes(segs))}
      status={s.dirty ? "draft" : "published"}
      onClick={() => p.onOpen(s)}
      tooltip={`${title}${s.dirty ? " · por publicar" : ""}${s.onCall ? " · prevenção" : ""}`}
      className="motion-safe:animate-motion-pop-in"
      style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
      ariaLabel={label}
    />
  );
}

/**
 * Grelha da escala como no Design System: coluna fixa, um dia por coluna, o
 * dia de hoje com o número em círculo cobre, linhas finas e sem sombras lá
 * dentro. Com um modelo escolhido, clicar num dia vazio atribui-o.
 */
export function RosterBoard(p: RosterBoardProps) {
  const cols = `grid grid-cols-[222px_repeat(${p.days.length},minmax(96px,1fr))]`;
  const grid = {
    gridTemplateColumns: `222px repeat(${p.days.length}, minmax(96px, 1fr))`,
  };
  const firstBatch = useFirstBatch(p.rows.map((r) => r.employeeId));
  const byShift = p.mode === "shifts" ? shiftRows(p.shifts, p.templates) : [];

  const header = (
    <div role="row" className="grid border-b border-line-subtle" style={grid}>
      <div
        role="columnheader"
        className={`${FIRST_COL} flex items-center justify-between gap-1 border-r border-line-subtle py-4 pl-4 pr-2`}
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold text-navy-900">
            {p.mode === "shifts"
              ? "Turnos da escala"
              : p.mode === "positions"
                ? "Cargos"
                : "Funcionários"}
          </span>
          <span className="block whitespace-nowrap text-[11px] text-ink-secondary">
            {p.mode === "shifts"
              ? `${byShift.filter((r) => r.key !== "day_off").length} turnos atribuídos`
              : `${p.rows.length} ${p.rows.length === 1 ? "pessoa atribuída" : "pessoas atribuídas"} • ${p.hidden} ${p.hidden === 1 ? "oculto" : "ocultos"}`}
          </span>
        </span>
        <IconButton
          label={p.sort === "asc" ? "Ordenar de Z a A" : "Ordenar de A a Z"}
          size="sm"
          onClick={p.onToggleSort}
        >
          <IconSort size={16} />
        </IconButton>
      </div>
      {p.days.map((ymd) => {
        const { weekday, day } = dayHeader(ymd);
        const today = ymd === p.today;
        const c = dayCounts(p.shifts, ymd);
        return (
          <div
            key={ymd}
            role="columnheader"
            aria-current={today ? "date" : undefined}
            className="flex flex-col items-center gap-1.5 border-r border-line-subtle px-2 py-3 last:border-r-0"
          >
            <span className="whitespace-nowrap text-[12px] text-ink-secondary">
              {weekday}
            </span>
            <span
              className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-base font-semibold tabular-nums ${today ? "bg-brand-600 text-white" : "text-navy-900"}`}
            >
              {day}
            </span>
            <span className="flex items-center gap-3 text-xs text-ink-secondary tabular-nums">
              <span
                className="flex items-center gap-1"
                title="Pessoas escaladas"
              >
                <IconUser size={14} /> {c.people}
              </span>
              <span className="flex items-center gap-1" title="Turnos">
                <IconCalendar size={14} /> {c.shifts}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );

  const emptyCell = (employeeId: string, name: string, ymd: string) => (
    <button
      type="button"
      aria-label={`${name} ${ymd}`}
      disabled={!p.painting}
      onClick={() => p.onPaint(employeeId, ymd)}
      title={
        p.painting
          ? "Atribuir o turno escolhido"
          : "Escolha um turno em “Atribuir turnos”"
      }
      className="flex h-full min-h-[64px] w-full items-center justify-center rounded-lg text-ink-muted opacity-0 transition duration-150 hover:bg-brand-50 hover:text-brand-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 enabled:group-hover:opacity-100 disabled:cursor-default"
    >
      {p.painting && <IconPlus size={16} />}
    </button>
  );

  const employeeRow = (r: RosterRow, index: number) => {
    const motion = motionListItem(index, firstBatch.has(r.employeeId));
    return (
      <div
        key={r.employeeId}
        role="row"
        className={`grid border-b border-line-subtle last:border-b-0 ${motion.className}`}
        style={{ ...grid, ...motion.style }}
      >
        <div
          role="rowheader"
          className={`${FIRST_COL} flex items-center border-r border-line-subtle py-3 pl-3.5 pr-3`}
        >
          <EmployeeCell
            name={r.name}
            photoUrl={r.photoUrl}
            subtitle={p.positionName(r.positionId) ?? undefined}
            size="list"
            aside={hoursLabel(r.minutes)}
          />
        </div>
        {p.days.map((ymd) => {
          const own = r.byDate.get(ymd) ?? [];
          return (
            <div
              key={ymd}
              role="cell"
              className="group flex min-h-[76px] flex-col gap-1.5 border-r border-line-subtle p-1 last:border-r-0"
            >
              {own.length
                ? own.map((s, i) => (
                    <Cell
                      key={s.id}
                      s={s}
                      p={p}
                      label={`${r.name} ${ymd}`}
                      index={index + i}
                    />
                  ))
                : emptyCell(r.employeeId, r.name, ymd)}
            </div>
          );
        })}
      </div>
    );
  };

  let body: ReactNode;
  if (p.loading) {
    body = Array.from({ length: 5 }, (_, i) => (
      <div key={i} className="grid border-b border-line-subtle" style={grid}>
        <div
          className={`${FIRST_COL} flex items-center gap-3 border-r border-line-subtle px-4 py-4`}
        >
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        {p.days.map((d) => (
          <div
            key={d}
            className="border-r border-line-subtle p-1.5 last:border-r-0"
          >
            {i % 2 === 0 && <Skeleton className="h-12 w-full rounded-lg" />}
          </div>
        ))}
      </div>
    ));
  } else if (p.mode === "shifts") {
    // Uma linha por modelo (folgas no fim): barra na cor do tipo, horário e
    // horas do período; em cada dia, as fotos de quem o faz.
    body = byShift.map((row, gi) => (
      <div
        key={row.key}
        role="row"
        className="grid border-b border-line-subtle last:border-b-0 motion-safe:animate-motion-fade-up"
        style={{ ...grid, animationDelay: `${Math.min(gi, 8) * 50}ms` }}
      >
        <div
          role="rowheader"
          className={`${FIRST_COL} flex items-stretch gap-3 border-r border-line-subtle py-3 pl-3.5 pr-3`}
        >
          <ShiftToneBar tone={row.tone} />
          <div className="min-w-0 py-0.5">
            <p className="text-[13px] font-semibold leading-snug text-navy-900">
              {row.label}
            </p>
            {row.segments.length > 0 && (
              <p className="text-xs tabular-nums text-ink-secondary">
                {row.segments.map(segmentLabel).join(" · ")}
              </p>
            )}
            {row.key !== "day_off" && (
              <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                {hoursLong(row.minutes)}
              </p>
            )}
          </div>
        </div>
        {p.days.map((ymd) => {
          const day = row.byDate.get(ymd) ?? [];
          return (
            <div
              key={ymd}
              role="cell"
              className="flex min-h-[76px] flex-col justify-center border-r border-line-subtle p-1 last:border-r-0"
            >
              {day.length > 0 && (
                <ShiftGroup
                  tone={row.tone}
                  draft={day.every((s) => s.dirty)}
                  className="motion-safe:animate-motion-pop-in"
                >
                  <AvatarStack
                    size="sm"
                    max={4}
                    items={day.map((s) => {
                      const who = p.person(s.employeeId);
                      return {
                        key: s.id,
                        name: who.name,
                        photoUrl: who.photoUrl,
                        label: `${who.name} ${ymd}`,
                        onClick: () => p.onOpen(s),
                      };
                    })}
                  />
                  <span
                    className="flex items-center gap-1 pr-0.5 text-xs font-medium tabular-nums text-ink-secondary"
                    title={`${day.length} ${day.length === 1 ? "pessoa" : "pessoas"}`}
                  >
                    <IconUser size={13} />
                    {day.length}
                  </span>
                </ShiftGroup>
              )}
            </div>
          );
        })}
      </div>
    ));
  } else if (p.mode === "positions") {
    const groups = new Map<string, RosterRow[]>();
    for (const r of p.rows) {
      const name = p.positionName(r.positionId) ?? "Sem cargo";
      groups.set(name, [...(groups.get(name) ?? []), r]);
    }
    let n = 0;
    body = [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt"))
      .map(([name, rows]) => (
        <Fragment key={name}>
          <div
            role="row"
            className="border-b border-line-subtle bg-surface-soft/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary"
          >
            <span role="rowheader">
              {name} · {rows.length}
            </span>
          </div>
          {rows.map((r) => employeeRow(r, n++))}
        </Fragment>
      ));
  } else {
    body = p.rows.map((r, i) => employeeRow(r, i));
  }

  const empty =
    !p.loading &&
    (p.mode === "shifts" ? byShift.length === 0 : p.rows.length === 0);
  return (
    <section
      aria-label="Escala"
      className="overflow-hidden rounded-2.5xl border border-line bg-surface-card shadow-card motion-safe:animate-motion-fade-up [animation-delay:120ms]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle px-5 py-3.5 text-sm text-ink-secondary">
        {p.summary}
      </div>
      <RosterAgenda {...p} />
      <div className="hidden overflow-x-auto md:block">
        <div
          role="table"
          aria-label="Turnos por dia"
          className={p.days.length > 7 ? "min-w-[1500px]" : "min-w-[900px]"}
          data-cols={cols}
        >
          {header}
          {body}
          {empty && (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center motion-safe:animate-motion-fade">
              <IconUsers size={22} className="text-ink-muted" />
              <p className="text-sm font-medium text-navy-900">
                Ainda ninguém nesta escala
              </p>
              <p className="text-sm text-ink-secondary">
                Escolha um turno em “Atribuir turnos” e acrescente colaboradores
                à grelha.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Telemóvel: agenda do dia (dias em botões; pessoas e turnos desse dia). */
function RosterAgenda(p: RosterBoardProps) {
  const [day, setDay] = useState(() =>
    p.days.includes(p.today) ? p.today : p.days[0]!,
  );
  const selected = p.days.includes(day) ? day : p.days[0]!;
  return (
    <div className="md:hidden">
      <div
        role="tablist"
        aria-label="Dia"
        className="flex gap-1.5 overflow-x-auto border-b border-line-subtle px-3 py-3"
      >
        {p.days.map((ymd) => {
          const { weekday, day: n } = dayHeader(ymd);
          const active = ymd === selected;
          return (
            <button
              key={ymd}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDay(ymd)}
              className={`flex min-w-[48px] flex-col items-center rounded-xl px-2 py-1.5 text-xs transition-colors duration-150 ${active ? "bg-navy-900 text-white" : ymd === p.today ? "bg-brand-50 text-brand-600" : "text-ink-secondary hover:bg-surface-soft"}`}
            >
              <span>{weekday.slice(0, 3)}</span>
              <span className="text-base font-semibold tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>
      <ul className="divide-y divide-line-subtle">
        {p.rows.map((r, i) => {
          const own = r.byDate.get(selected) ?? [];
          return (
            <li
              key={r.employeeId}
              className="space-y-2 px-4 py-3 motion-safe:animate-motion-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <EmployeeCell
                name={r.name}
                photoUrl={r.photoUrl}
                subtitle={p.positionName(r.positionId) ?? undefined}
                size="list"
                aside={hoursLabel(r.minutes)}
              />
              <div className="grid grid-cols-2 gap-2">
                {own.length
                  ? own.map((s, n) => (
                      <Cell
                        key={s.id}
                        s={s}
                        p={p}
                        label={`${r.name} ${selected}`}
                        index={n}
                      />
                    ))
                  : p.painting && (
                      <button
                        type="button"
                        onClick={() => p.onPaint(r.employeeId, selected)}
                        className="rounded-lg border border-dashed border-line py-2 text-xs font-medium text-brand-600"
                      >
                        Atribuir aqui
                      </button>
                    )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
