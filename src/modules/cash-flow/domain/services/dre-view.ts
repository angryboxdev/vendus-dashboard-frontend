import type { DreReport } from "../entities/dre.ts";

const PLATFORM_LABELS: Record<string, string> = { uber_eats: "Uber Eats", glovo: "Glovo", bolt_food: "Bolt Food" };

export const platformLabel = (platform: string) => PLATFORM_LABELS[platform] ?? platform;

/** Parte dos gastos que já está certa (com categoria e com IVA conhecido), em % inteiro; null sem gastos. */
export function dreConfidencePct(report: DreReport): number | null {
  const { totalNetCents, pendingVatCents, unclassifiedCents } = report.expenses;
  if (totalNetCents <= 0) return null;
  // Uma saída sem categoria também não tem IVA conhecido: não contar duas vezes.
  const uncertain = Math.min(totalNetCents, Math.max(pendingVatCents, unclassifiedCents));
  return Math.floor(((totalNetCents - uncertain) / totalNetCents) * 100);
}
