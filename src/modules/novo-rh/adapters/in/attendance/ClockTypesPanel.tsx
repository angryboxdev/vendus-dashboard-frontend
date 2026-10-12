import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, Drawer, FIELD, IconPlus, LABEL, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { ClockType, ClockTypeInput } from "../../../domain/entities/attendance.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "attendance", "clock-types"];
const WD = [1, 2, 3, 4, 5, 6, 7];

/**
 * Assiduidade → Tipos de registo (FE-105): formação, deslocação,
 * teletrabalho… O registo normal (obra) existe sempre; estes separam o resto
 * do tempo para salários e faturação.
 */
export function ClockTypesPanel() {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ClockType | "new" | null>(null);
  const q = useQuery({ queryKey: KEY, queryFn: () => attendance.listClockTypes() });
  const archive = useMutation({ mutationFn: (id: string) => attendance.archiveClockType(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const rows = (q.data ?? []).filter((c) => showArchived || !c.archived);
  const pay = (c: ClockType) => (c.remuneration === "paid" ? t("brk.pay.paid") : c.remuneration === "unpaid" ? t("brk.pay.unpaid") : t("brk.pay.hybridShort", { minutes: c.hybridPaidMinutes ?? 0 }));
  const blocked = (c: ClockType) =>
    [c.blockedWeekdays?.map((d) => t(`brk.wd.${d}` as MessageKey)).join(" "), c.blockedHours.map((h) => `${h.start}–${h.end}`).join(", ")].filter(Boolean).join(" · ") || "—";

  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-xs text-stone-500">{t("ctype.hint")}</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {t("brk.showArchived")}
          </label>
          <Button variant="primary" icon={<IconPlus />} onClick={() => setEditing("new")}>
            {t("ctype.new")}
          </Button>
        </div>
      </div>
      {q.isError && <p className="text-sm text-red-700">{q.error.message}</p>}
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>{t("brk.field.name")}</th>
            <th className={TH}>{t("brk.field.pay")}</th>
            <th className={TH}>{t("ctype.field.maxDay")}</th>
            <th className={TH}>{t("ctype.field.blocked")}</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          <tr className={TR}>
            <td className={TD}>
              <span className="font-medium text-stone-900">{t("ctype.normal")}</span>
              <span className="block text-xs text-stone-500">{t("ctype.normalHint")}</span>
            </td>
            <td className={TD}>{t("brk.pay.paid")}</td>
            <td className={TD}>—</td>
            <td className={TD}>—</td>
            <td className={TD} />
          </tr>
          {rows.map((c) => (
            <tr key={c.id} className={TR}>
              <td className={TD}>
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color ?? "#A8A29E" }} aria-hidden="true" />
                <span className="font-medium text-stone-900">{c.name}</span> {c.remote && <StatusBadge tone="neutral">{t("ctype.remote")}</StatusBadge>} {c.archived && <StatusBadge tone="neutral">{t("brk.archived")}</StatusBadge>}
              </td>
              <td className={TD}>{pay(c)}</td>
              <td className={TD}>{c.maxMinutesPerDay ? t("brk.minutes", { minutes: c.maxMinutesPerDay }) : t("brk.noLimit")}</td>
              <td className={TD}>{blocked(c)}</td>
              <td className={TD}>
                {!c.archived && (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => setEditing(c)}>
                      {t("brk.edit")}
                    </Button>
                    <Button size="sm" variant="tertiary" aria-label={`${t("brk.archive")} ${c.name}`} disabled={archive.isPending} onClick={() => archive.mutate(c.id)}>
                      {t("brk.archive")}
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && <ClockTypeDrawer current={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ClockTypeDrawer({ current, onClose }: { current: ClockType | null; onClose: () => void }) {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const qc = useQueryClient();
  const [v, setV] = useState<ClockTypeInput>(() =>
    current
      ? { name: current.name, color: current.color, remote: current.remote, remuneration: current.remuneration, hybridPaidMinutes: current.hybridPaidMinutes, maxMinutesPerDay: current.maxMinutesPerDay, blockedWeekdays: current.blockedWeekdays, blockedHours: current.blockedHours }
      : // Remuneração sem escolha prévia: afeta salários e faturação.
        { name: "", color: "#6366F1", remote: false, remuneration: "" as ClockTypeInput["remuneration"], hybridPaidMinutes: null, maxMinutesPerDay: null, blockedWeekdays: null, blockedHours: [] },
  );
  const [reason, setReason] = useState("");
  const set = <K extends keyof ClockTypeInput>(k: K, val: ClockTypeInput[K]) => setV({ ...v, [k]: val });
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const save = useMutation({
    mutationFn: () => (current ? attendance.updateClockType(current.id, v, current.version, reason) : attendance.createClockType(v)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
  });
  const toggleDay = (d: number) => {
    const cur = v.blockedWeekdays ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort();
    set("blockedWeekdays", next.length ? next : null);
  };
  const invalid =
    !v.name.trim() || !v.remuneration || (v.remuneration === "hybrid" && !v.hybridPaidMinutes) || (v.blockedWeekdays?.length ?? 0) === 7 || v.blockedHours.some((h) => !h.start || !h.end || h.start === h.end) || (!!current && reason.trim().length < 5);

  return (
    <Drawer
      open
      title={current ? t("ctype.editTitle", { name: current.name }) : t("ctype.new")}
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
        <div className="flex items-center gap-4">
          <label className="block">
            <span className={LABEL}>{t("brk.field.color")}</span>
            <input type="color" className="h-8 w-16 rounded border border-stone-300" value={v.color ?? "#6366F1"} onChange={(e) => set("color", e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-800">
            <input type="checkbox" checked={v.remote} onChange={(e) => set("remote", e.target.checked)} />
            {t("ctype.field.remote")}
          </label>
        </div>
        <fieldset>
          <legend className={LABEL}>{t("brk.field.pay")}</legend>
          <div className="space-y-1 text-sm text-stone-800">
            {(["paid", "unpaid", "hybrid"] as const).map((r) => (
              <label key={r} className="flex items-start gap-2">
                <input type="radio" name="ct-remuneration" checked={v.remuneration === r} onChange={() => setV({ ...v, remuneration: r, hybridPaidMinutes: r === "hybrid" ? (v.hybridPaidMinutes ?? 30) : null })} />
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
          <span className={LABEL}>{t("ctype.field.maxDayHint")}</span>
          <input inputMode="numeric" className={`${FIELD} w-32`} placeholder={t("brk.noLimit")} value={v.maxMinutesPerDay ?? ""} onChange={(e) => set("maxMinutesPerDay", num(e.target.value))} />
        </label>
        <fieldset>
          <legend className={LABEL}>{t("ctype.field.blockedDays")}</legend>
          <div className="flex flex-wrap gap-1">
            {WD.map((d) => {
              const on = v.blockedWeekdays?.includes(d) ?? false;
              return (
                <button key={d} type="button" aria-pressed={on} onClick={() => toggleDay(d)} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-red-400 bg-red-50 text-red-700" : "border-stone-200 text-stone-600"}`}>
                  {t(`brk.wd.${d}` as MessageKey)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className={LABEL}>{t("ctype.field.blockedHours")}</legend>
          <div className="space-y-1">
            {v.blockedHours.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" aria-label={t("ctype.field.blockedFrom", { n: i + 1 })} className={FIELD} value={h.start} onChange={(e) => set("blockedHours", v.blockedHours.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                <span className="text-stone-500">–</span>
                <input type="time" aria-label={t("ctype.field.blockedTo", { n: i + 1 })} className={FIELD} value={h.end} onChange={(e) => set("blockedHours", v.blockedHours.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                <Button size="sm" variant="tertiary" onClick={() => set("blockedHours", v.blockedHours.filter((_, j) => j !== i))}>
                  {t("ctype.removeRange")}
                </Button>
              </div>
            ))}
            {v.blockedHours.length < 6 && (
              <Button size="sm" onClick={() => set("blockedHours", [...v.blockedHours, { start: "12:00", end: "13:00" }])}>
                {t("ctype.addRange")}
              </Button>
            )}
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
