import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { Incident, IncidentStatus, IncidentType } from "../../../domain/entities/attendance.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const monthStart = (today: string) => `${today.slice(0, 7)}-01`;

/** Incidentes (RE-14): resolver como corrigido, validar as horas (D8) ou dispensar — com comentário. */
export function IncidentsPanel() {
  const { t } = useI18n();
  const { attendance, settings } = useNovoRh();
  const [range, setRange] = useState(() => ({ from: monthStart(todayIn()), to: todayIn() }));
  const [status, setStatus] = useState<IncidentStatus | "">("open");
  const [type, setType] = useState<IncidentType | "">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const q = useQuery({
    queryKey: ["novo-rh", "attendance", "incidents", range, status],
    queryFn: () => attendance.incidents({ ...range, ...(status ? { status } : {}) }),
  });
  const name = (id: string) => employees.data?.find((e) => e.id === id)?.label ?? id;
  const rows = (q.data ?? []).filter((i) => !type || i.type === type);
  const open = rows.filter((i) => i.status === "open");
  const allChecked = open.length > 0 && open.every((i) => selected.has(i.id));
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="flex flex-wrap gap-2">
        <input aria-label={t("common.from")} type="date" className={FIELD} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <input aria-label={t("common.to")} type="date" className={FIELD} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <select aria-label={t("att.col.status")} className={FIELD} value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus | "")}>
          <option value="">{t("common.none")}</option>
          {(["open", "resolved_correct", "resolved_validate", "dismissed"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`att.incidentStatus.${s}` as MessageKey)}
            </option>
          ))}
        </select>
        <select aria-label={t("att.col.type")} className={FIELD} value={type} onChange={(e) => setType(e.target.value as IncidentType | "")}>
          <option value="">{t("att.incidents.allTypes")}</option>
          {(["missing_in", "missing_out", "auto_closed", "late"] as const).map((x) => (
            <option key={x} value={x}>
              {t(`att.incident.${x}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>
      {selected.size > 0 && <BatchResolve ids={[...selected]} onDone={() => setSelected(new Set())} />}
      {q.isError && <p className="text-sm text-red-700">{q.error instanceof Error ? q.error.message : t("common.loadError")}</p>}
      {q.data && rows.length === 0 && <p className="text-sm text-stone-500">{t("att.incidents.none")}</p>}
      {rows.length > 0 && (
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={`${TH} w-8`}>
                <input type="checkbox" aria-label={t("att.incidents.selectAll")} checked={allChecked} disabled={open.length === 0} onChange={() => setSelected(allChecked ? new Set() : new Set(open.map((i) => i.id)))} />
              </th>
              <th className={TH}>{t("common.employee")}</th>
              <th className={TH}>{t("common.date")}</th>
              <th className={TH}>{t("att.col.type")}</th>
              <th className={TH}>{t("att.col.status")}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={TR}>
                <td className={TD}>{i.status === "open" && <input type="checkbox" aria-label={t("att.incidents.select", { name: `${name(i.employeeId)} ${i.workDate}` })} checked={selected.has(i.id)} onChange={() => toggle(i.id)} />}</td>
                <td className={TD}>{name(i.employeeId)}</td>
                <td className={TD}>{i.workDate}</td>
                <td className={TD}>{t(`att.incident.${i.type}` as MessageKey)}</td>
                <td className={TD}>
                  <StatusBadge tone={i.status === "open" ? "warning" : "success"}>{t(`att.incidentStatus.${i.status}` as MessageKey)}</StatusBadge>
                  {i.comment && <span className="ml-2 text-xs text-stone-500">{i.comment}</span>}
                </td>
                <td className={TD}>{i.status === "open" && <ResolveActions incident={i} label={`${name(i.employeeId)} ${i.workDate}`} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ResolveActions({ incident, label }: { incident: Incident; label: string }) {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const m = useMutation({
    mutationFn: (resolution: "correct" | "validate" | "dismiss") => attendance.resolveIncident(incident.id, resolution, comment.trim() || null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["novo-rh", "attendance"] }),
  });
  const needsComment = !comment.trim();
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input aria-label={`${t("att.field.comment")} ${label}`} className={`${FIELD} w-40`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("att.field.comment")} />
      <Button size="sm" disabled={m.isPending} onClick={() => m.mutate("correct")}>
        {t("att.resolve.correct")}
      </Button>
      <Button size="sm" disabled={m.isPending || needsComment} title={needsComment ? t("att.resolve.commentRequired") : undefined} onClick={() => m.mutate("validate")}>
        {t("att.resolve.validate")}
      </Button>
      <Button size="sm" variant="tertiary" disabled={m.isPending || needsComment} title={needsComment ? t("att.resolve.commentRequired") : undefined} onClick={() => m.mutate("dismiss")}>
        {t("att.resolve.dismiss")}
      </Button>
      {m.isError && <span className="text-xs text-red-700">{m.error instanceof Error ? m.error.message : t("common.error")}</span>}
    </div>
  );
}

/** Resolver vários incidentes de uma vez (FE-033): o mesmo comentário e a mesma resolução; resultado por incidente. */
function BatchResolve({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const m = useMutation({
    mutationFn: async (resolution: "correct" | "validate" | "dismiss") => {
      const errors: string[] = [];
      for (const id of ids) {
        try {
          await attendance.resolveIncident(id, resolution, comment.trim() || null);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
      return errors;
    },
    onSuccess: (errors) => {
      void qc.invalidateQueries({ queryKey: ["novo-rh", "attendance"] });
      setFailed(errors);
      if (errors.length === 0) onDone();
    },
  });
  const needsComment = !comment.trim();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#F5C992] bg-[#FDF8F5] p-2" role="region" aria-label={t("att.incidents.batch")}>
      <span className="text-sm text-stone-700">{t("att.incidents.selected", { count: ids.length })}</span>
      <input aria-label={t("att.field.comment")} className={`${FIELD} w-56`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("att.field.comment")} />
      <Button size="sm" disabled={m.isPending} onClick={() => m.mutate("correct")}>
        {t("att.resolve.correct")}
      </Button>
      <Button size="sm" disabled={m.isPending || needsComment} title={needsComment ? t("att.resolve.commentRequired") : undefined} onClick={() => m.mutate("validate")}>
        {t("att.resolve.validate")}
      </Button>
      <Button size="sm" variant="tertiary" disabled={m.isPending || needsComment} title={needsComment ? t("att.resolve.commentRequired") : undefined} onClick={() => m.mutate("dismiss")}>
        {t("att.resolve.dismiss")}
      </Button>
      {failed.length > 0 && <span className="text-xs text-red-700">{t("att.incidents.batchFailed", { count: failed.length })}: {failed[0]}</span>}
    </div>
  );
}
