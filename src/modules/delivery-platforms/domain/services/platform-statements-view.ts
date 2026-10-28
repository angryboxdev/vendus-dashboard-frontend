import type { DeliveryPlatform, PlatformStatementSummary } from "../entities/platform-statement.ts";

/** Limite do backend por envio. */
export const MAX_UPLOAD_FILES = 20;
const ACCEPTED = /\.(pdf|csv)$/i;

export const PLATFORM_LABELS: Record<DeliveryPlatform, string> = {
  uber_eats: "Uber Eats",
  glovo: "Glovo",
  bolt_food: "Bolt Food",
};

/** Motivo para não enviar a seleção, ou null se estiver bem. */
export function validatePlatformFiles(names: string[]): string | null {
  if (names.length === 0) return "Escolha pelo menos um ficheiro.";
  if (names.length > MAX_UPLOAD_FILES) return `No máximo ${MAX_UPLOAD_FILES} ficheiros de cada vez.`;
  const wrong = names.filter((n) => !ACCEPTED.test(n));
  if (wrong.length > 0) return `Só PDF ou CSV: ${wrong.join(", ")}.`;
  return null;
}

/** «01/09 – 15/09» a partir de datas ISO. */
export function periodLabel(from: string, to: string): string {
  const d = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return from === to ? d(from) : `${d(from)} – ${d(to)}`;
}

/** O período do extrato sai do mês escolhido (ex.: quinzena da Glovo que atravessa o mês). */
export function crossesMonth(s: Pick<PlatformStatementSummary, "periodFrom" | "periodTo">, year: number, month: number): boolean {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  return s.periodFrom.slice(0, 7) !== ym || s.periodTo.slice(0, 7) !== ym;
}

export interface PlatformTotals {
  platform: DeliveryPlatform;
  statements: number;
  ordersCount: number;
  salesCents: number;
  /** Promoções + comissões + marketing + outras taxas + reembolsos (com IVA). */
  platformCostsCents: number;
  netPayoutCents: number;
}

/** Custos de um extrato que ficam com a plataforma (com IVA). */
export const platformCostsCents = (s: PlatformStatementSummary) =>
  s.promotionsCents + s.commissionCents + s.marketingCents + s.otherFeesCents + s.refundsCents;

/** Totais por plataforma, pela ordem Uber, Glovo, Bolt; só as que têm extratos. */
export function totalsByPlatform(statements: PlatformStatementSummary[]): PlatformTotals[] {
  const order = Object.keys(PLATFORM_LABELS) as DeliveryPlatform[];
  return order
    .map((platform) => {
      const own = statements.filter((s) => s.platform === platform);
      return {
        platform,
        statements: own.length,
        ordersCount: own.reduce((a, s) => a + (s.ordersCount ?? 0), 0),
        salesCents: own.reduce((a, s) => a + s.salesCents, 0),
        platformCostsCents: own.reduce((a, s) => a + platformCostsCents(s), 0),
        netPayoutCents: own.reduce((a, s) => a + s.netPayoutCents, 0),
      };
    })
    .filter((t) => t.statements > 0);
}
