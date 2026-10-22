import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, IconDownload, LABEL, SECTION_TITLE, SegmentedControl, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR, Tabs } from "../../../../../components/ui/index.ts";
import { DISTRIBUTION_MAX_BYTES, DISTRIBUTION_MIME, type Distribution, type DistributionAudience } from "../../../domain/entities/distributions.ts";
import { shortDateTime } from "../../../domain/services/engagement.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { downloadBlob } from "../download.ts";
import { useNovoRhSlots } from "../slots.ts";

const KEY = ["novo-rh", "document-distributions"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Novo RH → Mais → Documentos: «Colaboradores» (pastas → colaboradores com
 * quantidade e último arquivamento; importar recibos) e «Empresa» (documentos
 * da empresa e envio a colaboradores, FE-065) — separados, como pedido pelo
 * utilizador. Os ecrãs do módulo `documents` entram pela raiz (slots).
 */
export function DocumentsView() {
  const { t } = useI18n();
  const slots = useNovoRhSlots();
  const [area, setArea] = useState<"people" | "company">(slots.employeeArchive ? "people" : "company");
  const [tab, setTab] = useState<"company" | "distributions">(slots.companyDocuments ? "company" : "distributions");
  return (
    <div className="space-y-4">
      {slots.employeeArchive && (
        <SegmentedControl<"people" | "company">
          label={t("novoRh.tab.documents")}
          value={area}
          onChange={setArea}
          items={[
            { key: "people", label: t("docs.area.people") },
            { key: "company", label: t("docs.area.company") },
          ]}
        />
      )}
      {area === "people" && slots.employeeArchive ? (
        <>
          {slots.payslipImport && <div className="flex justify-end">{slots.payslipImport()}</div>}
          {slots.employeeArchive()}
        </>
      ) : (
        <>
          {slots.companyDocuments && (
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { key: "company", label: t("docs.tab.company") },
                { key: "distributions", label: t("docs.tab.distributions") },
              ]}
            />
          )}
          {tab === "company" && slots.companyDocuments ? slots.companyDocuments() : <DistributionsPanel />}
        </>
      )}
    </div>
  );
}

function DistributionsPanel() {
  const { t } = useI18n();
  const { distributions } = useNovoRh();
  const list = useQuery({ queryKey: KEY, queryFn: () => distributions.list() });
  const [selected, setSelected] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const rows = (list.data ?? []).filter((d) => showArchived || d.status === "sent");
  const current = list.data?.find((d) => d.id === selected);
  return (
    <div className="space-y-4">
      <SendWizard onSent={setSelected} />
      <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("docs.sent")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={SECTION_TITLE}>{t("docs.sent")}</h3>
          <label className="flex items-center gap-1 text-sm text-stone-700">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {t("docs.showArchived")}
          </label>
        </div>
        {list.isError && <p className="text-sm text-red-700">{message(list.error, t("common.error"))}</p>}
        {list.data && rows.length === 0 && <p className="text-sm text-stone-500">{t("docs.none")}</p>}
        <ul className="divide-y divide-stone-100">
          {rows.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => setSelected(d.id === selected ? null : d.id)} className={`flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left ${d.id === selected ? "text-[#C2410C]" : "text-stone-800"}`}>
                <span className="font-medium">{d.title}</span>
                <span className="flex items-center gap-2 text-xs text-stone-500">
                  {shortDateTime(d.createdAt)} · {progress(t, d)}
                  {d.status === "archived" && <StatusBadge tone="neutral">{t("docs.archived")}</StatusBadge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {current && <Detail d={current} onGone={() => setSelected(null)} />}
    </div>
  );
}

function progress(t: ReturnType<typeof useI18n>["t"], d: Pick<Distribution, "requiresConfirmation" | "stats">) {
  return d.requiresConfirmation ? t("docs.progress.confirmed", { done: d.stats.confirmed, total: d.stats.recipients }) : t("docs.progress.read", { done: d.stats.read, total: d.stats.recipients });
}

type Step = 1 | 2 | 3;

/** Assistente em 3 passos: ficheiro e opções → destinatários (contagem) → resumo e envio. */
function SendWizard({ onSent }: { onSent: (id: string) => void }) {
  const { t } = useI18n();
  const { distributions, settings, structure } = useNovoRh();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [requiresConfirmation, setRequiresConfirmation] = useState(true);
  const [type, setType] = useState<DistributionAudience["type"]>("all");
  const [ids, setIds] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees(), enabled: step === 2 });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations(), enabled: step === 2 });
  const departments = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments(), enabled: step === 2 });
  const audience: DistributionAudience = type === "all" ? { type: "all" } : { type, ids };
  const audienceReady = type === "all" || ids.length > 0;
  const preview = useQuery({ queryKey: [...KEY, "preview", audience], queryFn: () => distributions.previewAudience(audience), enabled: step >= 2 && audienceReady });
  const send = useMutation({
    mutationFn: () => distributions.send({ title: title.trim(), audience, requiresConfirmation, file: file! }),
    onSuccess: async (d) => {
      setDone(t("docs.sentOk", { count: d.stats.recipients }));
      setStep(1);
      setFile(null);
      setTitle("");
      setIds([]);
      onSent(d.id);
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const fileError = file && !DISTRIBUTION_MIME.includes(file.type) ? t("docs.file.type") : file && file.size > DISTRIBUTION_MAX_BYTES ? t("docs.file.size") : null;
  const step1Ok = !!file && !fileError && !!title.trim();
  const options =
    type === "locations"
      ? (locations.data ?? [])
      : type === "departments"
        ? (departments.data ?? []).filter((d) => !d.archived).map((d) => ({ id: d.id, label: d.name }))
        : (employees.data ?? []);
  const steps: { n: Step; label: MessageKey }[] = [
    { n: 1, label: "docs.step.file" },
    { n: 2, label: "docs.step.recipients" },
    { n: 3, label: "docs.step.confirm" },
  ];
  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("docs.new")}>
      <h3 className={SECTION_TITLE}>{t("docs.new")}</h3>
      <ol className="flex flex-wrap gap-2 text-xs">
        {steps.map((s) => (
          <li key={s.n} aria-current={s.n === step ? "step" : undefined} className={`rounded-full px-2 py-0.5 ${s.n === step ? "bg-[#ED5C32] text-white" : "bg-stone-100 text-stone-500"}`}>
            {s.n}. {t(s.label)}
          </li>
        ))}
      </ol>
      {done && step === 1 && (
        <p className="text-sm text-emerald-700" role="status">
          {done}
        </p>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <label className="block">
            <span className={LABEL}>{t("docs.field.file")}</span>
            <input
              type="file"
              accept={DISTRIBUTION_MIME.join(",")}
              className="block text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setDone(null);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
          </label>
          <p className="text-xs text-stone-400">{t("docs.file.hint")}</p>
          {fileError && <p className="text-sm text-red-700">{fileError}</p>}
          <label className="block">
            <span className={LABEL}>{t("docs.field.title")}</span>
            <input className={`${FIELD} w-full`} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="flex items-center gap-1 text-sm text-stone-700">
            <input type="checkbox" checked={requiresConfirmation} onChange={(e) => setRequiresConfirmation(e.target.checked)} />
            {t("docs.field.confirm")}
          </label>
          <Button variant="primary" disabled={!step1Ok} onClick={() => setStep(2)}>
            {t("docs.next")}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className={LABEL}>{t("ann.field.audience")}</span>
              <select
                className={FIELD}
                value={type}
                onChange={(e) => {
                  setType(e.target.value as DistributionAudience["type"]);
                  setIds([]);
                }}
              >
                <option value="all">{t("ann.audience.all")}</option>
                <option value="locations">{t("ann.audience.locations")}</option>
                <option value="departments">{t("ann.audience.departments")}</option>
                <option value="employees">{t("ann.audience.employees")}</option>
              </select>
            </label>
            {type !== "all" && (
              <select multiple aria-label={t(`ann.audience.${type}` as MessageKey)} className={`${FIELD} min-w-[220px]`} value={ids} onChange={(e) => setIds([...e.target.selectedOptions].map((o) => o.value))}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          {audienceReady && preview.data && (
            <p className="text-xs text-stone-600" aria-live="polite">
              {t("ann.preview", { count: preview.data.recipients })}
              {preview.data.withoutAccount > 0 && ` ${t("ann.preview.noAccount", { count: preview.data.withoutAccount })}`}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => setStep(1)}>{t("docs.back")}</Button>
            <Button variant="primary" disabled={!audienceReady || !preview.data?.recipients} onClick={() => setStep(3)}>
              {t("docs.next")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && file && (
        <div className="space-y-2">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-stone-500">{t("docs.field.title")}</dt>
            <dd className="text-stone-800">{title.trim()}</dd>
            <dt className="text-stone-500">{t("docs.field.file")}</dt>
            <dd className="text-stone-800">
              {file.name} ({sizeLabel(file.size)})
            </dd>
            <dt className="text-stone-500">{t("docs.summary.recipients")}</dt>
            <dd className="text-stone-800">{preview.data?.recipients ?? 0}</dd>
            <dt className="text-stone-500">{t("docs.field.confirm")}</dt>
            <dd className="text-stone-800">{requiresConfirmation ? t("common.yes") : t("common.no")}</dd>
          </dl>
          <div className="flex gap-2">
            <Button onClick={() => setStep(2)}>{t("docs.back")}</Button>
            <Button variant="primary" disabled={send.isPending} onClick={() => send.mutate()}>
              {t("docs.send")}
            </Button>
          </div>
          {send.isError && <p className="text-sm text-red-700">{message(send.error, t("common.error"))}</p>}
        </div>
      )}
    </section>
  );
}

const STATUS_LABEL: Record<"delivered" | "read" | "confirmed", MessageKey> = { delivered: "docs.status.delivered", read: "docs.status.read", confirmed: "docs.status.confirmed" };

function Detail({ d, onGone }: { d: Distribution; onGone: () => void }) {
  const { t } = useI18n();
  const { distributions } = useNovoRh();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const report = useQuery({ queryKey: [...KEY, d.id, "report"], queryFn: () => distributions.report(d.id) });
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const remind = useMutation({ mutationFn: () => distributions.remind(d.id) });
  const archive = useMutation({
    mutationFn: () => distributions.archive(d.id),
    onSuccess: async () => {
      await refresh();
      onGone();
    },
  });
  const open = useMutation({ mutationFn: async () => window.open((await distributions.downloadUrl(d.id)).url, "_blank", "noopener") });
  const proof = useMutation({ mutationFn: async () => downloadBlob(await distributions.proofCsv(d.id), `prova-documento-${d.id}.csv`) });
  const rows = (report.data?.rows ?? []).filter((r) => filter === "all" || (d.requiresConfirmation ? !r.confirmedAt : !r.readAt));
  const error = remind.error ?? archive.error ?? open.error ?? proof.error ?? report.error;
  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={d.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={SECTION_TITLE}>{d.title}</h3>
          <p className="text-xs text-stone-500">
            {d.fileName} · {sizeLabel(d.sizeBytes)} · {t("docs.by", { who: d.createdBy, when: shortDateTime(d.createdAt) })}
          </p>
          {report.data && <p className="text-sm text-stone-700">{progress(t, { requiresConfirmation: d.requiresConfirmation, stats: report.data.totals })}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={open.isPending} onClick={() => open.mutate()}>
            {t("docs.open")}
          </Button>
          {d.status === "sent" && (
            <Button disabled={remind.isPending} onClick={() => remind.mutate()}>
              {t("docs.remind")}
            </Button>
          )}
          <Button icon={<IconDownload />} disabled={proof.isPending} onClick={() => proof.mutate()}>
            {t("docs.proof")}
          </Button>
          {d.status === "sent" && (
            <Button disabled={archive.isPending} onClick={() => archive.mutate()}>
              {t("docs.archive")}
            </Button>
          )}
        </div>
      </div>
      {remind.data && (
        <p className="text-sm text-stone-700" role="status">
          {t("docs.reminded", { notified: remind.data.notified, pending: remind.data.pending })}
        </p>
      )}
      {error && <p className="text-sm text-red-700">{message(error, t("common.error"))}</p>}
      <Tabs
        value={filter}
        onChange={setFilter}
        items={[
          { key: "all", label: t("docs.filter.all") },
          { key: "pending", label: t("docs.filter.pending") },
        ]}
      />
      <div className="max-h-[420px] overflow-auto">
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("docs.col.person")}</th>
              <th className={TH}>{t("docs.col.status")}</th>
              <th className={TH}>{t("docs.col.read")}</th>
              <th className={TH}>{t("docs.col.confirmed")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} className={TR}>
                <td className={TD}>
                  {r.name}
                  {!r.hasAccount && <span className="ml-1 text-xs text-stone-400">({t("docs.noAccount")})</span>}
                </td>
                <td className={TD}>
                  <StatusBadge tone={r.status === "confirmed" ? "success" : r.status === "read" ? "warning" : "neutral"}>{t(STATUS_LABEL[r.status])}</StatusBadge>
                </td>
                <td className={TD}>{shortDateTime(r.readAt)}</td>
                <td className={TD}>{shortDateTime(r.confirmedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
