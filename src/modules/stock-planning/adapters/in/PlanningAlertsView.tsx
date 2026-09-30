import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStockPlanningModule } from "../../stock-planning.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { PlanningSubNav } from "./PlanningSubNav.tsx";
import { SeverityBadge, StateBadge } from "./ConfidenceBadge.tsx";
import { PlanningAlertDetailDrawer } from "./PlanningAlertDetailDrawer.tsx";
import { formatIsoDatePt } from "../../../../lib/format.ts";
import {
  PLANNING_ALERT_TYPE_LABELS,
  PLANNING_ALERT_SEVERITY_LABELS,
  PLANNING_ALERT_STATE_LABELS,
  type PlanningAlertRowDTO,
  type PlanningAlertState,
  type PlanningAlertType,
} from "../../domain/entities/stock-planning.ts";

const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

const PAGE_SIZE = 20;

type QuickFilter = "all" | "critical" | "attention" | "excess" | "sales" | "price";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "critical", label: "Risco crítico" },
  { key: "attention", label: "Atenção" },
  { key: "excess", label: "Excesso" },
  { key: "sales", label: "Vendas" },
  { key: "price", label: "Preço" },
];

function matchesQuickFilter(alert: PlanningAlertRowDTO, filter: QuickFilter): boolean {
  switch (filter) {
    case "all": return true;
    case "critical": return alert.severity === "critica";
    case "attention": return alert.severity === "alta" || alert.severity === "media";
    case "excess": return alert.alertType === "excess_stock";
    case "sales": return alert.alertType === "stockout_risk";
    case "price": return alert.alertType === "price_anomaly";
  }
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function AlertActionsMenu({
  alert,
  onAcknowledge,
  onSilence,
}: {
  alert: PlanningAlertRowDTO;
  onAcknowledge: () => void;
  onSilence: () => void;
}) {
  const [open, setOpen] = useState(false);
  const canAct = alert.state === "active" || alert.state === "acknowledged";
  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="rounded-md border border-stone-200 px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-50"
      >
        ···
      </button>
      {open && (
        <div
          className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-stone-200 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {alert.state === "active" && (
            <button type="button" onClick={() => { onAcknowledge(); setOpen(false); }} className="block w-full px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50">
              Reconhecer
            </button>
          )}
          {canAct && (
            <button type="button" onClick={() => { onSilence(); setOpen(false); }} className="block w-full px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50">
              Silenciar…
            </button>
          )}
          {!canAct && <p className="px-3 py-1.5 text-xs text-stone-400">Sem ações disponíveis</p>}
        </div>
      )}
    </div>
  );
}

export function PlanningAlertsView() {
  const { api } = useStockPlanningModule();
  const { locations } = useLocations();
  const qc = useQueryClient();

  const [locationId, setLocationId] = useState<string | null>(locations[0]?.id ?? null);
  const [state, setState] = useState<PlanningAlertState | "all">("all");
  const [alertType, setAlertType] = useState<PlanningAlertType | "all">("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [page, setPage] = useState(0);
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);
  const [silenceFor, setSilenceFor] = useState<PlanningAlertRowDTO | null>(null);
  const [silenceReason, setSilenceReason] = useState("");

  const effectiveLocationId = locationId ?? locations[0]?.id ?? null;

  const { data: alerts = [], isLoading, isError } = useQuery({
    queryKey: ["stock-planning-alerts", effectiveLocationId, state, alertType],
    queryFn: () =>
      api.listAlerts({
        locationId: effectiveLocationId!,
        state: state === "all" ? undefined : state,
        alertType: alertType === "all" ? undefined : alertType,
      }),
    enabled: !!effectiveLocationId,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["stock-planning-alerts"] }),
  });

  const silenceMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.silenceAlert(id, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stock-planning-alerts"] });
      setSilenceFor(null);
      setSilenceReason("");
    },
  });

  const filtered = useMemo(() => alerts.filter((a) => matchesQuickFilter(a, quickFilter)), [alerts, quickFilter]);

  const summary = useMemo(() => ({
    critical: alerts.filter((a) => a.severity === "critica").length,
    attention: alerts.filter((a) => a.severity === "alta" || a.severity === "media").length,
    excess: alerts.filter((a) => a.alertType === "excess_stock").length,
    sales: alerts.filter((a) => a.alertType === "stockout_risk").length,
    price: alerts.filter((a) => a.alertType === "price_anomaly").length,
  }), [alerts]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function clearFilters() {
    setState("all");
    setAlertType("all");
    setQuickFilter("all");
    setPage(0);
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <PlanningSubNav current="Alertas de planeamento" />

      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-stone-900">Alertas de planeamento</h1>
        <p className="mt-0.5 text-sm text-stone-500">Risco de rutura, excesso, variação de vendas e de preço detetados automaticamente pelo forecast diário.</p>
      </div>

      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <SummaryCard label="Risco crítico" value={summary.critical} accent="text-red-600" />
          <SummaryCard label="Atenção" value={summary.attention} accent="text-amber-600" />
          <SummaryCard label="Possível excesso" value={summary.excess} accent="text-sky-600" />
          <SummaryCard label="Variação de vendas" value={summary.sales} accent="text-orange-600" />
          <SummaryCard label="Variação de preço" value={summary.price} accent="text-violet-600" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <LocationSelect value={locationId} onChange={setLocationId} className={inputCls} />
          <select value={state} onChange={(e) => { setState(e.target.value as PlanningAlertState | "all"); setPage(0); }} className={inputCls}>
            <option value="all">Todos os estados</option>
            {(Object.entries(PLANNING_ALERT_STATE_LABELS) as [PlanningAlertState, string][]).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <select value={alertType} onChange={(e) => { setAlertType(e.target.value as PlanningAlertType | "all"); setPage(0); }} className={inputCls}>
            <option value="all">Todos os tipos</option>
            {(Object.entries(PLANNING_ALERT_TYPE_LABELS) as [PlanningAlertType, string][]).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <button type="button" onClick={clearFilters} className="text-xs font-medium text-stone-500 hover:underline">Limpar filtros</button>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-white p-1 text-xs">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setQuickFilter(f.key); setPage(0); }}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${quickFilter === f.key ? "bg-[#ED5C32] text-white" : "text-stone-600 hover:bg-stone-100"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Descrição</th>
                <th className="px-4 py-2.5">Severidade</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {!effectiveLocationId ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">Sem loja selecionada.</td></tr>
              ) : isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">A carregar…</td></tr>
              ) : isError ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">Não foi possível carregar os alertas.</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">Sem alertas para este filtro.</td></tr>
              ) : (
                paged.map((alert) => (
                  <tr key={alert.id} className="cursor-pointer hover:bg-stone-50/60" onClick={() => setOpenAlertId(alert.id)}>
                    <td className="px-4 py-2.5 text-stone-600">{formatIsoDatePt(alert.firstDetectedAt)}</td>
                    <td className="px-4 py-2.5 text-stone-600">{PLANNING_ALERT_TYPE_LABELS[alert.alertType]}</td>
                    <td className="px-4 py-2.5 font-medium text-stone-800">{alert.itemName}</td>
                    <td className="px-4 py-2.5 text-stone-500">{PLANNING_ALERT_TYPE_LABELS[alert.alertType]} identificado para {alert.itemName}</td>
                    <td className="px-4 py-2.5"><SeverityBadge severity={alert.severity} label={PLANNING_ALERT_SEVERITY_LABELS[alert.severity]} /></td>
                    <td className="px-4 py-2.5"><StateBadge state={alert.state} label={PLANNING_ALERT_STATE_LABELS[alert.state]} /></td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setOpenAlertId(alert.id); }} className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                          Ver
                        </button>
                        <AlertActionsMenu
                          alert={alert}
                          onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
                          onSilence={() => setSilenceFor(alert)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>{filtered.length} alerta(s) · página {page + 1} de {pageCount}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-stone-300 px-2.5 py-1 font-medium text-stone-600 disabled:opacity-40">Anterior</button>
              <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} className="rounded-md border border-stone-300 px-2.5 py-1 font-medium text-stone-600 disabled:opacity-40">Seguinte</button>
            </div>
          </div>
        )}
      </div>

      {openAlertId && (
        <PlanningAlertDetailDrawer alertId={openAlertId} onClose={() => setOpenAlertId(null)} />
      )}

      {silenceFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-stone-900">Silenciar alerta</h3>
            <p className="mt-1 text-xs text-stone-500">{silenceFor.itemName} · {PLANNING_ALERT_TYPE_LABELS[silenceFor.alertType]}</p>
            <textarea
              value={silenceReason}
              onChange={(e) => setSilenceReason(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              placeholder="Motivo do silenciamento"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setSilenceFor(null)} className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                Fechar
              </button>
              <button
                type="button"
                disabled={!silenceReason.trim() || silenceMutation.isPending}
                onClick={() => silenceMutation.mutate({ id: silenceFor.id, reason: silenceReason.trim() })}
                className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {silenceMutation.isPending ? "A silenciar…" : "Silenciar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
