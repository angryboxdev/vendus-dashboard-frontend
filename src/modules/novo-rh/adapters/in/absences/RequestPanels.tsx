import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, LABEL, SECTION_TITLE, SURFACE } from "../../../../../components/ui/index.ts";
import type { AbsenceRequest, RequestStatus } from "../../../domain/entities/absences.ts";
import { formatAmount } from "../../../domain/services/absences.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { RequestForm } from "./RequestForm.tsx";
import { RequestsTable } from "./RequestsTable.tsx";

const KEY = ["novo-rh", "absences"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function useEmployees() {
  const { settings } = useNovoRh();
  const q = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  return { list: q.data ?? [], name: (id: string) => q.data?.find((e) => e.id === id)?.label ?? id };
}

/** Caixa do aprovador: pedidos em que estou no nível atual (RE-22 — nunca os meus). */
export function ApprovalsPanel() {
  const { t } = useI18n();
  const { myAbsences } = useNovoRh();
  const employees = useEmployees();
  const q = useQuery({ queryKey: [...KEY, "approvals"], queryFn: () => myAbsences.approvals() });
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      {q.isError && <p className="text-sm text-red-700">{message(q.error, t("common.loadError"))}</p>}
      {q.data?.length === 0 && <p className="text-sm text-stone-500">{t("abs.approvals.none")}</p>}
      {!!q.data?.length && <RequestsTable rows={q.data} employeeName={employees.name} actions={(r) => <Decide request={r} label={employees.name(r.employeeId)} />} />}
    </section>
  );
}

function Decide({ request, label }: { request: AbsenceRequest; label: string }) {
  const { t } = useI18n();
  const { myAbsences } = useNovoRh();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const m = useMutation({ mutationFn: (d: "approve" | "reject") => myAbsences.decide(request.id, d, comment.trim() || null), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input aria-label={`${t("abs.field.comment")} ${label}`} className={`${FIELD} w-36`} placeholder={t("abs.field.comment")} value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button size="sm" variant="primary" disabled={m.isPending} onClick={() => m.mutate("approve")}>
        {t("abs.approve")}
      </Button>
      <Button size="sm" disabled={m.isPending} onClick={() => m.mutate("reject")}>
        {t("abs.reject")}
      </Button>
      {m.isError && <span className="text-xs text-red-700">{message(m.error, t("common.error"))}</span>}
    </div>
  );
}

/** Pedidos da organização (no âmbito): filtrar, atribuir e cancelar. */
export function RequestsPanel() {
  const { t } = useI18n();
  const { absences } = useNovoRh();
  const qc = useQueryClient();
  const employees = useEmployees();
  const [status, setStatus] = useState<RequestStatus | "">("pending");
  const [employeeId, setEmployeeId] = useState("");
  const types = useQuery({ queryKey: [...KEY, "types"], queryFn: () => absences.listTypes() });
  const q = useQuery({
    queryKey: [...KEY, "requests", status, employeeId],
    queryFn: () => absences.listRequests({ ...(status ? { status } : {}), ...(employeeId ? { employeeId } : {}) }),
  });
  const assign = useMutation({
    mutationFn: (input: Parameters<typeof absences.assign>[1]) => absences.assign(employeeId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-3 p-4`}>
        <div className="flex flex-wrap gap-2">
          <select aria-label={t("common.employee")} className={`${FIELD} min-w-[220px]`} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{t("common.employee")}…</option>
            {employees.list.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label={t("abs.col.status")} className={FIELD} value={status} onChange={(e) => setStatus(e.target.value as RequestStatus | "")}>
            <option value="">{t("common.none")}</option>
            {(["pending", "approved", "rejected", "cancelled"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`abs.status.${s}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        {q.isError && <p className="text-sm text-red-700">{message(q.error, t("common.loadError"))}</p>}
        {q.data?.length === 0 && <p className="text-sm text-stone-500">{t("abs.requests.none")}</p>}
        {!!q.data?.length && <RequestsTable rows={q.data} employeeName={employees.name} actions={(r) => (r.status === "pending" || r.status === "approved" ? <CancelRequest request={r} /> : null)} />}
      </section>
      {employeeId && (
        <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("abs.assign")}>
          <h3 className={SECTION_TITLE}>{t("abs.assign")}</h3>
          <p className="text-xs text-stone-500">{t("abs.assign.hint")}</p>
          <RequestForm types={(types.data ?? []).filter((x) => !x.archived)} submitLabel={t("abs.assign")} busy={assign.isPending} onSubmit={(input) => assign.mutate(input)} />
          {assign.isError && <p className="text-sm text-red-700">{message(assign.error, t("common.error"))}</p>}
        </section>
      )}
    </div>
  );
}

function CancelRequest({ request }: { request: AbsenceRequest }) {
  const { t } = useI18n();
  const { absences } = useNovoRh();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({ mutationFn: () => absences.cancel(request.id, reason.trim() || null), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const needsReason = request.status === "approved" && !reason.trim();
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input aria-label={`${t("abs.cancelReason")} ${request.typeName} ${request.startDate}`} className={`${FIELD} w-40`} placeholder={t("abs.cancelReason")} value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button size="sm" variant="tertiary" disabled={m.isPending || needsReason} title={needsReason ? t("abs.cancelReasonHint") : undefined} onClick={() => m.mutate()}>
        {t("abs.cancel")}
      </Button>
      {m.isError && <span className="text-xs text-red-700">{message(m.error, t("common.error"))}</span>}
    </div>
  );
}

/** Saldos de um colaborador (ledger), ajustes e compensação de feriados trabalhados (CF-9). */
export function BalancesPanel() {
  const { t } = useI18n();
  const { absences } = useNovoRh();
  const qc = useQueryClient();
  const employees = useEmployees();
  const [employeeId, setEmployeeId] = useState("");
  const [adjust, setAdjust] = useState({ typeId: "", amount: "", reason: "" });
  const [range, setRange] = useState({ from: "", to: "" });
  const q = useQuery({ queryKey: [...KEY, "balances", employeeId], queryFn: () => absences.balances(employeeId), enabled: !!employeeId });
  const doAdjust = useMutation({
    mutationFn: () => {
      const b = q.data!.find((x) => x.typeId === adjust.typeId)!;
      return absences.adjust({ employeeId, typeId: adjust.typeId, period: b.period, amount: Number(adjust.amount.replace(",", ".")), reason: adjust.reason });
    },
    onSuccess: async () => {
      setAdjust({ typeId: "", amount: "", reason: "" });
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const comp = useMutation({ mutationFn: () => absences.holidayCompensation(employeeId, range.from, range.to), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <select aria-label={t("common.employee")} className={`${FIELD} min-w-[220px]`} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        <option value="">{t("common.employee")}…</option>
        {employees.list.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {q.isError && <p className="text-sm text-red-700">{message(q.error, t("common.loadError"))}</p>}
      {q.data && <BalanceList balances={q.data} />}
      {q.data && q.data.length > 0 && (
        <div className="flex flex-wrap items-end gap-2" aria-label={t("abs.adjust")} role="group">
          <label>
            <span className={LABEL}>{t("abs.field.type")}</span>
            <select className={FIELD} value={adjust.typeId} onChange={(e) => setAdjust({ ...adjust, typeId: e.target.value })}>
              <option value="">{t("common.choose")}…</option>
              {q.data.map((b) => (
                <option key={b.typeId} value={b.typeId}>
                  {b.typeName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>{t("abs.adjust.amount")}</span>
            <input className={`${FIELD} w-24`} value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
          </label>
          <label className="min-w-[200px] flex-1">
            <span className={LABEL}>{t("abs.adjust.reason")}</span>
            <input className={`${FIELD} w-full`} value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
          </label>
          <Button disabled={!adjust.typeId || !adjust.amount || !adjust.reason.trim() || doAdjust.isPending} onClick={() => doAdjust.mutate()}>
            {t("abs.adjust")}
          </Button>
          {doAdjust.isError && <span className="text-xs text-red-700">{message(doAdjust.error, t("common.error"))}</span>}
        </div>
      )}
      {employeeId && (
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className={LABEL}>{t("common.from")}</span>
            <input type="date" className={FIELD} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <label>
            <span className={LABEL}>{t("common.to")}</span>
            <input type="date" className={FIELD} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
          <Button disabled={!range.from || !range.to || comp.isPending} onClick={() => comp.mutate()}>
            {t("abs.holidayComp")}
          </Button>
          {comp.data && <span className="text-xs text-stone-600">{t("abs.holidayComp.done", comp.data)}</span>}
          {comp.isError && <span className="text-xs text-red-700">{message(comp.error, t("common.error"))}</span>}
        </div>
      )}
    </section>
  );
}

function BalanceList({ balances }: { balances: Awaited<ReturnType<ReturnType<typeof useNovoRh>["absences"]["balances"]>> }) {
  const { t } = useI18n();
  if (!balances.length) return <p className="text-sm text-stone-500">{t("abs.balances.none")}</p>;
  return (
    <ul className="space-y-2">
      {balances.map((b) => (
        <li key={b.typeId} className="rounded-md border border-stone-200 p-3">
          <p className="text-sm font-semibold text-stone-900">
            {t("abs.balance.row", { type: b.typeName, available: formatAmount(b.available, b.unit), used: formatAmount(b.used, b.unit), pending: formatAmount(b.pending, b.unit) })}
          </p>
          <details className="mt-1 text-xs text-stone-600">
            <summary className="cursor-pointer">{t("abs.balance.movements")}</summary>
            <ul className="mt-1 space-y-0.5">
              {b.entries.map((e) => (
                <li key={e.id}>
                  {t(`abs.ledger.${e.kind}` as MessageKey)}: {e.amount > 0 ? "+" : ""}
                  {formatAmount(e.amount, b.unit)} — {e.reason}
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}

/** As minhas ausências (Novo RH, em teste): saldos, pedir, cancelar pendentes. */
export function MyAbsencesPanel() {
  const { t } = useI18n();
  const { myAbsences } = useNovoRh();
  const qc = useQueryClient();
  const requests = useQuery({ queryKey: [...KEY, "mine"], queryFn: () => myAbsences.requests(), retry: false });
  const types = useQuery({ queryKey: [...KEY, "mine", "types"], queryFn: () => myAbsences.types(), enabled: requests.isSuccess });
  const balances = useQuery({ queryKey: [...KEY, "mine", "balances"], queryFn: () => myAbsences.balances(), enabled: requests.isSuccess });
  const ask = useMutation({ mutationFn: (input: Parameters<typeof myAbsences.request>[0]) => myAbsences.request(input), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const cancel = useMutation({ mutationFn: (id: string) => myAbsences.cancel(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  if (requests.isError) return <AlertBanner tone="warning" title={message(requests.error, t("common.loadError"))} />;
  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">{t("abs.mine.hint")}</p>
      {balances.data && (
        <section className={`${SURFACE} p-4`}>
          <BalanceList balances={balances.data} />
        </section>
      )}
      <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("abs.request")}>
        <h3 className={SECTION_TITLE}>{t("abs.request")}</h3>
        <RequestForm types={types.data ?? []} submitLabel={t("abs.request")} busy={ask.isPending} onSubmit={(input) => ask.mutate(input)} />
        {ask.isError && <p className="text-sm text-red-700">{message(ask.error, t("common.error"))}</p>}
      </section>
      {!!requests.data?.requests.length && (
        <section className={`${SURFACE} space-y-2 p-4`}>
          <h3 className={SECTION_TITLE}>{t("abs.mine.requests")}</h3>
          <RequestsTable
            rows={requests.data.requests}
            actions={(r) =>
              r.status === "pending" ? (
                <Button size="sm" variant="tertiary" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>
                  {t("abs.cancel")}
                </Button>
              ) : null
            }
          />
        </section>
      )}
    </div>
  );
}
