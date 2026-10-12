import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, Drawer, FIELD, IconPlus, LABEL, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { BreakType, BreakTypeInput } from "../../../domain/entities/attendance.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "attendance", "break-types"];
const WD = [1, 2, 3, 4, 5, 6, 7];

/**
 * Assiduidade → Pausas (FE-103): catálogo de pausas que os colaboradores
 * escolhem ao marcar. A remuneração decide o que conta como trabalhado.
 */
export function BreakTypesPanel() {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<BreakType | "new" | null>(null);
  const q = useQuery({ queryKey: KEY, queryFn: () => attendance.listBreakTypes() });
  const archive = useMutation({ mutationFn: (id: string) => attendance.archiveBreakType(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const rows = (q.data ?? []).filter((b) => showArchived || !b.archived);
  const pay = (b: BreakType) => (b.remuneration === "paid" ? t("brk.pay.paid") : b.remuneration === "unpaid" ? t("brk.pay.unpaid") : t("brk.pay.hybridShort", { minutes: b.hybridPaidMinutes ?? 0 }));
  const days = (b: BreakType) => (b.weekdays ? b.weekdays.map((d) => t(`brk.wd.${d}` as MessageKey)).join(" ") : t("brk.allDays"));

  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-xs text-stone-500">{t("brk.hint")}</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {t("brk.showArchived")}
          </label>
          <Button variant="primary" icon={<IconPlus />} onClick={() => setEditing("new")}>
            {t("brk.new")}
          </Button>
        </div>
      </div>
      {q.isError && <p className="text-sm text-red-700">{q.error.message}</p>}
      {q.data && rows.length === 0 && <p className="text-sm text-stone-500">{t("brk.none")}</p>}
      {rows.length > 0 && (
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("brk.field.name")}</th>
              <th className={TH}>{t("brk.field.pay")}</th>
              <th className={TH}>{t("brk.field.max")}</th>
              <th className={TH}>{t("brk.field.window")}</th>
              <th className={TH}>{t("brk.field.uses")}</th>
              <th className={TH}>{t("brk.field.days")}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className={TR}>
                <td className={TD}>
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color ?? "#A8A29E" }} aria-hidden="true" />
                  <span className="font-medium text-stone-900">{b.name}</span> {b.archived && <StatusBadge tone="neutral">{t("brk.archived")}</StatusBadge>}
                </td>
                <td className={TD}>{pay(b)}</td>
                <td className={TD}>{b.maxMinutes ? t("brk.minutes", { minutes: b.maxMinutes }) : t("brk.noLimit")}</td>
                <td className={TD}>{b.windowStart ? `${b.windowStart}–${b.windowEnd}` : t("brk.anyTime")}</td>
                <td className={TD}>{b.maxUsesPerDay ?? t("brk.noLimit")}</td>
                <td className={TD}>{days(b)}</td>
                <td className={TD}>
                  {!b.archived && (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => setEditing(b)}>
                        {t("brk.edit")}
                      </Button>
                      <Button size="sm" variant="tertiary" aria-label={`${t("brk.archive")} ${b.name}`} disabled={archive.isPending} onClick={() => archive.mutate(b.id)}>
                        {t("brk.archive")}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <BreakTypeDrawer current={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function BreakTypeDrawer({ current, onClose }: { current: BreakType | null; onClose: () => void }) {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const qc = useQueryClient();
  const [v, setV] = useState<BreakTypeInput>(() =>
    current
      ? { name: current.name, color: current.color, remuneration: current.remuneration, hybridPaidMinutes: current.hybridPaidMinutes, maxMinutes: current.maxMinutes, windowStart: current.windowStart, windowEnd: current.windowEnd, maxUsesPerDay: current.maxUsesPerDay, weekdays: current.weekdays }
      : // Sem remuneração pré-escolhida: é sempre uma decisão explícita.
        { name: "", color: "#0EA5E9", remuneration: "" as BreakTypeInput["remuneration"], hybridPaidMinutes: null, maxMinutes: null, windowStart: null, windowEnd: null, maxUsesPerDay: null, weekdays: null },
  );
  const [reason, setReason] = useState("");
  const set = <K extends keyof BreakTypeInput>(k: K, val: BreakTypeInput[K]) => setV({ ...v, [k]: val });
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const save = useMutation({
    mutationFn: () => (current ? attendance.updateBreakType(current.id, v, current.version, reason) : attendance.createBreakType(v)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
  });
  const invalid = !v.name.trim() || !v.remuneration || (v.remuneration === "hybrid" && !v.hybridPaidMinutes) || (v.windowStart !== null && (!v.windowStart || !v.windowEnd)) || (v.weekdays !== null && v.weekdays.length === 0) || (!!current && reason.trim().length < 5);

  return (
    <Drawer
      open
      title={current ? t("brk.editTitle", { name: current.name }) : t("brk.new")}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="tertiary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" disabled={invalid || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className={LABEL}>{t("brk.field.name")}</span>
          <input className={`${FIELD} w-full`} maxLength={60} value={v.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="block">
          <span className={LABEL}>{t("brk.field.color")}</span>
          <input type="color" className="h-8 w-16 rounded border border-stone-300" value={v.color ?? "#0EA5E9"} onChange={(e) => set("color", e.target.value)} />
        </label>
        <fieldset>
          <legend className={LABEL}>{t("brk.field.pay")}</legend>
          <div className="space-y-1 text-sm text-stone-800">
            {(["paid", "unpaid", "hybrid"] as const).map((r) => (
              <label key={r} className="flex items-start gap-2">
                <input type="radio" name="remuneration" checked={v.remuneration === r} onChange={() => setV({ ...v, remuneration: r, hybridPaidMinutes: r === "hybrid" ? (v.hybridPaidMinutes ?? 15) : null })} />
                <span>
                  {t(`brk.pay.${r}` as MessageKey)}
                  <span className="block text-xs text-stone-500">{t(`brk.pay.${r}.hint` as MessageKey)}</span>
                </span>
              </label>
            ))}
          </div>
          {v.remuneration === "hybrid" && (
            <label className="mt-2 block">
              <span className={LABEL}>{t("brk.field.hybridMinutes")}</span>
              <input inputMode="numeric" className={`${FIELD} w-32`} value={v.hybridPaidMinutes ?? ""} onChange={(e) => set("hybridPaidMinutes", num(e.target.value))} />
            </label>
          )}
        </fieldset>
        <label className="block">
          <span className={LABEL}>{t("brk.field.maxHint")}</span>
          <input inputMode="numeric" className={`${FIELD} w-32`} placeholder={t("brk.noLimit")} value={v.maxMinutes ?? ""} onChange={(e) => set("maxMinutes", num(e.target.value))} />
        </label>
        <fieldset>
          <label className="flex items-center gap-2 text-sm text-stone-800">
            <input type="checkbox" checked={v.windowStart !== null} onChange={(e) => setV({ ...v, windowStart: e.target.checked ? "12:00" : null, windowEnd: e.target.checked ? "14:00" : null })} />
            {t("brk.field.windowToggle")}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input type="time" aria-label={t("brk.field.windowStart")} className={FIELD} disabled={v.windowStart === null} value={v.windowStart ?? ""} onChange={(e) => set("windowStart", e.target.value)} />
            <span className="text-stone-500">–</span>
            <input type="time" aria-label={t("brk.field.windowEnd")} className={FIELD} disabled={v.windowStart === null} value={v.windowEnd ?? ""} onChange={(e) => set("windowEnd", e.target.value)} />
          </div>
        </fieldset>
        <label className="block">
          <span className={LABEL}>{t("brk.field.usesHint")}</span>
          <input inputMode="numeric" className={`${FIELD} w-32`} placeholder={t("brk.noLimit")} value={v.maxUsesPerDay ?? ""} onChange={(e) => set("maxUsesPerDay", num(e.target.value))} />
        </label>
        <fieldset>
          <label className="flex items-center gap-2 text-sm text-stone-800">
            <input type="checkbox" checked={v.weekdays !== null} onChange={(e) => set("weekdays", e.target.checked ? [1, 2, 3, 4, 5] : null)} />
            {t("brk.field.daysToggle")}
          </label>
          <div className="mt-1 flex flex-wrap gap-1">
            {WD.map((d) => {
              const on = v.weekdays?.includes(d) ?? true;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  disabled={v.weekdays === null}
                  onClick={() => set("weekdays", on ? v.weekdays!.filter((x) => x !== d) : [...v.weekdays!, d].sort())}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-[#ED5C32] bg-[#FDF8F5] text-[#C2410C]" : "border-stone-200 text-stone-500"} disabled:opacity-50`}
                >
                  {t(`brk.wd.${d}` as MessageKey)}
                </button>
              );
            })}
          </div>
        </fieldset>
        {current && (
          <label className="block">
            <span className={LABEL}>{t("brk.field.reason")}</span>
            <input className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
            <span className="mt-1 block text-xs text-stone-500">{t("brk.reasonHint")}</span>
          </label>
        )}
        {save.isError && (
          <AlertBanner tone="danger" title={t("common.error")}>
            {save.error.message}
          </AlertBanner>
        )}
      </div>
    </Drawer>
  );
}
