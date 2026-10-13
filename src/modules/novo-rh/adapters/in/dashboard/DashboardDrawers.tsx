import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar, Button, Drawer, SearchInput, SearchableSelect, Skeleton, Tabs } from "../../../../../components/ui/index.ts";
import type { OperationalSnapshot, TeamCategory, UnitRow } from "../../../domain/entities/dashboard.ts";
import { TEAM_LABEL } from "../../../domain/services/dashboard.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { useEmployeePhotos } from "../common/use-employee-photos.ts";
import { TeamStatusDonut } from "./TeamStatusDonut.tsx";
import { CoverageBody, GoogleReviewsBody } from "./Widgets.tsx";

const hm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : null);

/**
 * Lista de uma categoria (carregada só ao abrir; âmbito no servidor). O nome
 * abre a ficha pelo id.
 */
export function TeamList({ category, locationId, units }: { category: TeamCategory; locationId: string | null; units?: { id: string; label: string }[] }) {
  const { dashboard } = useNovoRh();
  const photoOf = useEmployeePhotos();
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState(locationId ?? "");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["novo-rh", "dashboard", "team", category, unit || null, q, page],
    queryFn: ({ signal }) => dashboard.team(category, { locationId: unit || null, q, page }, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const data = list.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <SearchInput label="Pesquisar colaborador" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} className="min-w-[180px] flex-1" />
        {units && units.length > 1 && !locationId && (
          <SearchableSelect label="Unidade" allLabel="Todas as unidades" value={unit} options={units} onChange={(v) => (setUnit(v), setPage(1))} triggerClassName="h-10" />
        )}
      </div>
      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : list.isError ? (
        <p className="text-sm text-ink-secondary">Não foi possível carregar a lista.</p>
      ) : !data?.items.length ? (
        <p className="text-sm text-ink-secondary">Ninguém nesta categoria.</p>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {data.items.map((p) => (
            <li key={p.employeeId} className="flex items-center gap-3 py-2.5">
              <Avatar name={p.name} photoUrl={photoOf(p.employeeId)} size="sm" />
              <div className="min-w-0 flex-1">
                <Link to={`/hr/novo/pessoas/${p.employeeId}`} className="block truncate text-sm font-medium text-navy-900 hover:underline">
                  {p.name}
                </Link>
                <p className="truncate text-xs text-ink-secondary">
                  {[p.absenceType, p.plannedStart && p.plannedEnd ? `${p.plannedStart}–${p.plannedEnd}` : null, hm(p.firstInAt) ? `entrada ${hm(p.firstInAt)}` : null, p.lateMinutes > 0 ? `atraso ${p.lateMinutes} min` : null, p.locationName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-xs text-ink-secondary">
          <span>
            A mostrar {Math.min(data.page * data.pageSize, data.total)} de {data.total}
          </span>
          {data.page * data.pageSize < data.total && (
            <Button size="sm" onClick={() => setPage(page + 1)}>
              Mais
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function TeamDrawer({ category, s, onClose }: { category: TeamCategory | null; s: OperationalSnapshot; onClose: () => void }) {
  const units = s.locations.map((l) => ({ id: l.locationId, label: l.name }));
  return (
    <Drawer
      open={!!category}
      title={category ? `${TEAM_LABEL[category]} hoje` : ""}
      description={category ? `${s.team[category]} colaborador(es)${s.context.name ? ` · ${s.context.name}` : ""}` : undefined}
      onClose={onClose}
      footer={
        <Link to="/hr/novo/assiduidade" className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500">
          Ver em Assiduidade
        </Link>
      }
    >
      {category && <TeamList key={category} category={category} locationId={s.context.locationId} units={units} />}
    </Drawer>
  );
}

type UnitTab = "overview" | "team" | "coverage" | "requests" | "reviews";

/** Detalhe de uma unidade sem sair do Dashboard: as mesmas fontes, filtradas pelo local. */
export function UnitDrawer({ unit, onClose, onFocusUnit }: { unit: UnitRow | null; onClose: () => void; onFocusUnit: (locationId: string) => void }) {
  const { dashboard, inbox } = useNovoRh();
  const [tab, setTab] = useState<UnitTab>("overview");
  const [cat, setCat] = useState<TeamCategory>("working");
  const snap = useQuery({
    queryKey: ["novo-rh", "dashboard", "snapshot", unit?.locationId ?? null],
    queryFn: ({ signal }) => dashboard.snapshot(unit!.locationId, signal),
    enabled: !!unit,
    staleTime: 30_000,
  });
  const reqs = useQuery({ queryKey: ["novo-rh", "inbox", "dashboard"], queryFn: () => inbox.list({ type: null, segment: "mine" }), enabled: !!unit && tab === "requests", staleTime: 30_000 });
  const s = snap.data;
  const kpi = (label: string, n: number, warn = false) => (
    <div className="rounded-xl border border-line-subtle px-3 py-2.5 text-center">
      <p className={`text-xl font-bold tabular-nums ${warn && n > 0 ? "text-red-600" : "text-navy-900"}`}>{n}</p>
      <p className="text-xs text-ink-secondary">{label}</p>
    </div>
  );
  return (
    <Drawer open={!!unit} title={unit?.name ?? ""} description="Hoje" onClose={() => (setTab("overview"), onClose())} width="max-w-xl">
      {unit && (
        <div className="space-y-4">
          <Tabs
            label="Detalhe da unidade"
            value={tab}
            onChange={(k) => setTab(k as UnitTab)}
            items={[
              { key: "overview", label: "Visão geral" },
              { key: "team", label: "Equipa" },
              { key: "coverage", label: "Cobertura" },
              { key: "requests", label: "Solicitações" },
              { key: "reviews", label: "Avaliações" },
            ]}
          />
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {kpi("Presentes", unit.present)}
                {kpi("Atrasos", unit.late, true)}
                {kpi("Ausentes", unit.absent + unit.missing, true)}
                {kpi("Sem cobertura", unit.uncovered, true)}
                {kpi("Pendentes", unit.pending, true)}
              </div>
              {s ? (
                <TeamStatusDonut team={s.team} onSelect={(c) => (setCat(c), setTab("team"))} />
              ) : (
                <Skeleton className="h-40 w-full rounded-xl" />
              )}
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Ações rápidas</h3>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <Link className="rounded-xl border border-line-subtle px-3 py-2 text-sm hover:bg-surface-soft" to="/hr/novo/assiduidade">Ver Assiduidade ›</Link>
                  <Link className="rounded-xl border border-line-subtle px-3 py-2 text-sm hover:bg-surface-soft" to="/hr/novo/escalas">Ver Escalas ›</Link>
                  <Link className="rounded-xl border border-line-subtle px-3 py-2 text-sm hover:bg-surface-soft" to="/hr/novo/pedidos">Ver Caixa de pedidos ›</Link>
                  <button type="button" className="rounded-xl border border-line-subtle px-3 py-2 text-left text-sm hover:bg-surface-soft" onClick={() => (onFocusUnit(unit.locationId), onClose())}>
                    Abrir unidade no Dashboard ›
                  </button>
                </div>
              </div>
            </div>
          )}
          {tab === "team" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(["working", "remote", "break", "vacation", "absent"] as TeamCategory[]).map((c) => (
                  <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full px-3 py-1 text-xs font-medium ${cat === c ? "bg-navy-900 text-white" : "bg-surface-soft text-ink-secondary hover:text-navy-900"}`}>
                    {TEAM_LABEL[c]} {s ? s.team[c] : ""}
                  </button>
                ))}
              </div>
              <TeamList key={cat} category={cat} locationId={unit.locationId} />
            </div>
          )}
          {tab === "coverage" && (s ? <CoverageBody s={s} /> : <Skeleton className="h-24 w-full rounded-xl" />)}
          {tab === "requests" && (
            <ul className="space-y-1.5">
              {(reqs.data?.items ?? []).filter((r) => r.locationName === unit.name).map((r) => (
                <li key={r.key} className="rounded-xl border border-line-subtle px-3 py-2 text-sm">
                  <p className="font-medium text-navy-900">{r.employeeName}</p>
                  <p className="text-xs text-ink-secondary">{r.title}</p>
                </li>
              ))}
              {reqs.data && !reqs.data.items.some((r) => r.locationName === unit.name) && <p className="text-sm text-ink-secondary">Sem solicitações pendentes nesta unidade.</p>}
              <Link to="/hr/novo/pedidos" className="inline-block pt-1 text-sm font-medium text-brand-600 hover:underline">Ver Caixa de pedidos ›</Link>
            </ul>
          )}
          {tab === "reviews" && <GoogleReviewsBody />}
        </div>
      )}
    </Drawer>
  );
}
