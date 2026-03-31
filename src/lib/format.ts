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

export function formatInvoiceDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
    return new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "medium",
    }).format(d);
  } catch {
    return isoDate;
  }
}
