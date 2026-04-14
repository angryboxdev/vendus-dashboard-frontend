import { useEffect, useState } from "react";

import { isStartBeforeEndSameDay } from "../dates";
import type { WeeklySchedule } from "../hr.types";
import {
  finalizeWeeklySchedule,
  toTimeInputValue,
  WEEKDAY_MON_FIRST_LABELS,
} from "../weeklyScheduleUtils";

const controlClass =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

type DraftSegment = { startTime: string; endTime: string };
type DraftDay = { weekday: number; segments: DraftSegment[] };

function scheduleToDraft(ws: WeeklySchedule | null | undefined): DraftDay[] {
  const map = new Map<number, DraftSegment[]>();
  for (const d of ws?.days ?? []) {
    map.set(
      d.weekday,
      d.segments.map((s) => ({
        startTime: toTimeInputValue(s.startTime),
        endTime: toTimeInputValue(s.endTime),
      })),
    );
  }
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    segments: map.get(weekday)?.length ? [...(map.get(weekday) as DraftSegment[])] : [],
  }));
}

function draftToSchedule(draft: DraftDay[]): WeeklySchedule {
  return {
    days: draft
      .filter((d) => d.segments.length > 0)
      .map((d) => ({
        weekday: d.weekday,
        segments: d.segments.map((s) => ({ ...s })),
      })),
  };
}

export function WeeklyScheduleEditor({
  initial,
  loading,
  onSave,
  onClear,
  getSuggestedPreset,
  /** Quando está dentro de painel colapsável (ex.: aba Turnos), sem moldura própria nem título duplicado. */
  embedded = false,
}: {
  initial: WeeklySchedule | null | undefined;
  loading: boolean;
  onSave: (body: WeeklySchedule | null) => void;
  onClear: () => void;
  getSuggestedPreset: () => WeeklySchedule | null;
  embedded?: boolean;
}) {
  const [draft, setDraft] = useState<DraftDay[]>(() =>
    scheduleToDraft(initial),
  );

  useEffect(() => {
    setDraft(scheduleToDraft(initial));
  }, [initial]);

  function updateSegment(
    weekday: number,
    segIdx: number,
    field: keyof DraftSegment,
    value: string,
  ) {
    setDraft((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const segments = d.segments.map((s, i) =>
          i === segIdx ? { ...s, [field]: value } : s,
        );
        return { ...d, segments };
      }),
    );
  }

  function addSegment(weekday: number) {
    setDraft((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? {
              ...d,
              segments: [...d.segments, { startTime: "09:00", endTime: "17:00" }],
            }
          : d,
      ),
    );
  }

  function removeSegment(weekday: number, segIdx: number) {
    setDraft((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? {
              ...d,
              segments: d.segments.filter((_, i) => i !== segIdx),
            }
          : d,
      ),
    );
  }

  function handleSave() {
    const raw = draftToSchedule(draft);
    if (raw.days.length === 0) {
      onSave(null);
      return;
    }
    for (const day of raw.days) {
      for (const seg of day.segments) {
        if (!seg.startTime?.trim() || !seg.endTime?.trim()) {
          window.alert(
            `Preencha início e fim em ${WEEKDAY_MON_FIRST_LABELS[day.weekday]}.`,
          );
          return;
        }
        if (!isStartBeforeEndSameDay(seg.startTime, seg.endTime)) {
          window.alert(
            `Horário inválido em ${WEEKDAY_MON_FIRST_LABELS[day.weekday]}: início deve ser antes do fim.`,
          );
          return;
        }
      }
    }
    onSave(finalizeWeeklySchedule(raw));
  }

  function handlePreset() {
    const p = getSuggestedPreset();
    if (!p) {
      window.alert("Não há preset definido para esta função e vínculo.");
      return;
    }
    setDraft(scheduleToDraft(p));
  }

  return (
    <div
      className={
        embedded
          ? ""
          : "rounded-xl border border-slate-200 bg-slate-50/50 p-4"
      }
    >
      {embedded ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="text-sm text-indigo-700 hover:underline"
            onClick={handlePreset}
          >
            Preencher com função atual
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            Escala base (semanal)
          </h3>
          <button
            type="button"
            className="text-sm text-indigo-700 hover:underline"
            onClick={handlePreset}
          >
            Preencher com função atual
          </button>
        </div>
      )}
      <p
        className={`text-xs text-slate-600 ${embedded ? "mt-2" : "mt-1"}`}
      >
        {embedded ? (
          <>
            Dias da semana e intervalos habituais. Use &quot;Aplicar escala ao
            mês&quot; na barra acima para gerar turnos no mês selecionado.
          </>
        ) : (
          <>
            Dias da semana e intervalos habituais. Na aba Turnos, use
            &quot;Aplicar escala ao mês&quot; para criar turnos no mês visível.
          </>
        )}
      </p>
      <div className="mt-4 space-y-3">
        {draft.map((d) => (
          <div
            key={d.weekday}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="text-xs font-semibold text-slate-700">
              {WEEKDAY_MON_FIRST_LABELS[d.weekday]}
            </div>
            {d.segments.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Folga</p>
            ) : (
              <div className="mt-2 space-y-2">
                {d.segments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="time"
                      className={`${controlClass} w-[7rem]`}
                      value={seg.startTime}
                      onChange={(e) =>
                        updateSegment(d.weekday, idx, "startTime", e.target.value)
                      }
                    />
                    <span className="text-slate-500">→</span>
                    <input
                      type="time"
                      className={`${controlClass} w-[7rem]`}
                      value={seg.endTime}
                      onChange={(e) =>
                        updateSegment(d.weekday, idx, "endTime", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="text-xs text-red-700 hover:underline"
                      onClick={() => removeSegment(d.weekday, idx)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="mt-2 text-xs text-indigo-700 hover:underline"
              onClick={() => addSegment(d.weekday)}
            >
              + Intervalo
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={handleSave}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "A guardar…" : "Guardar escala"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (
              window.confirm(
                "Remover a escala guardada deste funcionário? Os turnos já criados não são apagados.",
              )
            )
              onClear();
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          Limpar escala
        </button>
      </div>
    </div>
  );
}
