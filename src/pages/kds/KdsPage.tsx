import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  getDeliveries,
  updateDeliveryStatus,
  type Delivery,
  type DeliveryStatus,
} from "../../lib/kdsApi";

// ── Constants ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;

// Pizza base names (case-insensitive substring match)
const PIZZA_BASE_NAMES = [
  "tomate & pesto",
  "creamy garlic",
  "truffle shrooms",
  "tuna & mayo",
  "honey peperoni",
  "honey pepperoni",
  "4 formaggios",
  "chicken & cheese",
  "chicken ranch",
  "sweet smoked shrimp",
  "brigadeiro",
  "cookies and cream",
  "doce de leite e banana",
];

function isPizza(name: string): boolean {
  const lower = name.toLowerCase();
  return PIZZA_BASE_NAMES.some((p) => lower.includes(p));
}

type ItemStatus = "idle" | "forno" | "corte" | "pronto";

function nextItemStatus(current: ItemStatus, pizza: boolean): ItemStatus {
  if (current === "idle") return pizza ? "forno" : "pronto";
  if (current === "forno") return pizza ? "corte" : "pronto";
  if (current === "corte") return "pronto";
  return "idle"; // pronto → reset (tap de desfazer)
}

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: "Novo",
  received: "Novo",
  cooking: "Em preparo",
  waiting_to_delivery: "Pronto",
  delivered: "Entregue",
  canceled: "Cancelado",
};

const STATUS_DOT: Record<DeliveryStatus, string> = {
  pending: "bg-[#ED5C32]",
  received: "bg-[#ED5C32]",
  cooking: "bg-amber-500",
  waiting_to_delivery: "bg-emerald-500",
  delivered: "bg-stone-300",
  canceled: "bg-stone-300",
};

// card background + border per status
const CARD_STYLE: Record<DeliveryStatus, string> = {
  pending: "bg-white border-[#F5C992]/40",
  received: "bg-white border-[#F5C992]/40",
  cooking: "bg-amber-50 border-amber-200",
  waiting_to_delivery: "bg-emerald-50 border-emerald-200",
  delivered: "bg-white border-stone-200",
  canceled: "bg-white border-stone-200",
};

const STATUS_TEXT: Record<DeliveryStatus, string> = {
  pending: "text-[#ED5C32]",
  received: "text-[#ED5C32]",
  cooking: "text-amber-600",
  waiting_to_delivery: "text-emerald-600",
  delivered: "text-stone-400",
  canceled: "text-stone-400",
};

const TITLE_TEXT: Record<DeliveryStatus, string> = {
  pending: "text-stone-900",
  received: "text-stone-900",
  cooking: "text-amber-900",
  waiting_to_delivery: "text-emerald-900",
  delivered: "text-stone-500",
  canceled: "text-stone-500",
};

const ITEM_TEXT: Record<DeliveryStatus, string> = {
  pending: "text-stone-800",
  received: "text-stone-800",
  cooking: "text-amber-800",
  waiting_to_delivery: "text-emerald-800",
  delivered: "text-stone-400",
  canceled: "text-stone-400",
};

const QTY_TEXT: Record<DeliveryStatus, string> = {
  pending: "text-stone-900",
  received: "text-stone-900",
  cooking: "text-amber-700",
  waiting_to_delivery: "text-emerald-700",
  delivered: "text-stone-400",
  canceled: "text-stone-400",
};

// ── Long press hook ────────────────────────────────────────────────────────────

function useLongPress(
  onShortPress: () => void,
  onLongPress: () => void,
  delay = 500,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const start = useCallback(() => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  const handleClick = useCallback(() => {
    if (!fired.current) onShortPress();
    fired.current = false;
  }, [onShortPress]);

  return useMemo(() => ({
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onClick: handleClick,
  }), [start, cancel, handleClick]);
}

function nextStatus(status: DeliveryStatus): DeliveryStatus | null {
  if (status === "pending" || status === "received") return "cooking";
  if (status === "cooking") return "waiting_to_delivery";
  if (status === "waiting_to_delivery") return "delivered";
  return null;
}

function prevStatus(status: DeliveryStatus): DeliveryStatus | null {
  if (status === "cooking") return "pending";
  if (status === "waiting_to_delivery") return "cooking";
  if (status === "delivered") return "waiting_to_delivery";
  return null;
}


function fmtTime(d: Date): string {
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function parseUtcMs(dateCreate?: string): number {
  if (!dateCreate) return Date.now();
  const d = new Date(dateCreate.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function DeliveredDuration({ dateCreate, deliveredAt }: { dateCreate?: string; deliveredAt?: number }) {
  const start = parseUtcMs(dateCreate);
  const end = deliveredAt ?? Date.now();
  return (
    <span className="font-mono text-base font-bold tabular-nums text-stone-400">
      {fmtDuration(end - start)}
    </span>
  );
}

function ElapsedTimer({ dateCreate }: { dateCreate?: string }) {
  const startMs = useRef(parseUtcMs(dateCreate));
  const [elapsed, setElapsed] = useState(() => Date.now() - startMs.current);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startMs.current), 1000);
    return () => clearInterval(id);
  }, []);

  const totalSec = Math.max(0, Math.floor(elapsed / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const colour = mins >= 10 ? "text-red-600" : mins >= 5 ? "text-amber-500" : "text-emerald-600";

  return (
    <span className={`font-mono text-base font-bold tabular-nums ${colour}`}>
      {display}
    </span>
  );
}

function ItemIcon({ status }: { status: ItemStatus }) {
  if (status === "forno") return <span className="text-base leading-none">🔥</span>;
  if (status === "corte") return <span className="text-base leading-none">🔪</span>;
  if (status === "pronto") {
    return (
      <svg className="h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
      </svg>
    );
  }
  return <span className="h-4 w-4 shrink-0 rounded-full border border-stone-300 inline-block" />;
}

function OrderCard({
  delivery,
  onAdvance,
  onRevert,
  isUpdating,
  deliveredAt,
}: {
  delivery: Delivery;
  onAdvance: () => void;
  onRevert: () => void;
  isUpdating: boolean;
  deliveredAt?: number;
}) {
  const [itemStatuses, setItemStatuses] = useState<Record<number, ItemStatus>>({});

  const cycleItem = (idx: number, name: string) => {
    setItemStatuses((prev) => ({
      ...prev,
      [idx]: nextItemStatus(prev[idx] ?? "idle", isPizza(name)),
    }));
  };

  const canAdvance = nextStatus(delivery.status) !== null;
  const canInteract = (canAdvance || prevStatus(delivery.status) !== null) && !isUpdating;
  const pressHandlers = useLongPress(
    canAdvance ? onAdvance : () => undefined,
    onRevert,
  );
  const dividerColor =
    delivery.status === "cooking" ? "border-amber-200"
    : delivery.status === "waiting_to_delivery" ? "border-emerald-200"
    : "border-stone-100";

  return (
    <div
      {...(canInteract ? pressHandlers : {})}
      className={[
        "flex w-72 shrink-0 flex-col rounded-xl border shadow-sm transition-all duration-200 select-none",
        CARD_STYLE[delivery.status],
        canInteract ? "cursor-pointer active:scale-[0.98] active:shadow-none" : "",
        isUpdating ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Card header */}
      <div className={`flex items-center justify-between border-b px-4 py-3.5 ${dividerColor}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[delivery.status]}`} />
          <span className={`text-sm font-semibold ${STATUS_TEXT[delivery.status]}`}>
            {STATUS_LABEL[delivery.status]}
          </span>
        </div>
        {delivery.status === "delivered" ? (
          <DeliveredDuration dateCreate={delivery.dateCreate} deliveredAt={deliveredAt} />
        ) : (
          <ElapsedTimer dateCreate={delivery.dateCreate} />
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Title */}
        <p className={`mb-3 text-lg font-bold ${TITLE_TEXT[delivery.status]}`}>
          {delivery.table?.name ?? (delivery.reference > 0 ? `#${delivery.reference}` : `#${delivery.id}`)}
        </p>

        {/* Items */}
        <ul className="space-y-1">
          {delivery.items.map((item, i) => {
            const st = itemStatuses[i] ?? "idle";
            const done = st === "pronto";
            return (
              <li
                key={i}
                onClick={(e) => { e.stopPropagation(); cycleItem(i, item.name); }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/5 active:bg-black/10"
              >
                <ItemIcon status={st} />
                <span className={`min-w-[1.5rem] text-sm font-bold ${QTY_TEXT[delivery.status]}`}>
                  {item.qty}×
                </span>
                <div className="flex-1">
                  <span className={`text-sm font-medium ${ITEM_TEXT[delivery.status]} ${done ? "line-through opacity-50" : ""}`}>
                    {item.name}
                  </span>
                  {item.notes && (
                    <p className="text-xs italic text-stone-400">{item.notes}</p>
                  )}
                </div>
              </li>
            );
          })}
          {delivery.items.length === 0 && (
            <li className="text-xs italic text-stone-400">Sem items</li>
          )}
        </ul>

        {/* Extra info */}
        {delivery.extraInfo && (
          <p className="mt-3 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            {delivery.extraInfo}
          </p>
        )}

        {/* Source — só origens externas */}
        {delivery.source && delivery.source !== "pos" && delivery.source !== "0" && (
          <p className="mt-3 text-xs font-medium text-purple-600">{delivery.source}</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function KdsPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<number>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  // Regista o momento em que cada delivery foi visto pela 1ª vez como "delivered"
  const deliveredAtRef = useRef<Map<number, number>>(new Map());

  const refresh = useCallback(async () => {
    try {
      const data = await getDeliveries();
      // mais antigas à esquerda
      data.sort((a, b) => parseUtcMs(a.dateCreate) - parseUtcMs(b.dateCreate));
      // regista quando cada delivered foi visto pela 1ª vez
      const now = Date.now();
      data.forEach((d) => {
        if (d.status === "delivered" && !deliveredAtRef.current.has(d.id)) {
          deliveredAtRef.current.set(d.id, now);
        }
      });
      setDeliveries(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleAdvance = async (delivery: Delivery) => {
    const next = nextStatus(delivery.status);
    if (!next) return;
    setUpdating((prev) => new Set(prev).add(delivery.id));
    try {
      await updateDeliveryStatus(delivery.id, next);
      await refresh();
    } catch {
      // next poll will re-sync
    } finally {
      setUpdating((prev) => { const s = new Set(prev); s.delete(delivery.id); return s; });
    }
  };

  const handleRevert = async (delivery: Delivery) => {
    const prev = prevStatus(delivery.status);
    if (!prev) return;
    setUpdating((prev2) => new Set(prev2).add(delivery.id));
    try {
      await updateDeliveryStatus(delivery.id, prev);
      await refresh();
    } catch {
      // next poll will re-sync
    } finally {
      setUpdating((prev2) => { const s = new Set(prev2); s.delete(delivery.id); return s; });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">KDS — Cozinha</h1>
            <p className="text-sm text-stone-500">Pedidos activos em tempo real</p>
          </div>
          <div className="flex items-center gap-3">
            {deliveries.length > 0 && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                {deliveries.length} pedido{deliveries.length !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-xs text-stone-400">
              {fmtTime(lastRefresh)}
            </span>
            <button
              onClick={() => void refresh()}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
            >
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ED5C32] border-t-transparent" />
        </div>
      )}

      {!loading && (() => {
        const active = deliveries.filter(
          (d) =>
            d.status === "pending" ||
            d.status === "received" ||
            d.status === "cooking" ||
            d.status === "waiting_to_delivery",
        );
        const todayStr = new Date().toLocaleDateString("sv"); // "YYYY-MM-DD" no timezone local
        const finalizados = deliveries
          .filter((d) => {
            if (d.status !== "delivered") return false;
            if (!d.dateCreate) return true;
            const created = new Date(d.dateCreate.replace(" ", "T") + "Z");
            return created.toLocaleDateString("sv") === todayStr;
          })
          .reverse(); // mais recente à esquerda

        if (active.length === 0 && finalizados.length === 0 && !error) {
          return (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-stone-400">Sem pedidos activos</p>
            </div>
          );
        }

        return (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Lane activa — ocupa pelo menos metade da altura disponível */}
            <div className="flex min-h-[50%] items-start gap-4 overflow-x-auto p-6 pb-4">
              {active.length === 0 ? (
                <p className="self-center text-sm text-stone-400">Sem pedidos em preparo</p>
              ) : (
                active.map((d) => (
                  <OrderCard
                    key={d.id}
                    delivery={d}
                    onAdvance={() => void handleAdvance(d)}
                    onRevert={() => void handleRevert(d)}
                    isUpdating={updating.has(d.id)}
                    deliveredAt={deliveredAtRef.current.get(d.id)}
                  />
                ))
              )}
            </div>

            {/* Lane finalizados */}
            {finalizados.length > 0 && (
              <div className="border-t border-stone-200/60 px-6 py-5">
                <p className="mb-4 text-sm font-bold tracking-widest text-stone-400">FINALIZADOS</p>
                <div className="flex items-start gap-4 overflow-x-auto pb-2">
                  {finalizados.map((d) => (
                    <OrderCard
                      key={d.id}
                      delivery={d}
                      onAdvance={() => void handleAdvance(d)}
                      onRevert={() => void handleRevert(d)}
                      isUpdating={updating.has(d.id)}
                      deliveredAt={deliveredAtRef.current.get(d.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
