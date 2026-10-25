import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import { StockPlanningProvider, useStockPlanningModule } from "../../../stock-planning/stock-planning.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { formatEUR, formatIsoDatePt } from "../../../../lib/format.ts";
import {
  AppIcon,
  Button,
  DropdownMenu,
  FIELD,
  IconBox,
  IconButton,
  IconCalendar,
  IconMore,
  NUMERIC,
  SURFACE,
} from "../../../../components/ui/index.ts";
import type { SupplierDetail } from "../../domain/entities/supplier.ts";
import type { DeliveryDayRule, SupplierDeliveryScheduleDTO } from "../../domain/entities/supplier-delivery-schedule.ts";
import { effectiveRule, leadTimeRange, upcomingOpportunities } from "../../domain/services/supply-calendar.ts";
import type { SupplierReplenishmentRowDTO } from "../../../stock-planning/domain/entities/stock-planning.ts";
import { SupplierPlanningSummary } from "./SupplierPlanningSummary.tsx";

// ── Helpers ─────────────────────────────────────────────────────────────────

const WEEKDAYS = [
  { value: 1, short: "Seg", long: "Segunda-feira", plain: "segunda" },
  { value: 2, short: "Ter", long: "Terça-feira", plain: "terça" },
  { value: 3, short: "Qua", long: "Quarta-feira", plain: "quarta" },
  { value: 4, short: "Qui", long: "Quinta-feira", plain: "quinta" },
  { value: 5, short: "Sex", long: "Sexta-feira", plain: "sexta" },
  { value: 6, short: "Sáb", long: "Sábado", plain: "sábado" },
  { value: 7, short: "Dom", long: "Domingo", plain: "domingo" },
] as const;
const dayInfo = (weekday: number) => WEEKDAYS[weekday - 1]!;

const MONTHS_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** «12:00» → «12h»; «12:30» → «12h30». */
function hourLabel(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

const isoWeekdayOf = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay());
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

function qty(n: number, unit: string): string {
  return `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} ${unit}`;
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

const MAX_OPPORTUNITIES = 4;

// Rótulos curtos: o título do cartão já diz «Próximas»; assim o cabeçalho não parte a 1366 px.
const HORIZONS = [
  { weeks: 2, label: "2 semanas" },
  { weeks: 4, label: "4 semanas" },
  { weeks: 8, label: "8 semanas" },
];

// ── Peças visuais ───────────────────────────────────────────────────────────

function CardHeader({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle: string; action?: ReactNode }) {
  return (
    // O controlo fica na linha do título (sem a alargar: margem negativa) e o subtítulo
    // usa a largura toda por baixo — assim não parte por causa do seletor.
    <header className="px-5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-brand-600">{icon}</span>
          <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        </div>
        {action && <div className="-my-1.5 shrink-0">{action}</div>}
      </div>
      <p className="mt-0.5 pl-[34px] text-[13px] text-ink-secondary">{subtitle}</p>
    </header>
  );
}

function KpiCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="px-6 py-3">
      <p className="text-[13px] text-ink-secondary">{label}</p>
      <p className={`mt-0.5 text-xl font-bold text-navy-900 ${NUMERIC}`}>{value}</p>
      <p className="mt-0.5 text-[13px] text-ink-muted">{sub}</p>
    </div>
  );
}

function StockChip({ current, min, unit }: { current: number; min: number; unit: string }) {
  // Vermelho abaixo de metade do mínimo, âmbar abaixo do mínimo, verde a partir dele.
  const cls =
    min > 0 && current < min / 2
      ? "bg-red-50 text-red-700"
      : min > 0 && current < min
        ? "bg-amber-50 text-amber-800"
        : "bg-emerald-50 text-emerald-800";
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-[13px] font-medium ${NUMERIC} ${cls}`}>{qty(current, unit)}</span>;
}

// ── Calendário de fornecimento ──────────────────────────────────────────────

interface CalendarDraft {
  weekdays: number[];
  cutoffTime: string;
  active: boolean;
  dayRules: DeliveryDayRule[];
}

function draftFrom(schedule: SupplierDeliveryScheduleDTO | null): CalendarDraft {
  return {
    weekdays: schedule?.weekdays ?? [],
    cutoffTime: schedule?.cutoffTime?.slice(0, 5) ?? "",
    active: schedule?.active ?? true,
    dayRules: schedule?.dayRules ?? [],
  };
}

function SupplyCalendarCard({
  supplierId,
  locationId,
  onLocationChange,
  schedule,
}: {
  supplierId: string;
  locationId: string | null;
  onLocationChange: (id: string) => void;
  schedule: SupplierDeliveryScheduleDTO | null;
}) {
  const { api } = useFinancialBaseModule();
  const { activeLocations, hasMultipleLocations } = useLocations();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CalendarDraft | null>(null);

  const view = editing ?? draftFrom(schedule);
  const cutoff = view.cutoffTime || null;

  const saveMutation = useMutation({
    mutationFn: (draft: CalendarDraft) =>
      api.upsertSupplierDeliverySchedule(supplierId, {
        locationId: locationId!,
        weekdays: draft.weekdays.length > 0 ? draft.weekdays : null,
        cutoffTime: draft.cutoffTime || null,
        active: draft.active,
        dayRules: draft.dayRules.filter((r) => draft.weekdays.includes(r.weekday)),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["supplier-delivery-schedules", supplierId] });
      setEditing(null);
    },
  });

  function patch(next: Partial<CalendarDraft>) {
    setEditing({ ...view, ...next });
  }

  function toggleDay(weekday: number) {
    const weekdays = view.weekdays.includes(weekday) ? view.weekdays.filter((w) => w !== weekday) : [...view.weekdays, weekday].sort();
    patch({ weekdays });
  }

  function patchRule(weekday: number, change: Partial<DeliveryDayRule>) {
    const current = effectiveRule(weekday, view.dayRules, null);
    const base: DeliveryDayRule = { weekday, orderWeekday: current.orderWeekday, orderTime: view.dayRules.find((r) => r.weekday === weekday)?.orderTime ?? null, notes: current.notes };
    patch({ dayRules: [...view.dayRules.filter((r) => r.weekday !== weekday), { ...base, ...change }] });
  }

  const isEditing = editing !== null;
  const locationName = activeLocations.find((l) => l.id === locationId)?.name;

  return (
    <section className={`${SURFACE} flex flex-col pb-4`}>
      <CardHeader
        icon={<IconCalendar size={22} />}
        title="Calendário de fornecimento"
        subtitle="Dias em que este fornecedor costuma entregar."
        action={
          hasMultipleLocations ? (
            <select
              value={locationId ?? ""}
              onChange={(e) => {
                setEditing(null);
                onLocationChange(e.target.value);
              }}
              aria-label="Loja"
              className={`${FIELD} h-9 pr-8`}
            >
              {activeLocations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          ) : locationName ? (
            <span className="text-sm text-ink-secondary">{locationName}</span>
          ) : undefined
        }
      />

      <div className="mt-3 flex flex-wrap gap-2 px-5" role="group" aria-label="Dias de entrega">
        {WEEKDAYS.map((d) => {
          const on = view.weekdays.includes(d.value);
          return (
            <button
              key={d.value}
              type="button"
              aria-pressed={on}
              disabled={!isEditing}
              onClick={() => toggleDay(d.value)}
              className={`h-8 min-w-[56px] rounded-lg px-3 text-sm font-medium transition-colors ${
                on ? "bg-brand-600 text-white" : "bg-surface-soft text-ink-secondary"
              } ${isEditing ? (on ? "hover:bg-brand-500" : "hover:bg-line") : "cursor-default"}`}
            >
              {d.short}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-5">
        <label className="flex items-center gap-3 text-sm text-ink">
          Hora limite para encomendar
          <input
            type="time"
            value={view.cutoffTime}
            disabled={!isEditing}
            onChange={(e) => patch({ cutoffTime: e.target.value })}
            className={`${FIELD} h-9 w-32`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={view.active}
            disabled={!isEditing}
            onChange={(e) => patch({ active: e.target.checked })}
            className="h-4 w-4 rounded border-line accent-brand-600"
          />
          Calendário ativo
        </label>
      </div>

      <div className="mt-3 overflow-x-auto px-5">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-soft text-left text-[11px] font-medium uppercase tracking-wide text-ink-secondary">
              <th className="rounded-l-lg px-3 py-2 font-medium">Dia de entrega</th>
              <th className="px-3 py-2 font-medium">Pedido até</th>
              <th className="rounded-r-lg px-3 py-2 font-medium">Observações</th>
            </tr>
          </thead>
          <tbody>
            {view.weekdays.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-ink-secondary">
                  {isEditing ? "Escolha acima os dias de entrega." : "Sem dias de entrega definidos para esta loja."}
                </td>
              </tr>
            ) : (
              view.weekdays.map((w) => {
                const rule = effectiveRule(w, view.dayRules, cutoff);
                return (
                  <tr key={w} className="border-b border-line-subtle last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-ink">{dayInfo(w).long}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink">
                      {isEditing ? (
                        <span className="flex items-center gap-2">
                          <select
                            value={rule.orderWeekday}
                            onChange={(e) => patchRule(w, { orderWeekday: Number(e.target.value) })}
                            aria-label={`Dia do pedido para ${dayInfo(w).long}`}
                            className={`${FIELD} h-9 w-[8rem] pr-7`}
                          >
                            {WEEKDAYS.map((d) => (
                              // Nome curto («Sexta») para caber a 1366 px sem cortar.
                              <option key={d.value} value={d.value}>{d.plain[0]!.toUpperCase() + d.plain.slice(1)}</option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={view.dayRules.find((r) => r.weekday === w)?.orderTime ?? ""}
                            onChange={(e) => patchRule(w, { orderTime: e.target.value || null })}
                            aria-label={`Hora do pedido para ${dayInfo(w).long}`}
                            title="Vazio = hora limite geral"
                            className={`${FIELD} h-9 w-[6.5rem]`}
                          />
                        </span>
                      ) : (
                        `${dayInfo(rule.orderWeekday).long}${rule.orderTime ? `, ${hourLabel(rule.orderTime)}` : ""}`
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink">
                      {isEditing ? (
                        <input
                          value={rule.notes ?? ""}
                          maxLength={200}
                          onChange={(e) => patchRule(w, { notes: e.target.value || null })}
                          placeholder="Ex.: entrega no período da manhã"
                          aria-label={`Observações de ${dayInfo(w).long}`}
                          title={rule.notes ?? undefined}
                          className={`${FIELD} h-9 w-full min-w-[7rem]`}
                        />
                      ) : (
                        rule.notes ?? <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 px-5">
        {isEditing ? (
          <>
            <Button variant="primary" loading={saveMutation.isPending} disabled={!locationId} onClick={() => saveMutation.mutate(editing)}>
              Guardar calendário
            </Button>
            <Button onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button icon={<AppIcon name="edit" size={16} />} disabled={!locationId} onClick={() => setEditing(draftFrom(schedule))}>
            Editar calendário
          </Button>
        )}
        {saveMutation.isError && <span className="text-sm text-red-700">{(saveMutation.error as Error).message || "Não foi possível guardar o calendário."}</span>}
      </div>
    </section>
  );
}

// ── Próximas oportunidades ──────────────────────────────────────────────────

function OpportunitiesCard({ schedule }: { schedule: SupplierDeliveryScheduleDTO | null }) {
  const [weeks, setWeeks] = useState(4);
  const now = useMemo(() => new Date(), []);
  const active = schedule?.active ?? false;
  const ops = useMemo(
    () => (schedule && active ? upcomingOpportunities(schedule.weekdays ?? [], schedule.dayRules ?? [], schedule.cutoffTime?.slice(0, 5) ?? null, now, weeks * 7) : []),
    [schedule, active, now, weeks],
  );
  // As 4 mais próximas, como no mockup; o resto do período fica resumido.
  const shown = ops.slice(0, MAX_OPPORTUNITIES);
  const hidden = ops.length - shown.length;

  return (
    <section className={`${SURFACE} flex flex-col pb-2`}>
      <CardHeader
        icon={<AppIcon name="delivery" size={22} />}
        title="Próximas oportunidades de fornecimento"
        subtitle={`Pelo calendário, a partir de hoje (${formatIsoDatePt(now.toISOString())}).`}
        action={
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} aria-label="Período das próximas oportunidades" className={`${FIELD} h-9 pr-8`}>
            {HORIZONS.map((h) => (
              <option key={h.weeks} value={h.weeks}>{h.label}</option>
            ))}
          </select>
        }
      />
      <div className="mt-2 px-5">
        {!schedule || (schedule.weekdays ?? []).length === 0 ? (
          <p className="py-4 text-sm text-ink-secondary">Defina os dias de entrega no calendário para ver as próximas oportunidades.</p>
        ) : !active ? (
          <p className="py-4 text-sm text-ink-secondary">O calendário desta loja está inativo.</p>
        ) : shown.length === 0 ? (
          <p className="py-4 text-sm text-ink-secondary">Sem entregas possíveis neste período.</p>
        ) : (
          <ul>
            {shown.map((o, i) => {
              const delivery = dayInfo(isoWeekdayOf(o.deliveryDate));
              const order = dayInfo(isoWeekdayOf(o.orderDeadline));
              return (
                // Lista compacta (~54 px por linha): data em bloco curto, texto em duas linhas.
                <li key={o.deliveryDate.toISOString()} className="flex items-center gap-3 border-b border-line-subtle py-1 last:border-0">
                  <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-lg bg-surface-soft py-1 leading-none">
                    <span className="text-[10px] font-medium text-ink-secondary">{delivery.short.toUpperCase()}</span>
                    <span className={`text-base font-bold leading-none text-navy-900 ${NUMERIC}`}>{o.deliveryDate.getDate()}</span>
                    <span className="text-[10px] font-medium text-ink-secondary">{MONTHS_SHORT[o.deliveryDate.getMonth()]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-900">Entrega {delivery.value === 6 || delivery.value === 7 ? "no" : "na"} {delivery.long.toLowerCase()}</p>
                    <p className="truncate text-[13px] text-ink-secondary">
                      Encomendar até {order.plain}, {ddmm(o.orderDeadline)}
                      {o.hasOrderTime ? ` às ${hourLabel(`${String(o.orderDeadline.getHours()).padStart(2, "0")}:${String(o.orderDeadline.getMinutes()).padStart(2, "0")}`)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${NUMERIC} ${
                      i === 0 ? "bg-emerald-50 text-emerald-800" : "bg-surface-soft text-ink-secondary"
                    }`}
                  >
                    {o.daysUntilDelivery === 0 ? "Hoje" : o.daysUntilDelivery === 1 ? "Amanhã" : `Em ${o.daysUntilDelivery} dias`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {hidden > 0 && (
          <p className="pb-1 pt-1 text-[13px] text-ink-secondary">
            +{hidden} entrega{hidden !== 1 ? "s" : ""} possíve{hidden !== 1 ? "is" : "l"} neste período
          </p>
        )}
      </div>
    </section>
  );
}

// ── Necessidades de reposição ───────────────────────────────────────────────

function ReplenishmentCard({ supplierId, locationId, onOpenItems }: { supplierId: string; locationId: string | null; onOpenItems: () => void }) {
  const { api } = useStockPlanningModule();
  const navigate = useNavigate();
  const [onlyNeeds, setOnlyNeeds] = useState(true);

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["supplier-replenishment", supplierId, locationId],
    queryFn: () => api.listSupplierReplenishment(supplierId, locationId!),
    enabled: !!locationId,
  });

  const needs = rows.filter((r) => r.needsReplenishment);
  const shown = onlyNeeds ? needs : rows;

  return (
    <section className={`${SURFACE} flex flex-col pb-4`}>
      <CardHeader
        icon={<IconBox size={22} />}
        title="Necessidades de reposição"
        subtitle="Sugestão com base no stock atual, stock mínimo e consumo médio. Apenas artigos deste fornecedor."
        action={
          <select value={onlyNeeds ? "needs" : "all"} onChange={(e) => setOnlyNeeds(e.target.value === "needs")} aria-label="Filtro" className={`${FIELD} h-9 pr-8`}>
            <option value="needs">Mostrar apenas com necessidade</option>
            <option value="all">Mostrar todos os artigos</option>
          </select>
        }
      />
      <div className="mt-3 overflow-x-auto px-5">
        <table className="min-w-full text-[13px]">
          <thead>
            <tr className="bg-surface-soft text-left text-[11px] font-medium uppercase tracking-wide text-ink-secondary">
              <th className="rounded-l-lg px-3 py-2.5 font-medium">Artigo</th>
              <th className="px-3 py-2.5 font-medium">Código</th>
              <th className="px-3 py-2.5 font-medium">Categoria</th>
              <th className="px-3 py-2.5 text-center font-medium">Stock atual</th>
              <th className="px-3 py-2.5 text-center font-medium">Stock mín.</th>
              <th className="px-3 py-2.5 text-center font-medium">
                Consumo médio
                <span className="block text-[10px] normal-case tracking-normal">(30 dias)</span>
              </th>
              <th className="px-3 py-2.5 text-center font-medium">Sugestão</th>
              <th className="px-3 py-2.5 font-medium">Un. compra</th>
              <th className="px-3 py-2.5 text-center font-medium">Última compra</th>
              <th className="px-3 py-2.5 text-right font-medium">
                Preço
                <span className="block text-[10px] normal-case tracking-normal">(último)</span>
              </th>
              <th className="rounded-r-lg px-2 py-2.5"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {!locationId ? (
              <EmptyRow text="Sem loja selecionada." />
            ) : isLoading ? (
              <EmptyRow text="A carregar…" />
            ) : isError ? (
              <EmptyRow text="Não foi possível carregar as necessidades de reposição." />
            ) : shown.length === 0 ? (
              <EmptyRow
                text={
                  rows.length === 0
                    ? "Ainda não há artigos de stock comprados a este fornecedor nem atribuídos a ele no Planeamento."
                    : "Nenhum artigo deste fornecedor precisa de reposição."
                }
              />
            ) : (
              shown.map((r) => <ReplenishmentRow key={r.stockItemId} row={r} onOpenPlanning={() => navigate("/stock/planeamento")} />)
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-5 text-[13px]">
        <span className="text-ink-secondary">
          {onlyNeeds
            ? `A mostrar ${shown.length} de ${needs.length} artigo${needs.length !== 1 ? "s" : ""} com necessidade`
            : `A mostrar ${shown.length} artigo${shown.length !== 1 ? "s" : ""} (${needs.length} com necessidade)`}
        </span>
        <button type="button" onClick={onOpenItems} className="font-medium text-brand-600 transition-colors hover:text-brand-500">
          Ver todos os artigos associados →
        </button>
      </div>
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={11} className="px-3 py-6 text-center text-ink-secondary">{text}</td>
    </tr>
  );
}

function ReplenishmentRow({ row: r, onOpenPlanning }: { row: SupplierReplenishmentRowDTO; onOpenPlanning: () => void }) {
  // Embalagem confirmada: encomenda em embalagens inteiras («Preciso de 12 kg → 5 sacos (12,5 kg)»).
  const order = r.order && r.order.packages > 0 ? r.order : null;
  const packLabel = (o: NonNullable<SupplierReplenishmentRowDTO["order"]>, n: number) => (o.packageUnit ? `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} ${n === 1 ? o.packageUnit : o.packageUnit.endsWith("ão") ? o.packageUnit.replace(/ão$/, "ões") : `${o.packageUnit}s`}` : qty(n, o.contentUnit));
  const suggestion = order ? (
    <span className="inline-flex flex-col items-center" title={`Preciso de ${qty(r.suggestedBaseQty, r.baseUnit)} → encomendar ${packLabel(order, order.packages)} (${qty(order.quantityBase, r.baseUnit)})${order.surplusBase > 0 ? `, excedente ${qty(order.surplusBase, r.baseUnit)}` : ""}`}>
      <span className={`inline-flex rounded-md bg-brand-50 px-2 py-0.5 font-medium text-brand-600 ${NUMERIC}`}>{packLabel(order, order.packages)}</span>
      <span className={`mt-0.5 text-[11px] text-ink-muted ${NUMERIC}`}>
        preciso de {qty(r.suggestedBaseQty, r.baseUnit)} → {qty(order.quantityBase, r.baseUnit)}
      </span>
    </span>
  ) :
    r.suggestedBaseQty > 0 ? (
      <span
        title={
          r.suggestionSource === "forecast"
            ? `Previsão do Planeamento${r.suggestedPurchaseQty != null && r.purchaseUnit ? ` — ${r.suggestedPurchaseQty.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} × ${r.purchaseUnit}` : ""}`
            : "Repor até ao stock mínimo"
        }
        className={`inline-flex rounded-md bg-brand-50 px-2 py-0.5 font-medium text-brand-600 ${NUMERIC}`}
      >
        {qty(r.suggestedBaseQty, r.baseUnit)}
      </span>
    ) : (
      <span className="text-ink-muted">—</span>
    );

  return (
    <tr className="border-b border-line-subtle last:border-0">
      <td className="px-3 py-2.5 text-ink">
        <span className="flex min-w-[160px] items-center gap-2.5">
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[10px] font-semibold text-brand-600">
            {initials(r.name) || "?"}
          </span>
          {r.name}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-ink-secondary">{r.code ?? <span className="text-ink-muted">—</span>}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-ink-secondary">{r.categoryName ?? <span className="text-ink-muted">—</span>}</td>
      <td className="px-3 py-2.5 text-center"><StockChip current={r.currentQuantity} min={r.minStockQty} unit={r.baseUnit} /></td>
      <td className={`px-3 py-2.5 text-center text-ink-secondary ${NUMERIC}`}>{r.minStockQty > 0 ? r.minStockQty.toLocaleString("pt-PT") : "—"}</td>
      <td className={`whitespace-nowrap px-3 py-2.5 text-center text-ink ${NUMERIC}`}>{qty(r.consumption30d, r.baseUnit)}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-center">{suggestion}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-ink-secondary">
        {r.order?.packageUnit
          ? `${r.order.packageUnit} de ${r.order.contentQuantity.toLocaleString("pt-PT", { maximumFractionDigits: 3 })} ${r.order.contentUnit}`
          : r.presentationConfigured === false && r.suggestedBaseQty > 0
            ? <span className="text-amber-700" title="Confirme em Compras por rever se vem em saco e quanto tem cada um">Embalagem por configurar</span>
            : r.purchaseUnit ?? <span className="text-ink-muted">—</span>}
      </td>
      <td className={`whitespace-nowrap px-3 py-2.5 text-center text-ink-secondary ${NUMERIC}`}>{r.lastPurchaseDate ? formatIsoDatePt(r.lastPurchaseDate) : "—"}</td>
      <td className={`whitespace-nowrap px-3 py-2.5 text-right font-medium text-navy-900 ${NUMERIC}`}>{r.lastUnitPrice != null ? formatEUR(r.lastUnitPrice) : "—"}</td>
      <td className="px-2 py-2.5 text-right">
        <DropdownMenu
          label={`Ações de ${r.name}`}
          items={[{ label: "Ver no planeamento", onSelect: onOpenPlanning }]}
          trigger={({ toggle }) => (
            <IconButton label={`Ações de ${r.name}`} size="sm" onClick={toggle} className="border border-line">
              <IconMore />
            </IconButton>
          )}
        />
      </td>
    </tr>
  );
}

// ── Separador ───────────────────────────────────────────────────────────────

function SupplierSupplyInner({ supplier, onOpenItems }: { supplier: SupplierDetail; onOpenItems: () => void }) {
  const { api } = useFinancialBaseModule();
  const { activeLocations } = useLocations();
  const [locationId, setLocationId] = useState<string | null>(null);
  // Por omissão, a loja habitual do fornecedor; senão a primeira loja ativa.
  const effectiveLocationId =
    locationId ?? (activeLocations.some((l) => l.id === supplier.defaultLocationId) ? supplier.defaultLocationId! : activeLocations[0]?.id ?? null);

  const { data: schedules = [] } = useQuery({
    queryKey: ["supplier-delivery-schedules", supplier.id],
    queryFn: () => api.listSupplierDeliverySchedules(supplier.id),
  });
  const schedule = schedules.find((s) => s.locationId === effectiveLocationId) ?? null;

  const scheduleActive = !!schedule?.active && (schedule.weekdays ?? []).length > 0;
  const next = scheduleActive ? upcomingOpportunities(schedule.weekdays ?? [], schedule.dayRules ?? [], schedule.cutoffTime?.slice(0, 5) ?? null, new Date(), 21)[0] : undefined;
  const lead = scheduleActive ? leadTimeRange(schedule.weekdays ?? [], schedule.dayRules ?? [], schedule.cutoffTime?.slice(0, 5) ?? null) : null;

  return (
    <div className="space-y-4">
      <div className={`${SURFACE} grid divide-y divide-line-subtle sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x`}>
        <KpiCell
          label="Próxima entrega"
          value={next ? `${dayInfo(isoWeekdayOf(next.deliveryDate)).short}, ${ddmm(next.deliveryDate)}` : "—"}
          sub={next ? "Conforme calendário" : "Sem calendário ativo"}
        />
        <KpiCell
          label="Prazo de pagamento"
          value={supplier.paymentTermsDays != null ? `${supplier.paymentTermsDays} dias` : "—"}
          sub="Prazo habitual"
        />
        <KpiCell
          label="Lead time"
          value={lead ? (lead.min === lead.max ? `${lead.min} dia${lead.min !== 1 ? "s" : ""}` : `${lead.min}–${lead.max} dias`) : "—"}
          sub="Entre pedido e entrega"
        />
        <KpiCell
          label="Encomenda mínima"
          value={supplier.minOrderValue != null ? formatEUR(supplier.minOrderValue) : "—"}
          sub={supplier.minOrderValue != null ? "Valor configurado" : "Não configurada"}
        />
      </div>

      {/* Lado a lado a partir de 1024 px; cada painel só com a altura que precisa (sem esticar). */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SupplyCalendarCard supplierId={supplier.id} locationId={effectiveLocationId} onLocationChange={setLocationId} schedule={schedule} />
        <OpportunitiesCard schedule={schedule} />
      </div>

      <ReplenishmentCard supplierId={supplier.id} locationId={effectiveLocationId} onOpenItems={onOpenItems} />

      <SupplierPlanningSummary supplierId={supplier.id} onOpenItems={onOpenItems} />
    </div>
  );
}

/**
 * Separador «Abastecimento» do detalhe de fornecedor (antes «Planeamento de
 * stock»): KPIs de fornecimento, calendário com regras por dia de entrega,
 * próximas oportunidades e necessidades de reposição dos artigos deste
 * fornecedor. Instancia o seu próprio `StockPlanningProvider` porque a
 * árvore `/financial/*` não monta esse módulo (como os Artigos associados).
 * Sem encomendas: o sistema ainda não as tem (decisão do utilizador).
 */
export function SupplierSupplyTab({ supplier, onOpenItems }: { supplier: SupplierDetail; onOpenItems: () => void }) {
  return (
    <StockPlanningProvider>
      <SupplierSupplyInner supplier={supplier} onOpenItems={onOpenItems} />
    </StockPlanningProvider>
  );
}
