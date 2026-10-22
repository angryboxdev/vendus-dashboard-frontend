import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, IconDownload, LABEL, SegmentedControl, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { AttendanceDaysResult } from "../../../domain/entities/engagement.ts";
import {
  chunks,
  compliance,
  ddmmyyyy,
  EXPORT_COLUMNS,
  exportRows,
  grandTotals,
  hhmm,
  punctuality,
  reportLines,
  reportRange,
  teamSeries,
  type ReportBucket,
  type ReportPreset,
} from "../../../domain/services/attendance-report.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { loadBrandLogo } from "../../out/schedule-pdf.renderer.ts";
import { renderAttendanceReportPdf } from "../../out/attendance-report-pdf.renderer.ts";
import { PersonStatsChart } from "../people/PersonStatsChart.tsx";
import { downloadBlob } from "../download.ts";

type Scope = "all" | "location" | "group" | "department" | "employee";
const PRESETS: ReportPreset[] = ["week", "month", "lastMonth", "year", "since", "custom"];
const SCOPES: Scope[] = ["all", "location", "group", "department", "employee"];

interface Generated {
  data: AttendanceDaysResult;
  from: string;
  to: string;
  scopeLabel: string;
}

/**
 * Mais → Relatórios → Assiduidade: por semana, mês, ano ou desde a admissão;
 * para toda a empresa, um centro, grupo, departamento ou pessoa. O período é
 * pedido mês a mês (o motor apura até 31 dias de cada vez) e somado aqui;
 * exporta para Excel (formatado no servidor) e PDF.
 */
export function AttendanceReportView() {
  const { t } = useI18n();
  const { reports, settings, structure } = useNovoRh();
  const today = todayIn();
  const [preset, setPreset] = useState<ReportPreset>("month");
  const [custom, setCustom] = useState({ from: `${today.slice(0, 7)}-01`, to: today });
  const [scope, setScope] = useState<Scope>("all");
  const [target, setTarget] = useState("");
  const [bucket, setBucket] = useState<ReportBucket>("total");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Generated | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const groups = useQuery({ queryKey: ["novo-rh", "structure", "groups"], queryFn: () => structure.listGroups(), retry: false, enabled: scope === "group" });
  const departments = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments(), retry: false, enabled: scope === "department" });
  const options: { id: string; label: string }[] =
    scope === "location"
      ? (locations.data ?? [])
      : scope === "employee"
        ? (employees.data ?? [])
        : scope === "group"
          ? (groups.data ?? []).filter((g) => !g.archived).map((g) => ({ id: g.id, label: g.name }))
          : scope === "department"
            ? (departments.data ?? []).filter((d) => !d.archived).map((d) => ({ id: d.id, label: d.name }))
            : [];

  const generate = async () => {
    setError(null);
    setResult(null);
    const filters = {
      locationIds: scope === "location" && target ? [target] : [],
      groupIds: scope === "group" && target ? [target] : [],
      departmentIds: scope === "department" && target ? [target] : [],
      employeeIds: scope === "employee" && target ? [target] : [],
    };
    try {
      // «Desde a admissão»: primeiro um bloco curto para saber quem entra e a admissão mais antiga.
      let range = preset === "custom" ? custom : reportRange(preset, today, null);
      if (preset === "since") {
        const probe = await reports.attendanceDays({ from: today, to: today, ...filters });
        const hires = probe.people.map((p) => p.hireDate).filter((h): h is string => !!h).sort();
        range = reportRange("since", today, hires[0] ?? null);
      }
      if (range.to > today) range = { ...range, to: today };
      if (!range.from || range.from > range.to) throw new Error(t("arep.invalidPeriod"));
      const parts = chunks(range.from, range.to);
      setProgress({ done: 0, total: parts.length });
      const people = new Map<string, AttendanceDaysResult["people"][number]>();
      const days: AttendanceDaysResult["days"] = [];
      for (const [i, c] of parts.entries()) {
        const out = await reports.attendanceDays({ ...c, ...filters });
        for (const p of out.people) people.set(p.id, p);
        days.push(...out.days);
        setProgress({ done: i + 1, total: parts.length });
      }
      const scopeLabel = scope === "all" || !target ? t("arep.scope.all") : (options.find((o) => o.id === target)?.label ?? "");
      setResult({ data: { people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "pt")), days }, from: range.from, to: range.to, scopeLabel });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setProgress(null);
    }
  };

  const lines = result ? reportLines(result.data.people, result.data.days, bucket) : [];
  const total = result ? grandTotals(result.data.days) : null;
  const subtitle = result ? `${ddmmyyyy(result.from)} – ${ddmmyyyy(result.to)} · ${result.scopeLabel}` : "";
  const title = t("arep.title");

  const exportXlsx = async () => {
    setExporting("xlsx");
    try {
      const out = await reports.exportXlsx({ title, subtitle, columns: EXPORT_COLUMNS, rows: exportRows(lines) });
      downloadBlob(out.blob, out.fileName ?? "relatorio-assiduidade.xlsx");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setExporting(null);
    }
  };
  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const doc = renderAttendanceReportPdf(lines, total!, { title, subtitle, issuedAt: new Date(), logo: await loadBrandLogo() });
      doc.save(`relatorio-assiduidade-${result!.from}-${result!.to}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  const tile = (label: string, value: string, sub?: string, tone = "text-navy-900") => (
    <div className={`${SURFACE} p-4`}>
      <p className="text-xs font-medium text-ink-secondary">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-secondary">{sub}</p>}
    </div>
  );
  const pctText = (v: number | null) => (v === null ? "—" : `${v}%`);

  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-4 p-4 sm:p-5`} aria-label={t("arep.filters")}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className={LABEL}>{t("arep.period")}</span>
            <SegmentedControl<ReportPreset> label={t("arep.period")} value={preset} onChange={setPreset} items={PRESETS.map((p) => ({ key: p, label: t(`arep.preset.${p}` as MessageKey) }))} />
          </div>
          {preset === "custom" && (
            <>
              <label>
                <span className={LABEL}>{t("common.from")}</span>
                <input type="date" className={FIELD} value={custom.from} max={today} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              </label>
              <label>
                <span className={LABEL}>{t("common.to")}</span>
                <input type="date" className={FIELD} value={custom.to} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
              </label>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className={LABEL}>{t("arep.scope")}</span>
            <select className={FIELD} value={scope} onChange={(e) => (setScope(e.target.value as Scope), setTarget(""))}>
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {t(`arep.scope.${s}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          {scope !== "all" && (
            <label className="min-w-56">
              <span className={LABEL}>{t(`arep.scope.${scope}` as MessageKey)}</span>
              <select className={`${FIELD} w-full`} value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">{t("common.choose")}…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div>
            <span className={LABEL}>{t("arep.groupBy")}</span>
            <SegmentedControl<ReportBucket> label={t("arep.groupBy")} value={bucket} onChange={setBucket} items={(["total", "week", "month"] as const).map((b) => ({ key: b, label: t(`arep.bucket.${b}` as MessageKey) }))} />
          </div>
          <Button variant="primary" className="ml-auto" disabled={!!progress || (scope !== "all" && !target)} onClick={() => void generate()}>
            {progress ? t("arep.generating") : t("arep.generate")}
          </Button>
        </div>
        {progress && (
          <div role="status" aria-label={t("arep.progress", progress)} className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-brand-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
            <p className="text-xs text-ink-secondary">{t("arep.progress", progress)}</p>
          </div>
        )}
      </section>

      {error && (
        <AlertBanner tone="danger" title={t("common.error")}>
          {error}
        </AlertBanner>
      )}

      {result && total && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-ink-secondary">
              {subtitle} · {t("arep.peopleCount", { count: result.data.people.length })}
            </p>
            <Button variant="secondary" icon={<IconDownload />} disabled={!!exporting || !lines.length} onClick={() => void exportXlsx()}>
              {exporting === "xlsx" ? t("arep.exporting") : "Excel"}
            </Button>
            <Button variant="secondary" icon={<IconDownload />} disabled={!!exporting || !lines.length} onClick={() => void exportPdf()}>
              {exporting === "pdf" ? t("arep.exporting") : "PDF"}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tile(t("arep.kpi.worked"), hhmm(total.worked), t("arep.kpi.ofPlanned", { planned: hhmm(total.planned) }))}
            {tile(t("arep.kpi.difference"), `${total.worked - total.planned > 0 ? "+" : ""}${hhmm(total.worked - total.planned)}`, undefined, total.worked < total.planned ? "text-red-700" : "text-emerald-700")}
            {tile(t("arep.kpi.compliance"), pctText(compliance(total)), t("arep.kpi.days", { worked: total.workedDays, planned: total.plannedDays }))}
            {tile(t("arep.kpi.punctuality"), pctText(punctuality(total)), t("arep.kpi.punctualityHint"))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tile(t("arep.kpi.late"), String(total.late), t("arep.kpi.lateMinutes", { minutes: total.lateMinutes }), total.late ? "text-amber-700" : "text-navy-900")}
            {tile(t("arep.kpi.missing"), String(total.missing), undefined, total.missing ? "text-red-700" : "text-navy-900")}
            {tile(t("arep.kpi.forgotten"), String(total.forgotten))}
            {tile(t("arep.kpi.excused"), String(total.excused))}
          </div>
          <section className={`${SURFACE} p-4 sm:p-5`} aria-labelledby="arep-chart">
            <h3 id="arep-chart" className="mb-3 text-base font-semibold text-navy-900">
              {t("arep.chart")}
            </h3>
            <PersonStatsChart buckets={teamSeries(result.data.days, bucket)} />
          </section>
          <section className={`${SURFACE} overflow-x-auto`} aria-label={t("arep.table")}>
            {lines.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-secondary">{t("arep.empty")}</p>
            ) : (
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>{t("arep.col.person")}</th>
                    {bucket !== "total" && <th className={TH}>{t("arep.col.period")}</th>}
                    <th className={`${TH} text-right`}>{t("arep.col.planned")}</th>
                    <th className={`${TH} text-right`}>{t("arep.col.worked")}</th>
                    <th className={`${TH} text-right`}>{t("arep.col.difference")}</th>
                    <th className={`${TH} text-right`}>{t("arep.col.compliance")}</th>
                    <th className={`${TH} text-right`}>{t("arep.col.days")}</th>
                    <th className={`${TH} text-right`}>{t("arep.col.late")}</th>
                    <th className={`${TH} text-right`}>{t("arep.col.missing")}</th>
                    <th className={`${TH} text-right`}>{t("arep.col.forgotten")}</th>
                    <th className={`${TH} text-right`}>{t("arep.col.excused")}</th>
                    <th className={`${TH} text-right`}>{t("arep.col.punctuality")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const x = l.totals;
                    const diff = x.worked - x.planned;
                    return (
                      <tr key={`${l.person.id}|${l.periodKey}`} className={TR}>
                        <td className={`${TD} font-medium`}>{l.person.name}</td>
                        {bucket !== "total" && <td className={`${TD} text-ink-secondary`}>{l.periodLabel}</td>}
                        <td className={`${TD} text-right tabular-nums`}>{hhmm(x.planned)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{hhmm(x.worked)}</td>
                        <td className={`${TD} text-right tabular-nums ${diff < 0 ? "text-red-700" : ""}`}>{hhmm(diff)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{pctText(compliance(x))}</td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {x.workedDays}/{x.plannedDays}
                        </td>
                        <td className={`${TD} text-right tabular-nums ${x.late ? "text-amber-700" : ""}`}>{x.late ? `${x.late} · ${x.lateMinutes} min` : "0"}</td>
                        <td className={`${TD} text-right tabular-nums ${x.missing ? "text-red-700" : ""}`}>{x.missing}</td>
                        <td className={`${TD} text-right tabular-nums`}>{x.forgotten}</td>
                        <td className={`${TD} text-right tabular-nums`}>{x.excused}</td>
                        <td className={`${TD} text-right tabular-nums`}>{pctText(punctuality(x))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
