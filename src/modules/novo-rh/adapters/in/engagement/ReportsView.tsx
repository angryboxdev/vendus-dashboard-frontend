import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, FIELD, LABEL, SECTION_TITLE, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { ReportDefinition, ReportParams } from "../../../domain/entities/engagement.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { downloadBlob } from "../download.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const PREVIEW = 50;

/**
 * Novo RH → Relatórios: catálogo por grupos (FE-063) e gerador com filtros,
 * colunas e pré-visualização. `groups` limita aos relatórios da área
 * (Assiduidade, Ausências, Colaboradores); sem `groups`, todos.
 */
export function ReportsView({ groups }: { groups?: string[] } = {}) {
  const { t } = useI18n();
  const { reports } = useNovoRh();
  const catalog = useQuery({ queryKey: ["novo-rh", "reports", "catalog"], queryFn: () => reports.catalog() });
  const [key, setKey] = useState("");
  const defs = useMemo(() => (groups ? catalog.data?.filter((d) => groups.includes(d.group)) : catalog.data), [catalog.data, groups]);
  const def = defs?.find((r) => r.key === key);
  if (def) return <ReportGenerator key={def.key} def={def} onBack={() => setKey("")} />;
  return <ReportsCatalog defs={defs} loading={catalog.isLoading} error={catalog.isError ? message(catalog.error, t("common.error")) : null} onOpen={setKey} />;
}

function ReportsCatalog({ defs, loading, error, onOpen }: { defs: ReportDefinition[] | undefined; loading: boolean; error: string | null; onOpen: (key: string) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = new Map<string, { label: string; items: ReportDefinition[] }>();
    for (const d of defs ?? []) {
      if (term && !`${d.label} ${d.description}`.toLowerCase().includes(term)) continue;
      const g = out.get(d.group) ?? { label: d.groupLabel, items: [] };
      g.items.push(d);
      out.set(d.group, g);
    }
    return [...out.entries()];
  }, [defs, q]);
  return (
    <section className="space-y-3">
      <label className="block max-w-sm">
        <span className={LABEL}>{t("rep.search")}</span>
        <input type="search" className={`${FIELD} w-full`} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {loading && <p className="text-sm text-stone-500">{t("common.loading")}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!loading && !error && groups.length === 0 && <p className="text-sm text-stone-500">{t("rep.emptyCatalog")}</p>}
      {groups.map(([group, g]) => (
        <details key={group} open className={`${SURFACE} p-4`}>
          <summary className={`${SECTION_TITLE} cursor-pointer`}>{g.label}</summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((d) => (
              <li key={d.key}>
                <button type="button" onClick={() => onOpen(d.key)} className="h-full w-full rounded-lg border border-[#F5C992]/60 p-3 text-left transition hover:bg-[#FDF8F5]">
                  <span className="block text-sm font-semibold text-stone-900">{d.label}</span>
                  <span className="mt-1 block text-xs text-stone-500">{d.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}

function CheckList({ legend, options, value, onChange }: { legend: string; options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="min-w-0">
      <legend className={LABEL}>
        {legend} {value.length > 0 && <span className="text-stone-400">({value.length})</span>}
      </legend>
      <div className="max-h-40 overflow-auto rounded-md border border-stone-200 p-2">
        {options.length === 0 && <p className="text-xs text-stone-400">{t("rep.noOptions")}</p>}
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 py-0.5 text-sm text-stone-700">
            <input type="checkbox" checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ReportGenerator({ def, onBack }: { def: ReportDefinition; onBack: () => void }) {
  const { t } = useI18n();
  const { reports, settings } = useNovoRh();
  const today = todayIn();
  const [range, setRange] = useState({ from: `${today.slice(0, 7)}-01`, to: today });
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>(() => def.columns.map((c) => c.key));
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations(), enabled: def.perEmployee });
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees(), enabled: def.perEmployee });
  const badPeriod = def.needsPeriod && (!range.from || !range.to || range.to < range.from);
  // Mantém a ordem da definição; "todas" vai sem parâmetro.
  const ordered = def.columns.filter((c) => columns.includes(c.key)).map((c) => c.key);
  const params: ReportParams = {
    period: def.needsPeriod ? range : null,
    locationIds: def.perEmployee ? locationIds : [],
    employeeIds: def.perEmployee ? employeeIds : [],
    columns: ordered.length === def.columns.length ? [] : ordered,
  };
  const run = useMutation({ mutationFn: () => reports.run(def.key, params) });
  const csv = useMutation({ mutationFn: async () => downloadBlob(await reports.csv(def.key, params), `relatorio-${def.key}.csv`) });
  const blocked = badPeriod || ordered.length === 0;
  const shown = run.data?.columns ?? run.data?.definition.columns ?? [];
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onBack}>{t("rep.back")}</Button>
        <h2 className={SECTION_TITLE}>{def.label}</h2>
      </div>
      <p className="text-xs text-stone-500">{def.description}</p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className={`${SURFACE} space-y-3 p-4`} role="group" aria-label={t("rep.filters")}>
          {def.needsPeriod && (
            <div className="flex flex-wrap gap-2">
              <label>
                <span className={LABEL}>{t("common.from")}</span>
                <input type="date" className={FIELD} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
              </label>
              <label>
                <span className={LABEL}>{t("common.to")}</span>
                <input type="date" className={FIELD} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
              </label>
              {badPeriod && <p className="w-full text-xs text-red-700">{t("rep.badPeriod")}</p>}
            </div>
          )}
          {def.perEmployee && (
            <>
              <CheckList legend={t("rep.locations")} options={locations.data?.map((o) => ({ id: o.id, label: o.label })) ?? []} value={locationIds} onChange={setLocationIds} />
              <CheckList legend={t("rep.people")} options={employees.data?.map((o) => ({ id: o.id, label: o.label })) ?? []} value={employeeIds} onChange={setEmployeeIds} />
              <p className="text-xs text-stone-400">{t("rep.scopeNote")}</p>
            </>
          )}
          <fieldset>
            <legend className={LABEL}>{t("rep.columns")}</legend>
            {def.columns.map((c) => (
              <label key={c.key} className="flex items-start gap-2 py-0.5 text-sm text-stone-700">
                <input type="checkbox" className="mt-1" checked={columns.includes(c.key)} onChange={(e) => setColumns(e.target.checked ? [...columns, c.key] : columns.filter((x) => x !== c.key))} />
                <span>
                  {c.label}
                  {c.hint && <span className="block text-xs text-stone-400">{c.hint}</span>}
                </span>
              </label>
            ))}
            {ordered.length === 0 && <p className="text-xs text-red-700">{t("rep.noColumns")}</p>}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={blocked || run.isPending} onClick={() => run.mutate()}>
              {t("rep.run")}
            </Button>
            <Button disabled={blocked || csv.isPending} onClick={() => csv.mutate()}>
              {t("rep.csv")}
            </Button>
          </div>
        </div>
        <div className={`${SURFACE} min-w-0 space-y-2 p-4`}>
          <h3 className={SECTION_TITLE}>{t("rep.preview")}</h3>
          {(run.isError || csv.isError) && <p className="text-sm text-red-700">{message(run.error ?? csv.error, t("common.error"))}</p>}
          {!run.data && !run.isError && <p className="text-sm text-stone-500">{t("rep.previewHint")}</p>}
          {run.data && run.data.rows.length === 0 && <p className="text-sm text-stone-500">{t("rep.none")}</p>}
          {run.data && run.data.rows.length > 0 && (
            <>
              <p className="text-xs text-stone-500">
                {t("rep.rows", { count: run.data.rows.length })}
                {run.data.rows.length > PREVIEW && ` · ${t("rep.previewFirst", { count: PREVIEW })}`}
              </p>
              <div className="max-h-[480px] overflow-auto">
                <table className={TABLE}>
                  <thead className={THEAD}>
                    <tr>
                      {shown.map((c) => (
                        <th key={c.key} className={TH} title={c.hint}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {run.data.rows.slice(0, PREVIEW).map((r, i) => (
                      <tr key={i} className={TR}>
                        {shown.map((c) => (
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
        </div>
      </div>
    </section>
  );
}
