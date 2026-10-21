import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AppIcon, Avatar, Button, DropdownMenu, EmptyState, FIELD, IconChevronDown, IconDownload, IconPlus, IconSearch, Skeleton, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { PersonDayView } from "../../../domain/entities/overview.ts";
import type { Person } from "../../../domain/entities/people.ts";
import { formatDuration } from "../../../domain/services/attendance.service.ts";
import { displayDate, mergeStoredColumns, shortName, todayHours, todaySchedule, weeklyHoursLabel } from "../../../domain/services/people-list.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { downloadBlob } from "../download.ts";
import { ImportPeopleDrawer } from "./ImportPeopleDrawer.tsx";
import { NewPersonDrawer } from "./NewPersonDrawer.tsx";

type Status = "active" | "inactive" | "all";
type Column = "nif" | "position" | "location" | "schedule" | "hoursToday" | "hire" | "email" | "phone" | "status";
/** Ordem das colunas na tabela (prioridade da lista premium); as escolhidas aparecem sempre por esta ordem. */
const COLUMNS: Column[] = ["position", "location", "schedule", "hire", "status", "hoursToday", "nif", "email", "phone"];
const DEFAULT_COLUMNS: Column[] = ["position", "location", "schedule", "hire", "status"];
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
 * Novo RH → Pessoas (FE-011, lista premium): cabeçalho com «Novo colaborador»
 * e um menu «Ações» (CSV, convites); estado num seletor; uma faixa de
 * filtros guardada no endereço (partilhável); contagem e alertas só quando há
 * algo a resolver; tabela compacta com nome curto (o completo fica no título,
 * no leitor de ecrã e na pesquisa) e colunas à escolha (por navegador).
 */
export function PeopleListView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { people, settings, overview, invitations } = useNovoRh();
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
  // Pedidos de adesão por decidir (só para o aviso no menu; sem permissão, simplesmente não aparece).
  const requests = useQuery({ queryKey: ["novo-rh", "invitations", "requests"], queryFn: () => invitations.requests(), retry: false, staleTime: 60_000 });
  const pendingRequests = (requests.data ?? []).filter((r) => r.status === "pending").length;
  // «Horário» e «Horas hoje»: a mesma vista do dia da Visão geral (um pedido para todos, mesma cache).
  const wantsToday = status !== "inactive" && (columns.includes("schedule") || columns.includes("hoursToday"));
  // Só o dia de hoje (endpoint leve): antes pedia a semana inteira de toda a equipa.
  const today = useQuery({ queryKey: ["novo-rh", "overview", "today-only"], queryFn: () => overview.today(), enabled: wantsToday, retry: false });
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
  const byPosition = (p: Person) => !position || p.positionId === position;
  const byLocation = (p: Person) => !location || (location === "none" ? !p.primaryLocationId : p.primaryLocationId === location);
  const rows = all.filter((p) => byLocation(p) && byPosition(p) && (!incomplete || p.missing.length > 0));
  // Alertas sobre o que se está a ver (estado, pesquisa, cargo, centro) — nunca só sobre uma página.
  // «Sem local» ignora o centro escolhido: quem não tem local nunca pertence a um centro.
  const incompleteCount = all.filter((p) => byLocation(p) && byPosition(p) && p.missing.length > 0).length;
  const noLocationCount = all.filter((p) => byPosition(p) && (!incomplete || p.missing.length > 0) && !p.primaryLocationId).length;
  const toggleColumn = (c: Column) => {
    const next = columns.includes(c) ? columns.filter((x) => x !== c) : COLUMNS.filter((x) => x === c || columns.includes(x));
    setColumns(next);
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify({ cols: next, known: COLUMNS }));
    } catch {
      // Sem armazenamento: vale só nesta página.
    }
  };
  const shown = COLUMNS.filter((c) => columns.includes(c));
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
        // Sem barra vazia: 0h é só «ainda sem horas», não falta.
        return (
          <div className="min-w-[6rem]" title={h.theoreticalSeconds > 0 ? t("people.hoursToday.of", { hours: formatDuration(h.theoreticalSeconds) }) : undefined}>
            <span className="tabular-nums text-stone-800">{formatDuration(h.workedSeconds)}</span>
            {h.ratio !== null && h.workedSeconds > 0 && (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-label={t("people.column.hoursToday")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(h.ratio * 100)}>
                <div className="h-full rounded-full bg-[#ED5C32]" style={{ width: `${Math.round(h.ratio * 100)}%` }} />
              </div>
            )}
          </div>
        );
      }
      case "hire":
        return <span className="tabular-nums">{displayDate(p.hireDate)}</span>;
      case "email":
        return p.hidden.includes("email") ? <span className="text-stone-400">{t("people.hiddenValue")}</span> : (p.email ?? "—");
      case "phone":
        return p.hidden.includes("phone") ? <span className="text-stone-400">{t("people.hiddenValue")}</span> : (p.phone ?? "—");
      case "status": {
        // Em «Ativos» só as exceções; em «Inativos»/«Todos» também o estado.
        const showState = status !== "active";
        const parts = [
          showState && <StatusBadge key="state" tone={p.status === "active" ? "success" : "neutral"}>{p.status === "active" ? t("people.active") : t("people.inactive")}</StatusBadge>,
          p.missing.length > 0 && (
            <Link key="missing" to={`/hr/novo/pessoas/${p.id}`} title={missingText(p)} aria-label={`${t("people.toComplete")} — ${missingText(p)}`} className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ED5C32]">
              <StatusBadge tone="warning">{t("people.toComplete")}</StatusBadge>
            </Link>
          ),
          !p.primaryLocationId && <StatusBadge key="noLocation" tone="neutral">{t("people.kpi.noLocation")}</StatusBadge>,
        ].filter(Boolean);
        return parts.length ? <div className="flex gap-1">{parts}</div> : <span className="text-stone-400">—</span>;
      }
    }
  };

  const countText = filtered ? t("people.countOf", { shown: rows.length, total: all.length }) : rows.length === 1 ? t("people.countAll.one") : t("people.countAll", { count: rows.length });
  const alert = (key: "incomplete" | "noLocation", on: boolean, count: number, label: string, onClick: () => void) =>
    count > 0 || on ? (
      <button
        key={key}
        type="button"
        aria-pressed={on}
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ED5C32] ${on ? "border-amber-300 bg-amber-100 text-amber-900" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
      >
        <AppIcon name={key} size={14} />
        {label}
        {on && <span aria-hidden="true">×</span>}
      </button>
    ) : null;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">{t("people.title")}</h2>
          <p className="text-sm text-stone-500">{t("people.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu
            label={t("people.actions")}
            items={[
              { label: t("people.import"), icon: <AppIcon name="upload" size={16} />, onSelect: () => setImporting(true) },
              { label: t("people.export"), icon: <IconDownload />, onSelect: () => void people.exportCsv().then((b) => downloadBlob(b, "colaboradores.csv")) },
              "separator",
              { label: pendingRequests > 0 ? t("people.invitationsPending", { count: pendingRequests }) : t("people.invitations"), icon: <AppIcon name="invite" size={16} />, onSelect: () => navigate("/hr/novo/convites") },
            ]}
            trigger={({ open, toggle }) => (
              <Button size="sm" aria-haspopup="menu" aria-expanded={open} onClick={toggle} aria-label={pendingRequests > 0 ? `${t("people.actions")} — ${t("people.invitationsPending", { count: pendingRequests })}` : t("people.actions")}>
                <span className="inline-flex items-center gap-1.5">
                  {t("people.actions")}
                  {pendingRequests > 0 && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#ED5C32]" />}
                  <IconChevronDown size={16} />
                </span>
              </Button>
            )}
          />
          <Button size="sm" variant="primary" icon={<IconPlus />} onClick={() => setCreating(true)}>
            {t("people.new")}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={t("people.statusFilter")} className={`${FIELD} w-auto`} value={status} onChange={(e) => set("status", e.target.value === "active" ? null : e.target.value)}>
          <option value="active">{t("people.status.active")}</option>
          <option value="inactive">{t("people.status.inactive")}</option>
          <option value="all">{t("people.status.all")}</option>
        </select>
        <label className="relative block min-w-[12rem] flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute left-2.5 top-2 text-stone-400">
            <IconSearch />
          </span>
          <input aria-label={t("people.search")} placeholder={t("people.search")} className={`${FIELD} w-full pl-8`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select aria-label={t("people.col.location")} className={`${FIELD} w-auto`} value={location} onChange={(e) => set("local", e.target.value || null)}>
          <option value="">{t("ovw.allLocations")}</option>
          <option value="none">{t("people.kpi.noLocation")}</option>
          {(locations.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <select aria-label={t("people.col.position")} className={`${FIELD} w-auto`} value={position} onChange={(e) => set("cargo", e.target.value || null)}>
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

      <section className={`${SURFACE} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-4 py-2.5">
          <p className="text-sm font-medium text-stone-700" aria-live="polite">
            {list.isLoading ? t("common.loading") : countText}
          </p>
          {!list.isLoading && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("people.alerts")}>
              {alert("incomplete", incomplete, incompleteCount, incompleteCount === 1 ? t("people.alert.incomplete.one") : t("people.alert.incomplete", { count: incompleteCount }), () => set("completar", incomplete ? null : "1"))}
              {alert("noLocation", location === "none", noLocationCount, noLocationCount === 1 ? t("people.alert.noLocation.one") : t("people.alert.noLocation", { count: noLocationCount }), () => set("local", location === "none" ? null : "none"))}
            </div>
          )}
          {filtered && !list.isLoading && rows.length > 0 && (
            <button type="button" onClick={clearFilters} className="ml-auto text-xs font-medium text-[#C2410C] hover:underline">
              {t("people.clearFilters")}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
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
                  <th className={TH}>{t("people.col.person")}</th>
                  {shown.map((c) => (
                    <th key={c} className={`${TH} whitespace-nowrap`}>
                      {t(`people.column.${c}` as MessageKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={TR}>
                    <td className={`${TD} py-2.5`}>
                      <Link
                        to={`/hr/novo/pessoas/${p.id}`}
                        title={p.fullName}
                        aria-label={p.fullName}
                        className="inline-flex max-w-[16rem] items-center gap-2.5 rounded font-medium text-stone-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ED5C32]"
                      >
                        <Avatar name={p.fullName} photoUrl={p.photoUrl} size="sm" />
                        <span className="truncate">{shortName(p.fullName)}</span>
                      </Link>
                    </td>
                    {shown.map((c) => (
                      <td key={c} className={`${TD} whitespace-nowrap py-2.5`}>
                        {cell(p, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <NewPersonDrawer open={creating} onClose={() => setCreating(false)} locations={locations.data ?? []} />
      <ImportPeopleDrawer open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}
