import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatEuros, type Discount } from "../../domain/entities/pos.ts";
import type { PricedCart, PricedCartLine } from "../../domain/services/cart.service.ts";
import { ProductThumb } from "./PosCatalog.tsx";
import { POS } from "./pos-theme.ts";

/** Desconto em % ou €, limitado a 100 % ou ao valor. */
export function DiscountEditor({ value, maxCents, onChange, label }: { value: Discount | undefined; maxCents: number; onChange: (d: Discount | null) => void; label: string }) {
  const [kind, setKind] = useState<Discount["kind"]>(value?.kind ?? "pct");
  const [text, setText] = useState(value ? String(value.value).replace(".", ",") : "");
  const apply = (k: Discount["kind"], t: string) => {
    const n = Number(t.replace(",", "."));
    if (!t || !Number.isFinite(n) || n <= 0) return onChange(null);
    const capped = k === "pct" ? Math.min(n, 100) : Math.min(n, maxCents / 100);
    onChange({ kind: k, value: Math.round(capped * 100) / 100 });
  };
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <span className={`text-sm ${POS.mutedText}`}>{label}</span>
      <div className={`flex overflow-hidden rounded-lg border ${POS.border}`}>
        {(["pct", "eur"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              apply(k, text);
            }}
            className={`h-9 w-10 text-sm font-semibold ${kind === k ? POS.accent : POS.card}`}
          >
            {k === "pct" ? "%" : "€"}
          </button>
        ))}
      </div>
      <input
        inputMode="decimal"
        aria-label={`${label} (${kind === "pct" ? "%" : "€"})`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          apply(kind, e.target.value);
        }}
        className={`h-9 w-20 rounded-lg border ${POS.border} ${POS.card} px-2 text-right ${POS.num}`}
        placeholder="0"
      />
    </div>
  );
}

function TicketLine({ l, onChange, onDiscount }: { l: PricedCartLine; onChange: (delta: number) => void; onDiscount: (d: Discount | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`border-b ${POS.border} py-2`}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open} aria-label={`${l.product.name}: desconto`}>
          <ProductThumb product={l.product} size="sm" />
          <span className="min-w-0">
            <span className="line-clamp-2 block text-sm font-semibold leading-tight">{l.product.name}</span>
            <span className={`block text-xs ${POS.mutedText} ${POS.num}`}>
              {formatEuros(l.product.priceCents)}
              {l.line.discount && <span className="ml-1 rounded bg-emerald-700/15 px-1 text-emerald-700">−{l.line.discount.kind === "pct" ? `${l.line.discount.value} %` : formatEuros(Math.round(l.line.discount.value * 100))}</span>}
            </span>
          </span>
        </button>
        <button type="button" aria-label={`Menos ${l.product.name}`} onClick={() => onChange(-1)} className={`${POS.secondary} flex h-11 w-11 items-center justify-center rounded-xl`}>
          {l.line.quantity === 1 ? <Trash2 aria-hidden className="h-5 w-5" /> : <Minus aria-hidden className="h-5 w-5" />}
        </button>
        <span className={`w-6 text-center font-bold ${POS.num}`}>{l.line.quantity}</span>
        <button type="button" aria-label={`Mais ${l.product.name}`} onClick={() => onChange(1)} className={`${POS.secondary} flex h-11 w-11 items-center justify-center rounded-xl`}>
          <Plus aria-hidden className="h-5 w-5" />
        </button>
        <span className={`w-20 text-right font-semibold ${POS.num}`}>{formatEuros(l.netCents)}</span>
      </div>
      {l.product.trackStock && l.line.quantity > l.product.stockQty && (
        <p className={`${POS.amber} mt-1 ml-12 inline-block rounded-full px-2 text-xs font-semibold`}>
          stock insuficiente ({l.product.stockQty < 0 ? `Stock −${-l.product.stockQty}` : `${l.product.stockQty} em stock`})
        </p>
      )}
      {open && (
        <div className="mt-2 pl-12">
          <DiscountEditor label="Desconto da linha" value={l.line.discount} maxCents={l.grossCents} onChange={onDiscount} />
        </div>
      )}
    </li>
  );
}

/** Talão em construção: linhas com −/+, desconto por linha e na venda, IVA e total. */
export function PosTicket({
  priced,
  saleDiscount,
  onQuantity,
  onLineDiscount,
  onSaleDiscount,
  onClear,
}: {
  priced: PricedCart;
  saleDiscount: Discount | undefined;
  onQuantity: (productId: string, delta: number) => void;
  onLineDiscount: (productId: string, d: Discount | null) => void;
  onSaleDiscount: (d: Discount | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-lg font-semibold">Talão</h2>
        <button type="button" onClick={onClear} disabled={priced.lines.length === 0} className={`text-sm font-medium underline disabled:opacity-40 ${POS.mutedText}`}>
          Limpar
        </button>
      </div>
      {priced.lines.length === 0 ? (
        <p className={`py-8 text-center text-sm ${POS.mutedText}`}>Toque num artigo para o adicionar.</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Linhas do talão">
          {priced.lines.map((l) => (
            <TicketLine key={l.line.productId} l={l} onChange={(d) => onQuantity(l.line.productId, d)} onDiscount={(d) => onLineDiscount(l.line.productId, d)} />
          ))}
        </ul>
      )}
      {priced.lines.length > 0 && (
        <div className="space-y-2 pt-3">
          <DiscountEditor key={saleDiscount ? "com" : "sem"} label="Desconto na venda" value={saleDiscount} maxCents={priced.subtotalCents} onChange={onSaleDiscount} />
          {priced.saleDiscountCents > 0 && (
            <p className={`flex justify-between text-sm text-emerald-700 ${POS.num}`}>
              <span>Desconto na venda</span>
              <span>−{formatEuros(priced.saleDiscountCents)}</span>
            </p>
          )}
          <p className={`flex justify-between text-xs ${POS.mutedText} ${POS.num}`}>
            <span>IVA incluído {priced.vat.map((v) => `${v.rate} %`).join(" · ")}</span>
            <span>{formatEuros(priced.vat.reduce((s, v) => s + v.vatCents, 0))}</span>
          </p>
        </div>
      )}
    </div>
  );
}
