import { Banknote, CreditCard, Delete, Smartphone } from "lucide-react";
import { PAYMENT_LABELS, formatEuros, type PaymentMethod } from "../../domain/entities/pos.ts";
import { keypadPress, quickCashAmounts, type PaymentState } from "../../domain/services/cart.service.ts";
import { POS, TOUCH } from "./pos-theme.ts";

const METHOD_ICON = { card: CreditCard, cash: Banknote, mbway: Smartphone } as const;
const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0", "back"];

/** Métodos (botões grandes ou segmentados), dinheiro com valores rápidos, teclado e troco, e cliente opcional. */
export function PaymentPanel({ totalCents, value, onChange, compact = false }: { totalCents: number; value: PaymentState; onChange: (v: PaymentState) => void; compact?: boolean }) {
  const change = value.givenCents - totalCents;
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Método de pagamento" className={compact ? `flex overflow-hidden rounded-xl border ${POS.border}` : "grid grid-cols-3 gap-3"}>
        {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => {
          const Icon = METHOD_ICON[m];
          const on = value.method === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ ...value, method: m, givenCents: m === "cash" ? value.givenCents : 0 })}
              className={
                compact
                  ? `flex h-12 flex-1 items-center justify-center gap-2 text-sm font-semibold ${on ? POS.accent : POS.card}`
                  : `${TOUCH} flex h-20 flex-col items-center justify-center gap-1 border ${POS.border} ${on ? `${POS.accent} ${POS.primaryRing}` : POS.card}`
              }
            >
              <Icon aria-hidden className={compact ? "h-4 w-4" : "h-7 w-7"} />
              {PAYMENT_LABELS[m]}
            </button>
          );
        })}
      </div>

      {value.method === "cash" && (
        <div className="space-y-3">
          <div className={`${POS.muted} flex items-center justify-between rounded-xl px-4 py-3`}>
            <span className={`text-sm ${POS.mutedText}`}>Entregue</span>
            <span className={`text-2xl font-semibold ${POS.num}`} aria-live="polite">
              {formatEuros(value.givenCents)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {quickCashAmounts(totalCents).map((c) => (
              <button key={c} type="button" onClick={() => onChange({ ...value, givenCents: c })} className={`h-11 rounded-xl border ${POS.border} ${POS.card} text-sm font-semibold ${POS.num}`}>
                {formatEuros(c)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                aria-label={k === "back" ? "Apagar dígito" : k}
                onClick={() => onChange({ ...value, givenCents: keypadPress(value.givenCents, k) })}
                className={`${POS.key} flex ${compact ? "h-11" : "h-14"} items-center justify-center rounded-xl text-xl font-semibold ${POS.num}`}
              >
                {k === "back" ? <Delete aria-hidden className="h-5 w-5" /> : k}
              </button>
            ))}
          </div>
          <p className={`flex items-center justify-between rounded-xl px-4 py-3 text-2xl font-bold ${POS.num} ${change >= 0 ? POS.green : POS.red}`} aria-live="polite">
            <span className="text-base font-semibold">{change >= 0 ? "Troco a dar" : "Em falta"}</span>
            <span>{formatEuros(Math.abs(change))}</span>
          </p>
        </div>
      )}

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className={`mb-1 text-sm ${POS.mutedText}`}>Cliente (opcional — sem dados sai «Consumidor final»)</legend>
        <input
          aria-label="NIF do cliente"
          inputMode="numeric"
          maxLength={9}
          placeholder="NIF"
          value={value.customer.taxId}
          onChange={(e) => onChange({ ...value, customer: { ...value.customer, taxId: e.target.value.replace(/\D/g, "") } })}
          className={`h-11 rounded-xl border ${POS.border} ${POS.card} px-3 ${POS.num}`}
        />
        <input
          aria-label="Nome do cliente"
          placeholder="Nome"
          value={value.customer.name}
          onChange={(e) => onChange({ ...value, customer: { ...value.customer, name: e.target.value } })}
          className={`h-11 rounded-xl border ${POS.border} ${POS.card} px-3`}
        />
      </fieldset>
    </div>
  );
}
