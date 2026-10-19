import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import {
  DropdownMenu,
  IconCheck,
  IconChevronDown,
  IconMapPin,
  iconButtonClass,
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
  areas = [],
  area = "",
  onAreaChange,
  onManageAreas,
  collapsed = false,
  onExpand,
}: {
  templates: ShiftTemplate[];
  loading: boolean;
  /** Modelo escolhido ("day_off" = folga; "" = nenhum). */
  value: string;
  onChange: (id: string) => void;
  onCreate: () => void;
  onSettings: () => void;
  onClose: () => void;
  /** Áreas ativas que a escala aceita (vazio = o centro não usa áreas). */
  areas?: { id: string; label: string }[];
  /** Área a atribuir com o modelo ("" = sem área). */
  area?: string;
  onAreaChange?: (id: string) => void;
  onManageAreas?: () => void;
  /** Recolhido: barra estreita com as abreviaturas (só em ecrãs largos, onde o painel é uma coluna). */
  collapsed?: boolean;
  /** Expandir (e, com um modelo, escolhê-lo — sem atribuir nada). */
  onExpand?: (templateId?: string) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [byTime, setByTime] = useState(false);
  // O painel fica montado ao recolher: pesquisa e ordenação mantêm-se; o scroll guarda-se e repõe-se.
  const listRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const plusRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (collapsed) plusRef.current?.focus();
    else {
      if (listRef.current) listRef.current.scrollTop = savedScroll.current;
      closeRef.current?.focus();
    }
  }, [collapsed]);
  const collapse = () => {
    savedScroll.current = listRef.current?.scrollTop ?? 0;
    onClose();
  };
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
  // Recolhido: só um «+» laranja, pequeno, ao lado da grelha (reabre o painel tal como estava).
  if (collapsed)
    return (
      <div className="sticky top-[7.25rem] z-10 ml-3 shrink-0 md:top-[4.5rem]">
        <button
          ref={plusRef}
          type="button"
          aria-label={t("ros.assign.expand")}
          title={t("ros.assign.expand")}
          aria-expanded={false}
          onClick={() => onExpand?.()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm transition duration-150 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 motion-safe:animate-motion-fade"
        >
          <IconPlus size={16} />
        </button>
      </div>
    );

  const card = (active: boolean) =>
    `flex w-full items-center gap-4 rounded-2xl border bg-surface-card px-4 py-3.5 text-left transition duration-150 hover:border-navy-900/20 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
      active ? "border-brand-600 ring-1 ring-brand-600" : "border-line"
    }`;

  return (
    <>
      <aside
        aria-label={t("ros.assign.title")}
        className="sticky top-[7.25rem] z-10 ml-3 flex max-h-[calc(100dvh-8.25rem)] min-h-[min(560px,calc(100dvh-8.25rem))] w-[260px] shrink-0 flex-col rounded-2.5xl border border-line bg-surface-card shadow-pop motion-safe:animate-motion-fade md:top-[4.5rem] md:max-h-[calc(100dvh-5.5rem)] md:min-h-[min(560px,calc(100dvh-5.5rem))] lg:ml-4 lg:w-[308px]"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
          <h2 className="text-xl font-semibold text-navy-900">
            {t("ros.assign.title")}
          </h2>
          <button ref={closeRef} type="button" aria-label={t("ros.assign.collapse")} title={t("ros.assign.collapse")} aria-expanded className={iconButtonClass("sm")} onClick={collapse}>
            <IconClose size={18} />
          </button>
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
        {areas.length > 0 && onAreaChange && (
          <div role="group" aria-label={t("ros.area")} className="px-6 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                {t("ros.area")}
              </span>
              {onManageAreas && (
                <button
                  type="button"
                  onClick={onManageAreas}
                  className="text-xs font-medium text-brand-600 hover:text-brand-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  {t("ros.area.manage")}
                </button>
              )}
            </div>
            {/* Uma linha: a área escolhida; ao abrir, as áreas do centro (e «Sem área»). Só define a área dos próximos turnos. */}
            {(() => {
              const options = [{ id: "", label: t("ros.area.none") }, ...areas];
              const current = options.find((a) => a.id === area) ?? options[0]!;
              return (
                <DropdownMenu
                  label={t("ros.area")}
                  align="left"
                  portal
                  className="relative mt-2 block"
                  items={options.map((a) => ({
                    label: a.label,
                    icon: a.id === current.id ? <IconCheck size={16} /> : <span className="inline-block w-4" aria-hidden="true" />,
                    onSelect: () => onAreaChange(a.id),
                  }))}
                  trigger={({ open, toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-haspopup="menu"
                      aria-expanded={open}
                      aria-label={`${t("ros.area")}: ${current.label}`}
                      className="flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-surface-card px-3 text-left text-sm text-navy-900 transition duration-150 hover:border-navy-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    >
                      <IconMapPin size={16} className="shrink-0 text-brand-600" />
                      <span className={`min-w-0 flex-1 truncate ${current.id ? "font-medium" : "text-ink-secondary"}`}>{current.label}</span>
                      <IconChevronDown size={16} className={`shrink-0 text-ink-secondary transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
                    </button>
                  )}
                />
              );
            })()}
          </div>
        )}
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

        <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-6 pb-5">
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
