import { useState } from "react";
import { addMonths, daysInclusive, isDayDisabled, isInPeriod, monthGrid, monthTitle, pickDay, type PickedPeriod } from "../../domain/services/period-picker.service.ts";
import { dateLabel } from "../../domain/services/portal-text.service.ts";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/**
 * "Selecione o período" (mockup Portal, 2026-10-07) — folha que sobe de
 * baixo com um calendário de intervalo. Evita o "Até" antes do "De" dos
 * campos de data do telemóvel.
 */
export function PeriodSheet({
  initial,
  today,
  maxDays,
  onConfirm,
  onClose,
}: {
  initial: PickedPeriod;
  today: string;
  maxDays: number;
  onConfirm: (p: { start: string; end: string }) => void;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<PickedPeriod>(initial);
  const [month, setMonth] = useState((initial.start ?? today).slice(0, 7));
  const opts = { today, maxDays };
  const end = period.end ?? period.start;
  const canPrev = month > today.slice(0, 7);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="Selecione o período">
      <div className="w-full max-w-md rounded-t-3xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 shadow-xl">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-stone-200" />
        <div className="mb-3 flex items-center">
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 text-xl text-stone-700">
            ✕
          </button>
          <p className="flex-1 pr-7 text-center text-base font-semibold text-stone-900">Selecione o período</p>
        </div>

        <div className="mb-2 flex items-center justify-between px-6">
          <button type="button" aria-label="Mês anterior" disabled={!canPrev} onClick={() => setMonth(addMonths(month, -1))} className="p-2 text-stone-700 disabled:opacity-30">
            ‹
          </button>
          <p className="text-sm font-medium text-stone-900">{monthTitle(month)}</p>
          <button type="button" aria-label="Mês seguinte" onClick={() => setMonth(addMonths(month, 1))} className="p-2 text-stone-700">
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-xs text-stone-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
          {monthGrid(month).map((day) => {
            const inMonth = day.startsWith(month);
            const disabled = !inMonth || isDayDisabled(day, period, opts);
            const isEdge = day === period.start || day === end;
            const inRange = isInPeriod(day, period);
            const rowEdge = day === period.start ? "rounded-l-full" : day === end ? "rounded-r-full" : "";
            return (
              <div key={day} className={inRange ? `bg-orange-50 ${rowEdge}` : ""}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={dateLabel(day)}
                  aria-pressed={isEdge}
                  onClick={() => setPeriod(pickDay(period, day, opts))}
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${
                    isEdge ? "bg-[#ED5C32] font-semibold text-white" : disabled ? "text-stone-300" : "text-stone-800"
                  }`}
                >
                  {Number(day.slice(8, 10))}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-3 rounded-2xl bg-orange-50/70 px-4 py-3 text-sm">
          <div>
            <p className="text-xs text-stone-500">De:</p>
            <p className="font-medium text-stone-900">{period.start ? dateLabel(period.start) : "—"}</p>
          </div>
          <div className="border-l border-orange-100 pl-3">
            <p className="text-xs text-stone-500">Até:</p>
            <p className="font-medium text-stone-900">{end ? dateLabel(end) : "—"}</p>
          </div>
          <div className="border-l border-orange-100 pl-3">
            <p className="text-xs text-stone-500">Duração:</p>
            <p className="font-semibold text-stone-900">{period.start && end ? `${daysInclusive(period.start, end)} ${daysInclusive(period.start, end) === 1 ? "dia" : "dias"}` : "—"}</p>
          </div>
        </div>
        <p className="mt-1 text-center text-[11px] text-stone-400">Toque no primeiro e no último dia (máx. {maxDays} dias).</p>

        <div className="mt-3 grid grid-cols-[1fr_1.4fr] gap-3">
          <button type="button" onClick={() => setPeriod({ start: null, end: null })} className="rounded-xl border border-stone-300 py-3 text-sm font-medium text-stone-600">
            Limpar
          </button>
          <button
            type="button"
            disabled={!period.start}
            onClick={() => onConfirm({ start: period.start!, end: end! })}
            className="rounded-xl bg-[#ED5C32] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirmar período
          </button>
        </div>
      </div>
    </div>
  );
}
