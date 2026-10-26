// Formatação e estilos partilhados pelas Fichas técnicas (V7).
export const eur = (v: number) => v.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Custos pequenos com 4 casas (0,0234 €), para nunca mostrar «0,00 €» num valor que existe. */
export const eurCost = (v: number) => v.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) < 0.1 && v !== 0 ? 4 : 2 });
export const pct = (r: number) => `${(r * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
export const qty = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
/** Aceita «12,5» e «12.5»; vazio ou inválido = null. */
export const parseNum = (s: string): number | null => {
  const n = Number(s.trim().replace(",", "."));
  return s.trim() !== "" && Number.isFinite(n) ? n : null;
};

export type Tone = "ok" | "warn" | "bad" | "neutral";

export const inputCls = "rounded-md border border-line bg-surface-card px-2 py-1 text-sm text-ink";
export const btnCls = "rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-soft disabled:opacity-50";
export const primaryBtnCls = "rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50";

