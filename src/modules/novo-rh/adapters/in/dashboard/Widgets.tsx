import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar, Button, Dialog, FIELD, IconCheck, IconClose, SearchInput } from "../../../../../components/ui/index.ts";
import { ApiError } from "../../../../../lib/api.ts";
import type { AttentionItem, OperationalSnapshot, TeamCategory, TeamChart, UnitRow } from "../../../domain/entities/dashboard.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { useEmployeePhotos } from "../common/use-employee-photos.ts";
import { TeamStatusDonut } from "./TeamStatusDonut.tsx";
import { WidgetMessage, WidgetSkeleton } from "./DashboardWidget.tsx";

const SEV: Record<AttentionItem["severity"], string> = { critical: "bg-red-500", urgent: "bg-amber-500", attention: "bg-sky-500" };
const SEV_LABEL: Record<AttentionItem["severity"], string> = { critical: "Crítico", urgent: "Urgente", attention: "Atenção" };
const ATTENTION_LINK: Record<AttentionItem["key"], string> = {
  missing: "/hr/novo/assiduidade",
  late: "/hr/novo/assiduidade",
  uncovered: "/hr/novo/escalas",
  absences_review: "/hr/novo/pedidos",
  requests: "/hr/novo/pedidos",
};
const ROW_LINK = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";
const MORE = "mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline";

export function AttentionBody({ s, limit }: { s: OperationalSnapshot; limit?: number }) {
  if (!s.attention.length)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-emerald-50/60 px-3 py-3 text-sm text-emerald-800">
        <IconCheck size={16} /> Operação sem pendências críticas
      </p>
    );
  return (
    <ul className="divide-y divide-line-subtle rounded-xl border border-line-subtle">
      {(limit ? s.attention.slice(0, limit) : s.attention).map((a) => (
        <li key={a.key}>
          <Link to={ATTENTION_LINK[a.key]} className={ROW_LINK}>
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${SEV[a.severity]}`} />
            <span className="sr-only">{SEV_LABEL[a.severity]}: </span>
            <span className="flex-1 text-ink">
              <strong className="font-semibold tabular-nums text-navy-900">{a.count}</strong> {a.label}
            </span>
            <span aria-hidden="true" className="text-ink-muted">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TeamBody({ s, onOpen, format }: { s: OperationalSnapshot; onOpen: (c: TeamCategory) => void; format?: TeamChart }) {
  return <TeamStatusDonut team={s.team} onSelect={onOpen} format={format} />;
}

const STATE: Record<UnitRow["state"], { dot: string; label: string }> = {
  critical: { dot: "bg-red-500", label: "Com exceções" },
  attention: { dot: "bg-amber-500", label: "Atenção" },
  normal: { dot: "bg-emerald-500", label: "Normal" },
};

/** Cabeçalho compacto (cabe em 1/3 da linha); nome completo no title e para leitores de ecrã. */
function Th({ full, short, last = false }: { full: string; short: string; last?: boolean }) {
  return (
    <th scope="col" title={full} className={`whitespace-nowrap px-1.5 py-2 text-right font-medium ${last ? "rounded-r-lg" : ""}`}>
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{full}</span>
    </th>
  );
}

const STATE_RANK: Record<UnitRow["state"], number> = { critical: 0, attention: 1, normal: 2 };

/** Resumo das unidades: as mais urgentes primeiro, com o essencial; a tabela completa fica no detalhe. */
export function UnitsSummary({ s, onOpen, limit = 3 }: { s: OperationalSnapshot; onOpen: (u: UnitRow) => void; limit?: number }) {
  if (!s.locations.length) return <WidgetMessage text="Sem unidades no contexto escolhido." />;
  const top = [...s.locations].sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.name.localeCompare(b.name, "pt")).slice(0, limit);
  const issues = (u: UnitRow) =>
    [u.missing + u.absent ? `${u.missing + u.absent} ausentes` : "", u.late ? `${u.late} atrasos` : "", u.uncovered ? `${u.uncovered} sem cobertura` : "", u.pending ? `${u.pending} pendentes` : ""].filter(Boolean).join(" · ") || "Sem exceções";
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">
        <strong className="font-semibold tabular-nums text-navy-900">{s.units.operational}</strong> {s.units.operational === 1 ? "unidade" : "unidades"}
        {s.units.requiringAttention > 0 && (
          <span className="text-red-700">
            {" "}
            · <strong className="font-semibold tabular-nums">{s.units.requiringAttention}</strong> com exceções
          </span>
        )}
      </p>
      <ul className="divide-y divide-line-subtle rounded-xl border border-line-subtle">
        {top.map((u) => (
          <li key={u.locationId}>
            <button type="button" onClick={() => onOpen(u)} className={`${ROW_LINK} w-full text-left`}>
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${STATE[u.state].dot}`} />
              <span className="sr-only">{STATE[u.state].label}: </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-navy-900">{u.name}</span>
                <span className="block truncate text-xs text-ink-secondary">{issues(u)}</span>
              </span>
              <span className="text-xs tabular-nums text-ink-secondary">{u.present} presentes</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UnitsBody({ s, onOpen, onlyAttention, onClearFilter }: { s: OperationalSnapshot; onOpen: (u: UnitRow) => void; onlyAttention: boolean; onClearFilter: () => void }) {
  const [q, setQ] = useState("");
  const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const rows = s.locations.filter((u) => (!onlyAttention || u.state !== "normal") && (!q || norm(u.name).includes(norm(q))));
  const num = (n: number, warn: boolean) => <span className={`tabular-nums ${n > 0 && warn ? "font-semibold text-red-600" : "text-ink"}`}>{n}</span>;
  return (
    <div className="space-y-3">
      {(s.locations.length > 8 || onlyAttention) && (
        <div className="flex flex-wrap items-center gap-2">
          {s.locations.length > 8 && <SearchInput label="Pesquisar unidade" value={q} onChange={(e) => setQ(e.target.value)} className="w-full max-w-xs" />}
          {onlyAttention && (
            <button type="button" onClick={onClearFilter} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 hover:underline">
              Só unidades com exceções · ver todas
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-soft/70 text-xs text-ink-secondary">
            <tr>
              <th className="rounded-l-lg px-2 py-2 text-left font-medium">Unidade</th>
              <Th full="Presentes" short="Pres." />
              <Th full="Atrasos" short="Atr." />
              <Th full="Ausentes" short="Aus." />
              <Th full="Sem cobertura" short="S/ cob." />
              <Th full="Pendências" short="Pend." last />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.locationId} className="cursor-pointer border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-soft/60" onClick={() => onOpen(u)}>
                <td className="max-w-[9.5rem] px-2 py-2.5">
                  <button type="button" onClick={(e) => (e.stopPropagation(), onOpen(u))} className="flex min-w-0 items-center gap-2 text-left font-medium text-navy-900 hover:underline">
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATE[u.state].dot}`} />
                    <span className="truncate" title={u.name}>{u.name}</span>
                    <span className="sr-only">({STATE[u.state].label})</span>
                  </button>
                </td>
                <td className="px-1.5 py-2.5 text-right">{num(u.present, false)}</td>
                <td className="px-1.5 py-2.5 text-right">{num(u.late, true)}</td>
                <td className="px-1.5 py-2.5 text-right">{num(u.absent + u.missing, true)}</td>
                <td className="px-1.5 py-2.5 text-right">{num(u.uncovered, true)}</td>
                <td className="px-1.5 py-2.5 text-right">{num(u.pending, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
        <span>
          A mostrar {rows.length} de {s.locations.length} unidades
        </span>
        {(["critical", "attention", "normal"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATE[k].dot}`} />
            {STATE[k].label}
          </span>
        ))}
      </p>
    </div>
  );
}

/** Erro local de um widget (o resto do Dashboard continua normal). */
function RetryMessage({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <WidgetMessage
      text={text}
      action={
        onRetry && (
          <Button size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        )
      }
    />
  );
}

export function CoverageBody({ s, onRetry }: { s: OperationalSnapshot; onRetry?: () => void }) {
  if (s.partial?.includes("coverage")) return <RetryMessage text="Cobertura temporariamente indisponível." onRetry={onRetry} />;
  const row = (label: string, n: number) => (
    <Link to="/hr/novo/escalas" className="flex items-center justify-between rounded-xl border border-line-subtle px-3 py-2 text-sm hover:bg-surface-soft">
      <span className="text-ink">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${n ? "bg-red-50 text-red-700" : "bg-surface-soft text-ink-secondary"}`}>{n}</span>
    </Link>
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">
        {s.coverage.uncoveredTotal ? (
          <>
            <strong className="text-2xl font-bold tabular-nums text-red-600">{s.coverage.uncoveredTotal}</strong> {s.coverage.uncoveredTotal === 1 ? "turno precisa" : "turnos precisam"} de atenção
          </>
        ) : (
          "Todos os horários de hoje e amanhã têm turno na escala."
        )}
      </p>
      <div className="space-y-1.5">
        {row("Hoje", s.coverage.uncoveredToday)}
        {row("Amanhã", s.coverage.uncoveredTomorrow)}
      </div>
      <p className="text-xs text-ink-muted">Pessoas com horário sem turno publicado na escala do seu local.</p>
      <Link to="/hr/novo/escalas" className={MORE}>
        Ver nas Escalas ›
      </Link>
    </div>
  );
}

/**
 * Detalhe da cobertura: hoje e amanhã e, por centro, os turnos de hoje sem
 * cobertura (do mesmo agregado; sem pedidos novos). O detalhe por turno
 * abre-se nas Escalas.
 */
export function CoverageDetail({ s }: { s: OperationalSnapshot }) {
  if (s.partial?.includes("coverage")) return <WidgetMessage text="Cobertura temporariamente indisponível." />;
  const byUnit = s.locations.filter((u) => u.uncovered > 0).sort((a, b) => b.uncovered - a.uncovered || a.name.localeCompare(b.name, "pt"));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <dl className="grid grid-cols-2 gap-2 self-start">
        {[
          ["Hoje", s.coverage.uncoveredToday],
          ["Amanhã", s.coverage.uncoveredTomorrow],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-xl border border-line-subtle px-3 py-2.5">
            <dt className="text-xs text-ink-secondary">{label}</dt>
            <dd className={`text-xl font-bold tabular-nums ${n ? "text-red-600" : "text-navy-900"}`}>{n}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Hoje, por centro</h3>
        {byUnit.length ? (
          <ul className="divide-y divide-line-subtle rounded-xl border border-line-subtle">
            {byUnit.map((u) => (
              <li key={u.locationId}>
                <Link to="/hr/novo/escalas" className={ROW_LINK}>
                  <span className="min-w-0 flex-1 truncate font-medium text-navy-900">{u.name}</span>
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-red-700">{u.uncovered}</span>
                  <span aria-hidden="true" className="text-ink-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-secondary">Nenhum centro com turnos de hoje por cobrir.</p>
        )}
        <Link to="/hr/novo/escalas" className={MORE}>
          Ver turnos nas Escalas ›
        </Link>
      </div>
    </div>
  );
}

/** Solicitações: as mesmas ações da Caixa de pedidos (o backend revalida tudo). */
export function RequestsBody({ editing, limit = 4, unavailable = false, onRetry }: { editing: boolean; limit?: number; unavailable?: boolean; onRetry?: () => void }) {
  const { inbox } = useNovoRh();
  const qc = useQueryClient();
  const photoOf = useEmployeePhotos();
  const q = useQuery({ queryKey: ["novo-rh", "inbox", "dashboard"], queryFn: () => inbox.list({ type: null, segment: "mine" }), staleTime: 30_000 });
  const [reject, setReject] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const decide = useMutation({
    mutationFn: (v: { key: string; decision: "approve" | "reject"; comment: string | null }) => inbox.decide([v.key], v.decision, v.comment),
    onSuccess: () => {
      setReject(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["novo-rh", "inbox"] });
      void qc.invalidateQueries({ queryKey: ["novo-rh", "dashboard", "snapshot"] });
    },
  });
  if (q.isLoading) return <WidgetSkeleton />;
  if (q.isError || unavailable) return <RetryMessage text="Pedidos temporariamente indisponíveis." onRetry={() => (void q.refetch(), onRetry?.())} />;
  const items = (q.data?.items ?? []).slice(0, limit);
  if (!items.length) return <WidgetMessage text="Sem solicitações pendentes." />;
  return (
    <>
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li key={r.key} className="flex items-center gap-3 rounded-xl border border-line-subtle px-3 py-2">
            <Avatar name={r.employeeName} photoUrl={photoOf(r.employeeId)} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy-900">{r.employeeName}</p>
              <p className="truncate text-xs text-ink-secondary">{r.title}</p>
            </div>
            <Link to="/hr/novo/pedidos" className="hidden text-xs font-medium text-brand-600 hover:underline sm:inline">
              Ver detalhes
            </Link>
            {r.canDecide && !editing && (
              <>
                <button type="button" aria-label={`Aprovar pedido de ${r.employeeName}`} disabled={decide.isPending} onClick={() => decide.mutate({ key: r.key, decision: "approve", comment: null })} className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                  <IconCheck size={16} />
                </button>
                <button type="button" aria-label={`Recusar pedido de ${r.employeeName}`} disabled={decide.isPending} onClick={() => setReject(r.key)} className="rounded-lg bg-red-50 p-1.5 text-red-700 hover:bg-red-100 disabled:opacity-50">
                  <IconClose size={16} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {decide.isError && <p className="mt-2 text-xs text-red-700">{decide.error instanceof ApiError || decide.error instanceof Error ? decide.error.message : "Erro"}</p>}
      <Dialog
        open={!!reject}
        title="Recusar pedido"
        description="O motivo é comunicado a quem pediu."
        onClose={() => setReject(null)}
        actions={
          <>
            <Button variant="tertiary" onClick={() => setReject(null)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={reason.trim().length < 5 || decide.isPending} onClick={() => reject && decide.mutate({ key: reject, decision: "reject", comment: reason.trim() })}>
              Recusar
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-secondary">Motivo (mín. 5 caracteres)</span>
          <input className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </Dialog>
    </>
  );
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function BirthdaysBody({ today, limit = 5 }: { today: string; limit?: number }) {
  const { dashboard } = useNovoRh();
  const photoOf = useEmployeePhotos();
  const q = useQuery({ queryKey: ["novo-rh", "dashboard", "birthdays"], queryFn: () => dashboard.birthdays(), staleTime: 60 * 60_000, retry: false });
  if (q.isLoading) return <WidgetSkeleton />;
  if (q.isError) return <WidgetMessage text="Não foi possível carregar os aniversários." />;
  const list = (q.data ?? []).slice(0, limit);
  if (!list.length) return <WidgetMessage text="Sem aniversários nos próximos 30 dias." />;
  return (
    <ul className="space-y-1">
      {list.map((b) => (
        <li key={b.employeeId}>
          <Link to={`/hr/novo/pessoas/${b.employeeId}`} className={ROW_LINK}>
            <Avatar name={b.name} photoUrl={photoOf(b.employeeId)} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-navy-900">{b.name}</span>
              {b.locationName && <span className="block truncate text-xs text-ink-secondary">{b.locationName}</span>}
            </span>
            <span className="text-xs font-medium text-ink-secondary">{b.date === today ? "Hoje" : `${b.day} ${MONTHS[b.month - 1]}`}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function HolidaysBody({ s, limit }: { s: OperationalSnapshot; limit?: number }) {
  if (!s.holidays.length) return <WidgetMessage text="Sem feriados próximos." />;
  return (
    <ul className="space-y-1.5">
      {(limit ? s.holidays.slice(0, limit) : s.holidays).map((h) => (
        <li key={h.date} className="flex items-center gap-3 rounded-xl border border-line-subtle px-3 py-2">
          <span className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-red-50 py-1 leading-none text-red-700">
            <span className="text-[10px] font-semibold uppercase">{MONTHS[Number(h.date.slice(5, 7)) - 1]}</span>
            <span className="text-base font-bold tabular-nums">{h.date.slice(8, 10)}</span>
          </span>
          <span className="text-sm text-ink">{h.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function ReportsBody({ limit = 4 }: { limit?: number }) {
  const { reports } = useNovoRh();
  const q = useQuery({ queryKey: ["novo-rh", "reports", "catalog"], queryFn: () => reports.catalog(), staleTime: 10 * 60_000 });
  if (q.isLoading) return <WidgetSkeleton />;
  if (q.isError) return <WidgetMessage text="Não foi possível carregar os relatórios." />;
  const list = (q.data ?? []).slice(0, limit);
  if (!list.length) return <WidgetMessage text="Sem relatórios disponíveis." />;
  return (
    <ul className="space-y-1">
      {list.map((r) => (
        <li key={r.key}>
          <Link to="/hr/novo/assiduidade/relatorios" className={ROW_LINK}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-navy-900">{r.label}</span>
              <span className="block truncate text-xs text-ink-secondary">{r.groupLabel}</span>
            </span>
            <span className="text-xs font-medium text-brand-600">Ver</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Vizinho compacto (quando o outro cartão da linha está expandido): só o
 * essencial — um número e uma linha de apoio, truncada com tooltip.
 */
export function CompactKpi({ value, label, sub, tone = "neutral" }: { value: number | string; label: string; sub?: string; tone?: "neutral" | "critical" }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex items-baseline gap-1.5">
        <strong className={`text-2xl font-bold tabular-nums ${tone === "critical" && value ? "text-red-600" : "text-navy-900"}`}>{value}</strong>
        <span className="truncate text-sm text-ink-secondary">{label}</span>
      </p>
      {sub && (
        <p className="truncate text-xs text-ink-secondary" title={sub}>
          {sub}
        </p>
      )}
    </div>
  );
}
