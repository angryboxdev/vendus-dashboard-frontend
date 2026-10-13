import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import {
  IconButton,
  IconClose,
  IconPlus,
  IconSearch,
  IconSort,
  ShiftTypeChip,
} from "../../../../../components/ui/index.ts";
import type { ShiftTemplate } from "../../../domain/entities/rosters.ts";
import {
  chipLabel,
  hoursLabel,
  segmentLabel,
  segmentsMinutes,
  templateTone,
} from "../../../domain/services/roster-board.service.ts";

/**
 * "Atribuir turnos" (lateral direita): escolher um modelo (ou Folga) e
 * clicar nos dias vazios da grelha para o atribuir a um ou mais
 * colaboradores — o mesmo "pincel" de antes. Em ecrãs pequenos ocupa o ecrã.
 */
export function AssignPanel({
  templates,
  loading,
  value,
  onChange,
  onCreate,
  onSettings,
  onClose,
}: {
  templates: ShiftTemplate[];
  loading: boolean;
  /** Modelo escolhido ("day_off" = folga; "" = nenhum). */
  value: string;
  onChange: (id: string) => void;
  onCreate: () => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [byTime, setByTime] = useState(false);
  const norm = (v: string) =>
    v
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const shown = templates
    .filter(
      (x) =>
        !x.archived &&
        (!q || norm(`${x.name} ${x.abbreviation}`).includes(norm(q))),
    )
    .sort((a, b) =>
      byTime
        ? (a.segments[0]?.start ?? "").localeCompare(b.segments[0]?.start ?? "")
        : a.name.localeCompare(b.name, "pt"),
    );
  const card = (active: boolean) =>
    `flex w-full items-center gap-4 rounded-2xl border bg-surface-card px-4 py-3.5 text-left transition duration-150 hover:border-navy-900/20 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
      active ? "border-brand-600 ring-1 ring-brand-600" : "border-line"
    }`;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-navy-950/25 motion-safe:animate-motion-fade xl:hidden"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        aria-label={t("ros.assign.title")}
        className="fixed inset-0 z-50 flex flex-col bg-surface-card motion-safe:animate-motion-slide-in-right sm:inset-y-0 sm:left-auto sm:w-[420px] sm:shadow-pop xl:sticky xl:top-4 xl:z-10 xl:ml-4 xl:max-h-[calc(100vh-2rem)] xl:min-h-[640px] xl:w-[308px] xl:shrink-0 xl:rounded-2.5xl xl:border xl:border-line xl:shadow-pop"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
          <h2 className="text-xl font-semibold text-navy-900">
            {t("ros.assign.title")}
          </h2>
          <IconButton label={t("common.close")} size="sm" onClick={onClose}>
            <IconClose size={18} />
          </IconButton>
        </div>
        <p className="px-6 text-sm leading-6 text-ink-secondary">
          {t("ros.assign.hint")}{" "}
          <button
            type="button"
            onClick={onSettings}
            className="font-medium text-brand-600 hover:text-brand-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            {t("ros.assign.settings")}
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
              aria-label={t("ros.assign.search")}
              placeholder={`${t("ros.assign.search")}...`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-full rounded-full border border-transparent bg-surface-soft pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand-500 focus:bg-surface-card focus:ring-2 focus:ring-brand-500/15"
            />
          </div>
          <IconButton
            label={byTime ? t("ros.assign.sortName") : t("ros.assign.sortTime")}
            size="sm"
            onClick={() => setByTime((v) => !v)}
          >
            <IconSort size={16} />
          </IconButton>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto px-6 pb-5">
          {loading &&
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-2xl bg-surface-soft motion-reduce:animate-none"
              />
            ))}
          {!loading && shown.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-secondary">
              {q ? t("ros.assign.noMatch") : t("ros.assign.none")}
            </p>
          )}
          <ul className="space-y-2.5">
            {shown.map((x, i) => {
              const active = value === x.id;
              return (
                <li
                  key={x.id}
                  className="motion-safe:animate-motion-fade-up"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange(active ? "" : x.id)}
                    className={card(active)}
                  >
                    <ShiftTypeChip tone={templateTone(x)}>
                      {chipLabel(x)}
                    </ShiftTypeChip>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-900">
                        {x.name}
                      </span>
                      <span
                        className={`mt-0.5 block text-ink-secondary tabular-nums ${x.segments.length > 1 ? "text-xs" : "text-sm"}`}
                      >
                        {x.segments.map(segmentLabel).join(", ")}
                      </span>
                    </span>
                    <span className="shrink-0 self-end text-xs text-ink-secondary tabular-nums">
                      {hoursLabel(segmentsMinutes(x.segments))}
                    </span>
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                aria-pressed={value === "day_off"}
                onClick={() => onChange(value === "day_off" ? "" : "day_off")}
                className={card(value === "day_off")}
              >
                <span className="inline-flex h-8 min-w-[44px] items-center justify-center rounded-lg bg-surface-soft px-2 text-xs font-medium text-ink-secondary">
                  F
                </span>
                <span className="text-sm font-semibold text-navy-900">
                  {t("ros.dayOff")}
                </span>
              </button>
            </li>
          </ul>

          <div className="flex items-center gap-3 pt-4">
            <span className="text-sm text-ink-secondary">
              {t("ros.assign.custom")}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-card px-4 py-4 text-left text-sm text-navy-900 transition duration-150 hover:border-navy-900/20 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <IconPlus size={18} className="text-brand-600" />
            {t("ros.assign.create")}
          </button>
        </div>
      </aside>
    </>
  );
}
