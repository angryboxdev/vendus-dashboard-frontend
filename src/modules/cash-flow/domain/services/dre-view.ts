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

/** Taxas dos parâmetros que só servem para reconstituir as plataformas pelo banco (sem extratos). */
export const DELIVERY_RATE_KEYS: ReadonlySet<string> = new Set(["deliverySalesVatPct", "platformCommissionPct", "platformCommissionVatPct", "marketingVatPct"]);

export interface DeliveryParametersUse {
  /** Plataformas do mês com extratos importados: marketing e taxas vêm dos extratos (os parâmetros não contam). */
  fromStatements: { platform: string; marketingNetCents: number }[];
  /** Texto sobre as taxas de delivery; null quando não há extratos no mês (as taxas aplicam-se a todas). */
  ratesNote: string | null;
}

/** O que os parâmetros de delivery ainda decidem no mês, pela origem de cada plataforma na DRE. */
export function deliveryParametersUse(report: DreReport | null): DeliveryParametersUse {
  const platforms = report?.revenue.byPlatform ?? [];
  const fromStatements = platforms.filter((p) => p.source === "statements").map((p) => ({ platform: p.platform, marketingNetCents: p.marketingNetCents }));
  if (fromStatements.length === 0) return { fromStatements, ratesNote: null };
  const names = (list: { platform: string }[]) => list.map((p) => platformLabel(p.platform)).join(", ");
  const byBank = platforms.filter((p) => p.source === "bank");
  return {
    fromStatements,
    ratesNote:
      byBank.length === 0
        ? `Todas as plataformas deste mês têm extratos importados (${names(fromStatements)}): estas taxas não são usadas.`
        : `Usadas só em ${names(byBank)} (sem extratos). ${names(fromStatements)}: pelos extratos importados.`,
  };
}
