import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import {
  Button,
  IconChevronLeft,
  IconChevronRight,
  SECTION_TITLE,
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
} from "../../../domain/services/person-stats.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import type { Person } from "../../../domain/entities/people.ts";
import { useDataMode, useNovoRh } from "../../../novo-rh.module.tsx";
import { DemoAccessNotice } from "../DemoMode.tsx";

const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1 + n, 1)).toISOString().slice(0, 7);
};
const lastDay = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, "0")}`;
};
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
/** Ficha → Estatísticas (FE-023): o mês do colaborador — trabalhado vs. previsto, faltas, atrasos, horários médios, ausências. */
export function PersonStatsTab({ personId }: { personId: string }) {
  const { t } = useI18n();
  const { attendance, absences } = useNovoRh();
  const today = todayIn();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const from = `${month}-01`;
  const to = lastDay(month) < today ? lastDay(month) : today;
  const future = from > today;
  const q = useQuery({
    queryKey: ["novo-rh", "attendance", "days", personId, { from, to }],
    queryFn: () => attendance.days(personId, from, to),
    enabled: !future,
  });
  const abs = useQuery({
    queryKey: ["novo-rh", "absences", "requests", "approved", personId, month],
    queryFn: () =>
      absences.listRequests({
        employeeId: personId,
        status: "approved",
        from,
        to: lastDay(month),
      }),
  });
  const s = q.data ? monthStats(q.data) : null;
  const byType = new Map<string, { amount: number; unit: string }>();
  for (const r of abs.data ?? []) {
    const cur = byType.get(r.typeName) ?? { amount: 0, unit: r.unit };
    byType.set(r.typeName, { amount: cur.amount + r.amount, unit: r.unit });
  }
  const card = (label: string, value: string, tone = "text-stone-900") => (
    <div className="rounded-lg border border-[#F5C992]/40 p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );

  return (
    <section className={`${SURFACE} space-y-4 p-4`}>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          aria-label={t("abs.cal.prev")}
          icon={<IconChevronLeft size={14} />}
          onClick={() => setMonth(shiftMonth(month, -1))}
        />
        <span className="min-w-[140px] text-center text-sm font-semibold capitalize text-stone-900">
          {monthLabel(month)}
        </span>
        <Button
          size="sm"
          aria-label={t("abs.cal.next")}
          icon={<IconChevronRight size={14} />}
          disabled={month >= today.slice(0, 7)}
          onClick={() => setMonth(shiftMonth(month, 1))}
        />
      </div>
      {q.isError && <p className="text-sm text-red-700">{q.error.message}</p>}
      {q.isLoading && (
        <p className="text-sm text-stone-400">{t("common.loading")}</p>
      )}
      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {card(
              t("people.stats.worked"),
              `${formatDuration(s.worked)} / ${formatDuration(s.theoretical)}`,
            )}
            {card(
              t("people.stats.balance"),
              formatDuration(s.worked - s.theoretical),
              s.worked - s.theoretical < 0
                ? "text-red-700"
                : "text-emerald-700",
            )}
            {card(
              t("people.stats.days"),
              t("people.stats.daysValue", {
                worked: s.workedDays,
                scheduled: s.scheduledDays,
              }),
            )}
            {card(
              t("people.stats.missing"),
              String(s.missing),
              s.missing ? "text-red-700" : "text-stone-900",
            )}
            {card(
              t("people.stats.late"),
              String(s.late),
              s.late ? "text-amber-700" : "text-stone-900",
            )}
            {card(t("people.stats.forgotten"), String(s.forgotten))}
            {card(t("people.stats.avgInOut"), `${s.avgIn} – ${s.avgOut}`)}
            {card(t("people.stats.avgBreak"), formatDuration(s.avgBreak))}
          </div>
          <div>
            <h4 className={SECTION_TITLE}>{t("people.stats.daysStrip")}</h4>
            <div className="mt-2 flex flex-wrap gap-1">
              {q.data!.days.map((d) => {
                const tone = d.incidents.includes("missing_in")
                  ? "bg-red-500"
                  : d.incidents.includes("late")
                    ? "bg-amber-400"
                    : d.workedSeconds > 0
                      ? "bg-emerald-500"
                      : d.theoreticalSeconds > 0
                        ? "bg-stone-300"
                        : "bg-stone-100";
                return (
                  <span
                    key={d.workDate}
                    className={`h-6 w-6 rounded-sm text-center text-[10px] leading-6 text-white ${tone}`}
                    title={`${d.workDate}: ${formatDuration(d.workedSeconds)} / ${formatDuration(d.theoreticalSeconds)}`}
                  >
                    {Number(d.workDate.slice(8))}
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}
      <div>
        <h4 className={SECTION_TITLE}>{t("people.stats.absences")}</h4>
        {byType.size === 0 ? (
          <p className="mt-1 text-sm text-stone-500">
            {t("people.stats.noAbsences")}
          </p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-stone-700">
            {[...byType].map(([name, v]) => (
              <li key={name}>
                {name}: {v.amount}{" "}
                {v.unit === "days"
                  ? t("people.stats.unitDays")
                  : t("people.stats.unitHours")}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
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
