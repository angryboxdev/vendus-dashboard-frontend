export function formatEUR(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-PT").format(value || 0);
}

export function formatPct(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

export function normalizeText(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/** Formata valor monetário na moeda indicada (ISO 4217). Fallback EUR. */
export function formatMoney(value: number, currencyCode = "EUR") {
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return formatEUR(value);
  }
}

/**
 * Data civil `YYYY-MM-DD` ou prefixo ISO → **dd/mm/aaaa** (ex.: API HR, filtros).
 * Para ISO com hora, usa a data no fuso local.
 */
export function formatIsoDatePt(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === "") return "—";
  const s = String(iso).trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) {
    const [, y, mo, d] = ymd;
    return `${d}/${mo}/${y}`;
  }
  try {
    const d = new Date(s.includes("T") ? s : `${s}T12:00:00`);
    if (Number.isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return s;
  }
}

export function formatIsoDateRangePt(from: string, to: string): string {
  return `${formatIsoDatePt(from)} → ${formatIsoDatePt(to)}`;
}

/** Alias histórico: datas de fatura / movimento em dd/mm/aaaa. */
export function formatInvoiceDate(isoDate: string | null | undefined): string {
  return formatIsoDatePt(isoDate);
}
