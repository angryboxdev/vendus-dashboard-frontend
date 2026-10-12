/** "+4h02m49s" / "-2h59m24s" — precisão ao segundo, como no ledger observado. */
export function formatBank(seconds: number): string {
  const sign = seconds < 0 ? "-" : "+";
  const a = Math.abs(seconds);
  return `${sign}${Math.floor(a / 3600)}h${String(Math.floor((a % 3600) / 60)).padStart(2, "0")}m${String(a % 60).padStart(2, "0")}s`;
}

/** "HH:MM" → segundos; null se inválido. */
export function parseHhMm(text: string): number | null {
  const m = /^(\d{1,4}):([0-5]\d)$/.exec(text.trim());
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
}

/** Segundos → "HH:MM" (truncado ao minuto), para o campo de compensação. */
export function toHhMm(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
}

/** RE-28 no ecrã: o valor pedido é limitado ao máximo disponível. */
export function clampCompensation(requested: number, available: number, beyondAllowed: boolean): number {
  return beyondAllowed ? requested : Math.min(requested, Math.max(0, available));
}
