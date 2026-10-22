import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, FIELD, SegmentedControl, SURFACE } from "../../../../../components/ui/index.ts";
import {
  activeOn,
  ageBuckets,
  averageAge,
  averageAgeSeries,
  byUnit,
  generations,
  genderSplit,
  headcountSeries,
  inScope,
  movements,
  nationalities,
  quarterTrend,
  tenureBuckets,
  type AnalyticsAssignment,
  type AnalyticsPerson,
} from "../../../domain/services/team-analytics.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { Columns, Donut, HBars } from "./AnalyticsCharts.tsx";
import { CATEGORICAL } from "./analytics-palette.ts";

type ScopeKind = "all" | "location" | "department" | "group";
type UnitKind = "location" | "department" | "group";
interface Scope {
  kind: ScopeKind;
  id: string;
}
const KIND_LABEL: Record<ScopeKind, string> = { all: "Toda a empresa", location: "Centro", department: "Departamento", group: "Grupo" };

/**
 * Mais → Relatórios → Análise da equipa: efetivo, género, idade, gerações,
 * nacionalidade, antiguidade e distribuição por centro/departamento/grupo.
 * «Comparar» põe dois painéis lado a lado, cada um com o seu âmbito.
 * Calculado no ecrã a partir da lista (já com a privacidade de quem consulta).
 */
export function TeamAnalyticsView() {
  const { people, settings, structure } = useNovoRh();
  const [compare, setCompare] = useState(false);
  const list = useQuery({ queryKey: ["novo-rh", "people", "all", "analytics"], queryFn: () => people.list({ status: "all" }) });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  // Departamentos e grupos dependem da permissão da estrutura; sem ela, só por centro.
  const groups = useQuery({ queryKey: ["novo-rh", "structure", "groups"], queryFn: () => structure.listGroups(), retry: false });
  const departments = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments(), retry: false });
  const assignments = useQuery({ queryKey: ["novo-rh", "structure", "assignments", "all"], queryFn: () => structure.listAllAssignments(), retry: false });

  if (list.isLoading) return <p className="text-sm text-stone-400">A carregar…</p>;
  if (list.isError) return <p className="text-sm text-red-700">Não foi possível carregar os colaboradores.</p>;
  const data: AnalyticsPerson[] = (list.data ?? []).map((p) => ({
    id: p.id,
    hireDate: p.hireDate,
    deactivatedAt: p.deactivatedAt,
    status: p.status,
    birthDate: p.birthDate,
    gender: p.gender,
    nationality: p.nationality,
    primaryLocationId: p.primaryLocationId,
  }));
  const names = {
    location: new Map((locations.data ?? []).map((l) => [l.id, l.label])),
    department: new Map((departments.data ?? []).map((d) => [d.id, d.name])),
    group: new Map((groups.data ?? []).map((g) => [g.id, g.name])),
  };
  const units: UnitKind[] = ["location", ...(departments.data?.length && assignments.data ? (["department"] as const) : []), ...(groups.data?.length && assignments.data ? (["group"] as const) : [])];
  const hiddenPersonal = (list.data ?? []).some((p) => p.hidden.includes("birthDate") || p.hidden.includes("gender"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-ink-secondary">Números agregados; nenhum dado individual é mostrado.</p>
        <Button variant={compare ? "primary" : "secondary"} onClick={() => setCompare(!compare)}>
          {compare ? "Fechar comparação" : "Comparar"}
        </Button>
      </div>
      {hiddenPersonal && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Sem permissão para ver dados pessoais de alguns colaboradores: contam como «Desconhecido» no género e na idade.</p>}
      <div className={compare ? "grid gap-4 xl:grid-cols-2" : ""}>
        <Panel data={data} assignments={assignments.data ?? []} names={names} units={units} />
        {compare && <Panel data={data} assignments={assignments.data ?? []} names={names} units={units} />}
      </div>
    </div>
  );
}

function Panel({ data, assignments, names, units }: { data: AnalyticsPerson[]; assignments: AnalyticsAssignment[]; names: Record<UnitKind, Map<string, string>>; units: UnitKind[] }) {
  const today = todayIn();
  const [scope, setScope] = useState<Scope>({ kind: "all", id: "" });
  const [unit, setUnit] = useState<UnitKind>("location");
  const scoped = data.filter((p) => inScope(p, scope, assignments, today));
  const active = scoped.filter((p) => activeOn(p, today));
  const series = headcountSeries(scoped, today);
  const trend = quarterTrend(series);
  const avg = averageAge(scoped, today);
  const ages = averageAgeSeries(scoped, today);
  const mv = movements(scoped, today);
  const kinds: ScopeKind[] = ["all", ...units];

  const card = (title: string, children: React.ReactNode, foot?: React.ReactNode) => (
    <section className={`${SURFACE} p-4 sm:p-5`} aria-label={title}>
      <h3 className="mb-3 text-base font-semibold text-navy-900">{title}</h3>
      {children}
      {foot && <p className="mt-3 border-t border-line-subtle pt-3 text-center text-sm text-ink-secondary">{foot}</p>}
    </section>
  );
  const trendText =
    trend === null ? null : trend === 0 ? (
      <>
        O número de colaboradores <span className="font-semibold text-ink">não variou</span> no último trimestre.
      </>
    ) : (
      <>
        O número de colaboradores <span className={`font-semibold ${trend > 0 ? "text-emerald-700" : "text-red-700"}`}>{trend > 0 ? `aumentou ${trend}%` : `diminuiu ${Math.abs(trend)}%`}</span> no último trimestre.
      </>
    );

  return (
    <div className="space-y-4">
      <div className={`${SURFACE} flex flex-wrap items-center gap-2 p-3`}>
        <select aria-label="Âmbito" className={FIELD} value={scope.kind} onChange={(e) => setScope({ kind: e.target.value as ScopeKind, id: "" })}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        {scope.kind !== "all" && (
          <select aria-label={KIND_LABEL[scope.kind]} className={`${FIELD} min-w-48 flex-1`} value={scope.id} onChange={(e) => setScope({ ...scope, id: e.target.value })}>
            <option value="">Escolher…</option>
            {[...names[scope.kind]].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>

      {card(
        "Colaboradores",
        <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
          <div className="text-center sm:px-4">
            <p className="text-5xl font-semibold tabular-nums text-navy-900">{active.length}</p>
            <p className="text-sm text-ink-secondary">ativos hoje</p>
          </div>
          <Columns points={series} label="Colaboradores ativos por mês" color={CATEGORICAL[0]} />
        </div>,
        trendText,
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {card("Entradas (12 meses)", <p className="text-3xl font-semibold tabular-nums text-emerald-700">{mv.hires}</p>)}
        {card("Saídas (12 meses)", <p className="text-3xl font-semibold tabular-nums text-red-700">{mv.exits}</p>)}
        {card("Rotatividade", <p className="text-3xl font-semibold tabular-nums text-navy-900">{mv.turnover === null ? "—" : `${mv.turnover}%`}</p>, "Saídas sobre o efetivo médio")}
      </div>
      {card("Género", <Donut slices={genderSplit(active)} label="Género" />)}
      {card(
        "Idade média da equipa",
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
          <Columns points={ages} label="Idade média por mês" color={CATEGORICAL[1]} />
          <div className="text-center sm:px-4">
            <p className="text-5xl font-semibold tabular-nums text-navy-900">{avg ?? "—"}</p>
            <p className="text-sm text-ink-secondary">anos</p>
          </div>
        </div>,
        ages[0]?.value !== null && avg !== null && ages[0]!.value !== avg ? `A idade média passou de ${ages[0]!.value} para ${avg} anos no último ano.` : "A idade média não variou no último ano.",
      )}
      {card("Colaboradores por idade", <Donut slices={ageBuckets(active, today)} label="Colaboradores por idade" />)}
      {card(
        "Colaboradores por",
        <div className="space-y-4">
          {units.length > 1 && (
            <SegmentedControl<UnitKind>
              label="Agrupar por"
              value={unit}
              onChange={setUnit}
              items={units.map((u) => ({ key: u, label: KIND_LABEL[u] }))}
            />
          )}
          <Donut slices={byUnit(active, assignments, unit, names[unit], today)} label={`Colaboradores por ${KIND_LABEL[unit].toLowerCase()}`} />
        </div>,
      )}
      {card("Gerações", <HBars slices={generations(active, today)} color={CATEGORICAL[6]} />)}
      {card("Colaboradores por nacionalidade", <HBars slices={nationalities(active)} />)}
      {card("Tempo de serviço na empresa", <HBars slices={tenureBuckets(active, today)} color={CATEGORICAL[0]} />)}
    </div>
  );
}
