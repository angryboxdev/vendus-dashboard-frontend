import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, LABEL, SECTION_TITLE, SURFACE, TABLE, TD, TH, THEAD, TR, Tabs } from "../../../../../components/ui/index.ts";
import type { TimeBankLedger } from "../../../domain/entities/time-bank.ts";
import { clampCompensation, formatBank, parseHhMm, toHhMm } from "../../../domain/services/time-bank.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "time-bank"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Novo RH → Banco de horas (Fase 6). */
export function TimeBankView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"all" | "ledger" | "categories">("all");
  const [picked, setPicked] = useState("");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "all", label: t("tb.tab.all") },
          { key: "ledger", label: t("tb.tab.ledger") },
          { key: "categories", label: t("tb.tab.categories") },
        ]}
      />
      {tab === "all" && <BalancesPanel onOpen={(id) => (setPicked(id), setTab("ledger"))} />}
      {tab === "ledger" && <LedgerPanel key={picked} initialEmployeeId={picked} />}
      {tab === "categories" && <CategoriesPanel />}
    </div>
  );
}

/** Saldos de todos os colaboradores (FE-034), até ao último apuramento; abrir a pessoa sincroniza. */
function BalancesPanel({ onOpen }: { onOpen: (employeeId: string) => void }) {
  const { t } = useI18n();
  const { timeBank } = useNovoRh();
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState<"name" | "balance_desc" | "balance_asc">("balance_desc");
  const q = useQuery({ queryKey: [...KEY, "balances"], queryFn: () => timeBank.balances() });
  const all = q.data ?? [];
  const locations = [...new Set(all.map((b) => b.locationName).filter((x): x is string => !!x))].sort();
  const rows = all
    .filter((b) => (!search || b.name.toLowerCase().includes(search.toLowerCase())) && (!location || b.locationName === location))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "pt") : sort === "balance_desc" ? b.balance - a.balance : a.balance - b.balance));
  const total = rows.reduce((s, b) => s + b.balance, 0);
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label={t("tb.all.search")} placeholder={t("tb.all.search")} className={FIELD} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label={t("ovw.location")} className={FIELD} value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">{t("ovw.allLocations")}</option>
          {locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select aria-label={t("tb.all.sort")} className={FIELD} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="balance_desc">{t("tb.all.sort.desc")}</option>
          <option value="balance_asc">{t("tb.all.sort.asc")}</option>
          <option value="name">{t("tb.all.sort.name")}</option>
        </select>
        <span className="ml-auto text-sm text-stone-700">{t("tb.all.total", { total: formatBank(total) })}</span>
      </div>
      <p className="text-xs text-stone-500">{t("tb.all.hint")}</p>
      {q.isError && <p className="text-sm text-red-700">{message(q.error, t("common.loadError"))}</p>}
      {q.isLoading && <p className="text-sm text-stone-400">{t("common.loading")}</p>}
      {rows.length > 0 && (
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("common.employee")}</th>
              <th className={TH}>{t("ovw.location")}</th>
              <th className={TH}>{t("tb.all.generated")}</th>
              <th className={TH}>{t("tb.all.rest")}</th>
              <th className={TH}>{t("tb.all.paid")}</th>
              <th className={TH}>{t("tb.all.balance")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.employeeId} className={`${TR} cursor-pointer hover:bg-[#FDF8F5]`} onClick={() => onOpen(b.employeeId)}>
                <td className={TD}>
                  <button type="button" className="font-medium text-stone-900 hover:underline" onClick={() => onOpen(b.employeeId)}>
                    {b.name}
                  </button>
                </td>
                <td className={TD}>{b.locationName ?? "—"}</td>
                <td className={TD}>{formatBank(b.generated)}</td>
                <td className={TD}>{formatBank(b.compensatedRest)}</td>
                <td className={TD}>{formatBank(b.compensatedPaid)}</td>
                <td className={`${TD} font-semibold ${b.balance < 0 ? "text-red-700" : b.balance > 0 ? "text-emerald-700" : "text-stone-700"}`}>{formatBank(b.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function LedgerPanel({ initialEmployeeId = "" }: { initialEmployeeId?: string }) {
  const { t } = useI18n();
  const { timeBank, settings } = useNovoRh();
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const q = useQuery({ queryKey: [...KEY, employeeId], queryFn: () => timeBank.ledger(employeeId), enabled: !!employeeId });
  const sync = useMutation({ mutationFn: () => timeBank.sync(employeeId), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const l = q.data;
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <p className="text-xs text-stone-500">{t("tb.hint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={t("common.employee")} className={`${FIELD} min-w-[220px]`} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">{t("common.employee")}…</option>
          {(employees.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {employeeId && (
          <Button size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>
            {t("tb.sync")}
          </Button>
        )}
        {sync.data && <span className="text-xs text-stone-500">{t("tb.sync.done", { count: sync.data.posted })}</span>}
      </div>
      {q.isError && <p className="text-sm text-red-700">{message(q.error, t("common.loadError"))}</p>}
      {l && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["tb.kpi.balance", l.balance],
                ["tb.kpi.rest", l.compensatedRest],
                ["tb.kpi.paid", l.compensatedPaid],
                ["tb.kpi.expired", l.expired],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-md border border-stone-200 p-2">
                <dt className="text-xs text-stone-500">{t(k)}</dt>
                <dd className="font-mono text-sm font-semibold text-stone-900">{formatBank(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-stone-500">{t("tb.cutoff", { date: l.cutoff })}</p>
          {l.pendingValidation.length > 0 && <Validations employeeId={employeeId} rows={l.pendingValidation} />}
          <Compensate employeeId={employeeId} ledger={l} />
          <Adjust employeeId={employeeId} />
          <div className="max-h-[420px] overflow-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("common.date")}</th>
                  <th className={TH}>{t("tb.col.kind")}</th>
                  <th className={TH}>{t("tb.col.seconds")}</th>
                  <th className={TH}>{t("tb.col.running")}</th>
                  <th className={TH}>{t("tb.col.reason")}</th>
                </tr>
              </thead>
              <tbody>
                {l.entries.map((e) => (
                  <tr key={e.id} className={TR}>
                    <td className={TD}>
                      {e.workDate}
                      {e.postedOn !== e.workDate && <span className="block text-xs text-stone-500">{t("tb.postedOn", { date: e.postedOn })}</span>}
                    </td>
                    <td className={TD}>{t(`tb.kind.${e.kind}` as MessageKey)}</td>
                    <td className={`${TD} font-mono`}>{formatBank(e.seconds)}</td>
                    <td className={`${TD} font-mono font-semibold`}>{formatBank(e.running)}</td>
                    <td className={TD}>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Validations({ employeeId, rows }: { employeeId: string; rows: TimeBankLedger["pendingValidation"] }) {
  const { t } = useI18n();
  const { timeBank } = useNovoRh();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const m = useMutation({
    mutationFn: (v: { workDate: string; decision: "approve" | "reject" }) => timeBank.decideValidation(employeeId, v.workDate, v.decision, comment.trim() || null),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/50 p-3">
      <h3 className={SECTION_TITLE}>{t("tb.validations.title")}</h3>
      <input aria-label={t("tb.field.reason")} className={`${FIELD} w-full max-w-sm`} placeholder={t("tb.field.reason")} value={comment} onChange={(e) => setComment(e.target.value)} />
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.workDate} className="flex flex-wrap items-center gap-2">
            <span>{t("tb.validations.row", { date: r.workDate, seconds: formatBank(r.excessSeconds) })}</span>
            <Button size="sm" variant="primary" disabled={m.isPending} aria-label={`${t("tb.validate")} ${r.workDate}`} onClick={() => m.mutate({ workDate: r.workDate, decision: "approve" })}>
              {t("tb.validate")}
            </Button>
            <Button size="sm" disabled={m.isPending || !comment.trim()} aria-label={`${t("tb.reject")} ${r.workDate}`} onClick={() => m.mutate({ workDate: r.workDate, decision: "reject" })}>
              {t("tb.reject")}
            </Button>
          </li>
        ))}
      </ul>
      {m.isError && <p className="text-xs text-red-700">{message(m.error, t("common.error"))}</p>}
    </div>
  );
}

/** F-06.2 / RE-28: o campo nunca passa do disponível (salvo política). */
function Compensate({ employeeId, ledger }: { employeeId: string; ledger: TimeBankLedger }) {
  const { t } = useI18n();
  const { timeBank } = useNovoRh();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"rest" | "paid">("rest");
  const [hours, setHours] = useState("");
  const [month, setMonth] = useState("");
  const [reason, setReason] = useState("");
  const seconds = parseHhMm(hours);
  const m = useMutation({
    mutationFn: () => timeBank.compensate(employeeId, { mode, seconds: seconds!, paymentMonth: mode === "paid" ? month : null, reason }),
    onSuccess: async () => {
      setHours("");
      setReason("");
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const onHours = (text: string) => {
    const s = parseHhMm(text);
    setHours(s === null ? text : toHhMm(clampCompensation(s, ledger.available, ledger.compensateBeyondBalance)));
  };
  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label={t("tb.compensate")}>
      <fieldset className="flex items-center gap-3 pb-2 text-sm text-stone-700">
        <legend className="sr-only">{t("tb.compensate.mode")}</legend>
        <label className="flex items-center gap-1">
          <input type="radio" name="tb-mode" checked={mode === "rest"} onChange={() => setMode("rest")} />
          {t("tb.compensate.rest")}
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name="tb-mode" checked={mode === "paid"} onChange={() => setMode("paid")} />
          {t("tb.compensate.paid")}
        </label>
      </fieldset>
      <label>
        <span className={LABEL}>
          {t("tb.compensate.hours")} · {t("tb.compensate.max", { max: toHhMm(ledger.available) })}
        </span>
        <input className={`${FIELD} w-28 font-mono`} placeholder="00:00" value={hours} onChange={(e) => onHours(e.target.value)} />
      </label>
      <Button size="sm" variant="tertiary" disabled={ledger.available <= 0} onClick={() => setHours(toHhMm(ledger.available))}>
        {t("tb.compensate.all")}
      </Button>
      {mode === "paid" && (
        <label>
          <span className={LABEL}>{t("tb.compensate.month")}</span>
          <input type="month" className={FIELD} value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      )}
      <label className="min-w-[180px] flex-1">
        <span className={LABEL}>{t("tb.field.reason")}</span>
        <input className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <Button variant="primary" disabled={!seconds || !reason.trim() || (mode === "paid" && !month) || m.isPending} onClick={() => m.mutate()}>
        {t("tb.compensate")}
      </Button>
      {m.isError && <p className="w-full text-sm text-red-700">{message(m.error, t("common.error"))}</p>}
    </div>
  );
}

function Adjust({ employeeId }: { employeeId: string }) {
  const { t } = useI18n();
  const { timeBank } = useNovoRh();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const negative = amount.trim().startsWith("-");
  const parsed = parseHhMm(amount.trim().replace(/^[+-]/, ""));
  const seconds = parsed === null ? null : negative ? -parsed : parsed;
  const m = useMutation({
    mutationFn: () => timeBank.adjust(employeeId, { seconds: seconds!, workDate: day || null, reason }),
    onSuccess: async () => {
      setAmount("");
      setReason("");
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label={t("tb.adjust")}>
      <label>
        <span className={LABEL}>{t("tb.adjust.amount")}</span>
        <input className={`${FIELD} w-28 font-mono`} placeholder="+01:00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        <span className={LABEL}>{t("tb.adjust.day")}</span>
        <input type="date" className={FIELD} value={day} onChange={(e) => setDay(e.target.value)} />
      </label>
      <label className="min-w-[180px] flex-1">
        <span className={LABEL}>{t("tb.field.reason")}</span>
        <input className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <Button disabled={!seconds || !reason.trim() || m.isPending} onClick={() => m.mutate()}>
        {t("tb.adjust")}
      </Button>
      {m.isError && <p className="w-full text-sm text-red-700">{message(m.error, t("common.error"))}</p>}
    </div>
  );
}

function CategoriesPanel() {
  const { t } = useI18n();
  const { timeBank } = useNovoRh();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...KEY, "categories"], queryFn: () => timeBank.listCategories() });
  const [v, setV] = useState({ name: "", validFrom: "", weekdays: "1,2,3,4,5", start: "17:00", end: "18:00", factor: "" });
  const create = useMutation({
    mutationFn: () =>
      timeBank.createCategory({
        name: v.name,
        validFrom: v.validFrom,
        validTo: null,
        windows: [{ weekdays: v.weekdays.split(/[\s,]+/).filter(Boolean), start: v.start, end: v.end }],
        factor: v.factor.trim() ? Number(v.factor.replace(",", ".")) : null,
      }),
    onSuccess: async () => {
      setV({ ...v, name: "" });
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const archive = useMutation({ mutationFn: (id: string) => timeBank.archiveCategory(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const list = (q.data ?? []).filter((c) => !c.archived);
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <p className="text-xs text-stone-500">{t("tb.categories.hint")}</p>
      {q.data && list.length === 0 && <p className="text-sm text-stone-500">{t("tb.categories.none")}</p>}
      <ul className="space-y-1 text-sm">
        {list.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-stone-900">{c.name}</span>
            <span className="text-stone-500">{c.windows.map((w) => `${w.weekdays.join(",")} ${w.start}–${w.end}`).join("; ")}</span>
            {c.factor !== null && <span className="font-mono text-stone-700">× {c.factor}</span>}
            <Button size="sm" variant="tertiary" aria-label={`${t("tb.archive")} ${c.name}`} onClick={() => archive.mutate(c.id)}>
              {t("tb.archive")}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2" role="group" aria-label={t("tb.categories.new")}>
        <label>
          <span className={LABEL}>{t("tb.field.name")}</span>
          <input className={FIELD} maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>{t("tb.field.from")}</span>
          <input type="date" className={FIELD} value={v.validFrom} onChange={(e) => setV({ ...v, validFrom: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>{t("tb.field.weekdays")}</span>
          <input className={`${FIELD} w-32`} value={v.weekdays} onChange={(e) => setV({ ...v, weekdays: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>{t("tb.field.start")}</span>
          <input type="time" className={FIELD} value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>{t("tb.field.end")}</span>
          <input type="time" className={FIELD} value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>{t("tb.field.factor")}</span>
          <input className={`${FIELD} w-24`} value={v.factor} onChange={(e) => setV({ ...v, factor: e.target.value })} />
        </label>
        <Button variant="primary" disabled={!v.name.trim() || !v.validFrom || create.isPending} onClick={() => create.mutate()}>
          {t("tb.categories.new")}
        </Button>
        {create.isError && <p className="w-full text-sm text-red-700">{message(create.error, t("common.error"))}</p>}
      </div>
    </section>
  );
}
