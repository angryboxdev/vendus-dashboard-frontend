import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AppIcon, Avatar, Button, EmptyState, FIELD, IconDownload, IconPlus, IconSearch, Skeleton, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR, Tabs, type AppIconKey } from "../../../../../components/ui/index.ts";
import type { PersonDayView } from "../../../domain/entities/overview.ts";
import type { Person } from "../../../domain/entities/people.ts";
import { formatDuration } from "../../../domain/services/attendance.service.ts";
import { mergeStoredColumns, todayHours, todaySchedule, weeklyHoursLabel } from "../../../domain/services/people-list.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { downloadBlob } from "../download.ts";
import { ImportPeopleDrawer } from "./ImportPeopleDrawer.tsx";
import { NewPersonDrawer } from "./NewPersonDrawer.tsx";

type Status = "active" | "inactive" | "all";
type Column = "nif" | "position" | "location" | "schedule" | "hoursToday" | "hire" | "email" | "phone" | "status";
const COLUMNS: Column[] = ["nif", "position", "location", "schedule", "hoursToday", "hire", "email", "phone", "status"];
const DEFAULT_COLUMNS: Column[] = ["nif", "position", "location", "schedule", "hoursToday", "hire", "status"];
/** Colunas acrescentadas depois de haver escolhas guardadas: aparecem uma vez a quem já tinha escolhido. */
const INTRODUCED: Column[] = ["schedule", "hoursToday"];
const COLUMNS_KEY = "novo-rh.people.columns";

function loadColumns(): Column[] {
  try {
    const raw = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "null") as unknown;
    return mergeStoredColumns(raw, COLUMNS, DEFAULT_COLUMNS, INTRODUCED) ?? DEFAULT_COLUMNS;
  } catch {
    // Sem armazenamento: colunas por omissão.
  }
  return DEFAULT_COLUMNS;
}

/**
 * Novo RH → Pessoas (FE-011): lista no âmbito de quem vê, com números de topo
 * que filtram, filtros por local/cargo guardados no endereço (partilháveis),
 * colunas à escolha (por navegador), criar, importar e exportar.
 */
export function PeopleListView() {
  const { t } = useI18n();
  const { people, settings, overview } = useNovoRh();
  const [params, setParams] = useSearchParams();
  const status = (["active", "inactive", "all"].includes(params.get("status") ?? "") ? params.get("status") : "active") as Status;
  const location = params.get("local") ?? "";
  const position = params.get("cargo") ?? "";
  const incomplete = params.get("completar") === "1";
  const set = (k: string, v: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v) n.set(k, v);
        else n.delete(k);
        return n;
      },
      { replace: true },
    );
  // Pesquisa fica no estado local (nomes não vão para o endereço).
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [columns, setColumns] = useState<Column[]>(loadColumns);
  const [choosing, setChoosing] = useState(false);
  const list = useQuery({ queryKey: ["novo-rh", "people", status, q], queryFn: () => people.list({ status, ...(q.trim() && { q: q.trim() }) }) });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const positions = useQuery({ queryKey: ["novo-rh", "catalog", "positions"], queryFn: () => people.listPositions() });
  // «Horário» e «Horas hoje»: a mesma vista do dia da Visão geral (um pedido para todos, mesma cache).
  const wantsToday = status !== "inactive" && (columns.includes("schedule") || columns.includes("hoursToday"));
  const today = useQuery({ queryKey: ["novo-rh", "overview", "today"], queryFn: () => overview.get(), enabled: wantsToday, retry: false });
  const dayOf = new Map<string, PersonDayView>((today.data?.people ?? []).map((o) => [o.employeeId, o]));
  const locationName = (id: string | null) => (id ? (locations.data?.find((l) => l.id === id)?.label ?? "—") : "—");
  const positionName = (id: string | null) => (id ? (positions.data?.find((x) => x.id === id)?.name ?? "—") : "—");
  const missingText = (p: Person) => t("people.missingList", { fields: p.missing.map((f) => t(`people.field.${f}` as MessageKey)).join(", ") });
  const filtered = !!(location || position || incomplete || q.trim());
  const clearFilters = () => {
    setQ("");
    setParams((p) => {
      const n = new URLSearchParams(p);
      for (const k of ["local", "cargo", "completar"]) n.delete(k);
      return n;
    }, { replace: true });
  };

  const all = list.data ?? [];
  const rows = all.filter((p) => (!location || (location === "none" ? !p.primaryLocationId : p.primaryLocationId === location)) && (!position || p.positionId === position) && (!incomplete || p.missing.length > 0));
  const kpis = [
    { key: "total", icon: "people" as AppIconKey, label: t("people.kpi.total"), value: all.length, active: !location && !incomplete, onClick: () => (set("local", null), set("completar", null)) },
    { key: "incomplete", icon: "incomplete" as AppIconKey, label: t("people.kpi.incomplete"), value: all.filter((p) => p.missing.length > 0).length, active: incomplete, onClick: () => set("completar", incomplete ? null : "1") },
    { key: "noLocation", icon: "noLocation" as AppIconKey, label: t("people.kpi.noLocation"), value: all.filter((p) => !p.primaryLocationId).length, active: location === "none", onClick: () => set("local", location === "none" ? null : "none") },
  ];
  const toggleColumn = (c: Column) => {
    const next = columns.includes(c) ? columns.filter((x) => x !== c) : COLUMNS.filter((x) => x === c || columns.includes(x));
    setColumns(next);
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify({ cols: next, known: COLUMNS }));
    } catch {
      // Sem armazenamento: vale só nesta página.
    }
  };
  const cell = (p: Person, c: Column) => {
    switch (c) {
      case "nif":
        return p.hidden.includes("nif") ? <span className="text-stone-400">{t("people.hiddenValue")}</span> : (p.nif ?? "—");
      case "position":
        return positionName(p.positionId);
      case "location":
        return locationName(p.primaryLocationId);
      case "schedule": {
        const s = p.status === "active" ? todaySchedule(dayOf.get(p.id)) : { kind: "unknown" as const };
        const weekly = weeklyHoursLabel(p.weeklyHours);
        const main =
          s.kind === "hours" ? <span className="tabular-nums text-stone-800">{s.text}</span>
          : s.kind === "flexible" ? <span className="text-stone-800">{t("people.schedule.flexible", { hours: formatDuration(s.theoreticalSeconds) })}</span>
          : s.kind === "day_off" ? <span className="text-stone-500">{t("people.schedule.dayOff")}</span>
          : s.kind === "absent" ? <span className="text-stone-500">{s.absenceType ?? t("people.schedule.absent")}</span>
          : s.kind === "none" ? <span className="text-stone-400">{t("people.schedule.none")}</span>
          : today.isLoading && wantsToday && p.status === "active" ? <Skeleton className="h-3.5 w-20" />
          : <span className="text-stone-400">—</span>;
        return (
          <div className="leading-tight">
            {main}
            {weekly && <p className="mt-0.5 text-xs text-stone-400">{t("people.schedule.weekly", { hours: weekly })}</p>}
          </div>
        );
      }
      case "hoursToday": {
        const h = p.status === "active" ? todayHours(dayOf.get(p.id)) : null;
        if (!h) return today.isLoading && wantsToday && p.status === "active" ? <Skeleton className="h-3.5 w-16" /> : <span className="text-stone-400">—</span>;
        return (
          <div className="min-w-[7rem]" title={h.theoreticalSeconds > 0 ? t("people.hoursToday.of", { hours: formatDuration(h.theoreticalSeconds) }) : undefined}>
            <span className="tabular-nums text-stone-800">{formatDuration(h.workedSeconds)}</span>
            {h.ratio !== null && (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-label={t("people.column.hoursToday")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(h.ratio * 100)}>
                <div className="h-full rounded-full bg-[#ED5C32]" style={{ width: `${Math.round(h.ratio * 100)}%` }} />
              </div>
            )}
          </div>
        );
      }
      case "hire":
        return p.hireDate ?? "—";
      case "email":
        return p.hidden.includes("email") ? <span className="text-stone-400">{t("people.hiddenValue")}</span> : (p.email ?? "—");
      case "phone":
        return p.hidden.includes("phone") ? <span className="text-stone-400">{t("people.hiddenValue")}</span> : (p.phone ?? "—");
      case "status":
        return (
          <div className="flex flex-wrap gap-1">
            <StatusBadge tone={p.status === "active" ? "success" : "neutral"}>{p.status === "active" ? t("people.active") : t("people.inactive")}</StatusBadge>
            {p.missing.length > 0 && (
              <Link to={`/hr/novo/pessoas/${p.id}`} title={missingText(p)} aria-label={`${t("people.toComplete")} — ${missingText(p)}`} className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ED5C32]">
                <StatusBadge tone="warning">{t("people.toComplete")}</StatusBadge>
              </Link>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={status}
          onChange={(v) => set("status", v === "active" ? null : v)}
          items={[
            { key: "active", label: t("people.status.active") },
            { key: "inactive", label: t("people.status.inactive") },
            { key: "all", label: t("people.status.all") },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<AppIcon name="upload" size={18} />} onClick={() => setImporting(true)}>
            {t("people.import")}
          </Button>
          <Button size="sm" icon={<IconDownload />} onClick={() => void people.exportCsv().then((b) => downloadBlob(b, "colaboradores.csv"))}>
            {t("people.export")}
          </Button>
          <Link to="/hr/novo/convites" className="inline-flex items-center gap-1.5 self-center text-sm font-medium text-[#C2410C] hover:underline">
            <AppIcon name="invite" size={18} />
            {t("people.invitations")}
          </Link>
          <Button size="sm" variant="primary" icon={<IconPlus />} onClick={() => setCreating(true)}>
            {t("people.new")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:max-w-xl" role="group" aria-label={t("people.kpis")}>
        {kpis.map((k) => (
          <button key={k.key} type="button" aria-pressed={k.active} onClick={k.onClick} className={`${SURFACE} p-3 text-left hover:border-[#ED5C32]/60 ${k.active && k.key !== "total" ? "ring-2 ring-[#ED5C32]/50" : ""}`}>
            <p className="flex items-center gap-1.5 text-xs text-stone-500">
              <AppIcon name={k.icon} size={18} className="text-stone-400" />
              {k.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-stone-900">{k.value}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative block w-full max-w-sm">
          <span className="pointer-events-none absolute left-2.5 top-2 text-stone-400">
            <IconSearch />
          </span>
          <input aria-label={t("people.search")} placeholder={t("people.search")} className={`${FIELD} w-full pl-8`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select aria-label={t("people.col.location")} className={FIELD} value={location} onChange={(e) => set("local", e.target.value || null)}>
          <option value="">{t("ovw.allLocations")}</option>
          <option value="none">{t("people.kpi.noLocation")}</option>
          {(locations.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <select aria-label={t("people.col.position")} className={FIELD} value={position} onChange={(e) => set("cargo", e.target.value || null)}>
          <option value="">{t("people.allPositions")}</option>
          {(positions.data ?? []).map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <div className="relative ml-auto">
          <Button size="sm" icon={<AppIcon name="columns" size={18} />} aria-expanded={choosing} onClick={() => setChoosing(!choosing)}>
            {t("people.columns")}
          </Button>
          {choosing && (
            <fieldset className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-[#F5C992] bg-white p-3 shadow-md">
              <legend className="sr-only">{t("people.columns")}</legend>
              {COLUMNS.map((c) => (
                <label key={c} className="flex items-center gap-2 py-0.5 text-sm text-stone-700">
                  <input type="checkbox" checked={columns.includes(c)} onChange={() => toggleColumn(c)} />
                  {t(`people.column.${c}` as MessageKey)}
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </div>

      <section className={`${SURFACE} overflow-x-auto`}>
        {list.isLoading ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label={t("common.loading")}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="ml-auto h-3.5 w-24" />
              </div>
            ))}
          </div>
        ) : list.isError ? (
          <div className="flex flex-wrap items-center gap-3 p-4">
            <p className="text-sm text-red-700">{t("common.loadError")}</p>
            <Button size="sm" onClick={() => void list.refetch()}>
              {t("people.retry")}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={filtered ? t("people.emptyFiltered") : t("people.empty")}
            action={
              filtered ? (
                <Button size="sm" onClick={clearFilters}>
                  {t("people.clearFilters")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("people.col.name")}</th>
                {columns.map((c) => (
                  <th key={c} className={TH}>
                    {t(`people.column.${c}` as MessageKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={TR}>
                  <td className={TD}>
                    <Link to={`/hr/novo/pessoas/${p.id}`} className="inline-flex items-center gap-2.5 font-medium text-stone-900 hover:underline">
                      <Avatar name={p.fullName} photoUrl={p.photoUrl} size="sm" />
                      {p.fullName}
                    </Link>
                  </td>
                  {columns.map((c) => (
                    <td key={c} className={TD}>
                      {cell(p, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-stone-500">{t("people.count", { shown: rows.length, total: all.length })}</p>

      <NewPersonDrawer open={creating} onClose={() => setCreating(false)} locations={locations.data ?? []} />
      <ImportPeopleDrawer open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}
