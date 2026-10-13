import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import {
  AvatarStack,
  Button,
  EmptyState,
  IconCalendar,
  IconPlus,
  IconStore,
  IconUsers,
  SearchInput,
  Skeleton,
  StatusBadge,
  TABLE,
  TD,
  TH,
  THEAD,
} from "../../../../../components/ui/index.ts";
import { motionListItem, useFirstBatch } from "../../../../../components/motion/index.ts";
import type { RosterSummary } from "../../../domain/entities/rosters.ts";
import { weekOf } from "../../../domain/services/attendance.service.ts";
import { daysFrom } from "../../../domain/services/rosters.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { NewRosterDrawer } from "./PlannerPanel.tsx";

/** Período da visão macro: esta semana e as quatro seguintes. */
const WEEKS = 5;

const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Escalas vistas "do macro" (por local ou grupo): quem está escalado nas
 * próximas semanas, o que falta publicar e a última publicação. Escolher uma
 * escala abre a grelha dessa escala.
 */
export function RostersOverview({ onOpen }: { onOpen: (rosterId: string) => void }) {
  const { t } = useI18n();
  const { rosters, settings, structure } = useNovoRh();
  const from = weekOf(todayIn()).from;
  const to = daysFrom(from, WEEKS * 7).at(-1)!;
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ["novo-rh", "rosters", "summary", from], queryFn: () => rosters.summary(from, to) });
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const groups = useQuery({ queryKey: ["novo-rh", "structure", "groups"], queryFn: () => structure.listGroups() });
  const person = (id: string) => {
    const e = employees.data?.find((x) => x.id === id);
    return { name: e?.label ?? id, photoUrl: e?.photoUrl ?? null };
  };
  const target = (s: RosterSummary) =>
    s.roster.targetType === "location"
      ? { icon: <IconStore size={14} />, label: locations.data?.find((l) => l.id === s.roster.targetId)?.label ?? t("ros.overview.byLocation") }
      : { icon: <IconUsers size={14} />, label: groups.data?.find((g) => g.id === s.roster.targetId)?.name ?? t("ros.overview.byGroup") };
  const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const rows = (q.data ?? []).filter((s) => !search.trim() || norm(`${s.roster.name} ${target(s).label}`).includes(norm(search.trim())));
  const firstBatch = useFirstBatch(rows.map((r) => r.roster.id));

  return (
    <section aria-label={t("ros.overview.title")} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 motion-safe:animate-motion-fade-up">
        <SearchInput label={t("ros.overview.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-xs" />
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-secondary">{t("ros.overview.period", { from: fmtDate(from), to: fmtDate(to) })}</span>
          <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            {t("ros.roster.new")}
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2.5xl border border-line bg-surface-card shadow-card motion-safe:animate-motion-fade-up [animation-delay:80ms]">
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead className={`${THEAD} bg-surface-soft/70`}>
              <tr>
                <th className={`${TH} pl-6`}>{t("ros.overview.name")}</th>
                <th className={TH}>{t("ros.overview.target")}</th>
                <th className={TH}>{t("ros.overview.employees")}</th>
                <th className={TH}>{t("ros.overview.state")}</th>
                <th className={`${TH} pr-6 text-right`}>{t("ros.overview.lastPublished")}</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="border-b border-line-subtle">
                    {["w-40", "w-32", "w-24", "w-20", "w-24"].map((w, j) => (
                      <td key={j} className={TD}>
                        <Skeleton className={`h-4 ${w}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              {rows.map((s, i) => {
                const motion = motionListItem(i, firstBatch.has(s.roster.id));
                const tg = target(s);
                const people = s.employeeIds.map((id) => ({ key: id, ...person(id) }));
                return (
                  <tr
                    key={s.roster.id}
                    onClick={() => onOpen(s.roster.id)}
                    className={`cursor-pointer border-b border-line-subtle transition-colors duration-150 last:border-0 hover:bg-surface-soft/60 ${motion.className}`}
                    style={motion.style}
                  >
                    <td className={`${TD} py-5 pl-6`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(s.roster.id);
                        }}
                        className="text-left text-[15px] font-medium text-navy-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      >
                        {s.roster.name}
                      </button>
                    </td>
                    <td className={TD}>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-shift-afternoon-bg/70 px-2.5 py-1 text-xs font-medium text-shift-afternoon-ink">
                        {tg.icon}
                        {tg.label}
                      </span>
                    </td>
                    <td className={TD}>
                      {people.length ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-card py-1 pl-1 pr-2.5 shadow-card">
                          <AvatarStack size="xs" max={3} items={people.slice(0, 3)} />
                          <span className="text-xs font-medium tabular-nums text-shift-afternoon-ink">{people.length}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-ink-muted">{t("ros.overview.nobody")}</span>
                      )}
                    </td>
                    <td className={TD}>
                      {s.pending > 0 ? (
                        <StatusBadge tone="warning">{t("ros.overview.pending")}</StatusBadge>
                      ) : s.shifts > 0 ? (
                        <StatusBadge tone="success">{t("ros.overview.published")}</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">{t("ros.overview.empty")}</StatusBadge>
                      )}
                    </td>
                    <td className={`${TD} pr-6 text-right tabular-nums`}>{s.lastPublishedAt ? fmtDate(s.lastPublishedAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {q.data && rows.length === 0 && (
          <EmptyState
            icon={<IconCalendar size={22} />}
            title={search ? t("ros.overview.noMatch") : t("ros.board.noRostersTitle")}
            description={search ? undefined : t("ros.board.noRostersText")}
          />
        )}
        {q.isError && <EmptyState icon={<IconCalendar size={22} />} title={t("ros.board.loadError")} action={<Button onClick={() => void q.refetch()}>{t("ros.board.retry")}</Button>} />}
        {rows.length > 0 && <p className="border-t border-line-subtle px-6 py-3 text-right text-sm text-ink-muted">{t("ros.overview.count", { count: rows.length })}</p>}
      </div>
      <NewRosterDrawer
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          onOpen(id);
        }}
        locations={settings}
        structure={structure}
      />
    </section>
  );
}
