import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, Drawer, FIELD, IconSearch, LABEL, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import { MIN_REJECT_REASON, OLD_REQUEST_DAYS, type DecisionResult, type InboxRow, type InboxSegment, type InboxType } from "../../../domain/entities/inbox.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "inbox"] as const;
type Pending = { keys: string[]; decision: "approve" | "reject" };

const relative = (days: number, t: (k: MessageKey, p?: Record<string, string | number>) => string) => (days === 0 ? t("inbox.age.today") : t("inbox.age.days", { days }));

/**
 * Novo RH → Pedidos (FE-050): todos os pedidos que a gestão decide num só
 * sítio — por tipo, com contadores, decisão individual ou em lote. As regras
 * (sem autoaprovação, nível atual, período fechado) são do servidor.
 */
export function InboxView() {
  const { t } = useI18n();
  const { inbox } = useNovoRh();
  const [type, setType] = useState<InboxType | null>(null);
  const [segment, setSegment] = useState<InboxSegment>("mine");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<InboxRow | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [results, setResults] = useState<{ rows: InboxRow[]; results: DecisionResult[] } | null>(null);
  const q = useQuery({ queryKey: [...KEY, type ?? "all", segment], queryFn: () => inbox.list({ type, segment }), refetchInterval: 120_000 });

  const rows = useMemo(() => (q.data?.items ?? []).filter((r) => !search || r.employeeName.toLowerCase().includes(search.toLowerCase())), [q.data, search]);
  const decidable = rows.filter((r) => r.canDecide);
  const allChecked = decidable.length > 0 && decidable.every((r) => selected.has(r.key));
  const toggle = (key: string) => setSelected((s) => (s.has(key) ? new Set([...s].filter((k) => k !== key)) : new Set([...s, key])));
  const totalMine = Object.values(q.data?.counters ?? {}).reduce((s, c) => s + (c?.mine ?? 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav aria-label={t("inbox.types")} className={`${SURFACE} h-fit p-2`}>
        <TypeButton active={type === null} label={t("inbox.type.all")} count={totalMine} onClick={() => (setType(null), setSelected(new Set()))} />
        {(q.data?.types ?? []).map((ty) => (
          <TypeButton key={ty} active={type === ty} label={t(`inbox.type.${ty}` as MessageKey)} count={q.data?.counters[ty]?.mine ?? 0} onClick={() => (setType(ty), setSelected(new Set()))} />
        ))}
      </nav>

      <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("inbox.title")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label={t("inbox.segments")} className="flex flex-wrap gap-1">
            {(["mine", "others", "all"] as const).map((s) => (
              <button
                key={s}
                role="tab"
                type="button"
                aria-selected={segment === s}
                onClick={() => (setSegment(s), setSelected(new Set()))}
                className={`rounded-full px-3 py-1 text-sm ${segment === s ? "bg-[#FDF8F5] font-medium text-[#C2410C] ring-1 ring-[#ED5C32]" : "text-stone-600 hover:bg-stone-50"}`}
              >
                {t(`inbox.segment.${s}` as MessageKey)}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">{t("inbox.search")}</span>
            <IconSearch size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
            <input className={`${FIELD} pl-7`} placeholder={t("inbox.search")} aria-label={t("inbox.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>

        {results && <ResultsBanner rows={results.rows} results={results.results} onClose={() => setResults(null)} />}
        {q.isError && <p className="text-sm text-red-700">{q.error.message}</p>}
        {q.isLoading && <p className="text-sm text-stone-400">{t("common.loading")}</p>}
        {q.data && rows.length === 0 && <p className="py-6 text-center text-sm text-stone-500">{t(segment === "mine" ? "inbox.empty.mine" : "inbox.empty")}</p>}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={`${TH} w-8`}>
                    <input
                      type="checkbox"
                      aria-label={t("inbox.selectAll")}
                      checked={allChecked}
                      disabled={decidable.length === 0}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(decidable.map((r) => r.key)))}
                    />
                  </th>
                  <th className={TH}>{t("inbox.col.request")}</th>
                  <th className={TH}>{t("inbox.col.requester")}</th>
                  <th className={TH}>{t("inbox.col.age")}</th>
                  <th className={TH}>{t("inbox.col.level")}</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={`${TR} hover:bg-[#FDF8F5]`}>
                    <td className={TD}>
                      {r.canDecide && <input type="checkbox" aria-label={t("inbox.select", { name: r.employeeName })} checked={selected.has(r.key)} onChange={() => toggle(r.key)} />}
                    </td>
                    <td className={TD}>
                      <button type="button" className="text-left hover:underline" onClick={() => setOpen(r)}>
                        <span className="font-medium text-stone-900">{r.title}</span>
                        <span className="block text-xs text-stone-500">{r.detail}</span>
                      </button>
                    </td>
                    <td className={TD}>
                      <span className="text-stone-900">{r.employeeName}</span>
                      {r.locationName && <span className="block text-xs text-stone-500">{r.locationName}</span>}
                    </td>
                    <td className={TD} title={new Date(r.requestedAt).toLocaleString("pt-PT")}>
                      {r.ageDays >= OLD_REQUEST_DAYS ? <StatusBadge tone="warning">{t("inbox.age.old", { days: r.ageDays })}</StatusBadge> : <span className="text-stone-600">{relative(r.ageDays, t)}</span>}
                    </td>
                    <td className={TD}>{r.level ? t("inbox.level", { current: r.level.current, total: r.level.total }) : "—"}</td>
                    <td className={TD}>
                      {r.canDecide ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="primary" onClick={() => setPending({ keys: [r.key], decision: "approve" })}>
                            {t("inbox.approve")}
                          </Button>
                          <Button size="sm" onClick={() => setPending({ keys: [r.key], decision: "reject" })}>
                            {t("inbox.reject")}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-500">{t(`inbox.blocked.${r.blockedReason ?? "no_permission"}` as MessageKey)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected.size > 0 && (
          <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#F5C992] bg-white p-3 shadow-md" role="region" aria-label={t("inbox.batch")}>
            <span className="text-sm text-stone-700">{t("inbox.selected", { count: selected.size })}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="tertiary" onClick={() => setSelected(new Set())}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={() => setPending({ keys: [...selected], decision: "reject" })}>
                {t("inbox.rejectN", { count: selected.size })}
              </Button>
              <Button size="sm" variant="primary" onClick={() => setPending({ keys: [...selected], decision: "approve" })}>
                {t("inbox.approveN", { count: selected.size })}
              </Button>
            </div>
          </div>
        )}
      </section>

      {open && (
        <Drawer open title={open.title} description={`${open.employeeName}${open.locationName ? ` · ${open.locationName}` : ""}`} onClose={() => setOpen(null)}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className={LABEL}>{t("inbox.col.request")}</dt>
              <dd className="text-stone-900">{open.detail}</dd>
            </div>
            <div>
              <dt className={LABEL}>{t("inbox.requestedAt")}</dt>
              <dd className="text-stone-900">
                {new Date(open.requestedAt).toLocaleString("pt-PT")} · {relative(open.ageDays, t)}
              </dd>
            </div>
            {open.level && (
              <div>
                <dt className={LABEL}>{t("inbox.col.level")}</dt>
                <dd className="text-stone-900">{t("inbox.level", { current: open.level.current, total: open.level.total })}</dd>
              </div>
            )}
            {open.meta.map((m) => (
              <div key={m.label}>
                <dt className={LABEL}>{m.label}</dt>
                <dd className="whitespace-pre-wrap text-stone-900">{m.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex gap-2">
            {open.canDecide ? (
              <>
                <Button variant="primary" onClick={() => (setPending({ keys: [open.key], decision: "approve" }), setOpen(null))}>
                  {t("inbox.approve")}
                </Button>
                <Button onClick={() => (setPending({ keys: [open.key], decision: "reject" }), setOpen(null))}>{t("inbox.reject")}</Button>
              </>
            ) : (
              <p className="text-sm text-stone-500">{t(`inbox.blocked.${open.blockedReason ?? "no_permission"}` as MessageKey)}</p>
            )}
          </div>
        </Drawer>
      )}

      {pending && (
        <DecisionDrawer
          pending={pending}
          rows={(q.data?.items ?? []).filter((r) => pending.keys.includes(r.key))}
          onClose={() => setPending(null)}
          onDone={(rs, res) => {
            setPending(null);
            setSelected(new Set());
            setResults({ rows: rs, results: res });
          }}
        />
      )}
    </div>
  );
}

function TypeButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${active ? "bg-[#FDF8F5] font-medium text-[#C2410C]" : "text-stone-700 hover:bg-stone-50"}`}
    >
      <span>{label}</span>
      <span className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${count ? "bg-[#ED5C32] text-white" : "bg-stone-100 text-stone-500"}`}>{count}</span>
    </button>
  );
}

/** Confirmar a decisão (um ou vários). Recusar exige motivo, comunicado ao requerente. */
function DecisionDrawer({ pending, rows, onClose, onDone }: { pending: Pending; rows: InboxRow[]; onClose: () => void; onDone: (rows: InboxRow[], results: DecisionResult[]) => void }) {
  const { t } = useI18n();
  const { inbox } = useNovoRh();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const reject = pending.decision === "reject";
  const m = useMutation({
    mutationFn: () => inbox.decide(pending.keys, pending.decision, comment.trim() || null),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["novo-rh"] });
      onDone(rows, res);
    },
  });
  const invalid = reject && comment.trim().length < MIN_REJECT_REASON;
  return (
    <Drawer
      open
      title={t(reject ? "inbox.confirm.reject" : "inbox.confirm.approve", { count: pending.keys.length })}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="tertiary" onClick={onClose} disabled={m.isPending}>
            {t("common.cancel")}
          </Button>
          <Button variant={reject ? "danger" : "primary"} disabled={invalid || m.isPending} onClick={() => m.mutate()}>
            {reject ? t("inbox.reject") : t("inbox.approve")}
          </Button>
        </div>
      }
    >
      <ul className="mb-4 space-y-1 text-sm text-stone-700">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="font-medium">{r.employeeName}</span> — {r.title} · {r.detail}
          </li>
        ))}
      </ul>
      <label className={LABEL} htmlFor="inbox-comment">
        {reject ? t("inbox.reason") : t("inbox.comment")}
      </label>
      <textarea id="inbox-comment" className={`${FIELD} w-full`} rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
      {reject && <p className="mt-1 text-xs text-stone-500">{t("inbox.reasonHint", { min: MIN_REJECT_REASON })}</p>}
      {m.isError && <p className="mt-2 text-sm text-red-700">{m.error.message}</p>}
    </Drawer>
  );
}

function ResultsBanner({ rows, results, onClose }: { rows: InboxRow[]; results: DecisionResult[]; onClose: () => void }) {
  const { t } = useI18n();
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const label = (key: string) => {
    const r = rows.find((x) => x.key === key);
    return r ? `${r.employeeName} — ${r.title}` : key;
  };
  return (
    <AlertBanner
      tone={failed.length ? "warning" : "success"}
      title={t("inbox.result", { ok, failed: failed.length })}
      action={
        <Button size="sm" variant="tertiary" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      {failed.length > 0 && (
        <ul className="mt-1 list-disc pl-4">
          {failed.map((f) => (
            <li key={f.key}>
              {label(f.key)}: {f.message}
            </li>
          ))}
        </ul>
      )}
    </AlertBanner>
  );
}
