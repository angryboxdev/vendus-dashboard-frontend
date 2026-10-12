import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, LABEL, SECTION_TITLE, StatusBadge, SURFACE, Tabs, type StatusTone } from "../../../../../components/ui/index.ts";
import type { PayPeriod, PendingItem } from "../../../domain/entities/periods.ts";
import { TransfersView } from "../TransfersView.tsx";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "periods"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const STATUS_TONE: Record<PayPeriod["status"], StatusTone> = { open: "neutral", closed: "success", reopened: "warning" };

/** Novo RH → Fecho de período (Fase 8). */
export function PeriodsView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"periods" | "reopenings" | "exports">("periods");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "periods", label: t("per.tab.periods") },
          { key: "reopenings", label: t("per.tab.reopenings") },
          { key: "exports", label: t("per.tab.exports") },
        ]}
      />
      {tab === "periods" && <PeriodsPanel />}
      {tab === "reopenings" && <ReopeningsPanel />}
      {tab === "exports" && <TransfersView />}
    </div>
  );
}

function PeriodsPanel() {
  const { t } = useI18n();
  const { periods, settings } = useNovoRh();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: [...KEY, "list"], queryFn: () => periods.list() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const [selectedId, setSelectedId] = useState("");
  const [v, setV] = useState({ scopeType: "organization" as PayPeriod["scopeType"], scopeId: "", startDate: "", endDate: "" });
  const create = useMutation({
    mutationFn: () => periods.create({ scopeType: v.scopeType, scopeId: v.scopeType === "location" ? v.scopeId : null, startDate: v.startDate, endDate: v.endDate }),
    onSuccess: async (p) => {
      setSelectedId(p.id);
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const locName = (id: string | null) => (id ? (locations.data?.find((l) => l.id === id)?.label ?? id) : t("per.scope.organization"));
  const selected = list.data?.find((p) => p.id === selectedId);
  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-3 p-4`}>
        <div className="flex flex-wrap items-end gap-2" role="group" aria-label={t("per.new")}>
          <label>
            <span className={LABEL}>{t("per.scope")}</span>
            <select className={FIELD} value={v.scopeType} onChange={(e) => setV({ ...v, scopeType: e.target.value as PayPeriod["scopeType"] })}>
              <option value="organization">{t("per.scope.organization")}</option>
              <option value="location">{t("per.scope.location")}</option>
            </select>
          </label>
          {v.scopeType === "location" && (
            <label>
              <span className={LABEL}>{t("per.location")}</span>
              <select className={FIELD} value={v.scopeId} onChange={(e) => setV({ ...v, scopeId: e.target.value })}>
                <option value="">{t("common.choose")}…</option>
                {(locations.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className={LABEL}>{t("common.from")}</span>
            <input type="date" className={FIELD} value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
          </label>
          <label>
            <span className={LABEL}>{t("common.to")}</span>
            <input type="date" className={FIELD} value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />
          </label>
          <Button disabled={!v.startDate || !v.endDate || (v.scopeType === "location" && !v.scopeId) || create.isPending} onClick={() => create.mutate()}>
            {t("per.new")}
          </Button>
        </div>
        {create.isError && <p className="text-sm text-red-700">{message(create.error, t("common.error"))}</p>}
        {list.data?.length === 0 && <p className="text-sm text-stone-500">{t("per.none")}</p>}
        <ul className="space-y-1 text-sm">
          {(list.data ?? []).map((p) => (
            <li key={p.id}>
              <button type="button" className={`flex flex-wrap items-center gap-2 rounded px-1 ${p.id === selectedId ? "bg-[#FDF8F5] font-semibold" : ""}`} onClick={() => setSelectedId(p.id)}>
                <span>
                  {p.startDate} – {p.endDate}
                </span>
                <span className="text-stone-500">{locName(p.scopeId)}</span>
                <StatusBadge tone={STATUS_TONE[p.status]}>{t(`per.status.${p.status}` as MessageKey)}</StatusBadge>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {selected && <PeriodDetail key={selected.id} period={selected} />}
    </div>
  );
}

function PeriodDetail({ period }: { period: PayPeriod }) {
  const { t } = useI18n();
  const { periods, settings } = useNovoRh();
  const qc = useQueryClient();
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const name = (id: string) => employees.data?.find((e) => e.id === id)?.label ?? id;
  const [pending, setPending] = useState<PendingItem[] | null>(null);
  const [exception, setException] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [nif, setNif] = useState(false);
  const [queued, setQueued] = useState(false);
  const closures = useQuery({ queryKey: [...KEY, "closures", period.id], queryFn: () => periods.closures(period.id) });
  const precheck = useMutation({ mutationFn: () => periods.precheck(period.id), onSuccess: (r) => setPending(r.pending) });
  const close = useMutation({
    mutationFn: () => periods.close(period.id, exception.trim() || null),
    onSuccess: async () => {
      setPending(null);
      await qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => {
      const data = (e as { data?: { pending?: PendingItem[] } }).data;
      if (data?.pending?.length) setPending(data.pending);
    },
  });
  const reopen = useMutation({
    mutationFn: () => periods.requestReopen(period.id, reopenReason.trim()),
    onSuccess: async () => {
      setReopenReason("");
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const exportJob = useMutation({
    mutationFn: (kind: "payroll" | "billing_location") => periods.requestExport(period.id, kind, kind === "payroll" && nif),
    onSuccess: async () => {
      setQueued(true);
      await qc.invalidateQueries({ queryKey: [...KEY, "exports"] });
    },
  });
  const canClose = period.status !== "closed";
  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={`${period.startDate} – ${period.endDate}`}>
      <h3 className={SECTION_TITLE}>
        {period.startDate} – {period.endDate}
      </h3>
      {canClose && (
        <>
          <p className="text-xs text-stone-500">{t("per.close.hint")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <Button disabled={precheck.isPending} onClick={() => precheck.mutate()}>
              {t("per.precheck")}
            </Button>
            <label className="min-w-[240px] flex-1">
              <span className={LABEL}>{t("per.exception")}</span>
              <input className={`${FIELD} w-full`} value={exception} onChange={(e) => setException(e.target.value)} />
            </label>
            <Button variant="primary" disabled={close.isPending || (!!pending?.length && !exception.trim())} onClick={() => close.mutate()}>
              {t("per.close")}
            </Button>
          </div>
          {precheck.data && pending?.length === 0 && <AlertBanner tone="success" title={t("per.precheck.ok", { count: precheck.data.employees })} />}
          {!!pending?.length && (
            <AlertBanner tone="warning" title={t("per.precheck.pending", { count: pending.length })}>
              <ul className="list-disc pl-4">
                {pending.map((p) => (
                  <li key={`${p.type}-${p.id}`}>
                    {p.date} · {name(p.employeeId)} · {p.label}
                  </li>
                ))}
              </ul>
            </AlertBanner>
          )}
          {close.isError && !pending?.length && <p className="text-sm text-red-700">{message(close.error, t("common.error"))}</p>}
        </>
      )}
      {period.status === "closed" && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex items-center gap-1 pb-2 text-sm text-stone-700">
              <input type="checkbox" checked={nif} onChange={(e) => setNif(e.target.checked)} />
              {t("per.export.nif")}
            </label>
            <Button variant="primary" disabled={exportJob.isPending} onClick={() => exportJob.mutate("payroll")}>
              {t("per.export.payroll")}
            </Button>
            <Button disabled={exportJob.isPending} onClick={() => exportJob.mutate("billing_location")}>
              {t("per.export.billing")}
            </Button>
          </div>
          {queued && <p className="text-xs text-stone-600">{t("per.export.queued")}</p>}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[240px] flex-1">
              <span className={LABEL}>{t("per.reopen.reason")}</span>
              <input className={`${FIELD} w-full`} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
            </label>
            <Button disabled={!reopenReason.trim() || reopen.isPending} onClick={() => reopen.mutate()}>
              {t("per.reopen")}
            </Button>
          </div>
          <p className="text-xs text-stone-500">{t("per.reopen.hint")}</p>
          {(reopen.isError || exportJob.isError) && <p className="text-sm text-red-700">{message(reopen.error ?? exportJob.error, t("common.error"))}</p>}
        </>
      )}
      {!!closures.data?.length && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("per.closures")}</h4>
          <ul className="space-y-1 text-sm text-stone-700">
            {closures.data.map((c) => (
              <li key={c.id}>
                {t("per.closure.row", { no: c.closureNo, date: c.createdAt.slice(0, 10), by: c.closedBy, count: c.totals.length })}
                {c.exceptionReason && <span className="block text-xs text-amber-800">{t("per.closure.exception", { reason: c.exceptionReason })}</span>}
                {c.diff && c.diff.length > 0 && <span className="block text-xs text-stone-500">{t("per.closure.diff", { count: c.diff.length })}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ReopeningsPanel() {
  const { t } = useI18n();
  const { periods } = useNovoRh();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...KEY, "reopenings"], queryFn: () => periods.reopenings() });
  const approve = useMutation({ mutationFn: (id: string) => periods.approveReopen(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const reject = useMutation({ mutationFn: (id: string) => periods.rejectReopen(id, null), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      {q.data?.length === 0 && <p className="text-sm text-stone-500">{t("per.reopenings.none")}</p>}
      <ul className="space-y-1 text-sm">
        {(q.data ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <span>{t("per.reopening.row", { by: r.requestedBy, reason: r.reason, count: r.approvals.length })}</span>
            <StatusBadge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>{t(`per.reopening.status.${r.status}` as MessageKey)}</StatusBadge>
            {r.status === "pending" && (
              <>
                <Button size="sm" variant="primary" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>
                  {t("per.reopening.approve")}
                </Button>
                <Button size="sm" variant="tertiary" disabled={reject.isPending} onClick={() => reject.mutate(r.id)}>
                  {t("per.reopening.reject")}
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {(approve.isError || reject.isError) && <p className="text-sm text-red-700">{message(approve.error ?? reject.error, t("common.error"))}</p>}
    </section>
  );
}

