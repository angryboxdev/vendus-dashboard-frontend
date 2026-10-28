import type { DeliveryPlatformKey, DreParameters } from "../entities/dre.ts";
import type { CardSettlement } from "../entities/sales-reconciliation.ts";

export const SETTLEMENT_STATUS: Record<CardSettlement["status"], { label: string; tone: "success" | "warning" | "neutral" }> = {
  ok: { label: "Taxa OK", tone: "success" },
  check: { label: "Verificar", tone: "warning" },
  no_sales: { label: "Sem vendas", tone: "neutral" },
};

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Dias de venda cobertos por um crédito: «12/09» ou «12/09 – 14/09». */
export function salesRangeLabel(from: string, to: string): string {
  return from === to ? dm(from) : `${dm(from)} – ${dm(to)}`;
}

/** «1,2%» (1 casa, vírgula); null → «—». */
export function pctLabel(pct: number | null): string {
  return pct === null ? "—" : `${pct.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// ─── Formulário dos parâmetros da DRE ─────────────────────────────────────────

export const PCT_FIELDS = [
  { key: "deliverySalesVatPct", label: "IVA médio das vendas de delivery", hint: "Comida 13% + bebida 23% → ≈ 15%" },
  { key: "platformCommissionPct", label: "Comissão das plataformas", hint: "Sobre a venda" },
  { key: "platformCommissionVatPct", label: "IVA da comissão", hint: "Cobrado pela plataforma" },
  { key: "marketingVatPct", label: "IVA do marketing", hint: "Cobrado pela plataforma" },
  { key: "cardFeePct", label: "Taxa do TPA", hint: "0% se o banco cobra a comissão à parte (débito mensal); usada na DRE e na conferência de vendas" },
  { key: "expenseDefaultVatPct", label: "IVA teórico dos gastos", hint: "Gastos com categoria sem faturas (ex.: serviços)" },
] as const;

export type PctFieldKey = (typeof PCT_FIELDS)[number]["key"];

/** Valores do formulário como texto (o que o utilizador escreve). */
export interface DreParametersForm {
  pct: Record<PctFieldKey, string>;
  commissionOnGross: boolean;
  marketing: Record<DeliveryPlatformKey, string>;
  /** Despesa de empréstimos do mês (DE), em euros. */
  loanExpense: string;
  /** Renda variável: limite (€) e % sobre o excedente. */
  rentThreshold: string;
  rentVariablePct: string;
}

const num = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 2, useGrouping: false });

export function toForm(p: DreParameters): DreParametersForm {
  return {
    pct: Object.fromEntries(PCT_FIELDS.map((f) => [f.key, num(p[f.key])])) as Record<PctFieldKey, string>,
    commissionOnGross: p.commissionOnGross,
    marketing: {
      uber_eats: num(p.marketingNetCents.uber_eats / 100),
      glovo: num(p.marketingNetCents.glovo / 100),
      bolt_food: num(p.marketingNetCents.bolt_food / 100),
    },
    loanExpense: num((p.loanExpenseCents ?? 0) / 100),
    rentThreshold: num((p.rentThresholdCents ?? 0) / 100),
    rentVariablePct: num(p.rentVariablePct ?? 0),
  };
}

/** Percentagem escrita («15», «12,5») → número 0–100; inválida → null. */
export function parsePct(input: string): number | null {
  const s = input.replace(/\s|%/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n <= 100 ? n : null;
}

/**
 * Formulário → parâmetros a gravar, ou a lista dos campos inválidos. `parseEuro` vem de fora (o
 * leitor de euros do extrato) para este serviço não depender de outro módulo.
 */
export function fromForm(
  form: DreParametersForm,
  parseEuro: (s: string) => number | null,
): { ok: true; value: DreParameters } | { ok: false; invalid: string[] } {
  const invalid: string[] = [];
  const pct = {} as Record<PctFieldKey, number>;
  for (const f of PCT_FIELDS) {
    const v = parsePct(form.pct[f.key]);
    if (v === null) invalid.push(f.key);
    else pct[f.key] = v;
  }
  const marketing = {} as Record<DeliveryPlatformKey, number>;
  for (const k of ["uber_eats", "glovo", "bolt_food"] as const) {
    const v = form.marketing[k].trim() === "" ? 0 : parseEuro(form.marketing[k]);
    if (v === null) invalid.push(`marketing.${k}`);
    else marketing[k] = v;
  }
  const loanExpense = form.loanExpense.trim() === "" ? 0 : parseEuro(form.loanExpense);
  if (loanExpense === null) invalid.push("loanExpense");
  const rentThreshold = form.rentThreshold.trim() === "" ? 0 : parseEuro(form.rentThreshold);
  if (rentThreshold === null) invalid.push("rentThreshold");
  const rentVariablePct = form.rentVariablePct.trim() === "" ? 0 : parsePct(form.rentVariablePct);
  if (rentVariablePct === null) invalid.push("rentVariablePct");
  if (invalid.length === 0 && (pct.platformCommissionPct / 100) * (1 + pct.platformCommissionVatPct / 100) >= 1) invalid.push("platformCommissionPct");
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true, value: { ...pct, commissionOnGross: form.commissionOnGross, marketingNetCents: marketing, loanExpenseCents: loanExpense ?? 0, rentThresholdCents: rentThreshold ?? 0, rentVariablePct: rentVariablePct ?? 0 } };
}
