import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchOrderDetail, fetchOrders } from "./ordersApi";
import {
  DOCUMENT_TYPE_LABELS,
  type OrderChannel,
  type VendusOrderDetail,
  type VendusOrderSummary,
} from "./orders.types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(systemTime: string): string {
  // "2016-01-02 10:01:20" → "10:01"
  const t = systemTime?.slice(11, 16);
  return t ?? systemTime?.slice(0, 10) ?? "—";
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function normalizeQty(qty: string | number): string {
  const n = Number(qty);
  return isNaN(n)
    ? String(qty)
    : n % 1 === 0
      ? String(n)
      : n.toFixed(2).replace(".00", "");
}

function loadPrinted(): Set<string> {
  try {
    const raw = localStorage.getItem("ab_printed_order_ids");
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function savePrinted(s: Set<string>) {
  localStorage.setItem("ab_printed_order_ids", JSON.stringify([...s]));
}

// ── Print ticket component ────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<
  OrderChannel,
  { label: string; emoji: string; className: string }
> = {
  delivery: {
    label: "APP / DELIVERY",
    emoji: "",
    className: "ticket-channel-delivery",
  },
  restaurant: {
    label: "RESTAURANTE",
    emoji: "",
    className: "ticket-channel-restaurant",
  },
  take_away: {
    label: "TAKE AWAY",
    emoji: "",
    className: "ticket-channel-takeaway",
  },
  unknown: {
    label: "CANAL DESCONHECIDO",
    emoji: "",
    className: "ticket-channel-unknown",
  },
};

function PrintTicket({ doc }: { doc: VendusOrderDetail }) {
  const items = doc.items ?? [];
  const obs = doc.observations?.trim();
  const channel = doc.channel ?? "unknown";
  const ch = CHANNEL_CONFIG[channel];

  return (
    <div id="print-ticket">
      <div className="ticket-header">
        <div className="ticket-brand">ANGRY BOX</div>
        <div className="ticket-sub">— COZINHA —</div>
      </div>

      <div className="ticket-sep" />

      {/* Canal — destaque grande */}
      <div className={`ticket-channel ${ch.className}`}>
        <span className="ticket-channel-emoji">{ch.emoji}</span>
        <span className="ticket-channel-label">{ch.label}</span>
        <span className="ticket-channel-emoji">{ch.emoji}</span>
      </div>

      <div className="ticket-sep" />

      <div className="ticket-meta">
        <span className="ticket-number">{doc.number}</span>
        <span className="ticket-time">
          {fmtDate(doc.date)}&nbsp;&nbsp;{fmtTime(doc.system_time)}
        </span>
      </div>

      <div className="ticket-sep" />

      <div className="ticket-items">
        {items.map((item, i) => (
          <div key={`${item.id}-${i}`} className="ticket-item">
            <div className="ticket-item-main">
              <span className="ticket-qty">{normalizeQty(item.qty)}x</span>
              <span className="ticket-name">{item.title}</span>
            </div>
            {item.text?.trim() && (
              <div className="ticket-item-note">
                → {item.text.trim().toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>

      {obs && (
        <>
          <div className="ticket-sep" />
          <div className="ticket-obs-label">OBSERVAÇÕES:</div>
          <div className="ticket-obs">{obs}</div>
        </>
      )}

      <div className="ticket-sep ticket-sep-end" />
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  printed,
  onPrint,
  loading,
}: {
  order: VendusOrderSummary;
  printed: boolean;
  onPrint: (id: string | number) => void;
  loading: boolean;
}) {
  const isNew = !printed;

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-all ${
        isNew
          ? "border-amber-300 bg-amber-50"
          : "border-slate-200 bg-white opacity-60"
      }`}
    >
      {isNew && (
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
          NOVO
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900">{order.number}</div>
        <div className="text-sm text-slate-500">
          {fmtDate(order.date)}&nbsp;&nbsp;{fmtTime(order.system_time)}
          &nbsp;·&nbsp;
          {DOCUMENT_TYPE_LABELS[order.type] ?? order.type}
          &nbsp;·&nbsp;
          {Number(order.amount_gross).toFixed(2)} €
        </div>
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={() => onPrint(order.id)}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          isNew
            ? "bg-slate-900 text-white hover:bg-slate-700"
            : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {printed ? "Re-imprimir" : "Imprimir"}
      </button>
    </div>
  );
}

// ── Delivery label (2nd page) ─────────────────────────────────────────────────

function DeliveryLabel({ doc }: { doc: VendusOrderDetail }) {
  const obs = doc.observations?.trim();
  const sub =
    doc.channel === "take_away" ? "— TAKE AWAY —" : "— SACO / ENTREGA —";

  return (
    <div id="delivery-label">
      <div className="ticket-header">
        <div className="ticket-brand">ANGRY BOX</div>
        <div className="ticket-sub">{sub}</div>
      </div>

      <div className="ticket-sep" />

      <div className="ticket-meta">
        <span className="ticket-number">{doc.number}</span>
        <span className="ticket-time">
          {fmtDate(doc.date)}&nbsp;&nbsp;{fmtTime(doc.system_time)}
        </span>
      </div>

      <div className="ticket-sep" />

      {obs && <div className="label-obs">{obs}</div>}

      {doc.has_drinks && (
        <>
          <div className="ticket-sep" />
          <div className="label-drinks">!! NÃO ESQUECER AS BEBIDAS !!</div>
        </>
      )}

      <div className="ticket-sep ticket-sep-end" />
    </div>
  );
}

// ── Print modal ───────────────────────────────────────────────────────────────

function PrintModal({
  doc,
  onPrint,
  onClose,
}: {
  doc: VendusOrderDetail;
  onPrint: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {/* Preview card */}
      <div className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="font-semibold text-slate-800">Pré-visualização</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Ticket preview */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          <div className="mx-auto w-[302px] bg-white p-3 font-mono text-[12px] leading-snug shadow-sm">
            <PrintTicket doc={doc} />
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            🖨 Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const KITCHEN_TYPES = ["FS", "FT", "FR", "DC", "EC"];

export function PrintOrdersPage() {
  const [type, setType] = useState("FS");
  const [date, setDate] = useState(todayIso);
  const [perPage, setPerPage] = useState(10);
  const [printDoc, setPrintDoc] = useState<VendusOrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | number | null>(
    null,
  );
  const [printedIds, setPrintedIds] = useState<Set<string>>(loadPrinted);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const {
    data: orders = [],
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["print-orders", type, date, perPage],
    queryFn: () => fetchOrders({ since: date, until: date, type, perPage }),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // Track seen IDs to detect new orders on next poll
  useEffect(() => {
    prevIdsRef.current = new Set(orders.map((o) => String(o.id)));
  }, [orders]);

  const markPrinted = useCallback((id: string) => {
    setPrintedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      savePrinted(next);
      return next;
    });
  }, []);

  async function handlePrint(id: string | number) {
    setLoadingDetail(id);
    try {
      const doc = await fetchOrderDetail(id);
      setPrintDoc(doc);
    } finally {
      setLoadingDetail(null);
    }
  }

  function doPrint() {
    window.print();
    if (printDoc) markPrinted(String(printDoc.id));
    setPrintDoc(null);
  }

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  const unprinted = useMemo(
    () => orders.filter((o) => !printedIds.has(String(o.id))),
    [orders, printedIds],
  );

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media screen {
          #print-page-1, #print-page-2 { display: none; }
        }
        @media print {
          body * { visibility: hidden; }
          #print-page-1, #print-page-1 * { visibility: visible; }
          #print-page-2, #print-page-2 * { visibility: visible; }
          #print-page-2 { page-break-before: always; }
          @page { size: 72mm auto; margin: 2mm; }
        }
        .ticket-brand { font-size: 16px; font-weight: bold; text-align: center; letter-spacing: 2px; }
        .ticket-sub { font-size: 11px; text-align: center; margin-bottom: 2px; }
        .ticket-sep { border-top: 1px dashed #000; margin: 4px 0; }
        .ticket-sep-end { margin-top: 8px; }
        .ticket-meta { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
        .ticket-number { font-weight: bold; }
        .ticket-time { }
        .ticket-items { margin: 4px 0; }
        .ticket-item { margin-bottom: 5px; }
        .ticket-item-main { display: flex; gap: 6px; }
        .ticket-qty { font-weight: bold; min-width: 28px; font-size: 13px; }
        .ticket-name { font-size: 13px; font-weight: bold; }
        .ticket-obs-label { font-size: 11px; font-weight: bold; margin-bottom: 2px; }
        .ticket-obs { font-size: 12px; font-weight: bold; }
        .ticket-channel { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 0; margin: 2px 0; }
        .ticket-channel-label { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
        .ticket-channel-emoji { font-size: 14px; }
        .ticket-channel-delivery { background: #000; color: #fff; }
        .ticket-channel-restaurant { background: #fff; color: #000; border: 2px solid #000; }
        .ticket-channel-takeaway { background: #fff; color: #000; border: 2px dashed #000; }
        .ticket-channel-unknown { background: #eee; color: #555; }
        .ticket-item-note { margin-left: 34px; font-size: 11px; font-style: italic; }
        .label-obs { font-size: 15px; font-weight: bold; margin: 4px 0; }
        .label-drinks { font-size: 13px; font-weight: bold; text-align: center; padding: 4px 0; }
      `}</style>

      {/* Hidden print-only wrappers */}
      {printDoc && (
        <div id="print-page-1">
          <PrintTicket doc={printDoc} />
        </div>
      )}
      {(printDoc?.channel === "delivery" ||
        printDoc?.channel === "take_away") && (
        <div id="print-page-2">
          <DeliveryLabel doc={printDoc} />
        </div>
      )}

      <div className="min-h-screen bg-slate-100">
        {/* Top bar */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <img
              src="/image.png"
              alt="Angry Box"
              className="h-9 w-9 rounded-full"
            />
            <div className="flex-1">
              <h1 className="text-base font-bold text-slate-900">
                Impressão de Pedidos
              </h1>
              <p className="text-xs text-slate-500">
                Última atualização: {lastRefresh}
                {isFetching && (
                  <span className="ml-2 text-amber-500">↻ a atualizar…</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Atualizar
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-2xl p-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                {KITCHEN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t} — {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">
                Mostrar
              </label>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    Últimos {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary badge */}
          {unprinted.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
              <span className="text-lg">🔔</span>
              {unprinted.length} pedido{unprinted.length > 1 ? "s" : ""} por
              imprimir
            </div>
          )}

          {/* Order list */}
          {isFetching && orders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
              A carregar pedidos…
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
              Nenhum pedido para {fmtDate(date)}.
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  printed={printedIds.has(String(order.id))}
                  onPrint={handlePrint}
                  loading={loadingDetail === order.id}
                />
              ))}
            </div>
          )}

          <p className="text-center text-xs text-slate-400">
            Auto-atualização a cada 30 segundos
          </p>
        </div>
      </div>

      {/* Print modal */}
      {printDoc && (
        <PrintModal
          doc={printDoc}
          onPrint={doPrint}
          onClose={() => setPrintDoc(null)}
        />
      )}
    </>
  );
}
