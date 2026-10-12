import { Fragment, useState, type ReactNode } from "react";
import {
  EmployeeCell,
  IconButton,
  IconCalendar,
  IconPlus,
  IconSort,
  IconUser,
  IconUsers,
  ShiftCard,
  ShiftTypeChip,
  Skeleton,
} from "../../../../../components/ui/index.ts";
import {
  motionListItem,
  useFirstBatch,
} from "../../../../../components/motion/index.ts";
import {
  LEAVE_TYPE_LABELS,
  type LeaveOverviewEntry,
  type WorkShift,
} from "../../../domain/entities/schedule.ts";
import {
  abbreviation,
  dayCounts,
  dayHeader,
  hoursLabel,
  shiftTypeRows,
  shiftWorkMinutes,
  timeRange,
  type BoardRow,
  type ShiftVisualType,
} from "../../../domain/services/schedule-board.service.ts";

import { attendanceIndicator } from "./attendance-indicator.ts";

export type BoardMode = "employees" | "shifts" | "positions";

const FIRST_COL = "sticky left-0 z-10 bg-surface-card";
const GRID = "grid grid-cols-[222px_repeat(7,minmax(96px,1fr))]";

export interface WeekBoardProps {
  mode: BoardMode;
  days: Date[];
  todayYmd: string;
  rows: BoardRow[];
  /** Todos os turnos visíveis (para contagens e o agrupamento por turno). */
  shifts: WorkShift[];
  loading: boolean;
  sort: "asc" | "desc";
  onToggleSort: () => void;
  positionName: (positionId: string | null) => string | null;
  /** Rótulo e tipo do turno (nome do modelo quando existe). */
  shiftLabel: (s: WorkShift) => { title: string; tone: ShiftVisualType };
  leavesByDate: Map<string, LeaveOverviewEntry[]>;
  holidaysByDate: Map<string, { name: string }>;
  onOpenShift: (s: WorkShift) => void;
  onNewShift: (employeeId: string | null, ymd: string) => void;
  /** Linha por cima da grelha (pessoas atribuídas, ocultos, estado da publicação). */
  summary: ReactNode;
  toYmd: (d: Date) => string;
}

function shiftTimes(s: WorkShift): string[] {
  const first = timeRange(s.startTime, s.endTime);
  return s.secondStartTime && s.secondEndTime
    ? [first, timeRange(s.secondStartTime, s.secondEndTime)]
    : [first];
}

function Card({
  s,
  onOpen,
  shiftLabel,
  index,
  subtitle,
}: {
  s: WorkShift;
  onOpen: (s: WorkShift) => void;
  shiftLabel: WeekBoardProps["shiftLabel"];
  index: number;
  subtitle?: string;
}) {
  const { title, tone } = shiftLabel(s);
  const tooltip = `${s.employeeName} · ${title} ${shiftTimes(s).join(" | ")}${s.endsNextDay ? " (+1 dia)" : ""}${s.status === "draft" ? " · rascunho" : ""}`;
  return (
    <ShiftCard
      tone={tone}
      title={subtitle ?? title}
      times={shiftTimes(s)}
      hours={hoursLabel(shiftWorkMinutes(s))}
      status={s.status === "draft" ? "draft" : "published"}
      onClick={() => onOpen(s)}
      tooltip={tooltip}
      indicator={attendanceIndicator(s)}
      className="motion-safe:animate-motion-pop-in"
      style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
    />
  );
}

function LeaveChip({ leave }: { leave: LeaveOverviewEntry }) {
  return (
    <div
      className="rounded-xl border border-line-subtle bg-surface-soft px-2.5 py-2 text-[12px] font-medium text-ink-secondary"
      title={LEAVE_TYPE_LABELS[leave.type]}
    >
      {LEAVE_TYPE_LABELS[leave.type]}
    </div>
  );
}

/**
 * Grelha semanal (Design System Mezza): coluna fixa à esquerda, um dia por
 * coluna, dia atual com o número em círculo cobre, linhas finas e nenhuma
 * sombra dentro da grelha. Cada célula vazia tem "+" (novo turno) ao passar.
 */
export function WeekBoard(p: WeekBoardProps) {
  const firstBatch = useFirstBatch(p.rows.map((r) => r.employee.id));
  const header = (
    <div className={`${GRID} border-b border-line-subtle`} role="row">
      <div
        className={`${FIRST_COL} flex items-center justify-between border-r border-line-subtle px-4 py-4`}
        role="columnheader"
      >
        <span className="text-base font-semibold text-navy-900">
          {p.mode === "shifts"
            ? "Turnos"
            : p.mode === "positions"
              ? "Cargos"
              : "Funcionários"}
        </span>
        <IconButton
          label={p.sort === "asc" ? "Ordenar de Z a A" : "Ordenar de A a Z"}
          size="sm"
          onClick={p.onToggleSort}
        >
          <IconSort size={16} />
        </IconButton>
      </div>
      {p.days.map((d) => {
        const ymd = p.toYmd(d);
        const { weekday, day } = dayHeader(d);
        const today = ymd === p.todayYmd;
        const counts = dayCounts(p.shifts, ymd);
        const holiday = p.holidaysByDate.get(ymd);
        return (
          <div
            key={ymd}
            role="columnheader"
            aria-current={today ? "date" : undefined}
            className={`flex flex-col items-center gap-1.5 border-r border-line-subtle px-2 py-3 last:border-r-0 ${holiday ? "bg-amber-50/50" : ""}`}
          >
            <span className="text-[13px] text-ink-secondary">{weekday}</span>
            <span
              className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-base font-semibold tabular-nums ${today ? "bg-brand-600 text-white" : "text-navy-900"}`}
            >
              {day}
            </span>
            {holiday && (
              <span
                className="max-w-full truncate text-[11px] font-medium text-amber-700"
                title={holiday.name}
              >
                {holiday.name}
              </span>
            )}
            <span className="flex items-center gap-3 text-xs text-ink-secondary tabular-nums">
              <span
                className="flex items-center gap-1"
                title="Pessoas escaladas"
              >
                <IconUser size={14} /> {counts.people}
              </span>
              <span className="flex items-center gap-1" title="Turnos">
                <IconCalendar size={14} /> {counts.shifts}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );

  const cell = (
    ymd: string,
    content: ReactNode,
    employeeId: string | null,
    label: string,
  ) => {
    const holiday = p.holidaysByDate.get(ymd);
    return (
      <div
        key={ymd}
        role="cell"
        className={`group relative flex min-h-[76px] flex-col gap-1.5 border-r border-line-subtle p-1.5 last:border-r-0 ${holiday ? "bg-amber-50/30" : ""}`}
      >
        {content}
        <button
          type="button"
          onClick={() => p.onNewShift(employeeId, ymd)}
          aria-label={`Novo turno — ${label}`}
          className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-md bg-surface-card/90 text-ink-muted opacity-0 shadow-card transition duration-150 hover:text-brand-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 group-hover:opacity-100"
        >
          <IconPlus size={14} />
        </button>
      </div>
    );
  };

  const employeeRow = (r: BoardRow, index: number) => {
    const motion = motionListItem(index, firstBatch.has(r.employee.id));
    return (
      <div
        key={r.employee.id}
        role="row"
        className={`${GRID} border-b border-line-subtle last:border-b-0 ${motion.className}`}
        style={motion.style}
      >
        <div
          role="rowheader"
          className={`${FIRST_COL} flex items-center border-r border-line-subtle py-3 pl-3.5 pr-3`}
        >
          <EmployeeCell
            name={r.employee.fullName}
            subtitle={p.positionName(r.employee.positionId) ?? undefined}
            photoUrl={r.employee.photoUrl}
            size="list"
            aside={hoursLabel(r.minutes)}
          />
        </div>
        {p.days.map((d) => {
          const ymd = p.toYmd(d);
          const own = r.shiftsByDate.get(ymd) ?? [];
          const leaves = (p.leavesByDate.get(ymd) ?? []).filter(
            (l) => l.employeeId === r.employee.id,
          );
          return cell(
            ymd,
            <>
              {own.map((s, i) => (
                <Card
                  key={s.id}
                  s={s}
                  onOpen={p.onOpenShift}
                  shiftLabel={p.shiftLabel}
                  index={index + i}
                />
              ))}
              {leaves.map((l) => (
                <LeaveChip key={l.id} leave={l} />
              ))}
            </>,
            r.employee.id,
            `${r.employee.fullName}, ${ymd}`,
          );
        })}
      </div>
    );
  };

  let body: ReactNode;
  if (p.loading) {
    body = Array.from({ length: 5 }, (_, i) => (
      <div key={i} className={`${GRID} border-b border-line-subtle`}>
        <div
          className={`${FIRST_COL} flex items-center gap-3 border-r border-line-subtle px-4 py-4`}
        >
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        {p.days.map((d) => (
          <div
            key={p.toYmd(d)}
            className="border-r border-line-subtle p-1.5 last:border-r-0"
          >
            {i % 2 === 0 && <Skeleton className="h-12 w-full rounded-xl" />}
          </div>
        ))}
      </div>
    ));
  } else if (p.mode === "shifts") {
    const groups = shiftTypeRows(p.shifts, (s) => p.shiftLabel(s).title);
    body = groups.map((g, gi) => {
      const sample = [...g.byDate.values()][0]![0]!;
      const { tone } = p.shiftLabel(sample);
      return (
        <div
          key={g.label}
          role="row"
          className={`${GRID} border-b border-line-subtle last:border-b-0 motion-safe:animate-motion-fade-up`}
          style={{ animationDelay: `${Math.min(gi, 8) * 50}ms` }}
        >
          <div
            role="rowheader"
            className={`${FIRST_COL} flex items-center gap-3 border-r border-line-subtle px-4 py-3`}
          >
            <ShiftTypeChip tone={tone}>{abbreviation(g.label)}</ShiftTypeChip>
            <span className="text-sm font-medium text-navy-900">{g.label}</span>
          </div>
          {p.days.map((d) => {
            const ymd = p.toYmd(d);
            return cell(
              ymd,
              (g.byDate.get(ymd) ?? []).map((s, i) => (
                <Card
                  key={s.id}
                  s={s}
                  onOpen={p.onOpenShift}
                  shiftLabel={p.shiftLabel}
                  index={i}
                  subtitle={s.employeeName.split(" ").slice(0, 2).join(" ")}
                />
              )),
              null,
              `${g.label}, ${ymd}`,
            );
          })}
        </div>
      );
    });
  } else if (p.mode === "positions") {
    const groups = new Map<string, BoardRow[]>();
    for (const r of p.rows) {
      const name = p.positionName(r.employee.positionId) ?? "Sem cargo";
      groups.set(name, [...(groups.get(name) ?? []), r]);
    }
    let n = 0;
    body = [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt"))
      .map(([name, rows]) => (
        <Fragment key={name}>
          <div
            role="row"
            className="sticky left-0 border-b border-line-subtle bg-surface-soft/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary"
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
    (p.mode === "shifts" ? p.shifts.length === 0 : p.rows.length === 0);
  return (
    <section
      aria-label="Escala da semana"
      className="overflow-hidden rounded-2.5xl border border-line bg-surface-card shadow-card motion-safe:animate-motion-fade-up [animation-delay:120ms]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle px-5 py-3.5 text-sm text-ink-secondary">
        {p.summary}
      </div>
      <WeekAgenda {...p} />
      <div className="hidden overflow-x-auto md:block">
        <div role="table" aria-label="Turnos por dia" className="min-w-[900px]">
          {header}
          {body}
          {empty && (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center motion-safe:animate-motion-fade">
              <IconUsers size={22} className="text-ink-muted" />
              <p className="text-sm font-medium text-navy-900">
                Sem turnos nesta semana
              </p>
              <p className="text-sm text-ink-secondary">
                Use “Atribuir turnos” ou “Adicionar” para planear a semana.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Telemóvel: em vez de encolher a grelha, uma agenda do dia — os 7 dias em
 * botões e, por baixo, as pessoas e os turnos desse dia.
 */
function WeekAgenda(p: WeekBoardProps) {
  const initial = p.days.find((d) => p.toYmd(d) === p.todayYmd) ?? p.days[0]!;
  const [day, setDay] = useState(() => p.toYmd(initial));
  const selected = p.days.some((d) => p.toYmd(d) === day)
    ? day
    : p.toYmd(p.days[0]!);
  const people = p.rows.filter(
    (r) =>
      (r.shiftsByDate.get(selected) ?? []).length > 0 ||
      (p.leavesByDate.get(selected) ?? []).some(
        (l) => l.employeeId === r.employee.id,
      ),
  );
  return (
    <div className="md:hidden">
      <div
        role="tablist"
        aria-label="Dia da semana"
        className="flex gap-1.5 overflow-x-auto border-b border-line-subtle px-3 py-3"
      >
        {p.days.map((d) => {
          const ymd = p.toYmd(d);
          const { weekday, day: n } = dayHeader(d);
          const active = ymd === selected;
          const today = ymd === p.todayYmd;
          return (
            <button
              key={ymd}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDay(ymd)}
              className={`flex min-w-[48px] flex-col items-center rounded-xl px-2 py-1.5 text-xs transition-colors duration-150 ${active ? "bg-navy-900 text-white" : today ? "bg-brand-50 text-brand-600" : "text-ink-secondary hover:bg-surface-soft"}`}
            >
              <span>{weekday.slice(0, 3)}</span>
              <span className="text-base font-semibold tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>
      <ul className="divide-y divide-line-subtle">
        {p.loading && (
          <li className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-10 flex-1 rounded-xl" />
          </li>
        )}
        {!p.loading && people.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-ink-secondary">
            Ninguém escalado neste dia.
          </li>
        )}
        {people.map((r, i) => (
          <li
            key={r.employee.id}
            className="space-y-2 px-4 py-3 motion-safe:animate-motion-fade-up"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <EmployeeCell
              name={r.employee.fullName}
              subtitle={p.positionName(r.employee.positionId) ?? undefined}
              photoUrl={r.employee.photoUrl}
              size="list"
              aside={hoursLabel(r.minutes)}
            />
            <div className="grid grid-cols-2 gap-2">
              {(r.shiftsByDate.get(selected) ?? []).map((s, n) => (
                <Card
                  key={s.id}
                  s={s}
                  onOpen={p.onOpenShift}
                  shiftLabel={p.shiftLabel}
                  index={n}
                />
              ))}
              {(p.leavesByDate.get(selected) ?? [])
                .filter((l) => l.employeeId === r.employee.id)
                .map((l) => (
                  <LeaveChip key={l.id} leave={l} />
                ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-line-subtle p-3">
        <button
          type="button"
          onClick={() => p.onNewShift(null, selected)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm font-medium text-brand-600 hover:bg-brand-50"
        >
          <IconPlus size={16} /> Novo turno neste dia
        </button>
      </div>
    </div>
  );
}
