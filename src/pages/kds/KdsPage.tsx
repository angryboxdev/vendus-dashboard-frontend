import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  getDeliveries,
  updateDeliveryStatus,
  updateAirMenuDeliveryStatus,
  type Delivery,
  type DeliveryStatus,
} from "../../lib/kdsApi";
import { API_BASE } from "../../lib/api";
import { getStoredDeviceToken } from "../../modules/location-credentials/adapters/out/local-storage-device-token.adapter.ts";

// ── Constants ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;

const AIR_MENU_SOURCES = ["Glovo", "Uber Eats", "Bolt Food", "AirMenu"] as const;

function isAirMenuDelivery(d: Delivery): boolean {
  return (AIR_MENU_SOURCES as readonly string[]).includes(d.source);
}

const PLATFORM_BADGE: Record<string, string> = {
  Glovo: "bg-orange-500/20 text-orange-400 border border-orange-500/40",
  "Uber Eats": "bg-green-500/20 text-green-400 border border-green-500/40",
  "Bolt Food": "bg-neutral-700 text-white border border-neutral-500",
  AirMenu: "bg-blue-500/20 text-blue-400 border border-blue-500/40",
};

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
  pending: "bg-[#8b93b0]",
  received: "bg-[#8b93b0]",
  cooking: "bg-[#DEB221]",
  waiting_to_delivery: "bg-[#00cc99]",
  delivered: "bg-[#4a5168]",
  canceled: "bg-[#4a5168]",
};

// card background + border per status
const CARD_STYLE: Record<DeliveryStatus, string> = {
  pending: "bg-[#2e3347] border-[#4a5168]",
  received: "bg-[#2e3347] border-[#4a5168]",
  cooking: "bg-[#3a3010] border-[#DEB221]",
  waiting_to_delivery: "bg-[#0d3526] border-[#00cc99]",
  delivered: "bg-[#1e2130] border-[#353b52]",
  canceled: "bg-[#1e2130] border-[#353b52]",
};

const STATUS_TEXT: Record<DeliveryStatus, string> = {
  pending: "text-[#8b93b0]",
  received: "text-[#8b93b0]",
  cooking: "text-[#DEB221]",
  waiting_to_delivery: "text-[#00cc99]",
  delivered: "text-[#4a5168]",
  canceled: "text-[#4a5168]",
};

const TITLE_TEXT: Record<DeliveryStatus, string> = {
  pending: "text-white",
  received: "text-white",
  cooking: "text-[#f5e5a0]",
  waiting_to_delivery: "text-[#d5f0ee]",
  delivered: "text-[#4a5168]",
  canceled: "text-[#4a5168]",
};

const ITEM_TEXT: Record<DeliveryStatus, string> = {
  pending: "text-[#d4d8e8]",
  received: "text-[#d4d8e8]",
  cooking: "text-[#f0d882]",
  waiting_to_delivery: "text-[#b1ebe1]",
  delivered: "text-[#4a5168]",
  canceled: "text-[#4a5168]",
};

const QTY_TEXT: Record<DeliveryStatus, string> = {
  pending: "text-white",
  received: "text-white",
  cooking: "text-[#DEB221]",
  waiting_to_delivery: "text-[#00cc99]",
  delivered: "text-[#4a5168]",
  canceled: "text-[#4a5168]",
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
  // ISO strings (AirMenu) já têm timezone — não adicionar "Z" de novo
  const normalized = dateCreate.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateCreate)
    ? dateCreate
    : dateCreate.replace(" ", "T") + "Z";
  const d = new Date(normalized);
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
    <span className="font-mono text-lg font-extrabold tabular-nums text-stone-400">
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
    <span className={`font-mono text-lg font-extrabold tabular-nums ${colour}`}>
      {display}
    </span>
  );
}

function ItemIcon({ status }: { status: ItemStatus }) {
  if (status === "forno") return <span className="text-2xl leading-none">🔥</span>;
  if (status === "corte") return <span className="text-2xl leading-none">🔪</span>;
  if (status === "pronto") {
    return (
      <svg className="h-6 w-6 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
      </svg>
    );
  }
  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-[#4a5168] inline-block" />;
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

  const airMenu = isAirMenuDelivery(delivery);

  // Parse extraInfo to get provider order ID (Glovo/Uber/Bolt ID)
  const providerOrderId: string | null = (() => {
    if (!airMenu) return null;
    try {
      const info = JSON.parse(delivery.extraInfo) as { providerOrderId?: string | null; airMenuOrderId?: number };
      return info.providerOrderId ?? null;
    } catch { return null; }
  })();

  const displayOrderId = providerOrderId ?? `${delivery.reference > 0 ? delivery.reference : delivery.id}`;

  const cycleItem = (idx: number, name: string) => {
    // AirMenu orders are always from a pizza restaurant — all items use the full pizza flow
    const pizza = airMenu || isPizza(name);
    setItemStatuses((prev) => ({
      ...prev,
      [idx]: nextItemStatus(prev[idx] ?? "idle", pizza),
    }));
  };

  const canAdvance = nextStatus(delivery.status) !== null;
  const canInteract = (canAdvance || prevStatus(delivery.status) !== null) && !isUpdating;
  const pressHandlers = useLongPress(
    canAdvance ? onAdvance : () => undefined,
    onRevert,
  );
  const dividerColor =
    delivery.status === "cooking" ? "border-[#524518]"
    : delivery.status === "waiting_to_delivery" ? "border-[#154d38]"
    : delivery.status === "pending" || delivery.status === "received" ? "border-[#3d4460]"
    : "border-[#2a2f42]";

  return (
    <div
      {...(canInteract ? pressHandlers : {})}
      className={[
        "flex w-96 shrink-0 flex-col rounded-2xl border shadow-sm transition-all duration-200 select-none",
        CARD_STYLE[delivery.status],
        canInteract ? "cursor-pointer active:scale-[0.98] active:shadow-none" : "",
        isUpdating ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Card header */}
      <div className={`flex items-center justify-between border-b px-5 py-4 ${dividerColor}`}>
        <div className="flex items-center gap-2.5">
          <span className={`h-3 w-3 rounded-full ${STATUS_DOT[delivery.status]}`} />
          <span className={`text-lg font-bold ${STATUS_TEXT[delivery.status]}`}>
            {STATUS_LABEL[delivery.status]}
          </span>
          {airMenu && (
            <span className={`text-lg font-bold ${TITLE_TEXT[delivery.status]}`}>
              #{displayOrderId}
            </span>
          )}
        </div>
        {delivery.status === "delivered" ? (
          <DeliveredDuration dateCreate={delivery.dateCreate} deliveredAt={deliveredAt} />
        ) : (
          <ElapsedTimer dateCreate={delivery.dateCreate} />
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-5">
        {/* Title */}
        <div className="mb-4">
          {airMenu ? (
            <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${PLATFORM_BADGE[delivery.source] ?? PLATFORM_BADGE["AirMenu"]}`}>
              {delivery.source}
            </span>
          ) : (
            <p className={`text-xl font-bold ${TITLE_TEXT[delivery.status]}`}>
              {delivery.table?.name ?? (delivery.reference > 0 ? `#${delivery.reference}` : `#${delivery.id}`)}
            </p>
          )}
        </div>

        {/* Items */}
        <ul className="space-y-2">
          {delivery.items.map((item, i) => {
            const st = itemStatuses[i] ?? "idle";
            const done = st === "pronto";
            return (
              <li
                key={i}
                onClick={(e) => { e.stopPropagation(); cycleItem(i, item.name); }}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5 active:bg-white/10"
              >
                <ItemIcon status={st} />
                <span className={`min-w-[2rem] text-base font-bold ${QTY_TEXT[delivery.status]}`}>
                  {item.qty}×
                </span>
                <div className="flex-1">
                  <span className={`text-base font-extrabold ${ITEM_TEXT[delivery.status]} ${done ? "line-through opacity-50" : ""}`}>
                    {item.name}
                  </span>
                  {item.notes && (
                    <p className="text-sm italic text-stone-400">{item.notes}</p>
                  )}
                </div>
              </li>
            );
          })}
          {delivery.items.length === 0 && (
            <li className="text-sm italic text-stone-400">Sem items</li>
          )}
        </ul>

        {/* Extra info — só para pedidos Vendus com notas relevantes */}
        {!airMenu && delivery.extraInfo && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {delivery.extraInfo}
          </p>
        )}

        {/* Source — só origens externas não-AirMenu */}
        {!airMenu && delivery.source && delivery.source !== "pos" && delivery.source !== "0" && (
          <p className="mt-4 text-sm font-medium text-purple-600">{delivery.source}</p>
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
  // Pedidos AirMenu recebidos via SSE — mantidos separados para não serem apagados pelo polling Vendus
  const airMenuRef = useRef<Map<number, Delivery>>(new Map());

  const refresh = useCallback(async () => {
    try {
      const vendusData = await getDeliveries();
      const airMenuData = Array.from(airMenuRef.current.values());

      // Merge: Vendus + AirMenu (AirMenu IDs não colidem com Vendus)
      const merged = [...vendusData, ...airMenuData];
      merged.sort((a, b) => parseUtcMs(a.dateCreate) - parseUtcMs(b.dateCreate));

      const now = Date.now();
      merged.forEach((d) => {
        if (d.status === "delivered" && !deliveredAtRef.current.has(d.id)) {
          deliveredAtRef.current.set(d.id, now);
        }
      });
      setDeliveries(merged);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling Vendus
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // SSE — pedidos AirMenu em tempo real
  useEffect(() => {
    const token = getStoredDeviceToken();
    const url = `${API_BASE}/api/kds/stream${token ? `?device_token=${encodeURIComponent(token)}` : ""}`;
    const es = new EventSource(url);

    es.addEventListener("delivery", (e: MessageEvent) => {
      const delivery = JSON.parse(e.data as string) as Delivery;
      airMenuRef.current.set(delivery.id, delivery);
      // Força re-render com o novo pedido
      setDeliveries((prev) => {
        const withoutThis = prev.filter((d) => d.id !== delivery.id);
        const merged = [...withoutThis, delivery];
        merged.sort((a, b) => parseUtcMs(a.dateCreate) - parseUtcMs(b.dateCreate));
        return merged;
      });
    });

    es.onerror = () => {
      // O browser reconecta automaticamente — não precisamos fazer nada
    };

    return () => es.close();
  }, []);

  const handleAdvance = async (delivery: Delivery) => {
    const next = nextStatus(delivery.status);
    if (!next) return;
    setUpdating((prev) => new Set(prev).add(delivery.id));
    try {
      if (isAirMenuDelivery(delivery)) {
        await updateAirMenuDeliveryStatus(delivery.id, next);
        // SSE will broadcast the update — no manual refresh needed
      } else {
        await updateDeliveryStatus(delivery.id, next);
        await refresh();
      }
    } catch {
      // next poll / SSE will re-sync
    } finally {
      setUpdating((prev) => { const s = new Set(prev); s.delete(delivery.id); return s; });
    }
  };

  const handleRevert = async (delivery: Delivery) => {
    const prev = prevStatus(delivery.status);
    if (!prev) return;
    setUpdating((prev2) => new Set(prev2).add(delivery.id));
    try {
      if (isAirMenuDelivery(delivery)) {
        await updateAirMenuDeliveryStatus(delivery.id, prev);
        // SSE will broadcast the update — no manual refresh needed
      } else {
        await updateDeliveryStatus(delivery.id, prev);
        await refresh();
      }
    } catch {
      // next poll / SSE will re-sync
    } finally {
      setUpdating((prev2) => { const s = new Set(prev2); s.delete(delivery.id); return s; });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#272B39]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#1e2130] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">KDS — Cozinha</h1>
            <p className="text-sm text-stone-400">Pedidos activos em tempo real</p>
          </div>
          <div className="flex items-center gap-3">
            {deliveries.length > 0 && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-stone-300">
                {deliveries.length} pedido{deliveries.length !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-xs text-stone-500">
              {fmtTime(lastRefresh)}
            </span>
            <button
              onClick={() => void refresh()}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-stone-300 transition hover:bg-white/10"
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
            const created = new Date(parseUtcMs(d.dateCreate));
            return created.toLocaleDateString("sv") === todayStr;
          })
          .reverse(); // mais recente à esquerda

        if (active.length === 0 && finalizados.length === 0 && !error) {
          return (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-stone-500">Sem pedidos activos</p>
            </div>
          );
        }

        return (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Lane activa — ocupa pelo menos metade da altura disponível */}
            <div className="flex min-h-[50%] items-start gap-4 overflow-x-auto p-6 pb-4">
              {active.length === 0 ? (
                <p className="self-center text-sm text-stone-500">Sem pedidos em preparo</p>
              ) : (
                active.map((d) => (
                  <OrderCard
                    key={d.id}
                    delivery={d}
                    onAdvance={() => void handleAdvance(d)}
                    onRevert={() => void handleRevert(d)}
                    isUpdating={updating.has(d.id)}
                    deliveredAt={d.deliveredAt ?? deliveredAtRef.current.get(d.id)}
                  />
                ))
              )}
            </div>

            {/* Lane finalizados */}
            {finalizados.length > 0 && (
              <div className="border-t border-white/10 px-6 py-5">
                <p className="mb-4 text-sm font-bold tracking-widest text-stone-500">FINALIZADOS</p>
                <div className="flex items-start gap-4 overflow-x-auto pb-2">
                  {finalizados.map((d) => (
                    <OrderCard
                      key={d.id}
                      delivery={d}
                      onAdvance={() => void handleAdvance(d)}
                      onRevert={() => void handleRevert(d)}
                      isUpdating={updating.has(d.id)}
                      deliveredAt={d.deliveredAt ?? deliveredAtRef.current.get(d.id)}
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
