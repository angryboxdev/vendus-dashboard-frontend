import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, FIELD, LABEL, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { downloadBlob } from "../download.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Novo RH → Relatórios prioritários (assiduidade, saldos, ausências, dados incompletos, histórico). */
export function ReportsView() {
  const { t } = useI18n();
  const { reports } = useNovoRh();
  const catalog = useQuery({ queryKey: ["novo-rh", "reports", "catalog"], queryFn: () => reports.catalog() });
  const [key, setKey] = useState("");
  const today = todayIn();
  const [range, setRange] = useState({ from: `${today.slice(0, 7)}-01`, to: today });
  const def = catalog.data?.find((r) => r.key === key);
  const period = def?.needsPeriod ? range : null;
  const run = useMutation({ mutationFn: () => reports.run(key, period) });
  const csv = useMutation({
    mutationFn: async () => downloadBlob(await reports.csv(key, period), `relatorio-${key}.csv`),
  });
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className={LABEL}>{t("rep.choose")}</span>
          <select className={`${FIELD} min-w-[220px]`} value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="">{t("common.choose")}…</option>
            {(catalog.data ?? []).map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {def?.needsPeriod && (
          <>
            <label>
              <span className={LABEL}>{t("common.from")}</span>
              <input type="date" className={FIELD} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </label>
            <label>
              <span className={LABEL}>{t("common.to")}</span>
              <input type="date" className={FIELD} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </label>
          </>
        )}
        <Button variant="primary" disabled={!key || run.isPending} onClick={() => run.mutate()}>
          {t("rep.run")}
        </Button>
        <Button disabled={!key || csv.isPending} onClick={() => csv.mutate()}>
          {t("rep.csv")}
        </Button>
      </div>
      {def && <p className="text-xs text-stone-500">{def.description}</p>}
      {(run.isError || csv.isError) && <p className="text-sm text-red-700">{message(run.error ?? csv.error, t("common.error"))}</p>}
      {run.data && run.data.rows.length === 0 && <p className="text-sm text-stone-500">{t("rep.none")}</p>}
      {run.data && run.data.rows.length > 0 && (
        <>
          <p className="text-xs text-stone-500">{t("rep.rows", { count: run.data.rows.length })}</p>
          <div className="max-h-[480px] overflow-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  {run.data.definition.columns.map((c) => (
                    <th key={c.key} className={TH}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {run.data.rows.map((r, i) => (
                  <tr key={i} className={TR}>
                    {run.data!.definition.columns.map((c) => (
                      <td key={c.key} className={TD}>
                        {typeof r[c.key] === "number" ? (r[c.key] as number).toLocaleString("pt-PT") : (r[c.key] ?? "")}
                      </td>
                    ))}
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
