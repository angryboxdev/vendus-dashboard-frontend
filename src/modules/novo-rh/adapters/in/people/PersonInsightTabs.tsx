import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import {
  SECTION_TITLE,
  SegmentedControl,
  SURFACE,
  TABLE,
  TD,
  TH,
  THEAD,
  TR,
} from "../../../../../components/ui/index.ts";
import { formatDuration } from "../../../domain/services/attendance.service.ts";
import {
  auditChangedFields,
  fieldHistory,
  monthStats,
  statsNotes,
} from "../../../domain/services/person-stats.service.ts";
import { percent, statsBuckets, statsRange, type StatsPreset } from "../../../domain/services/person-overview.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { PersonStatsChart } from "./PersonStatsChart.tsx";
import type { Person } from "../../../domain/entities/people.ts";
import { useDataMode, useNovoRh } from "../../../novo-rh.module.tsx";
import { DemoAccessNotice } from "../DemoMode.tsx";

/**
 * Ficha → Estatísticas (FE-023, redesign premium): o resumo do colaborador num
 * período (este mês, últimos 3 meses, este ano) — trabalhado vs. programado,
 * dias feitos vs. programados, faltas, atrasos, horários médios, barras por
 * dia/semana/mês e ausências aprovadas. Números do apuramento (RE-6), só somados.
 */
export function PersonStatsTab({ personId }: { personId: string }) {
  const { t } = useI18n();
  const { attendance, absences } = useNovoRh();
  const today = todayIn();
  const [preset, setPreset] = useState<StatsPreset>("month");
  const { from, to, bucket } = statsRange(preset, today);
  const q = useQuery({
    queryKey: ["novo-rh", "attendance", "days", personId, { from, to }],
    queryFn: () => attendance.days(personId, from, to),
  });
  const abs = useQuery({
    queryKey: ["novo-rh", "absences", "requests", "approved", personId, from, to],
    queryFn: () => absences.listRequests({ employeeId: personId, status: "approved", from, to }),
  });
  const s = q.data ? monthStats(q.data) : null;
  const notes = q.data ? statsNotes(q.data) : null;
  const buckets = q.data ? statsBuckets(q.data, bucket) : [];
  const byType = new Map<string, { amount: number; unit: string; color: string | null }>();
  for (const r of abs.data ?? []) {
    const cur = byType.get(r.typeName) ?? { amount: 0, unit: r.unit, color: r.typeColor };
    byType.set(r.typeName, { ...cur, amount: cur.amount + r.amount });
  }
  const range = `${from.slice(8)}/${from.slice(5, 7)}/${from.slice(0, 4)} – ${to.slice(8)}/${to.slice(5, 7)}/${to.slice(0, 4)}`;

  const tile = (label: string, value: string, opts: { tone?: string; sub?: string; meter?: number } = {}) => (
    <div className={`${SURFACE} p-4`}>
      <p className="text-xs font-medium text-ink-secondary">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${opts.tone ?? "text-navy-900"}`}>{value}</p>
      {opts.meter !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, opts.meter)}%` }} />
        </div>
      )}
      {opts.sub && <p className="mt-1.5 text-xs text-ink-secondary">{opts.sub}</p>}
    </div>
  );
  const balance = s ? s.worked - s.theoretical : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<StatsPreset>
          label={t("stats.period")}
          value={preset}
          onChange={setPreset}
          items={[
            { key: "month", label: t("stats.preset.month") },
            { key: "quarter", label: t("stats.preset.quarter") },
            { key: "year", label: t("stats.preset.year") },
          ]}
        />
        <span className="text-sm tabular-nums text-ink-secondary">{range}</span>
      </div>
      {q.isError && <p className="text-sm text-red-700">{q.error.message}</p>}
      {q.isLoading && <p className="text-sm text-stone-400">{t("common.loading")}</p>}
      {s && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tile(t("stats.worked"), formatDuration(s.worked), { meter: percent(s.worked, s.theoretical), sub: t("stats.compliance", { pct: percent(s.worked, s.theoretical) }) })}
            {tile(t("stats.theoretical"), formatDuration(s.theoretical), { sub: t("stats.ofDays", { count: s.scheduledDays }) })}
            {tile(t("stats.balance"), `${balance > 0 ? "+" : ""}${formatDuration(balance)}`, { tone: balance < 0 ? "text-red-700" : "text-emerald-700" })}
            {tile(t("stats.days"), `${s.workedDays} / ${s.scheduledDays}`, { meter: percent(s.workedDays, s.scheduledDays), sub: t("stats.daysPct", { pct: percent(s.workedDays, s.scheduledDays) }) })}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {tile(t("stats.missing"), String(s.missing), { tone: s.missing ? "text-red-700" : "text-navy-900" })}
            {tile(t("stats.late"), String(s.late), { tone: s.late ? "text-amber-700" : "text-navy-900" })}
            {tile(t("stats.forgotten"), String(s.forgotten))}
            {tile(t("stats.avgInOut"), `${s.avgIn} – ${s.avgOut}`)}
            {tile(t("stats.avgBreak"), formatDuration(s.avgBreak))}
          </div>
          {notes && (notes.noSchedule || notes.openBreakDays > 0) && (
            <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" aria-label={t("people.stats.notes")}>
              {notes.noSchedule && <li>{t("stats.note.noSchedule")}</li>}
              {notes.openBreakDays > 0 && <li>{t("people.stats.note.openBreaks", { count: notes.openBreakDays })}</li>}
            </ul>
          )}
          <section className={`${SURFACE} p-4 sm:p-5`} aria-labelledby="stats-chart">
            <h3 id="stats-chart" className="mb-3 text-base font-semibold text-navy-900">
              {t("stats.chart")}
            </h3>
            <PersonStatsChart buckets={buckets} />
          </section>
        </>
      )}
      <section className={`${SURFACE} p-4 sm:p-5`} aria-labelledby="stats-abs">
        <h3 id="stats-abs" className="text-base font-semibold text-navy-900">
          {t("stats.absences")}
        </h3>
        {byType.size === 0 ? (
          <p className="mt-1 text-sm text-ink-secondary">{t("stats.noAbsences")}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm text-ink">
            {[...byType].map(([name, v]) => (
              <li key={name} className="flex items-center gap-2 rounded-xl bg-surface-soft px-3 py-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.color ?? "#2563EB" }} />
                {name}: <span className="font-semibold tabular-nums">{v.amount}</span> {v.unit === "days" ? t("people.stats.unitDays") : t("people.stats.unitHours")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Ficha → Histórico (FE-014): quem alterou o quê e quando, com o motivo (auditoria append-only). */
export function PersonHistoryTab({ personId }: { personId: string }) {
  const { t } = useI18n();
  const { audit } = useNovoRh();
  const q = useQuery({
    queryKey: ["novo-rh", "audit", "person", personId],
    queryFn: () => audit.list({ resourceId: personId }),
  });
  return (
    <section className={`${SURFACE} space-y-2 p-4`}>
      <p className="text-xs text-stone-500">{t("people.history.hint")}</p>
      {q.isError && <p className="text-sm text-red-700">{q.error.message}</p>}
      {q.data && q.data.length === 0 && (
        <p className="text-sm text-stone-500">{t("people.history.empty")}</p>
      )}
      {q.data && q.data.length > 0 && (
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("people.history.when")}</th>
              <th className={TH}>{t("people.history.who")}</th>
              <th className={TH}>{t("people.history.what")}</th>
              <th className={TH}>{t("people.history.reason")}</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((e) => {
              const fields = auditChangedFields(e.before, e.after);
              return (
                <tr key={e.id} className={TR}>
                  <td className={`${TD} whitespace-nowrap`}>
                    {new Date(e.occurredAt).toLocaleString("pt-PT")}
                  </td>
                  <td className={TD}>{e.actor}</td>
                  <td className={TD}>
                    <span className="font-mono text-xs text-stone-700">
                      {e.action}
                    </span>
                    {fields.length > 0 && (
                      <span className="block text-xs text-stone-500">
                        {t("people.history.fields", {
                          fields: fields.slice(0, 8).join(", "),
                        })}
                      </span>
                    )}
                  </td>
                  <td className={TD}>{e.reason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Ficha → Acesso (FE-016): conta ligada, perfil e âmbitos. Gerir faz-se em Utilizadores/Acessos (contas reais). */
export function PersonAccessTab({ person }: { person: Person }) {
  const { t } = useI18n();
  const { access } = useNovoRh();
  const { mode } = useDataMode();
  const users = useQuery({ queryKey: ["novo-rh", "access", "users"], queryFn: () => access.listUsers(), enabled: mode === "real" && !!person.userId });
  const profiles = useQuery({ queryKey: ["novo-rh", "access", "profiles"], queryFn: () => access.listProfiles(), enabled: mode === "real" && !!person.userId });
  const scopes = useQuery({ queryKey: ["novo-rh", "access", "scopes", person.userId], queryFn: () => access.listScopes(person.userId!), enabled: mode === "real" && !!person.userId });
  if (mode === "demo") return <DemoAccessNotice />;
  const user = users.data?.find((u) => u.userId === person.userId);
  const profile = profiles.data?.find((p) => p.id === user?.profileId);
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      {!person.userId ? (
        <>
          <p className="text-sm text-stone-700">{t("people.access.none")}</p>
          <Link to="/admin/users" className="text-sm font-medium text-[#C2410C] hover:underline">
            {t("people.access.manage")} →
          </Link>
        </>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-stone-500">{t("people.access.account")}</dt>
              <dd className="font-medium text-stone-900">{user?.label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{t("people.access.profile")}</dt>
              <dd className="font-medium text-stone-900">{profile?.name ?? "—"}</dd>
            </div>
          </dl>
          <div>
            <h4 className={SECTION_TITLE}>{t("people.access.scopes")}</h4>
            {(scopes.data ?? []).length === 0 ? (
              <p className="mt-1 text-sm text-stone-500">{t("people.access.noScopes")}</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-stone-700">
                {scopes.data!.map((s) => (
                  <li key={s.id}>
                    {t(`people.access.scope.${s.scopeType}` as MessageKey)} · {s.validFrom}
                    {s.validTo ? ` → ${s.validTo}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to={`/admin/users/${person.userId}`} className="font-medium text-[#C2410C] hover:underline">
              {t("people.access.editUser")} →
            </Link>
            <Link to="/hr/novo/acessos" className="font-medium text-[#C2410C] hover:underline">
              {t("people.access.openAccess")} →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Históricos de cargo e de salário (FE-015, FE-018) a partir da auditoria da
 * ficha — só os campos que a pessoa que vê pode ver (privacidade por campo).
 */
export function PersonFieldHistory({ person, field, title }: { person: Person; field: "positionId" | "baseSalary"; title: string }) {
  const { t } = useI18n();
  const { audit, people } = useNovoRh();
  const q = useQuery({ queryKey: ["novo-rh", "audit", "person", person.id], queryFn: () => audit.list({ resourceId: person.id }) });
  const positions = useQuery({ queryKey: ["novo-rh", "catalog", "positions"], queryFn: () => people.listPositions(), enabled: field === "positionId" });
  // Sem acesso à auditoria (ou campo escondido) não se mostra o histórico.
  if (person.hidden.includes(field) || q.isError) return null;
  const rows = fieldHistory(q.data ?? [], field);
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : field === "positionId" ? (positions.data?.find((p) => p.id === v)?.name ?? String(v)) : `${String(v)} ${person.currency}`);
  return (
    <section className={`${SURFACE} space-y-2 p-4`}>
      <h4 className={SECTION_TITLE}>{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">{t("people.history.noChanges")}</p>
      ) : (
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("people.history.when")}</th>
              <th className={TH}>{t("people.history.from")}</th>
              <th className={TH}>{t("people.history.to")}</th>
              <th className={TH}>{t("people.history.who")}</th>
              <th className={TH}>{t("people.history.reason")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={TR}>
                <td className={`${TD} whitespace-nowrap`}>{new Date(r.at).toLocaleDateString("pt-PT")}</td>
                <td className={TD}>{show(r.from)}</td>
                <td className={`${TD} font-medium`}>{show(r.to)}</td>
                <td className={TD}>{r.actor}</td>
                <td className={TD}>{r.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
