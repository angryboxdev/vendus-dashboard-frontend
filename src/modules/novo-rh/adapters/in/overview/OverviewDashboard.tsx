import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Avatar, Button, FIELD, IconCalendar, IconSearch, SECTION_TITLE, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { PersonOverview, PersonStatus } from "../../../domain/entities/overview.ts";
import { formatDuration, timeIn } from "../../../domain/services/attendance.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { STATUS } from "./overview-status.ts";
import { useEmployeePhotos } from "../common/use-employee-photos.ts";
import { PersonDayDrawer } from "./PersonDayDrawer.tsx";


type Filter = "all" | "present" | "missing" | "late" | "absent" | "not_started";
const PRESENT: PersonStatus[] = ["working", "remote", "break"];
const matches = (p: PersonOverview, f: Filter) =>
  f === "all" ||
  (f === "present" && PRESENT.includes(p.status)) ||
  (f === "missing" && p.status === "missing") ||
  (f === "late" && p.lateMinutes > 0) ||
  (f === "absent" && p.status === "absent") ||
  (f === "not_started" && p.status === "not_started");

const shortDay = (date: string) => new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const longDate = (date: string) => new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/**
 * Painel do dia (visão do dono): o que se passa hoje em toda a empresa — quem
 * está, quem faltou, quem chegou tarde — com o detalhe de cada pessoa a um clique.
 */
export function OverviewDashboard() {
  const { t } = useI18n();
  const photoOf = useEmployeePhotos();
  const { overview } = useNovoRh();
  const [date, setDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<PersonOverview | null>(null);
  const q = useQuery({
    queryKey: ["novo-rh", "overview", date ?? "today"],
    queryFn: () => overview.get(date ?? undefined),
    refetchInterval: date ? false : 60_000,
  });
  const o = q.data;
  const isToday = !!o && o.date === o.today;

  const people = useMemo(
    () => (o?.people ?? []).filter((p) => matches(p, filter) && (!location || (p.locationId ?? "") === location) && (!search || p.name.toLowerCase().includes(search.toLowerCase()))),
    [o, filter, location, search],
  );

  if (q.isError) return <p className="text-sm text-red-700">{q.error.message}</p>;
  if (!o) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;

  const k = o.kpis;
  const cards: { filter: Filter; label: MessageKey; value: number; tone: string; hint?: string }[] = [
    { filter: "present", label: isToday ? "ovw.kpi.presentNow" : "ovw.kpi.worked", value: isToday ? k.working + k.remote + k.onBreak : k.finished, tone: "text-emerald-700", hint: isToday ? t("ovw.kpi.presentHint", { remote: k.remote, onBreak: k.onBreak, finished: k.finished }) : undefined },
    { filter: "missing", label: "ovw.kpi.missing", value: k.missing, tone: k.missing ? "text-red-700" : "text-stone-900" },
    { filter: "late", label: "ovw.kpi.late", value: k.late, tone: k.late ? "text-amber-700" : "text-stone-900" },
    { filter: "absent", label: "ovw.kpi.absent", value: k.absent, tone: "text-stone-900" },
    { filter: "not_started", label: "ovw.kpi.notStarted", value: k.notStarted, tone: "text-stone-900" },
    { filter: "all", label: "ovw.kpi.scheduled", value: k.scheduled, tone: "text-stone-900", hint: t("ovw.kpi.peopleHint", { people: k.people }) },
  ];
  const pending: { key: MessageKey; value: number; to: string }[] = [
    { key: "ovw.pending.absences", value: o.pending.absenceRequests, to: "/hr/novo/ausencias" },
    { key: "ovw.pending.corrections", value: o.pending.corrections, to: "/hr/novo/assiduidade" },
    { key: "ovw.pending.incidents", value: o.pending.incidents, to: "/hr/novo/assiduidade" },
    { key: "ovw.pending.requests", value: o.pending.customRequests, to: "/hr/novo/tarefas" },
    { key: "ovw.pending.alerts", value: o.pending.alerts, to: "/hr/novo/alertas" },
  ];
  const maxWeek = Math.max(1, ...o.week.map((w) => w.late + w.missing + w.absent));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold capitalize text-stone-900">{longDate(o.date)}</h2>
          <p className="text-xs text-stone-500">{t("ovw.updatedAt", { time: timeIn(o.generatedAt, o.timeZone) })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <IconCalendar size={16} />
            <span className="sr-only">{t("ovw.date")}</span>
            <input type="date" className={FIELD} aria-label={t("ovw.date")} value={o.date} max={o.today} onChange={(e) => setDate(e.target.value && e.target.value !== o.today ? e.target.value : null)} />
          </label>
          {!isToday && (
            <Button size="sm" onClick={() => setDate(null)}>
              {t("ovw.today")}
            </Button>
          )}
          <Button size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
            {t("ovw.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" role="group" aria-label={t("ovw.kpis")}>
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={filter === c.filter}
            onClick={() => setFilter(filter === c.filter ? "all" : c.filter)}
            className={`${SURFACE} p-3 text-left transition hover:border-[#ED5C32]/60 ${filter === c.filter && c.filter !== "all" ? "ring-2 ring-[#ED5C32]/50" : ""}`}
          >
            <p className="text-xs font-medium text-stone-500">{t(c.label)}</p>
            <p className={`mt-1 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
            {c.hint && <p className="mt-0.5 text-[11px] text-stone-500">{c.hint}</p>}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className={`${SURFACE} p-4 xl:col-span-2`} aria-labelledby="ovw-people">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="ovw-people" className={SECTION_TITLE}>
              {t("ovw.people.title")} <span className="font-normal text-stone-500">({people.length})</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">{t("ovw.search")}</span>
                <IconSearch size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
                <input className={`${FIELD} pl-7`} placeholder={t("ovw.search")} aria-label={t("ovw.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <select className={FIELD} aria-label={t("ovw.location")} value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">{t("ovw.allLocations")}</option>
                {o.locations.map((l) => (
                  <option key={l.locationId ?? ""} value={l.locationId ?? ""}>
                    {l.name}
                  </option>
                ))}
              </select>
              {filter !== "all" && (
                <Button size="sm" variant="tertiary" onClick={() => setFilter("all")}>
                  {t("ovw.clearFilter")}
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("ovw.col.person")}</th>
                  <th className={TH}>{t("ovw.col.status")}</th>
                  <th className={TH}>{t("ovw.col.planned")}</th>
                  <th className={TH}>{t("ovw.col.firstIn")}</th>
                  <th className={TH}>{t("ovw.col.worked")}</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.employeeId} className={`${TR} cursor-pointer hover:bg-[#FDF8F5]`} onClick={() => setOpen(p)}>
                    <td className={TD}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={p.name} photoUrl={photoOf(p.employeeId)} size="sm" />
                        <div className="min-w-0">
                          <button type="button" className="text-left font-medium text-stone-900 hover:underline" onClick={() => setOpen(p)}>
                            {p.name}
                          </button>
                          <p className="text-xs text-stone-500">{p.locationName ?? t("ovw.noLocation")}</p>
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge tone={STATUS[p.status].tone}>{t(STATUS[p.status].key)}</StatusBadge>
                        {p.lateMinutes > 0 && <StatusBadge tone="warning">{t("ovw.lateBy", { minutes: p.lateMinutes })}</StatusBadge>}
                      </div>
                      {p.absenceType && <p className="mt-0.5 text-xs text-stone-500">{p.absenceType}</p>}
                    </td>
                    <td className={TD}>{p.plannedStart ? `${p.plannedStart}–${p.plannedEnd ?? "?"}` : "—"}</td>
                    <td className={TD}>{p.firstInAt ? timeIn(p.firstInAt, o.timeZone) : "—"}</td>
                    <td className={TD}>
                      {p.theoreticalSeconds > 0 || p.workedSeconds > 0 ? `${formatDuration(p.workedSeconds)} / ${formatDuration(p.theoreticalSeconds)}` : "—"}
                    </td>
                  </tr>
                ))}
                {people.length === 0 && (
                  <tr>
                    <td className={`${TD} text-center text-stone-500`} colSpan={5}>
                      {t("ovw.people.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          <section className={`${SURFACE} p-4`} aria-labelledby="ovw-pending">
            <h3 id="ovw-pending" className={SECTION_TITLE}>
              {t("ovw.pending.title")}
            </h3>
            <ul className="mt-2 divide-y divide-stone-100">
              {pending.map((x) => (
                <li key={x.key}>
                  <Link to={x.to} className="flex items-center justify-between py-2 text-sm text-stone-700 hover:text-[#C2410C]">
                    <span>{t(x.key)}</span>
                    <span className={`min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${x.value ? "bg-[#ED5C32] text-white" : "bg-stone-100 text-stone-500"}`}>{x.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${SURFACE} p-4`} aria-labelledby="ovw-locations">
            <h3 id="ovw-locations" className={SECTION_TITLE}>
              {t("ovw.locations.title")}
            </h3>
            <table className={`${TABLE} mt-2`}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("ovw.col.location")}</th>
                  <th className={TH}>{t("ovw.col.present")}</th>
                  <th className={TH}>{t("ovw.col.missing")}</th>
                  <th className={TH}>{t("ovw.col.late")}</th>
                </tr>
              </thead>
              <tbody>
                {o.locations.map((l) => (
                  <tr key={l.locationId ?? ""} className={`${TR} cursor-pointer hover:bg-[#FDF8F5]`} onClick={() => setLocation(location === (l.locationId ?? "") ? "" : (l.locationId ?? ""))}>
                    <td className={TD}>{l.name}</td>
                    <td className={TD}>
                      {l.present}/{l.people}
                    </td>
                    <td className={`${TD} ${l.missing ? "font-semibold text-red-700" : ""}`}>{l.missing}</td>
                    <td className={`${TD} ${l.late ? "font-semibold text-amber-700" : ""}`}>{l.late}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={`${SURFACE} p-4`} aria-labelledby="ovw-week">
            <h3 id="ovw-week" className={SECTION_TITLE}>
              {t("ovw.week.title")}
            </h3>
            <div className="mt-3 flex h-28 items-end gap-2">
              {o.week.map((w) => {
                const total = w.late + w.missing + w.absent;
                return (
                  <div key={w.date} className="flex flex-1 flex-col items-center gap-1" title={t("ovw.week.tooltip", { late: w.late, missing: w.missing, absent: w.absent })}>
                    <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-md bg-stone-50">
                      <div className="bg-stone-300" style={{ height: `${(w.absent / maxWeek) * 100}%` }} />
                      <div className="bg-amber-400" style={{ height: `${(w.late / maxWeek) * 100}%` }} />
                      <div className="bg-red-500" style={{ height: `${(w.missing / maxWeek) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-stone-700">{total}</span>
                    <span className="text-[10px] capitalize text-stone-500">{shortDay(w.date)}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-stone-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-red-500" /> {t("ovw.kpi.missing")}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-amber-400" /> {t("ovw.kpi.late")}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-stone-300" /> {t("ovw.kpi.absent")}
              </span>
            </p>
          </section>

          <AnnouncementsWidget />

          {o.holidays.length > 0 && (
            <section className={`${SURFACE} p-4`} aria-labelledby="ovw-holidays">
              <h3 id="ovw-holidays" className={SECTION_TITLE}>
                {t("ovw.holidays.title")}
              </h3>
              <ul className="mt-2 space-y-2">
                {o.holidays.map((h) => (
                  <li key={h.date} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-xs font-medium capitalize text-[#C2410C]">{shortDay(h.date)}</span>
                    <span className="text-stone-700">{h.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {open && <PersonDayDrawer person={open} date={o.date} timeZone={o.timeZone} onClose={() => setOpen(null)} />}
    </div>
  );
}

/**
 * FE-010: últimos 3 comunicados publicados com a taxa de confirmação. Tem a
 * sua própria consulta: se falhar (ex.: sem permissão), o widget não aparece
 * e o resto do painel não é afetado.
 */
function AnnouncementsWidget() {
  const { t } = useI18n();
  const { announcements } = useNovoRh();
  const q = useQuery({ queryKey: ["novo-rh", "announcements"], queryFn: () => announcements.list() });
  if (q.isError || !q.data) return null;
  const recent = q.data
    .filter((a) => a.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 3);
  return (
    <section className={`${SURFACE} p-4`} aria-labelledby="ovw-announcements">
      <div className="flex items-center justify-between">
        <h3 id="ovw-announcements" className={SECTION_TITLE}>
          {t("ovw.ann.title")}
        </h3>
        <Link to="/hr/novo/comunicados" className="text-xs font-medium text-[#C2410C] hover:underline">
          {t("ovw.ann.all")}
        </Link>
      </div>
      {recent.length === 0 && <p className="mt-2 text-sm text-stone-500">{t("ovw.ann.none")}</p>}
      <ul className="mt-2 space-y-2">
        {recent.map((a) => (
          <li key={a.id} className="text-sm">
            <span className="block truncate font-medium text-stone-800">{a.title}</span>
            <span className="text-xs text-stone-500">
              {a.publishedAt ? shortDay(a.publishedAt.slice(0, 10)) : ""}
              {a.stats && ` · ${a.requiresConfirmation ? t("ovw.ann.confirmed", { done: a.stats.confirmed, total: a.stats.recipients }) : t("ovw.ann.read", { done: a.stats.read, total: a.stats.recipients })}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
