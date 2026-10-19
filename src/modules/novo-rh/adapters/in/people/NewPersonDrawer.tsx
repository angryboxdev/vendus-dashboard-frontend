import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, Drawer, FIELD, LABEL, StatusBadge } from "../../../../../components/ui/index.ts";
import type { ContractInput } from "../../../domain/entities/people.ts";
import { similarPeople } from "../../../domain/services/people-form.service.ts";
import type { Option } from "../../../domain/ports/out/settings-api.port.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { PersonFieldInput, SPECIAL_FIELDS } from "./PersonFieldInput.tsx";

const STEPS = ["identity", "work", "contract", "review"] as const;
type Step = (typeof STEPS)[number];
const IDENTITY = ["firstName", "lastName", "nif", "email", "phone"] as const;
const REQUIRED: Record<Step, string[]> = { identity: ["firstName", "lastName", "nif"], work: ["hireDate", "primaryLocationId"], contract: [], review: [] };
const CONTRACT_TYPES: ContractInput["contractType"][] = ["permanent", "fixed_term", "temporary", "internship", "other"];
/**
 * Criar colaborador em passos (FE-012): identificação (com aviso de fichas
 * parecidas), trabalho (local, cargo, admissão — mínimo legal D4), contrato e
 * horário opcionais, resumo. O servidor valida tudo de novo (NIF único, RE-2).
 */
export function NewPersonDrawer({
  open,
  onClose,
  locations,
  initial,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  locations: Option[];
  /** Dados para pré-preencher (ex.: pedido de adesão, FE-054). */
  initial?: Record<string, string>;
  /** Depois de criar a ficha (ex.: marcar o pedido de adesão como aceite). */
  onCreated?: (employeeId: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const { people, time } = useNovoRh();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("identity");
  const [form, setForm] = useState<Record<string, string>>(initial ?? {});
  const [contract, setContract] = useState<{ on: boolean; type: ContractInput["contractType"]; hours: string; end: string }>({ on: true, type: "permanent", hours: "40", end: "" });
  const [scheduleId, setScheduleId] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const positions = useQuery({ queryKey: ["novo-rh", "catalog", "positions"], queryFn: () => people.listPositions(), enabled: open });
  const schedules = useQuery({ queryKey: ["novo-rh", "time", "schedules"], queryFn: () => time.listSchedules(), enabled: open });
  const everyone = useQuery({ queryKey: ["novo-rh", "people", "all", ""], queryFn: () => people.list({ status: "all" }), enabled: open });
  const similar = similarPeople(everyone.data ?? [], form);

  const reset = () => {
    setStep("identity");
    setForm(initial ?? {});
    setContract({ on: true, type: "permanent", hours: "40", end: "" });
    setScheduleId("");
    setWarnings([]);
  };
  const close = () => {
    reset();
    onClose();
  };
  const create = useMutation({
    mutationFn: async () => {
      const p = await people.create(Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim())));
      // Contrato e horário: a ficha já existe; se algum falhar, fica o aviso e completa-se na ficha.
      const issues: string[] = [];
      if (onCreated) {
        try {
          await onCreated(p.id);
        } catch (e) {
          issues.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (contract.on) {
        try {
          await people.createContract(p.id, { contractType: contract.type, code: null, startDate: form.hireDate!, endDate: contract.end || null, seniorityDate: null, probationEnd: null, weeklyHours: Number(contract.hours.replace(",", ".")) || 40, fte: 1, agreementId: null, remote: false, comment: null });
        } catch (e) {
          issues.push(`${t("people.wizard.contract")}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (scheduleId) {
        try {
          await time.assign({ resourceType: "schedule", resourceId: scheduleId, targetType: "employee", targetId: p.id, validFrom: form.hireDate!, validTo: null });
        } catch (e) {
          issues.push(`${t("people.wizard.schedule")}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return { p, issues };
    },
    onSuccess: ({ p, issues }) => {
      void qc.invalidateQueries({ queryKey: ["novo-rh"] });
      if (issues.length) {
        setWarnings(issues);
        return;
      }
      close();
      navigate(`/hr/novo/pessoas/${p.id}`);
    },
  });
  const ready = (s: Step) => REQUIRED[s].every((f) => (form[f] ?? "").trim());
  const idx = STEPS.indexOf(step);
  const field = (f: string, type = "text") => (
    <div key={f}>
      <label htmlFor={`new-${f}`} className={LABEL}>
        {t(`people.field.${f}` as MessageKey)}
        {REQUIRED[step].includes(f) && <span className="text-[#C2410C]"> *</span>}
      </label>
      {SPECIAL_FIELDS.has(f) ? (
        <PersonFieldInput field={f} id={`new-${f}`} value={form[f] ?? ""} onChange={(v) => setForm({ ...form, [f]: v })} />
      ) : (
        <input id={`new-${f}`} type={type} className={`${FIELD} w-full`} value={form[f] ?? ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
      )}
    </div>
  );
  const label = (id: string, list: { id: string; name?: string; label?: string }[]) => {
    const x = list.find((o) => o.id === id);
    return x ? (x.name ?? x.label ?? "—") : "—";
  };

  return (
    <Drawer
      open={open}
      as="form"
      title={t("people.new")}
      description={t("people.wizard.stepOf", { n: idx + 1, total: STEPS.length, name: t(`people.wizard.${step}` as MessageKey) })}
      onClose={close}
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "review") create.mutate();
        else if (ready(step)) setStep(STEPS[idx + 1]!);
      }}
      footer={
        <div className="flex justify-between gap-2">
          <Button type="button" variant="tertiary" onClick={idx === 0 ? close : () => setStep(STEPS[idx - 1]!)}>
            {idx === 0 ? t("common.cancel") : t("people.wizard.back")}
          </Button>
          {warnings.length > 0 && create.data ? (
            <Button type="button" variant="primary" onClick={() => (close(), navigate(`/hr/novo/pessoas/${create.data!.p.id}`))}>
              {t("people.wizard.openPerson")}
            </Button>
          ) : step === "review" ? (
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {t("people.wizard.create")}
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={!ready(step)}>
              {t("people.wizard.next")}
            </Button>
          )}
        </div>
      }
    >
      <ol className="mb-4 flex gap-1" aria-label={t("people.wizard.steps")}>
        {STEPS.map((s, i) => (
          <li key={s} aria-current={s === step ? "step" : undefined} className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-[#ED5C32]" : "bg-stone-200"}`} title={t(`people.wizard.${s}` as MessageKey)} />
        ))}
      </ol>

      {step === "identity" && (
        <div className="space-y-3">
          {IDENTITY.map((f) => field(f, f === "email" ? "email" : "text"))}
          {similar.length > 0 && (
            <AlertBanner tone="warning" title={t("people.wizard.similar")}>
              <ul className="mt-1 list-disc pl-4">
                {similar.map((p) => (
                  <li key={p.id}>
                    <Link to={`/hr/novo/pessoas/${p.id}`} className="underline" onClick={close}>
                      {p.fullName}
                    </Link>{" "}
                    {p.status === "inactive" && <StatusBadge tone="neutral">{t("people.inactive")}</StatusBadge>}
                  </li>
                ))}
              </ul>
            </AlertBanner>
          )}
        </div>
      )}

      {step === "work" && (
        <div className="space-y-3">
          {field("hireDate", "date")}
          <div>
            <label htmlFor="new-primaryLocationId" className={LABEL}>
              {t("people.field.primaryLocationId")}
              <span className="text-[#C2410C]"> *</span>
            </label>
            <select id="new-primaryLocationId" className={`${FIELD} w-full`} value={form.primaryLocationId ?? ""} onChange={(e) => setForm({ ...form, primaryLocationId: e.target.value })}>
              <option value="">{t("common.choose")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-positionId" className={LABEL}>
              {t("people.col.position")}
            </label>
            <select id="new-positionId" className={`${FIELD} w-full`} value={form.positionId ?? ""} onChange={(e) => setForm({ ...form, positionId: e.target.value })}>
              <option value="">{t("common.choose")}</option>
              {(positions.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === "contract" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-stone-800">
            <input type="checkbox" checked={contract.on} onChange={(e) => setContract({ ...contract, on: e.target.checked })} />
            {t("people.wizard.withContract")}
          </label>
          {contract.on && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="new-c-type" className={LABEL}>
                  {t("people.wizard.contractType")}
                </label>
                <select id="new-c-type" className={`${FIELD} w-full`} value={contract.type} onChange={(e) => setContract({ ...contract, type: e.target.value as ContractInput["contractType"] })}>
                  {CONTRACT_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {t(`contracts.type.${k}` as MessageKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-c-hours" className={LABEL}>
                  {t("people.wizard.weeklyHours")}
                </label>
                <input id="new-c-hours" inputMode="decimal" className={`${FIELD} w-full`} value={contract.hours} onChange={(e) => setContract({ ...contract, hours: e.target.value })} />
              </div>
              {contract.type !== "permanent" && (
                <div className="col-span-2">
                  <label htmlFor="new-c-end" className={LABEL}>
                    {t("people.wizard.contractEnd")}
                  </label>
                  <input id="new-c-end" type="date" min={form.hireDate} className={`${FIELD} w-full`} value={contract.end} onChange={(e) => setContract({ ...contract, end: e.target.value })} />
                </div>
              )}
            </div>
          )}
          <div>
            <label htmlFor="new-schedule" className={LABEL}>
              {t("people.wizard.schedule")}
            </label>
            <select id="new-schedule" className={`${FIELD} w-full`} value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
              <option value="">{t("people.wizard.noSchedule")}</option>
              {(schedules.data ?? [])
                .filter((s) => !s.archived)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {step === "review" && (
        <dl className="space-y-2 text-sm">
          {[
            [t("people.col.name"), `${form.firstName ?? ""} ${form.lastName ?? ""}`],
            [t("people.field.nif"), form.nif],
            [t("people.field.hireDate"), form.hireDate],
            [t("people.field.primaryLocationId"), label(form.primaryLocationId ?? "", locations)],
            [t("people.col.position"), label(form.positionId ?? "", positions.data ?? [])],
            [t("people.wizard.contract"), contract.on ? `${t(`contracts.type.${contract.type}` as MessageKey)} · ${contract.hours} h${contract.end ? ` · ${contract.end}` : ""}` : "—"],
            [t("people.wizard.schedule"), scheduleId ? label(scheduleId, schedules.data ?? []) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-stone-100 pb-1">
              <dt className="text-stone-500">{k}</dt>
              <dd className="text-right font-medium text-stone-900">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      )}

      {create.isError && (
        <AlertBanner tone="danger" title={t("common.error")}>
          {create.error instanceof Error ? create.error.message : ""}
        </AlertBanner>
      )}
      {warnings.length > 0 && (
        <AlertBanner tone="warning" title={t("people.wizard.partial")}>
          <ul className="mt-1 list-disc pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </AlertBanner>
      )}
    </Drawer>
  );
}
