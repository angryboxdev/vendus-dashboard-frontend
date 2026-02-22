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
