import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, LABEL, StatusBadge, SURFACE, Tabs } from "../../../../../components/ui/index.ts";
import type { Alert, AlertKind } from "../../../domain/entities/engagement.ts";
import { shortDateTime } from "../../../domain/services/engagement.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "alerts"];
const KINDS: AlertKind[] = ["pending_absence", "pending_correction", "pending_reopening", "pending_swap", "pending_custom_request", "contract_end", "probation_end", "overdue_task"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Novo RH → Alertas (RE-24, RE-36). */
export function AlertsView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"list" | "rules">("list");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "list", label: t("alerts.tab.list") },
          { key: "rules", label: t("alerts.tab.rules") },
        ]}
      />
      {tab === "list" ? <ListPanel /> : <RulesPanel />}
    </div>
  );
}

function ListPanel() {
  const { t } = useI18n();
  const { alerts } = useNovoRh();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...KEY, "active"], queryFn: () => alerts.list("active") });
  const run = useMutation({ mutationFn: () => alerts.run(), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={run.isPending} onClick={() => run.mutate()}>
          {t("alerts.run")}
        </Button>
        {run.data && <span className="text-xs text-stone-600">{t("alerts.run.done", run.data)}</span>}
      </div>
      {q.data?.length === 0 && <p className="text-sm text-stone-500">{t("alerts.none")}</p>}
      <ul className="space-y-2">
        {(q.data ?? []).map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}
      </ul>
    </section>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const { t } = useI18n();
  const { alerts } = useNovoRh();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const take = useMutation({ mutationFn: () => alerts.take(alert.id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const close = useMutation({ mutationFn: () => alerts.close(alert.id, note.trim()), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const overdue = alert.dueAt < new Date().toISOString();
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-stone-200 p-2 text-sm">
      <span className="font-medium text-stone-900">{alert.title}</span>
      <StatusBadge tone={alert.status === "open" ? "warning" : "neutral"}>{t(`alerts.status.${alert.status}` as MessageKey)}</StatusBadge>
      {alert.escalatedAt && <StatusBadge tone="danger">{t("alerts.escalated")}</StatusBadge>}
      <span className={`text-xs ${overdue ? "text-red-700" : "text-stone-500"}`}>{t("alerts.due", { date: shortDateTime(alert.dueAt) })}</span>
      {alert.status === "open" && (
        <Button size="sm" disabled={take.isPending} onClick={() => take.mutate()}>
          {t("alerts.take")}
        </Button>
      )}
      <input aria-label={`${t("alerts.closeNote")} ${alert.title}`} className={`${FIELD} w-48`} placeholder={t("alerts.closeNote")} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" variant="tertiary" disabled={!note.trim() || close.isPending} onClick={() => close.mutate()}>
        {t("alerts.close")}
      </Button>
      {(take.isError || close.isError) && <span className="text-xs text-red-700">{message(take.error ?? close.error, t("common.error"))}</span>}
    </li>
  );
}

function RulesPanel() {
  const { t } = useI18n();
  const { alerts, access } = useNovoRh();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...KEY, "rules"], queryFn: () => alerts.rules() });
  const users = useQuery({ queryKey: ["novo-rh", "access", "users"], queryFn: () => access.listUsers() });
  const [v, setV] = useState({ kind: "pending_absence" as AlertKind, thresholdDays: "3", owner: "admins", slaHours: "24", escalateTo: "" });
  const create = useMutation({
    mutationFn: () => alerts.createRule({ kind: v.kind, thresholdDays: Number(v.thresholdDays), owner: v.owner, slaHours: Number(v.slaHours), escalateTo: v.escalateTo || null, enabled: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const owners = [{ value: "admins", label: t("alerts.owner.admins") }, ...(users.data ?? []).map((u) => ({ value: `user:${u.userId}`, label: u.label }))];
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      {q.data?.length === 0 && <p className="text-sm text-stone-500">{t("alerts.rules.none")}</p>}
      <ul className="space-y-1 text-sm">
        {(q.data ?? []).map((r) => (
          <li key={r.id}>{t("alerts.rule.row", { kind: t(`alerts.kind.${r.kind}` as MessageKey), days: r.thresholdDays, sla: r.slaHours })}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2" role="group" aria-label={t("alerts.rule.new")}>
        <label>
          <span className={LABEL}>{t("alerts.rule.kind")}</span>
          <select className={FIELD} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as AlertKind })}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`alerts.kind.${k}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={LABEL}>{t("alerts.rule.days")}</span>
          <input className={`${FIELD} w-20`} inputMode="numeric" value={v.thresholdDays} onChange={(e) => setV({ ...v, thresholdDays: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>{t("alerts.rule.owner")}</span>
          <select className={FIELD} value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })}>
            {owners.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={LABEL}>{t("alerts.rule.sla")}</span>
          <input className={`${FIELD} w-20`} inputMode="numeric" value={v.slaHours} onChange={(e) => setV({ ...v, slaHours: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>{t("alerts.rule.escalate")}</span>
          <select className={FIELD} value={v.escalateTo} onChange={(e) => setV({ ...v, escalateTo: e.target.value })}>
            <option value="">{t("alerts.owner.none")}</option>
            {owners.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
          {t("alerts.rule.new")}
        </Button>
      </div>
      {create.isError && <p className="text-sm text-red-700">{message(create.error, t("common.error"))}</p>}
    </section>
  );
}
