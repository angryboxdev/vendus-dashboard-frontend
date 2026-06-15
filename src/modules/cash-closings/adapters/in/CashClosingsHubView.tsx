import type {
  CashClosing,
  CashClosingStatus,
} from "../../domain/entities/cash-closing.ts";
import { ClosingDetailModal, StatusBadge } from "./ClosingDetailModal.tsx";
import {
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  getMondayOfWeek,
  getMonthRange,
  getWeekDays,
  nextMonth,
  nextWeekMonday,
  prevMonth,
  prevWeekMonday,
} from "../../domain/services/closings-period.ts";

import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useCashClosingsModule } from "../../cash-closings.module.tsx";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

// ---------- helpers ----------

function fmtEur(n: number): string {
  return (
    n.toLocaleString("pt-PT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function fmtDate(ymd: string): string {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
}

/** Devolve o status "pior" de uma lista de fechos (pending > rejected > approved). */
function worstStatus(closings: CashClosing[]): CashClosingStatus | null {
  if (closings.length === 0) return null;
  if (closings.some((c) => c.status === "pending")) return "pending";
  if (closings.some((c) => c.status === "rejected")) return "rejected";
  return "approved";
}

// ---------- ViewModeToggle ----------

type ViewMode = "week" | "month";

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-[#F5C992]/80 bg-white text-sm shadow-sm">
      {(["week", "month"] as ViewMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-4 py-1.5 font-medium transition-colors ${
            mode === m
              ? "bg-gradient-to-r from-[#ED5C32] to-[#EF8935] text-white"
              : "text-stone-600 hover:bg-stone-50"
          }`}
        >
          {m === "week" ? "Semana" : "Mês"}
        </button>
      ))}
    </div>
  );
}

// ---------- StatusFilter ----------

const STATUS_LABELS: [CashClosingStatus | "", string][] = [
  ["", "Todos"],
  ["pending", "Pendentes"],
  ["approved", "Aprovados"],
  ["rejected", "Rejeitados"],
];

function StatusFilter({
  value,
  onChange,
}: {
  value: CashClosingStatus | "";
  onChange: (v: CashClosingStatus | "") => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-stone-200 bg-white text-sm shadow-sm">
      {STATUS_LABELS.map(([val, label]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`px-3 py-1.5 font-medium transition-colors ${
            value === val
              ? "bg-stone-800 text-white"
              : "text-stone-500 hover:bg-stone-50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------- NavButton ----------

function NavButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 shadow-sm transition-colors hover:border-[#F5C992] hover:text-[#ED5C32]"
    >
      {children}
    </button>
  );
}

// ---------- DayCard (week view) ----------

interface DayCardProps {
  date: string;
  closings: CashClosing[];
  statusFilter: CashClosingStatus | "";
  onClick: (closings: CashClosing[]) => void;
}

function DayCard({ date, closings, statusFilter, onClick }: DayCardProps) {
  const filtered = statusFilter
    ? closings.filter((c) => c.status === statusFilter)
    : closings;
  const { short, num, month } = formatDayLabel(date);
  const hasData = filtered.length > 0;
  const total = filtered.reduce((s, c) => s + c.totalCalculated, 0);
  const status = worstStatus(filtered);
  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <button
      type="button"
      disabled={!hasData}
      onClick={() => hasData && onClick(filtered)}
      className={`group relative overflow-hidden flex flex-col rounded-xl border bg-white p-4 text-left transition-all ${
        hasData
          ? "cursor-pointer border-[#F5C992]/60 shadow-sm hover:border-[#ED5C32]/40 hover:shadow-md"
          : "cursor-default border-stone-100 opacity-60"
      } ${isToday ? "ring-1 ring-[#ED5C32]/30" : ""}`}
    >
      {/* Top accent bar */}
      {hasData && (
        <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-gradient-to-r from-[#ED5C32] to-[#F1A93F]" />
      )}

      {/* Day header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            {short}
          </span>
          <p className="mt-0.5 text-xl font-bold text-stone-800">{num}</p>
          <p className="text-xs text-stone-400">{month}</p>
        </div>
        {isToday && (
          <span className="rounded-full bg-[#ED5C32]/10 px-2 py-0.5 text-xs font-medium text-[#ED5C32]">
            hoje
          </span>
        )}
      </div>

      {/* Content */}
      <div className="mt-4 space-y-1.5">
        {hasData ? (
          <>
            <p className="text-xs text-stone-400">
              {filtered.length} fecho{filtered.length !== 1 ? "s" : ""}
            </p>
            <p className="text-sm font-semibold tabular-nums text-stone-800">
              {fmtEur(total)}
            </p>
            {status && (
              <div className="pt-1">
                <StatusBadge status={status} />
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-stone-400">Sem fechos</p>
        )}
      </div>
    </button>
  );
}

// ---------- DayDrawer (week mode: list of closings for a day) ----------

interface DayDrawerProps {
  closings: CashClosing[];
  onSelectClosing: (c: CashClosing) => void;
  onClose: () => void;
}

function DayDrawer({ closings, onSelectClosing, onClose }: DayDrawerProps) {
  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        className="flex-1 bg-black/25 backdrop-blur-sm"
        onClick={onClose}
        aria-label="fechar"
      />
      <div className="flex w-80 flex-col bg-[#FAF6F3] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F5C992]/60 bg-white px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-stone-800">
              {fmtDate(closings[0]?.closingDate ?? "")}
            </p>
            <p className="text-xs text-stone-400">
              {closings.length} fecho{closings.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22Z" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {closings.map((c) => {
            const diff =
              c.vendusTotal != null
                ? Math.round((c.totalCalculated - c.vendusTotal) * 100) / 100
                : null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectClosing(c)}
                className="w-full rounded-xl border border-[#F5C992]/60 bg-white p-4 text-left shadow-sm transition-all hover:border-[#ED5C32]/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-stone-800">
                    {c.employeeName}
                  </p>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-lg font-bold tabular-nums text-stone-900">
                    {fmtEur(c.totalCalculated)}
                  </p>
                  {diff != null && diff !== 0 && (
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        diff > 0 ? "text-[#ED5C32]" : "text-[#A3211A]"
                      }`}
                    >
                      {(diff > 0 ? "+" : "") + fmtEur(diff)}
                    </span>
                  )}
                </div>
                {c.sangriaAmount > 0 && (
                  <p className="mt-1 text-xs text-[#7A1A00]">
                    Sangria: {fmtEur(c.sangriaAmount)}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-stone-400">
                  {fmtDateTime(c.submittedAt)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- WeekView ----------

interface WeekViewProps {
  monday: string;
  closings: CashClosing[];
  statusFilter: CashClosingStatus | "";
  onDayClick: (closings: CashClosing[]) => void;
}

function WeekView({
  monday,
  closings,
  statusFilter,
  onDayClick,
}: WeekViewProps) {
  const days = getWeekDays(monday);
  const byDate = new Map<string, CashClosing[]>();
  for (const c of closings) {
    const list = byDate.get(c.closingDate) ?? [];
    list.push(c);
    byDate.set(c.closingDate, list);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => (
        <DayCard
          key={d}
          date={d}
          closings={byDate.get(d) ?? []}
          statusFilter={statusFilter}
          onClick={onDayClick}
        />
      ))}
    </div>
  );
}

// ---------- MonthView (table) ----------

const PAGE_SIZE = 30;

interface MonthViewProps {
  closings: CashClosing[];
  total: number;
  offset: number;
  onOffsetChange: (n: number) => void;
  onRowClick: (c: CashClosing) => void;
}

function MonthView({
  closings,
  total,
  offset,
  onOffsetChange,
  onRowClick,
}: MonthViewProps) {
  if (closings.length === 0) {
    return (
      <div className="rounded-xl border border-stone-100 bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-stone-400">
          Sem fechos para o período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#ED5C32] to-[#F1A93F]" />
      <table className="w-full text-sm">
        <thead className="border-b border-stone-100 bg-stone-50">
          <tr>
            {[
              "Data",
              "Funcionário",
              "Total",
              "Vendus",
              "Dif.",
              "Sangria",
              "Estado",
              "Submetido",
            ].map((h) => (
              <th
                key={h}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 ${
                  ["Total", "Vendus", "Dif.", "Sangria"].includes(h)
                    ? "text-right"
                    : h === "Estado"
                      ? "text-center"
                      : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {closings.map((c) => {
            const diff =
              c.vendusTotal != null
                ? Math.round((c.totalCalculated - c.vendusTotal) * 100) / 100
                : null;
            return (
              <tr
                key={c.id}
                onClick={() => onRowClick(c)}
                className="cursor-pointer transition-colors hover:bg-[#FAF6F3]"
              >
                <td className="px-4 py-3 text-stone-600">
                  {fmtDate(c.closingDate)}
                </td>
                <td className="px-4 py-3 font-medium text-stone-800">
                  {c.employeeName}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                  {fmtEur(c.totalCalculated)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-stone-400">
                  {c.vendusTotal != null ? fmtEur(c.vendusTotal) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {diff != null ? (
                    <span
                      className={
                        diff === 0
                          ? "text-emerald-600"
                          : diff > 0
                            ? "text-[#ED5C32]"
                            : "text-[#A3211A]"
                      }
                    >
                      {(diff >= 0 ? "+" : "") + fmtEur(diff)}
                    </span>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#7A1A00]">
                  {c.sangriaAmount > 0 ? (
                    fmtEur(c.sangriaAmount)
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-stone-400">
                  {fmtDateTime(c.submittedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(closings.length < total || offset > 0) && (
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => onOffsetChange(Math.max(0, offset - PAGE_SIZE))}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-stone-400">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => onOffsetChange(offset + PAGE_SIZE)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-40"
          >
            Seguinte
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- PeriodSummary ----------

interface PeriodSummaryProps {
  closings: CashClosing[];
}

function PeriodSummary({ closings }: PeriodSummaryProps) {
  if (closings.length === 0) return null;

  const totalAmount = closings.reduce((s, c) => s + c.totalCalculated, 0);
  const sangriaTotal = closings.reduce((s, c) => s + c.sangriaAmount, 0);

  return (
    <div className="mb-5 flex items-baseline gap-4">
      <div>
        <span className="text-xs font-medium tracking-wider text-stone-400">
          Total do período
        </span>
        <span className="ml-2 text-sm font-semibold tabular-nums text-stone-700">
          {fmtEur(totalAmount)}
        </span>
      </div>
      {sangriaTotal > 0 && (
        <>
          <span className="text-stone-300">·</span>
          <div>
            <span className="text-xs font-medium tracking-wider text-stone-400">
              Sangria
            </span>
            <span className="ml-2 text-sm font-semibold tabular-nums text-[#A3211A]/70">
              {fmtEur(sangriaTotal)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- CashClosingsHubView (main) ----------

export function CashClosingsHubView() {
  const { listClosings } = useCashClosingsModule();

  const today = new Date().toISOString().slice(0, 10);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [statusFilter, setStatusFilter] = useState<CashClosingStatus | "">("");
  const [monday, setMonday] = useState(() => getMondayOfWeek(today));
  const [monthYear, setMonthYear] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  }));
  const [monthOffset, setMonthOffset] = useState(0);

  // Modal / drawer state
  const [selectedClosing, setSelectedClosing] = useState<CashClosing | null>(
    null,
  );
  const [dayClosings, setDayClosings] = useState<CashClosing[] | null>(null);

  // Build query params based on view mode
  const queryParams =
    viewMode === "week"
      ? {
          from: monday,
          to: getWeekDays(monday)[6] ?? monday,
          limit: 200,
          offset: 0,
        }
      : {
          ...getMonthRange(monthYear.year, monthYear.month),
          status: statusFilter || undefined,
          limit: PAGE_SIZE,
          offset: monthOffset,
        };

  const { data, isPending } = useQuery({
    queryKey: ["cash-closings", viewMode, queryParams],
    queryFn: () => listClosings.execute(queryParams),
  });

  const closings = data?.closings ?? [];
  const total = data?.total ?? 0;

  function handleDayCardClick(dayClosings: CashClosing[]) {
    if (dayClosings.length === 1) {
      setSelectedClosing(dayClosings[0] ?? null);
    } else {
      setDayClosings(dayClosings);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF6F3]">
      <div className="mx-auto w-full max-w-7xl flex-1 p-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#A3211A]">Fechos de Caixa</h1>
          <p className="mt-1 text-sm text-stone-500">
            Revisão e aprovação dos fechos submetidos pelos funcionários.
          </p>
        </div>

        {/* Controls bar */}
        <div className="mb-5 space-y-3">
          {/* Row 1: view toggle (left) + period navigator (right) */}
          <div className="flex items-center justify-between gap-3">
            <ViewModeToggle
              mode={viewMode}
              onChange={(m) => {
                setViewMode(m);
                setStatusFilter("");
              }}
            />
            <div className="flex items-center gap-2">
              <NavButton
                onClick={() => {
                  if (viewMode === "week") setMonday(prevWeekMonday(monday));
                  else setMonthYear((my) => prevMonth(my.year, my.month));
                }}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" />
                </svg>
              </NavButton>
              <span className="min-w-28 text-center text-sm font-medium text-stone-700 sm:min-w-36">
                {viewMode === "week"
                  ? formatWeekLabel(monday)
                  : formatMonthLabel(monthYear.year, monthYear.month)}
              </span>
              <NavButton
                onClick={() => {
                  if (viewMode === "week") setMonday(nextWeekMonday(monday));
                  else setMonthYear((my) => nextMonth(my.year, my.month));
                }}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M6.22 11.78a.75.75 0 0 1 0-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 1.06-1.06l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06 0Z" />
                </svg>
              </NavButton>
            </div>
          </div>

          {/* Row 2: status filter */}
          <StatusFilter
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setMonthOffset(0);
            }}
          />
        </div>

        {/* Period summary */}
        {!isPending && <PeriodSummary closings={closings} />}

        {/* Content */}
        {isPending ? (
          <div className="animate-pulse">
            {viewMode === "week" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-36 rounded-xl bg-white/80" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-stone-100" />
                ))}
              </div>
            )}
          </div>
        ) : viewMode === "week" ? (
          <WeekView
            monday={monday}
            closings={closings}
            statusFilter={statusFilter}
            onDayClick={handleDayCardClick}
          />
        ) : (
          <MonthView
            closings={closings}
            total={total}
            offset={monthOffset}
            onOffsetChange={setMonthOffset}
            onRowClick={setSelectedClosing}
          />
        )}
      </div>

      {/* Day drawer (week view: multiple closings for a day) */}
      {dayClosings && !selectedClosing && (
        <DayDrawer
          closings={dayClosings}
          onSelectClosing={(c) => {
            setSelectedClosing(c);
            setDayClosings(null);
          }}
          onClose={() => setDayClosings(null)}
        />
      )}

      {/* Detail modal */}
      {selectedClosing && (
        <ClosingDetailModal
          closing={selectedClosing}
          onClose={() => setSelectedClosing(null)}
        />
      )}

      <PageFooter />
    </div>
  );
}
