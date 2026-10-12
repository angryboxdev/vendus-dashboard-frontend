import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, Drawer, FIELD, IconChevronLeft, IconChevronRight, IconPlus, LABEL, SURFACE } from "../../../../../components/ui/index.ts";
import type { AbsenceRequest } from "../../../domain/entities/absences.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const monthOf = (date: string) => date.slice(0, 7);
const daysIn = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
};
const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const weekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
const monthLabel = (month: string) => new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

/**
 * Ausências → Calendário (FE-035): o mês da empresa — quem está ausente em
 * cada dia (aprovado ou pendente), feriados — e atribuir a mesma ausência a
 * várias pessoas de uma vez (cada uma passa pelas regras do servidor).
 */
export function CalendarPanel() {
  const { t } = useI18n();
  const { absences, settings, time } = useNovoRh();
  const [month, setMonth] = useState(() => monthOf(todayIn()));
  const [search, setSearch] = useState("");
  const [onlyWith, setOnlyWith] = useState(false);
  const [bulk, setBulk] = useState(false);
  const days = daysIn(month);
  const from = days[0]!;
  const to = days.at(-1)!;
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const requests = useQuery({ queryKey: ["novo-rh", "absences", "calendar", month], queryFn: () => absences.listRequests({ from, to }) });
  const holidays = useQuery({ queryKey: ["novo-rh", "time", "holiday-calendars"], queryFn: () => time.listHolidayCalendars() });

  const holidayOn = new Map<string, string>();
  for (const c of holidays.data ?? []) for (const d of c.days) if (d.date >= from && d.date <= to && !holidayOn.has(d.date)) holidayOn.set(d.date, d.name);
  const active = (requests.data ?? []).filter((r) => r.status === "approved" || r.status === "pending");
  const byPerson = new Map<string, AbsenceRequest[]>();
  for (const r of active) byPerson.set(r.employeeId, [...(byPerson.get(r.employeeId) ?? []), r]);
  const people = (employees.data ?? []).filter((e) => (!search || e.label.toLowerCase().includes(search.toLowerCase())) && (!onlyWith || byPerson.has(e.id)));
  const absentOn = (date: string) => active.filter((r) => r.startDate <= date && r.endDate >= date).length;

  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("abs.tab.calendar")}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" aria-label={t("abs.cal.prev")} icon={<IconChevronLeft size={14} />} onClick={() => setMonth(shiftMonth(month, -1))} />
        <span className="min-w-[140px] text-center text-sm font-semibold capitalize text-stone-900">{monthLabel(month)}</span>
        <Button size="sm" aria-label={t("abs.cal.next")} icon={<IconChevronRight size={14} />} onClick={() => setMonth(shiftMonth(month, 1))} />
        <input aria-label={t("inbox.search")} placeholder={t("inbox.search")} className={FIELD} value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={onlyWith} onChange={(e) => setOnlyWith(e.target.checked)} />
          {t("abs.cal.onlyWith")}
        </label>
        <Button size="sm" variant="primary" className="ml-auto" icon={<IconPlus size={14} />} onClick={() => setBulk(true)}>
          {t("abs.cal.bulk")}
        </Button>
      </div>
      {(requests.isError || employees.isError) && <p className="text-sm text-red-700">{(requests.error ?? employees.error)?.message}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-semibold text-stone-600">{t("common.employee")}</th>
              {days.map((d) => (
                <th key={d} title={holidayOn.get(d)} className={`w-7 px-0.5 py-1 text-center font-medium ${holidayOn.has(d) ? "bg-violet-50 text-violet-800" : weekend(d) ? "bg-stone-50 text-stone-400" : "text-stone-600"}`}>
                  {Number(d.slice(8))}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 pb-1 text-left text-[10px] font-normal text-stone-500">{t("abs.cal.absentPerDay")}</th>
              {days.map((d) => (
                <th key={d} className="px-0.5 pb-1 text-center text-[10px] font-normal text-stone-500">
                  {absentOn(d) || ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((e) => {
              const reqs = byPerson.get(e.id) ?? [];
              return (
                <tr key={e.id} className="border-t border-stone-100">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-stone-900">{e.label}</td>
                  {days.map((d) => {
                    const r = reqs.find((x) => x.startDate <= d && x.endDate >= d);
                    const color = r?.typeColor ?? "#ED5C32";
                    return (
                      <td key={d} className={`h-7 px-0.5 ${holidayOn.has(d) ? "bg-violet-50/60" : weekend(d) ? "bg-stone-50" : ""}`}>
                        {r && (
                          <span
                            className={`block h-5 rounded-sm ${r.status === "pending" ? "border-2 border-dashed" : ""}`}
                            style={r.status === "pending" ? { borderColor: color } : { backgroundColor: color }}
                            title={`${r.typeName} · ${t(`abs.status.${r.status}` as MessageKey)}`}
                            aria-label={`${e.label} ${d}: ${r.typeName} (${t(`abs.status.${r.status}` as MessageKey)})`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-3 text-[11px] text-stone-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#ED5C32]" /> {t("abs.status.approved")}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border-2 border-dashed border-[#ED5C32]" /> {t("abs.status.pending")}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-violet-100" /> {t("abs.cal.holiday")}
        </span>
      </p>
      {bulk && <BulkAssignDrawer employees={employees.data ?? []} defaultDate={from > todayIn() ? from : todayIn()} onClose={() => setBulk(false)} />}
    </section>
  );
}

/** Atribuir a mesma ausência a várias pessoas; o resultado vem por pessoa (saldo, sobreposição, período fechado…). */
function BulkAssignDrawer({ employees, defaultDate, onClose }: { employees: { id: string; label: string }[]; defaultDate: string; onClose: () => void }) {
  const { t } = useI18n();
  const { absences } = useNovoRh();
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ["novo-rh", "absences", "types"], queryFn: () => absences.listTypes() });
  const [typeId, setTypeId] = useState("");
  const [start, setStart] = useState(defaultDate);
  const [end, setEnd] = useState(defaultDate);
  const [comment, setComment] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<{ id: string; ok: boolean; message?: string }[] | null>(null);
  const visible = employees.filter((e) => !search || e.label.toLowerCase().includes(search.toLowerCase()));
  const type = (types.data ?? []).find((x) => x.id === typeId);
  const m = useMutation({
    mutationFn: async () => {
      const out: { id: string; ok: boolean; message?: string }[] = [];
      for (const id of picked) {
        try {
          await absences.assign(id, { typeId, startDate: start, endDate: end, startTime: null, endTime: null, halfDay: false, comment: comment.trim() || null });
          out.push({ id, ok: true });
        } catch (e) {
          out.push({ id, ok: false, message: e instanceof Error ? e.message : String(e) });
        }
      }
      return out;
    },
    onSuccess: (out) => {
      void qc.invalidateQueries({ queryKey: ["novo-rh", "absences"] });
      setResults(out);
    },
  });
  const name = (id: string) => employees.find((e) => e.id === id)?.label ?? id;
  const invalid = !typeId || !start || !end || end < start || picked.size === 0 || type?.unit === "hours";

  return (
    <Drawer
      open
      title={t("abs.cal.bulk")}
      description={t("abs.cal.bulkHint")}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="tertiary" onClick={onClose}>
            {results ? t("common.close") : t("common.cancel")}
          </Button>
          {!results && (
            <Button variant="primary" disabled={invalid || m.isPending} onClick={() => m.mutate()}>
              {m.isPending ? t("abs.cal.assigning") : t("abs.cal.assignN", { count: picked.size })}
            </Button>
          )}
        </div>
      }
    >
      {results ? (
        <AlertBanner tone={results.every((r) => r.ok) ? "success" : "warning"} title={t("abs.cal.result", { ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length })}>
          <ul className="mt-1 list-disc pl-4">
            {results
              .filter((r) => !r.ok)
              .map((r) => (
                <li key={r.id}>
                  {name(r.id)}: {r.message}
                </li>
              ))}
          </ul>
        </AlertBanner>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={LABEL} htmlFor="bulk-type">
              {t("abs.field.type")}
            </label>
            <select id="bulk-type" className={`${FIELD} w-full`} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">…</option>
              {(types.data ?? [])
                .filter((x) => !x.archived)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
            {type?.unit === "hours" && <p className="mt-1 text-xs text-amber-700">{t("abs.cal.hoursNotSupported")}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL} htmlFor="bulk-start">
                {t("abs.field.start")}
              </label>
              <input id="bulk-start" type="date" className={`${FIELD} w-full`} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="bulk-end">
                {t("abs.field.end")}
              </label>
              <input id="bulk-end" type="date" className={`${FIELD} w-full`} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="bulk-comment">
              {t("abs.field.comment")}
            </label>
            <input id="bulk-comment" className={`${FIELD} w-full`} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className={LABEL}>{t("abs.cal.people", { count: picked.size })}</span>
              <button type="button" className="text-xs text-[#C2410C] hover:underline" onClick={() => setPicked(picked.size === visible.length ? new Set() : new Set(visible.map((e) => e.id)))}>
                {picked.size === visible.length ? t("abs.cal.none") : t("abs.cal.all")}
              </button>
            </div>
            <input aria-label={t("inbox.search")} placeholder={t("inbox.search")} className={`${FIELD} mb-2 w-full`} value={search} onChange={(e) => setSearch(e.target.value)} />
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded border border-stone-200 p-2">
              {visible.map((e) => (
                <li key={e.id}>
                  <label className="flex items-center gap-2 text-sm text-stone-800">
                    <input type="checkbox" checked={picked.has(e.id)} onChange={() => setPicked((s) => (s.has(e.id) ? new Set([...s].filter((x) => x !== e.id)) : new Set([...s, e.id])))} />
                    {e.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {m.isError && <p className="text-sm text-red-700">{m.error.message}</p>}
        </div>
      )}
    </Drawer>
  );
}
