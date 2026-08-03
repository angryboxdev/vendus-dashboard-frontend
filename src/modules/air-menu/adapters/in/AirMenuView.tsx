import { AirMenuAnalytics, Pagination } from "./AirMenuAnalytics.tsx";
import type {
  AirMenuDocumentType,
  AirMenuOrder,
} from "../../domain/entities/air-menu-order.ts";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AirMenuEnterprise } from "../../domain/entities/air-menu-enterprise.ts";
import { OrderRow } from "./air-menu-shared.tsx";
import { useAirMenuModule } from "../../air-menu.module.tsx";
import { useAirMenuSummary } from "./use-air-menu-summary.ts";

// ─── Date helpers ────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Date range selector ─────────────────────────────────────────────────────

type Preset = "today" | "yesterday" | "last7" | "last30" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last7: "Últimos 7 dias",
  last30: "Último mês",
  custom: "Personalizado",
};

function presetRange(
  preset: Preset,
  customStart: Date,
  customEnd: Date,
): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "last7":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "last30":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "custom":
      return { start: customStart, end: customEnd };
  }
}

function DateRangeSelector({
  preset,
  customStart,
  customEnd,
  onChange,
}: {
  preset: Preset;
  customStart: Date;
  customEnd: Date;
  onChange: (preset: Preset, customStart: Date, customEnd: Date) => void;
}) {
  const [draftStart, setDraftStart] = useState(customStart);
  const [draftEnd, setDraftEnd] = useState(customEnd);

  const handlePresetClick = (p: Preset) => {
    if (p === "custom") {
      setDraftStart(customStart);
      setDraftEnd(customEnd);
      onChange("custom", customStart, customEnd);
    } else {
      onChange(p, customStart, customEnd);
    }
  };

  const presets: Preset[] = ["today", "yesterday", "last7", "last30", "custom"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p}
          onClick={() => handlePresetClick(p)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            preset === p
              ? "bg-[#E8533F] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={toInputValue(draftStart)}
            max={toInputValue(draftEnd)}
            onChange={(e) =>
              setDraftStart(startOfDay(new Date(e.target.value)))
            }
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
          <span className="text-sm text-gray-400">até</span>
          <input
            type="date"
            value={toInputValue(draftEnd)}
            min={toInputValue(draftStart)}
            onChange={(e) => setDraftEnd(endOfDay(new Date(e.target.value)))}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => onChange("custom", draftStart, draftEnd)}
            className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Buscar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Document type filter + summary ──────────────────────────────────────────

type DocFilter = "all" | AirMenuDocumentType;

function FilterSummary({
  orders,
  docFilter,
}: {
  orders: AirMenuOrder[];
  docFilter: DocFilter;
}) {
  const invoices = orders.filter((o) => o.documentType === "invoice");
  const creditNotes = orders.filter((o) => o.documentType === "credit_note");
  const invoiceTotal = invoices.reduce((s, o) => s + o.total, 0);
  const creditTotal = creditNotes.reduce((s, o) => s + Math.abs(o.total), 0);
  const net = invoiceTotal - creditTotal;

  if (docFilter === "invoice") {
    return (
      <span className="text-sm font-medium text-gray-600">
        {invoices.length} fatura{invoices.length !== 1 ? "s" : ""}{" "}
        <span className="text-emerald-600">· €{invoiceTotal.toFixed(2)}</span>
      </span>
    );
  }

  if (docFilter === "credit_note") {
    return (
      <span className="text-sm font-medium text-gray-600">
        {creditNotes.length} nota{creditNotes.length !== 1 ? "s" : ""} de
        crédito{" "}
        <span className="text-red-500">· €{creditTotal.toFixed(2)}</span>
      </span>
    );
  }

  return (
    <span className="text-sm text-gray-500">
      Faturas{" "}
      <span className="font-medium text-emerald-600">
        €{invoiceTotal.toFixed(2)}
      </span>
      {" − "}
      Notas{" "}
      <span className="font-medium text-red-500">
        €{creditTotal.toFixed(2)}
      </span>
      {" = Líquido "}
      <span
        className={`font-semibold ${net >= 0 ? "text-gray-800" : "text-red-500"}`}
      >
        €{net.toFixed(2)}
      </span>
    </span>
  );
}

const DOC_FILTER_LABELS: Record<DocFilter, string> = {
  all: "Todos",
  invoice: "Faturas",
  credit_note: "Notas de Crédito",
};

function DocFilterTabs({
  active,
  onChange,
}: {
  active: DocFilter;
  onChange: (f: DocFilter) => void;
}) {
  const filters: DocFilter[] = ["invoice", "credit_note", "all"];
  return (
    <div className="flex gap-1">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active === f
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {DOC_FILTER_LABELS[f]}
        </button>
      ))}
    </div>
  );
}

// ─── Order detail drawer ──────────────────────────────────────────────────────

const FLAG_COLORS: Record<string, string> = {
  ACCEPT: "bg-blue-100 text-blue-700",
  FATURAR: "bg-emerald-100 text-emerald-700",
  PRINT: "bg-gray-100 text-gray-600",
  READY: "bg-yellow-100 text-yellow-700",
  PICKING_UP: "bg-orange-100 text-orange-700",
  PICKED: "bg-orange-100 text-orange-700",
  FINISHED: "bg-green-100 text-green-700",
  DENY: "bg-red-100 text-red-600",
  CANCEL: "bg-red-200 text-red-800",
};

function OrderDrawer({
  order,
  enterpriseId,
  onClose,
}: {
  order: AirMenuOrder;
  enterpriseId: string;
  onClose: () => void;
}) {
  const { getOrderRaw } = useAirMenuModule();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [rawData, setRawData] = useState<Record<string, unknown>[] | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setRawLoading(true);
    setRawError(null);
    getOrderRaw
      .execute(enterpriseId, order.orderId)
      .then(setRawData)
      .catch((e: unknown) =>
        setRawError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setRawLoading(false));
  }, [enterpriseId, order.orderId, getOrderRaw]);

  const fmtDate = (d: Date) =>
    d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "medium" });

  const itemsTotal = order.items.reduce((s, i) => s + i.price * i.count, 0);
  const isCreditNote = order.documentType === "credit_note";

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Detalhe do Pedido
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold text-gray-800">
              {order.providerOrderId ?? order.orderId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Ordem
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
              {[
                ...(order.firstName || order.lastName
                  ? [["Cliente", `${order.firstName} ${order.lastName}`.trim()]]
                  : []),
                ["ID AirMenu", order.orderId],
                ["Plataforma", order.platform],
                ...(order.providerOrderId
                  ? [["ID na Plataforma", order.providerOrderId]]
                  : []),
                ["Pagamento", order.paymentMethod],
                ["Data Pedido", fmtDate(order.orderDate)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-medium text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Itens
            </h3>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-right">Qtd</th>
                    <th className="px-4 py-2 text-right">P. Unit.</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-800">{item.title}</td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {item.count}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        €{item.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-800">
                        €{(item.price * item.count).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-400"
                    >
                      Total
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-bold ${isCreditNote ? "text-red-500" : "text-gray-800"}`}
                    >
                      {isCreditNote ? "-" : ""}€{itemsTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Histórico de Ações
            </h3>
            <ol className="space-y-2">
              {[...order.activeFlags]
                .sort((a, b) => ((a as { datetime?: number }).datetime ?? 0) - ((b as { datetime?: number }).datetime ?? 0))
                .map((flag, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        FLAG_COLORS[flag.key] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {flag.key}
                    </span>
                    <div className="text-sm">
                      {(flag as unknown as { datetime?: number }).datetime && (
                        <p className="text-gray-800">
                          {new Date((flag as { datetime: number }).datetime).toLocaleString("pt-PT", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </p>
                      )}
                      {flag.operator && (
                        <p className="text-xs text-gray-400">{flag.operator}</p>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Resposta Raw (AirMenu API)
              {rawData && rawData.length > 1 && (
                <span className="ml-2 normal-case text-gray-400">
                  — {rawData.length} instâncias
                </span>
              )}
            </h3>
            {rawLoading && (
              <div className="flex items-center justify-center py-6 text-sm text-gray-400">
                A carregar dados brutos…
              </div>
            )}
            {rawError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {rawError}
              </div>
            )}
            {rawData && (
              <div className="space-y-3">
                {rawData.map((instance, i) => (
                  <div key={i}>
                    {rawData.length > 1 && (
                      <p className="mb-1 text-xs text-gray-400">
                        Instância {i + 1}
                        {typeof instance["childDivisionName"] === "string" && (
                          <> — {instance["childDivisionName"]}</>
                        )}
                      </p>
                    )}
                    <pre className="max-h-96 overflow-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
                      {JSON.stringify(instance, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EnterpriseTabs({
  enterprises,
  selected,
  onSelect,
}: {
  enterprises: AirMenuEnterprise[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {enterprises.map((e) => (
        <button
          key={e.id}
          onClick={() => onSelect(e.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            selected === e.id
              ? "border-b-2 border-[#E8533F] text-[#E8533F]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {e.name}
        </button>
      ))}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AirMenuView() {
  const { getEnterprises } = useAirMenuModule();
  const [enterprises, setEnterprises] = useState<AirMenuEnterprise[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingEnterprises, setLoadingEnterprises] = useState(true);

  const now = new Date();
  const [preset, setPreset] = useState<Preset>("today");
  const [customStart, setCustomStart] = useState<Date>(startOfDay(now));
  const [customEnd, setCustomEnd] = useState<Date>(endOfDay(now));
  const [docFilter, setDocFilter] = useState<DocFilter>("invoice");

  const { start: startDate, end: endDate } = presetRange(
    preset,
    customStart,
    customEnd,
  );

  const handlePresetChange = useCallback((p: Preset, cs: Date, ce: Date) => {
    setPreset(p);
    setCustomStart(cs);
    setCustomEnd(ce);
  }, []);

  const loadEnterprises = useCallback(async () => {
    try {
      const list = await getEnterprises.execute();
      setEnterprises(list);
      if (list.length > 0) setSelectedId(list[0]!.id);
    } catch {
      // silenced — shown in orders error UI
    } finally {
      setLoadingEnterprises(false);
    }
  }, [getEnterprises]);

  useEffect(() => {
    void loadEnterprises();
  }, [loadEnterprises]);

  const [detailOrder, setDetailOrder] = useState<AirMenuOrder | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);

  const {
    orders: allOrders,
    analytics,
    loading,
    error,
    refresh,
  } = useAirMenuSummary(selectedId, startDate, endDate);

  const invoicedOrders = allOrders.filter(
    (o) => o.documentType === "invoice" || o.documentType === "credit_note",
  );

  const filteredOrders =
    docFilter === "all"
      ? invoicedOrders
      : invoicedOrders.filter((o) => o.documentType === docFilter);

  const ordersStart = (ordersPage - 1) * ordersPageSize;
  const visibleOrders = filteredOrders.slice(
    ordersStart,
    ordersStart + ordersPageSize,
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Air Menu</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pedidos agregados de Glovo, Uber Eats e Bolt Food
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading || !selectedId}
          className="rounded-lg bg-[#E8533F] px-4 py-2 text-sm font-medium text-white hover:bg-[#d44432] disabled:opacity-50"
        >
          {loading ? "A carregar…" : "Atualizar"}
        </button>
      </div>

      {loadingEnterprises ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          A carregar enterprises…
        </div>
      ) : (
        <>
          {/* Enterprise tabs */}
          <div className="mb-4">
            <EnterpriseTabs
              enterprises={enterprises}
              selected={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setOrdersPage(1);
              }}
            />
          </div>

          {/* Date range */}
          <div className="mb-6">
            <DateRangeSelector
              preset={preset}
              customStart={customStart}
              customEnd={customEnd}
              onChange={handlePresetChange}
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Orders table — always rendered; spinner inside when loading */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <DocFilterTabs
                active={docFilter}
                onChange={(f) => {
                  setDocFilter(f);
                  setOrdersPage(1);
                }}
              />
              <FilterSummary
                orders={invoicedOrders}
                docFilter={docFilter}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                A carregar pedidos…
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                Sem pedidos no período selecionado.
              </div>
            ) : (
              <>
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Plataforma</th>
                      <th className="px-4 py-3">ID Plataforma</th>
                      {docFilter === "all" && (
                        <th className="px-4 py-3">Documento</th>
                      )}
                      <th className="px-4 py-3">Data Documento</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Itens</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => (
                      <OrderRow
                        key={`${order.orderId}-${order.divisionName}`}
                        order={order}
                        onDetail={setDetailOrder}
                        showDocumentCol={docFilter === "all"}
                      />
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-gray-100">
                  <Pagination
                    total={filteredOrders.length}
                    page={ordersPage}
                    pageSize={ordersPageSize}
                    pageSizeOptions={[10, 25, 50, 100]}
                    onPageChange={setOrdersPage}
                    onPageSizeChange={(s) => {
                      setOrdersPageSize(s);
                      setOrdersPage(1);
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Analytics — always rendered with its own loading state */}
          <AirMenuAnalytics
            data={analytics}
            loading={loading}
            error={error}
            orders={invoicedOrders}
            onOrderDetail={setDetailOrder}
          />
        </>
      )}

      {detailOrder !== null && selectedId !== null && (
        <OrderDrawer
          order={detailOrder}
          enterpriseId={selectedId}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </div>
  );
}
